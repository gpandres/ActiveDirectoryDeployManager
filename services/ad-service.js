const { execFile } = require('child_process');

// Sanitize user input before interpolating into PowerShell commands.
// Uses allowlist approach: only alphanumeric, spaces, hyphens, underscores,
// dots, commas, equals, @, and AD DN characters (OU=, DC=, CN=, etc.)
function sanitizePSInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^a-zA-Z0-9\s\-_.,=@OUouDCdcCNcn]/g, '').trim();
}

// Sanitize a Windows/UNC file path for embedding inside a PowerShell single-quoted
// string. Keeps backslashes, forward slashes, colons (drive letters), spaces, and
// all normal path characters. Only removes characters that could break out of a PS
// single-quoted string or inject commands: backtick, $, ;, |, &, {, }, <, >, ", NUL.
// Single quotes are doubled (PS escaping), which is safe inside '...' strings.
function sanitizePSPath(str) {
  if (typeof str !== 'string') return '';
  // Remove PS/shell injection characters; keep everything else a path can contain
  return str.replace(/[`$;|&{}<>"\0]/g, '').replace(/'/g, "''").trim();
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
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

// Sanitize an AD Distinguished Name for embedding in a PS single-quoted string.
// In PS '...' only the single quote itself needs escaping (doubled).
// We also strip backtick, $, ;, |, &, {, }, <, >, NUL which could break PS even
// in single-quoted context if the shell pre-processes the command.
function sanitizeDN(dn) {
  if (typeof dn !== 'string') return '';
  return dn.replace(/[`$;|&{}<>\0]/g, '').replace(/'/g, "''").trim();
}

function toPSSingleQuotedArray(values) {
  return '@(' + values.map(v => `'${sanitizeDN(v)}'`).join(',') + ')';
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    const ps = execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
      { maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve(stdout.trim());
      }
    );
    ps.stdin.write(command);
    ps.stdin.end();
  });
}

// Returns a PS snippet that resolves $adServer to the preferred DC (or PDC emulator).
// Insert once at the top of every PS block that touches AD/GPO.
function dcSnippet(preferredDC) {
  const safe = preferredDC ? preferredDC.replace(/'/g, "''").replace(/[^a-zA-Z0-9.\-_]/g, '') : '';
  if (safe) {
    return `$adServer = '${safe}'`;
  }
  // Fall back to PDC emulator — safest choice for writes in multi-DC environments
  return `$adServer = (Get-ADDomain).PDCEmulator`;
}

function buildGPOName(displayName, shareId) {
  return shareId ? `ADDM_${shareId}_${displayName}` : displayName;
}

function stripGPOPrefix(fullName, shareId) {
  if (shareId && fullName.startsWith(`ADDM_${shareId}_`)) {
    return fullName.slice(`ADDM_${shareId}_`.length);
  }
  return fullName;
}

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
      return {
        available: false,
        message: `Error al comprobar RSAT: ${err.message}`
      };
    }
  },

  async getOUs(ignoreBaseOU = false) {
    try {
      const config = require('./config').getConfig();
      const baseOUs = !ignoreBaseOU ? normalizeDNArray(config.baseOUs || config.baseOU) : [];
      let ous = [];

      if (baseOUs.length === 0) {
        const json = await runPowerShell(
          `Import-Module ActiveDirectory; ${dcSnippet(config.preferredDC)}; Get-ADOrganizationalUnit -Filter * -Server $adServer -Properties Name,DistinguishedName,Description | Select-Object Name,DistinguishedName,Description | ConvertTo-Json -Depth 5`
        );
        try {
          ous = JSON.parse(json || '[]');
        } catch (e) {
          console.error('Error parsing OUs JSON:', e.message);
        }
      } else {
        const map = new Map();
        for (const baseOU of baseOUs) {
          const sanitized = sanitizePSInput(baseOU).replace(/'/g, "''");
          const json = await runPowerShell(
            `Import-Module ActiveDirectory; ${dcSnippet(config.preferredDC)}; Get-ADOrganizationalUnit -Filter * -SearchBase '${sanitized}' -Server $adServer -Properties Name,DistinguishedName,Description | Select-Object Name,DistinguishedName,Description | ConvertTo-Json -Depth 5`
          );
          let subset = [];
          try {
            subset = JSON.parse(json || '[]');
          } catch (e) {
            console.error('Error parsing scoped OUs JSON:', e.message);
          }
          const subsetArray = Array.isArray(subset) ? subset : [subset];
          for (const ou of subsetArray) {
            if (ou?.DistinguishedName) map.set(ou.DistinguishedName, ou);
          }
        }
        ous = Array.from(map.values());
      }
      const ouArray = Array.isArray(ous) ? ous : [ous];
      return { success: true, data: buildOUTree(ouArray) };
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
      let gpos = [];
      try {
        gpos = JSON.parse(json || '[]');
      } catch (e) {
        console.error('Error parsing GPOs JSON:', e.message);
      }
      return { success: true, data: Array.isArray(gpos) ? gpos : [gpos] };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  async linkGPOtoOU(gpoName, ouDN) {
    try {
      const config = require('./config').getConfig();
      const safeGpo = sanitizePSInput(gpoName).replace(/'/g, "''");
      const safeOU = sanitizeDN(ouDN);
      await runPowerShell(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; New-GPLink -Name '${safeGpo}' -Target '${safeOU}' -Server $adServer -LinkEnabled Yes -ErrorAction Stop`
      );
      return { success: true };
    } catch (err) {
      if (err.message.includes('already linked')) {
        try {
          const config = require('./config').getConfig();
          const safeGpo = sanitizePSInput(gpoName).replace(/'/g, "''");
          const safeOU = sanitizeDN(ouDN);
          await runPowerShell(
            `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; Set-GPLink -Name '${safeGpo}' -Target '${safeOU}' -Server $adServer -LinkEnabled Yes -ErrorAction Stop`
          );
          return { success: true, message: 'GPO ya estaba vinculada y se ha reactivado el enlace' };
        } catch (setErr) {
          return { success: false, error: setErr.message };
        }
      }
      return { success: false, error: err.message };
    }
  },

  async bulkLinkGPO(gpoName, ouDNs) {
    const results = [];
    for (const ouDN of ouDNs) {
      const result = await this.linkGPOtoOU(gpoName, ouDN);
      results.push({ ouDN, ...result });
    }
    return results;
  },

  async createGPO(gpoName, scriptPath, ouDN) {
    try {
      const config = require('./config').getConfig();
      const safeGpoName = sanitizePSInput(gpoName).replace(/'/g, "''");
      const safeScriptPath = sanitizePSPath(scriptPath);
      const normalizedOUs = normalizeDNArray(ouDN);
      const ouTargetsArray = toPSSingleQuotedArray(normalizedOUs);

      const ps = `
        $ErrorActionPreference = 'Stop'
        try {
            Import-Module ActiveDirectory
            Import-Module GroupPolicy
            ${dcSnippet(config.preferredDC)}
            $gpoName = '${safeGpoName}'
            $scriptLocalPath = '${safeScriptPath}'
            $ouTargets = ${ouTargetsArray}

            $gpo = Get-GPO -Name $gpoName -Server $adServer -ErrorAction SilentlyContinue
            if (-not $gpo) { $gpo = New-GPO -Name $gpoName -Server $adServer }
            $gpoGuid = "{" + $gpo.Id.ToString() + "}"
            $domainObj = Get-ADDomain -Server $adServer
            if (-not $domainObj) { throw "No se pudo obtener el Dominio de Active Directory (Get-ADDomain vacío)." }
            $domain = $domainObj.DNSRoot

            $machineScriptsPath = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\Startup"
            if (-not (Test-Path $machineScriptsPath)) { New-Item -ItemType Directory -Path $machineScriptsPath -Force | Out-Null }

            $scriptsIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\scripts.ini"
            $iniLines = @("[Startup]", "0CmdLine=powershell.exe", "0Parameters=-ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$scriptLocalPath\`"")
            Set-Content -Path $scriptsIni -Value $iniLines -Encoding Unicode -Force

            $gptIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\gpt.ini"
            if (Test-Path $gptIni) {
                $gptLines = Get-Content $gptIni
                $newGptLines = @()
                foreach ($line in $gptLines) {
                    if ($line -match "^Version=(.*)") {
                        $ver = [int]$matches[1] + 1
                        $newGptLines += "Version=$ver"
                    } else {
                        $newGptLines += $line
                    }
                }
                Set-Content -Path $gptIni -Value $newGptLines -Encoding ASCII -Force
            }

            try {
                $adPath = "CN=$gpoGuid,CN=Policies,CN=System,$($domainObj.DistinguishedName)"
                $gpoAdObj = Get-ADObject -Identity $adPath -Server $adServer -Properties gPCMachineExtensionNames
                $ext = $gpoAdObj.gPCMachineExtensionNames
                $scriptExt = "[{42B5FAAE-6536-11D2-AE5A-0000F87571E3}{40B6664F-4972-11D1-A7CA-0000F87571E3}]"
                if ($null -eq $ext -or $ext -notmatch "42B5FAAE") {
                    $newExt = "$ext$scriptExt"
                    Set-ADObject -Identity $adPath -Server $adServer -Replace @{gPCMachineExtensionNames=$newExt}
                }
            } catch {
                Write-Warning "AVISO: No se pudo habilitar el atributo gPCMachineExtensionNames en AD. $_"
            }

            foreach ($ouDN in $ouTargets) {
                if ($ouDN) {
                    try {
                        New-GPLink -Name $gpoName -Target $ouDN -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
                    } catch {
                        $linkError = $_.Exception.Message
                        if ($linkError -match 'already linked to a Scope of Management') {
                            Set-GPLink -Name $gpoName -Target $ouDN -Server $adServer -LinkEnabled Yes -ErrorAction Stop | Out-Null
                        } else {
                            throw
                        }
                    }
                }
            }
        } catch {
            Write-Error $_.Exception.Message
            exit 1
        }
      `;
      await runPowerShell(ps);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async deleteGPO(gpoName) {
    try {
      const config = require('./config').getConfig();
      const ps = `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; Remove-GPO -Name '${sanitizePSInput(gpoName).replace(/'/g, "''")}' -Server $adServer -ErrorAction Stop`;
      await runPowerShell(ps);
      return { success: true };
    } catch (err) {
      if (err.message.includes('not found')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  },

  async checkGPOExists(gpoName) {
    try {
      const config = require('./config').getConfig();
      const safe = sanitizePSInput(gpoName).replace(/'/g, "''");
      const result = await runPowerShell(
        `Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; $g = Get-GPO -Name '${safe}' -Server $adServer -ErrorAction SilentlyContinue; if ($g) { Write-Output 'EXISTS' } else { Write-Output 'NOT_FOUND' }`
      );
      return { exists: result.trim() === 'EXISTS' };
    } catch {
      return { exists: false };
    }
  },

  async unlinkGPOfromOU(gpoName, ouDN) {
    try {
      const config = require('./config').getConfig();
      const safeGpoName = sanitizePSInput(gpoName).replace(/'/g, "''");
      const safeOuDN = sanitizeDN(ouDN);
      await runPowerShell(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)}; Remove-GPLink -Name '${safeGpoName}' -Target '${safeOuDN}' -Server $adServer -ErrorAction Stop`
      );
      return { success: true };
    } catch (err) {
      // If the link doesn't exist, treat as success
      if (err.message.includes('is not linked') || err.message.includes('not found') || err.message.includes('cannot find')) {
        return { success: true, message: 'GPO no estaba vinculada a esa OU' };
      }
      return { success: false, error: err.message };
    }
  },

  async removeGPOStartupScript(gpoName) {
    try {
      const config = require('./config').getConfig();
      const safeGpoName = sanitizePSInput(gpoName).replace(/'/g, "''");
      const ps = `
        $ErrorActionPreference = 'Stop'
        Import-Module ActiveDirectory
        Import-Module GroupPolicy
        ${dcSnippet(config.preferredDC)}
        $gpo = Get-GPO -Name '${safeGpoName}' -Server $adServer -ErrorAction Stop
        $gpoGuid = "{" + $gpo.Id.ToString() + "}"
        $domainObj = Get-ADDomain -Server $adServer
        $domain = $domainObj.DNSRoot

        # Remove scripts.ini (the startup script registration)
        $scriptsIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\scripts.ini"
        if (Test-Path $scriptsIni) { Remove-Item $scriptsIni -Force }

        # Remove Startup folder contents
        $startupDir = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\Startup"
        if (Test-Path $startupDir) { Remove-Item "$startupDir\\*" -Recurse -Force -ErrorAction SilentlyContinue }

        # Bump GPT.ini version so clients pick up the change
        $gptIni = "\\\\$adServer\\sysvol\\$domain\\Policies\\$gpoGuid\\gpt.ini"
        if (Test-Path $gptIni) {
            $gptLines = Get-Content $gptIni
            $newGptLines = @()
            foreach ($line in $gptLines) {
                if ($line -match "^Version=(.*)") {
                    $ver = [int]$matches[1] + 1
                    $newGptLines += "Version=$ver"
                } else {
                    $newGptLines += $line
                }
            }
            Set-Content -Path $gptIni -Value $newGptLines -Encoding ASCII -Force
        }

        # Remove gPCMachineExtensionNames script extension from AD object
        try {
            $adPath = "CN=$gpoGuid,CN=Policies,CN=System,$($domainObj.DistinguishedName)"
            $gpoAdObj = Get-ADObject -Identity $adPath -Server $adServer -Properties gPCMachineExtensionNames
            $ext = $gpoAdObj.gPCMachineExtensionNames
            if ($ext) {
                $scriptExt = "[{42B5FAAE-6536-11D2-AE5A-0000F87571E3}{40B6664F-4972-11D1-A7CA-0000F87571E3}]"
                $newExt = $ext -replace [regex]::Escape($scriptExt), ""
                if ([string]::IsNullOrWhiteSpace($newExt)) {
                    Set-ADObject -Identity $adPath -Server $adServer -Clear gPCMachineExtensionNames
                } else {
                    Set-ADObject -Identity $adPath -Server $adServer -Replace @{gPCMachineExtensionNames=$newExt}
                }
            }
        } catch {}

        Write-Output "OK"
      `;
      await runPowerShell(ps);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getGPOLinkCounts() {
    try {
      const config = require('./config').getConfig();
      const json = await runPowerShell(
        `Import-Module ActiveDirectory; Import-Module GroupPolicy; ${dcSnippet(config.preferredDC)};
$ous = Get-ADOrganizationalUnit -Filter * -Properties gPLink -Server $adServer
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
      const parsed = JSON.parse(json || '{}');
      return { success: true, data: parsed };
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
      let links = [];
      try {
        links = JSON.parse(json || '[]');
      } catch (e) {
        console.error('Error parsing GPO conflicts JSON:', e.message);
      }
      return { success: true, data: Array.isArray(links) ? links : [links] };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  }
};

function buildOUTree(ous) {
  const map = {};
  const roots = [];

  ous.forEach(ou => {
    if (!ou.DistinguishedName) return;
    map[ou.DistinguishedName] = {
      name: ou.Name || 'Unknown',
      dn: ou.DistinguishedName,
      description: ou.Description || '',
      children: [],
      expanded: false
    };
  });

  ous.forEach(ou => {
    if (!ou.DistinguishedName) return;
    const parentDN = ou.DistinguishedName.replace(/^OU=[^,]+,/, '');
    if (map[parentDN]) {
      map[parentDN].children.push(map[ou.DistinguishedName]);
    } else {
      roots.push(map[ou.DistinguishedName]);
    }
  });

  return roots;
}

module.exports = { ...adService, buildGPOName, stripGPOPrefix };
