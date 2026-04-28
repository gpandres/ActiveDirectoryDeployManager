const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Input sanitization helpers ──────────────────────────────────────────────

// Sanitize user input before interpolating into PowerShell single-quoted strings.
// Allowlist: alphanumeric, whitespace, and characters legitimately used in AD
// object names (DN components, email-style UPNs, hyphenated names).
function sanitizePSInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^a-zA-Z0-9\s\-_.,=@]/g, '').trim();
}

// Sanitize an AD Distinguished Name for embedding in a PS single-quoted string.
// Inside '...' only the single quote itself needs escaping (doubled).
// Backslash is a legitimate DN escape character, so we keep it.
function sanitizeDN(dn) {
  if (typeof dn !== 'string') return '';
  return dn.replace(/[`$;|&{}<>\0]/g, '').replace(/'/g, "''").trim();
}

function normalizeDNArray(value) {
  const raw = Array.isArray(value)
    ? value
    : (typeof value === 'string' && value.trim() ? [value.trim()] : []);
  const seen = new Set();
  return raw
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeStringArray(value) {
  const raw = Array.isArray(value)
    ? value
    : (typeof value === 'string' && value.trim() ? [value.trim()] : []);
  const seen = new Set();
  return raw
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function toPSSingleQuotedArray(values) {
  if (!values.length) return '@()';
  return '@(' + values.map(v => `'${sanitizeDN(v)}'`).join(',') + ')';
}

// ─── scriptPath validation: block remote/out-of-scope paths ──────────────────

// Returns a normalized absolute path or throws. Rejects any path not residing
// under one of the configured trusted roots (networkSharePath, logDirectory).
function validateScriptPath(scriptPath, config) {
  if (typeof scriptPath !== 'string' || !scriptPath.trim()) {
    throw new Error('scriptPath requerido');
  }
  const raw = scriptPath.trim();

  // Reject control characters and obvious PS/shell metacharacters outright.
  // A legitimate Windows/UNC path never contains these.
  if (/[`$;|&{}<>"\0\r\n]/.test(raw)) {
    throw new Error('scriptPath contiene caracteres no permitidos');
  }

  // Must have a .ps1, .bat, .cmd or .exe extension — not arbitrary file types.
  if (!/\.(ps1|bat|cmd|exe)$/i.test(raw)) {
    throw new Error('scriptPath debe apuntar a un script ejecutable (.ps1/.bat/.cmd/.exe)');
  }

  // Normalize to strip any trailing separator. path.resolve preserves (or adds)
  // a trailing separator for UNC roots like "\\\\server\\share", which would
  // break the prefix-with-sep check below.
  const stripTrailingSep = p => p.replace(/[\\/]+$/, '');

  const roots = [config.networkSharePath, config.logDirectory]
    .filter(r => typeof r === 'string' && r.trim())
    .map(r => stripTrailingSep(path.resolve(r)).toLowerCase());

  if (roots.length === 0) {
    throw new Error('No hay rutas confiables configuradas (networkSharePath/logDirectory)');
  }

  const resolved = stripTrailingSep(path.resolve(raw)).toLowerCase();

  // Strict prefix match with separator to avoid "C:\shareevil" matching "C:\share".
  const isUnder = roots.some(root => {
    return resolved === root || resolved.startsWith(root + path.sep);
  });

  if (!isUnder) {
    throw new Error('scriptPath está fuera de las rutas confiables permitidas');
  }

  return raw;
}

// ─── PowerShell execution ────────────────────────────────────────────────────

const DEFAULT_PS_TIMEOUT_MS = 120000; // 2 min per command

// Run a PowerShell command via a temporary .ps1 file. Script is written
// as UTF-8 with BOM so PowerShell parses non-ASCII characters correctly,
// and the file is deleted as soon as the process exits.
function runPowerShell(command, { timeoutMs = DEFAULT_PS_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const prelude =
      "$ErrorActionPreference='Stop'\r\n" +
      "$OutputEncoding=[System.Text.Encoding]::UTF8\r\n" +
      "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8\r\n";
    const scriptPath = path.join(
      os.tmpdir(),
      `addeploy-ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`
    );
    // UTF-8 BOM ensures PowerShell 5.1 reads accents/Unicode correctly.
    const buf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(prelude + command, 'utf8')]);
    try { fs.writeFileSync(scriptPath, buf, { mode: 0o600 }); }
    catch (e) { return reject(e); }

    let killed = false;
    const cleanup = () => { try { fs.unlinkSync(scriptPath); } catch { /* ignore */ } };

    const child = execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { maxBuffer: 1024 * 1024 * 50, windowsHide: true },
      (error, stdout, stderr) => {
        cleanup();
        if (killed) return reject(new Error(`PowerShell timeout tras ${timeoutMs}ms`));
        if (error) return reject(new Error(stderr || error.message));
        resolve(stdout.trim());
      }
    );
    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
    }, timeoutMs);
    child.on('exit', () => clearTimeout(timer));
  });
}

// ─── JSON helpers ────────────────────────────────────────────────────────────

function parseJsonArray(raw, { where = 'JSON' } = {}) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return [];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error(`Error parsing ${where}:`, e.message);
    return [];
  }
}

function parseJsonObject(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (_) {
    return {};
  }
}

// ─── DC/domain resolution ────────────────────────────────────────────────────

// Returns a PS snippet that resolves $adServer to the preferred DC (or PDC emulator).
// Fails fast if neither is resolvable — avoids cascading null-reference errors.
function dcSnippet(preferredDC) {
  const safe = preferredDC ? preferredDC.replace(/[^a-zA-Z0-9.\-_]/g, '') : '';
  if (safe) {
    return `$adServer = '${safe}'`;
  }
  return `
    try { $adServer = (Get-ADDomain -ErrorAction Stop).PDCEmulator }
    catch { throw "No se pudo resolver un controlador de dominio (Get-ADDomain falló)." }
    if (-not $adServer) { throw "PDC emulator no disponible." }
  `.trim();
}

// ─── GPO naming ──────────────────────────────────────────────────────────────

function buildGPOName(displayName, shareId) {
  return shareId ? `ADDM_${shareId}_${displayName}` : displayName;
}

function stripGPOPrefix(fullName, shareId) {
  if (typeof fullName !== 'string') return '';
  if (shareId && fullName.startsWith(`ADDM_${shareId}_`)) {
    return fullName.slice(`ADDM_${shareId}_`.length);
  }
  return fullName;
}

// ─── Per-name mutex for mutating ops on the same GPO ─────────────────────────

const gpoLocks = new Map();
async function withGPOLock(gpoName, fn) {
  const key = typeof gpoName === 'string' ? gpoName : '';
  const prev = gpoLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise(res => { release = res; });
  const combined = prev.then(() => next);
  gpoLocks.set(key, combined);
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (gpoLocks.get(key) === combined) gpoLocks.delete(key);
  }
}

// ─── Typed-error PS wrapper ──────────────────────────────────────────────────

// Wraps a PS body so it always emits a single JSON object of the form
// { ok: bool, code?: string, data?: any, error?: string }. Consumers can then
// match on `code` instead of locale-specific English error substrings.
function wrapJsonResult(body) {
  return `
    try {
${body}
    } catch {
      $code = 'ERROR'
      $msg = $_.Exception.Message
      $fq = $_.FullyQualifiedErrorId
      if ($msg -match 'already linked|ya est.* vinculad|already exists|ya existe') { $code = 'ALREADY_EXISTS' }
      elseif ($msg -match 'not found|no se encuentra|no se encontr|cannot find|no se puede encontrar') { $code = 'NOT_FOUND' }
      elseif ($msg -match 'is not linked|no est.* vinculad') { $code = 'NOT_LINKED' }
      elseif ($fq) {
        if ($fq -match 'ObjectNotFound') { $code = 'NOT_FOUND' }
        elseif ($fq -match 'ResourceExists|AlreadyExists') { $code = 'ALREADY_EXISTS' }
      }
      @{ ok = $false; code = $code; error = $msg } | ConvertTo-Json -Compress -Depth 5
    }
  `;
}

function isMissingGPOLinkError(message) {
  if (typeof message !== 'string') return false;
  return /is not linked|not linked|no est.*vinculad|no hay ning[uú]n gpo.*vinculad|there is no gpo.*linked/i.test(message);
}

function normalizeUnlinkResult(result) {
  if (result?.ok) return { success: true };
  if (result?.code === 'NOT_LINKED' || result?.code === 'NOT_FOUND' || isMissingGPOLinkError(result?.error)) {
    return { success: true, message: 'GPO no estaba vinculada a esa OU' };
  }
  return { success: false, error: result?.error || 'Error desconocido' };
}

async function runPSJson(command) {
  const raw = await runPowerShell(wrapJsonResult(command));
  return parseJsonObject(raw);
}

// ─── AD service ──────────────────────────────────────────────────────────────

const adService = {
  async checkRSAT() {
    try {
      const result = await runPowerShell(
        "if ((Get-Module -ListAvailable -Name ActiveDirectory) -and (Get-Module -ListAvailable -Name GroupPolicy)) { Write-Output 'OK' } elseif (Get-Module -ListAvailable -Name ActiveDirectory) { Write-Output 'MISSING_GPMC' } else { Write-Output 'MISSING' }"
      );
      if (result === 'OK') {
        return { available: true, message: 'Módulo ActiveDirectory y GroupPolicy disponibles' };
      }
      if (result === 'MISSING_GPMC') {
        return {
          available: true,
          missingGPMC: true,
          message: 'Falta RSAT Group Policy. GPOs deshabilitadas. Instala: Add-WindowsCapability -Online -Name Rsat.GroupPolicy.Management.Tools~~~~0.0.1.0'
        };
      }
      return {
        available: false,
        message: 'RSAT no está instalado. Instala: Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0'
      };
    } catch (err) {
      return { available: false, message: `Error al comprobar RSAT: ${err.message}` };
    }
  },

  async getOUs(ignoreBaseOU = false) {
    try {
      const config = require('./config').getConfig();
      const baseOUs = !ignoreBaseOU ? normalizeDNArray(config.baseOUs || config.baseOU) : [];

      let ous = [];
      if (baseOUs.length === 0) {
        const json = await runPowerShell(
          `Import-Module ActiveDirectory; ${dcSnippet(config.preferredDC)}; Get-ADOrganizationalUnit -Filter * -Server $adServer -Properties Name,DistinguishedName,Description -ResultPageSize 1000 | Select-Object Name,DistinguishedName,Description | ConvertTo-Json -Depth 5`
        );
        ous = parseJsonArray(json, { where: 'OUs JSON' });
      } else {
        // Single PS process iterates all base OUs — avoids N process spawns.
        const arrayLiteral = toPSSingleQuotedArray(baseOUs);
        const script = `
          Import-Module ActiveDirectory
          ${dcSnippet(config.preferredDC)}
          $bases = ${arrayLiteral}
          $all = New-Object System.Collections.Generic.List[object]
          $seen = @{}
          foreach ($b in $bases) {
            try {
              $items = Get-ADOrganizationalUnit -Filter * -SearchBase $b -Server $adServer -Properties Name,DistinguishedName,Description -ResultPageSize 1000
              foreach ($o in $items) {
                if (-not $seen.ContainsKey($o.DistinguishedName)) {
                  $seen[$o.DistinguishedName] = $true
                  $all.Add([pscustomobject]@{ Name = $o.Name; DistinguishedName = $o.DistinguishedName; Description = $o.Description })
                }
              }
            } catch { Write-Warning "Base OU inválida: $b - $($_.Exception.Message)" }
          }
          $all | ConvertTo-Json -Depth 5
        `;
        const json = await runPowerShell(script);
        ous = parseJsonArray(json, { where: 'scoped OUs JSON' });
      }
      return { success: true, data: buildOUTree(ous) };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  async getGPOs() {
    try {
      const config = require('./config').getConfig();
      const json = await runPowerShell(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; Get-GPO -All -Server $adServer | Select-Object DisplayName,Id,GpoStatus,CreationTime,ModificationTime | ConvertTo-Json -Depth 3`
      );
      return { success: true, data: parseJsonArray(json, { where: 'GPOs JSON' }) };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  async linkGPOtoOU(gpoName, ouDN) {
    const config = require('./config').getConfig();
    const safeGpo = sanitizePSInput(gpoName).replace(/'/g, "''");
    const safeOU = sanitizeDN(ouDN);
    const script = `
      Import-Module ActiveDirectory
      Import-Module GroupPolicy
      ${dcSnippet(config.preferredDC)}
      try {
        New-GPLink -Name '${safeGpo}' -Target '${safeOU}' -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
        @{ ok = $true } | ConvertTo-Json -Compress
      } catch {
        if ($_.Exception.Message -match 'already linked|ya est.* vinculad') {
          Set-GPLink -Name '${safeGpo}' -Target '${safeOU}' -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
          @{ ok = $true; code = 'REACTIVATED' } | ConvertTo-Json -Compress
        } else { throw }
      }
    `;
    const result = await runPSJson(script);
    if (result.ok) {
      return result.code === 'REACTIVATED'
        ? { success: true, message: 'GPO ya estaba vinculada y se ha reactivado el enlace' }
        : { success: true };
    }
    return { success: false, error: result.error || 'Error desconocido' };
  },

  async bulkLinkGPO(gpoName, ouDNs) {
    const normalized = normalizeDNArray(ouDNs);
    if (!normalized.length) return [];

    const config = require('./config').getConfig();
    const safeGpo = sanitizePSInput(gpoName).replace(/'/g, "''");
    const arrayLiteral = toPSSingleQuotedArray(normalized);
    const script = `
      Import-Module ActiveDirectory
      Import-Module GroupPolicy
      ${dcSnippet(config.preferredDC)}
      $targets = ${arrayLiteral}
      $results = @()
      foreach ($ou in $targets) {
        try {
          New-GPLink -Name '${safeGpo}' -Target $ou -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
          $results += [pscustomobject]@{ ouDN = $ou; ok = $true }
        } catch {
          if ($_.Exception.Message -match 'already linked|ya est.* vinculad') {
            try {
              Set-GPLink -Name '${safeGpo}' -Target $ou -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
              $results += [pscustomobject]@{ ouDN = $ou; ok = $true; code = 'REACTIVATED' }
            } catch {
              $results += [pscustomobject]@{ ouDN = $ou; ok = $false; error = $_.Exception.Message }
            }
          } else {
            $results += [pscustomobject]@{ ouDN = $ou; ok = $false; error = $_.Exception.Message }
          }
        }
      }
      $results | ConvertTo-Json -Depth 3 -Compress
    `;
    try {
      const json = await runPowerShell(script);
      const arr = parseJsonArray(json, { where: 'bulkLink JSON' });
      return arr.map(r => ({
        ouDN: r.ouDN,
        success: !!r.ok,
        ...(r.code ? { message: 'GPO ya estaba vinculada y se ha reactivado el enlace' } : {}),
        ...(r.error ? { error: r.error } : {})
      }));
    } catch (err) {
      return normalized.map(ou => ({ ouDN: ou, success: false, error: err.message }));
    }
  },

  async createGPO(gpoName, scriptPath, ouDN) {
    const config = require('./config').getConfig();

    // Validate scriptPath against allowed roots BEFORE anything else — this is
    // the primary defense against an attacker pointing a GPO at an arbitrary
    // UNC/local path and achieving SYSTEM-level RCE across the domain.
    let validatedPath;
    try {
      validatedPath = validateScriptPath(scriptPath, config);
    } catch (e) {
      return { success: false, error: e.message, code: 'INVALID_SCRIPT_PATH' };
    }

    const safeGpoName = sanitizePSInput(gpoName).replace(/'/g, "''");
    const safeScriptPath = validatedPath.replace(/[`$;|&{}<>"\0]/g, '').replace(/'/g, "''");
    const normalizedOUs = normalizeDNArray(ouDN);
    const ouTargetsArray = toPSSingleQuotedArray(normalizedOUs);

    return withGPOLock(gpoName, async () => {
      const ps = `
        Import-Module ActiveDirectory
        Import-Module GroupPolicy
        ${dcSnippet(config.preferredDC)}

        $gpoName = '${safeGpoName}'
        $scriptLocalPath = '${safeScriptPath}'
        $ouTargets = ${ouTargetsArray}
        $createdNew = $false

        $gpo = Get-GPO -Name $gpoName -Server $adServer -ErrorAction SilentlyContinue
        if (-not $gpo) {
          $gpo = New-GPO -Name $gpoName -Server $adServer -ErrorAction Stop
          $createdNew = $true
        }
        $gpoGuid = "{" + $gpo.Id.ToString() + "}"
        $domainObj = Get-ADDomain -Server $adServer -ErrorAction Stop
        if (-not $domainObj) { throw "No se pudo obtener el Dominio de Active Directory." }
        $domain = $domainObj.DNSRoot

        try {
          $machineScriptsPath = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\Startup"
          if (-not (Test-Path $machineScriptsPath)) {
            New-Item -ItemType Directory -Path $machineScriptsPath -Force | Out-Null
          }

          $scriptsIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\scripts.ini"
          $iniLines = @("[Startup]", "0CmdLine=powershell.exe", "0Parameters=-ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$scriptLocalPath\`"")
          Set-Content -Path $scriptsIni -Value $iniLines -Encoding Unicode -Force

          # Bump gpt.ini Version. The value encodes (UserVer << 16) | MachineVer.
          # Our changes affect Machine only — increment the low word, preserve high.
          $gptIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\gpt.ini"
          $newVersionValue = $null
          if (Test-Path $gptIni) {
            $gptLines = Get-Content $gptIni
            $newGptLines = @()
            foreach ($line in $gptLines) {
              if ($line -match "^Version=(.*)") {
                $current = [uint32]$matches[1]
                $user = ($current -shr 16) -band 0xFFFF
                $machine = ($current -band 0xFFFF) + 1
                if ($machine -gt 0xFFFF) { $machine = 1; $user = ($user + 1) -band 0xFFFF }
                $newVersionValue = ($user -shl 16) -bor $machine
                $newGptLines += "Version=$newVersionValue"
              } else {
                $newGptLines += $line
              }
            }
            Set-Content -Path $gptIni -Value $newGptLines -Encoding ASCII -Force
          }

          # Register the Scripts CSE so clients actually execute startup scripts.
          # If this fails we roll back the GPO we just created — a GPO without
          # gPCMachineExtensionNames silently does nothing on clients.
          $adPath = "CN=$gpoGuid,CN=Policies,CN=System,$($domainObj.DistinguishedName)"
          $gpoAdObj = Get-ADObject -Identity $adPath -Server $adServer -Properties gPCMachineExtensionNames,versionNumber -ErrorAction Stop
          $ext = $gpoAdObj.gPCMachineExtensionNames
          $scriptExt = "[{42B5FAAE-6536-11D2-AE5A-0000F87571E3}{40B6664F-4972-11D1-A7CA-0000F87571E3}]"
          if ($null -eq $ext -or $ext -notmatch "42B5FAAE") {
            $newExt = "$ext$scriptExt"
            Set-ADObject -Identity $adPath -Server $adServer -Replace @{gPCMachineExtensionNames=$newExt} -ErrorAction Stop
          }

          # Also bump versionNumber on the AD object so the domain-side copy
          # matches SYSVOL and clients refresh the policy.
          if ($newVersionValue -ne $null) {
            Set-ADObject -Identity $adPath -Server $adServer -Replace @{versionNumber=[int]$newVersionValue} -ErrorAction Stop
          }

          # Link to each requested OU — aggregate results instead of bailing on first failure.
          $linkResults = @()
          foreach ($ouDN in $ouTargets) {
            if (-not $ouDN) { continue }
            try {
              New-GPLink -Name $gpoName -Target $ouDN -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
              $linkResults += [pscustomobject]@{ ouDN = $ouDN; ok = $true }
            } catch {
              if ($_.Exception.Message -match 'already linked|ya est.* vinculad|Scope of Management') {
                try {
                  Set-GPLink -Name $gpoName -Target $ouDN -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
                  $linkResults += [pscustomobject]@{ ouDN = $ouDN; ok = $true; code = 'REACTIVATED' }
                } catch {
                  $linkResults += [pscustomobject]@{ ouDN = $ouDN; ok = $false; error = $_.Exception.Message }
                }
              } else {
                $linkResults += [pscustomobject]@{ ouDN = $ouDN; ok = $false; error = $_.Exception.Message }
              }
            }
          }

          @{ ok = $true; gpoId = $gpo.Id.ToString(); createdNew = $createdNew; linkResults = $linkResults } | ConvertTo-Json -Depth 5 -Compress
        } catch {
          # Rollback only if WE created the GPO in this call — never delete a pre-existing one.
          if ($createdNew) {
            try { Remove-GPO -Name $gpoName -Server $adServer -ErrorAction SilentlyContinue | Out-Null } catch {}
          }
          throw
        }
      `;
      const result = await runPSJson(ps);
      if (result.ok) {
        const linkResults = Array.isArray(result.linkResults) ? result.linkResults : [];
        const failed = linkResults.filter(r => !r.ok);
        return {
          success: true,
          gpoId: result.gpoId,
          createdNew: !!result.createdNew,
          linkResults: linkResults.map(r => ({
            ouDN: r.ouDN,
            success: !!r.ok,
            ...(r.error ? { error: r.error } : {})
          })),
          ...(failed.length ? { partial: true, failedLinks: failed.length } : {})
        };
      }
      return { success: false, error: result.error || 'Error desconocido', code: result.code };
    });
  },

  async deleteGPO(gpoName) {
    const config = require('./config').getConfig();
    const safe = sanitizePSInput(gpoName).replace(/'/g, "''");
    return withGPOLock(gpoName, async () => {
      const result = await runPSJson(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; Remove-GPO -Name '${safe}' -Server $adServer -ErrorAction Stop; @{ ok = $true } | ConvertTo-Json -Compress`
      );
      if (result.ok) return { success: true };
      if (result.code === 'NOT_FOUND') return { success: true };
      return { success: false, error: result.error || 'Error desconocido' };
    });
  },

  async checkGPOExists(gpoName) {
    try {
      const config = require('./config').getConfig();
      const safe = sanitizePSInput(gpoName).replace(/'/g, "''");
      const result = await runPSJson(
        `Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; $g = Get-GPO -Name '${safe}' -Server $adServer -ErrorAction SilentlyContinue; if ($g) { @{ ok = $true; exists = $true } | ConvertTo-Json -Compress } else { @{ ok = $true; exists = $false } | ConvertTo-Json -Compress }`
      );
      if (result.ok) return { exists: !!result.exists };
      // Transient failure: signal uncertainty so the caller doesn't assume "not found".
      return { exists: false, error: result.error || 'Error desconocido' };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  },

  async unlinkGPOfromOU(gpoName, ouDN) {
    const config = require('./config').getConfig();
    const safeGpo = sanitizePSInput(gpoName).replace(/'/g, "''");
    const safeOU = sanitizeDN(ouDN);
    const result = await runPSJson(
      `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; Remove-GPLink -Name '${safeGpo}' -Target '${safeOU}' -Server $adServer -ErrorAction Stop | Out-Null; @{ ok = $true } | ConvertTo-Json -Compress`
    );
    return normalizeUnlinkResult(result);
  },

  async removeGPOStartupScript(gpoName) {
    const config = require('./config').getConfig();
    const safeGpo = sanitizePSInput(gpoName).replace(/'/g, "''");
    return withGPOLock(gpoName, async () => {
      const ps = `
        Import-Module ActiveDirectory
        Import-Module GroupPolicy
        ${dcSnippet(config.preferredDC)}
        $gpo = Get-GPO -Name '${safeGpo}' -Server $adServer -ErrorAction Stop
        $gpoGuid = "{" + $gpo.Id.ToString() + "}"
        $domainObj = Get-ADDomain -Server $adServer -ErrorAction Stop
        $domain = $domainObj.DNSRoot

        $scriptsIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\scripts.ini"
        if (Test-Path $scriptsIni) { Remove-Item $scriptsIni -Force }

        $startupDir = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\Startup"
        if (Test-Path $startupDir) { Remove-Item "$startupDir\\*" -Recurse -Force -ErrorAction SilentlyContinue }

        $gptIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\gpt.ini"
        $newVersionValue = $null
        if (Test-Path $gptIni) {
          $gptLines = Get-Content $gptIni
          $newGptLines = @()
          foreach ($line in $gptLines) {
            if ($line -match "^Version=(.*)") {
              $current = [uint32]$matches[1]
              $user = ($current -shr 16) -band 0xFFFF
              $machine = ($current -band 0xFFFF) + 1
              if ($machine -gt 0xFFFF) { $machine = 1; $user = ($user + 1) -band 0xFFFF }
              $newVersionValue = ($user -shl 16) -bor $machine
              $newGptLines += "Version=$newVersionValue"
            } else {
              $newGptLines += $line
            }
          }
          Set-Content -Path $gptIni -Value $newGptLines -Encoding ASCII -Force
        }

        $adPath = "CN=$gpoGuid,CN=Policies,CN=System,$($domainObj.DistinguishedName)"
        try {
          $gpoAdObj = Get-ADObject -Identity $adPath -Server $adServer -Properties gPCMachineExtensionNames -ErrorAction Stop
          $ext = $gpoAdObj.gPCMachineExtensionNames
          if ($ext) {
            $scriptExt = "[{42B5FAAE-6536-11D2-AE5A-0000F87571E3}{40B6664F-4972-11D1-A7CA-0000F87571E3}]"
            $newExt = $ext -replace [regex]::Escape($scriptExt), ""
            if ([string]::IsNullOrWhiteSpace($newExt)) {
              Set-ADObject -Identity $adPath -Server $adServer -Clear gPCMachineExtensionNames -ErrorAction Stop
            } else {
              Set-ADObject -Identity $adPath -Server $adServer -Replace @{gPCMachineExtensionNames=$newExt} -ErrorAction Stop
            }
          }
          if ($newVersionValue -ne $null) {
            Set-ADObject -Identity $adPath -Server $adServer -Replace @{versionNumber=[int]$newVersionValue} -ErrorAction Stop
          }
        } catch {
          Write-Warning "No se pudo actualizar atributos AD del GPO: $($_.Exception.Message)"
        }

        @{ ok = $true } | ConvertTo-Json -Compress
      `;
      const result = await runPSJson(ps);
      if (result.ok) return { success: true };
      return { success: false, error: result.error || 'Error desconocido' };
    });
  },

  async getGPOLinkCounts() {
    try {
      const config = require('./config').getConfig();
      const json = await runPowerShell(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)};
$ous = Get-ADOrganizationalUnit -Filter * -Properties gPLink -Server $adServer -ResultPageSize 1000
$map = @{}
foreach ($ou in $ous) {
  if ($ou.gPLink) {
    [regex]::Matches($ou.gPLink, '\\{([^}]+)\\}') | ForEach-Object {
      $g = $_.Groups[1].Value.ToLower()
      if ($map.ContainsKey($g)) { $map[$g]++ } else { $map[$g] = 1 }
    }
  }
}
$map | ConvertTo-Json -Compress`
      );
      return { success: true, data: parseJsonObject(json) };
    } catch (err) {
      return { success: false, error: err.message, data: {} };
    }
  },

  async getManagedGPOLinks(gpoNames, ouDNs = []) {
    try {
      const config = require('./config').getConfig();
      const managedGpoNames = normalizeStringArray(gpoNames);
      const targetOUs = normalizeDNArray(ouDNs);
      if (!managedGpoNames.length) {
        return { success: true, data: {} };
      }

      const gpoArrayLiteral = '@(' + managedGpoNames
        .map(name => `'${sanitizePSInput(name).replace(/'/g, "''")}'`)
        .join(',') + ')';
      const ouArrayLiteral = toPSSingleQuotedArray(targetOUs);
      const json = await runPowerShell(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)};
$targetNames = ${gpoArrayLiteral}
$targetLookup = @{}
foreach ($name in $targetNames) { $targetLookup[$name.ToLower()] = $true }
$gpoLookup = @{}
Get-GPO -All -Server $adServer -ErrorAction Stop | ForEach-Object {
  if ($targetLookup.ContainsKey($_.DisplayName.ToLower())) {
    $gpoLookup[$_.Id.ToString().ToLower()] = $_.DisplayName
  }
}
$ouTargets = ${ouArrayLiteral}
if ($ouTargets.Count -gt 0) {
  $ous = foreach ($ouDN in $ouTargets) {
    try {
      Get-ADOrganizationalUnit -Identity $ouDN -Server $adServer -Properties DistinguishedName,gPLink -ErrorAction Stop
    } catch {}
  }
} else {
  $ous = Get-ADOrganizationalUnit -Filter * -Server $adServer -Properties DistinguishedName,gPLink -ResultPageSize 1000
}
$result = @{}
foreach ($ou in $ous) {
  $matches = New-Object System.Collections.Generic.List[string]
  if ($ou.gPLink) {
    [regex]::Matches($ou.gPLink, '\\{([^}]+)\\}') | ForEach-Object {
      $guid = $_.Groups[1].Value.ToLower()
      if ($gpoLookup.ContainsKey($guid)) {
        $name = $gpoLookup[$guid]
        if (-not $matches.Contains($name)) { $matches.Add($name) }
      }
    }
  }
  if ($matches.Count -gt 0) {
    $result[$ou.DistinguishedName] = @($matches)
  }
}
$result | ConvertTo-Json -Depth 5 -Compress`
      );
      return { success: true, data: parseJsonObject(json) };
    } catch (err) {
      return { success: false, error: err.message, data: {} };
    }
  },

  async checkGPOConflicts(ouDN) {
    try {
      const config = require('./config').getConfig();
      const safeOuDN = sanitizeDN(ouDN);
      const json = await runPowerShell(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; (Get-GPInheritance -Target '${safeOuDN}' -Server $adServer).GpoLinks | Select-Object DisplayName,Enabled,Order | ConvertTo-Json -Depth 2`
      );
      return { success: true, data: parseJsonArray(json, { where: 'GPO conflicts JSON' }) };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  }
};

// ─── DN-aware OU tree builder ────────────────────────────────────────────────

// Split a DN into components respecting RFC 4514 backslash escapes.
// "OU=Acme\, Inc,OU=Parent,DC=x" → ["OU=Acme\\, Inc", "OU=Parent", "DC=x"]
function splitDN(dn) {
  const out = [];
  let buf = '';
  for (let i = 0; i < dn.length; i++) {
    const c = dn[i];
    if (c === '\\' && i + 1 < dn.length) {
      buf += c + dn[i + 1];
      i++;
    } else if (c === ',') {
      out.push(buf);
      buf = '';
    } else {
      buf += c;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function parentDN(dn) {
  const parts = splitDN(dn);
  if (parts.length <= 1) return '';
  return parts.slice(1).join(',');
}

function buildOUTree(ous) {
  const map = {};
  const roots = [];

  ous.forEach(ou => {
    if (!ou || !ou.DistinguishedName) return;
    map[ou.DistinguishedName] = {
      name: ou.Name || 'Unknown',
      dn: ou.DistinguishedName,
      description: ou.Description || '',
      children: [],
      expanded: false
    };
  });

  ous.forEach(ou => {
    if (!ou || !ou.DistinguishedName) return;
    const parent = parentDN(ou.DistinguishedName);
    if (parent && map[parent]) {
      map[parent].children.push(map[ou.DistinguishedName]);
    } else {
      roots.push(map[ou.DistinguishedName]);
    }
  });

  return roots;
}

module.exports = {
  ...adService,
  buildGPOName,
  stripGPOPrefix,
  __test__: {
    isMissingGPOLinkError,
    normalizeUnlinkResult
  }
};
