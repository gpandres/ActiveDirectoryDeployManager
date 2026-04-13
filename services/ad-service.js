const { execFile } = require('child_process');
const path = require('path');

// Sanitize user input before interpolating into PowerShell commands.
// Allows alphanumerics, spaces, hyphens, underscores, dots, commas, equals,
// and the characters required for AD Distinguished Names (OU=, DC=, etc.)
function sanitizePSInput(str) {
  if (typeof str !== 'string') return '';
  // Remove backticks, semicolons, pipe, ampersand, dollar, curly braces,
  // parentheses, and other PS meta-characters that enable injection
  return str.replace(/[`$;|&{}()\[\]@#!%^<>"\\]/g, '').trim();
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
      let searchBaseStr = '';
      if (!ignoreBaseOU && config.baseOU) {
        const sanitized = sanitizePSInput(config.baseOU).replace(/'/g, "''");
        searchBaseStr = `-SearchBase '${sanitized}'`;
      }
      const json = await runPowerShell(
        `Import-Module ActiveDirectory; Get-ADOrganizationalUnit -Filter * ${searchBaseStr} -Properties Name,DistinguishedName,Description | Select-Object Name,DistinguishedName,Description | ConvertTo-Json -Depth 5`
      );
      const ous = JSON.parse(json || '[]');
      const ouArray = Array.isArray(ous) ? ous : [ous];
      return { success: true, data: buildOUTree(ouArray) };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  async getGPOs() {
    try {
      const json = await runPowerShell(
        "Import-Module GroupPolicy; Get-GPO -All | Select-Object DisplayName,Id,GpoStatus,CreationTime,ModificationTime | ConvertTo-Json -Depth 3"
      );
      const gpos = JSON.parse(json || '[]');
      return { success: true, data: Array.isArray(gpos) ? gpos : [gpos] };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  },

  async linkGPOtoOU(gpoName, ouDN) {
    try {
      const safeGpo = sanitizePSInput(gpoName).replace(/'/g, "''");
      const safeOU = sanitizePSInput(ouDN).replace(/'/g, "''");
      await runPowerShell(
        `Import-Module GroupPolicy; New-GPLink -Name '${safeGpo}' -Target '${safeOU}' -LinkEnabled Yes -ErrorAction Stop`
      );
      return { success: true };
    } catch (err) {
      if (err.message.includes('already linked')) {
        return { success: true, message: 'GPO ya estaba vinculada' };
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
      const safeGpoName = sanitizePSInput(gpoName).replace(/'/g, "''");
      const safeScriptPath = sanitizePSInput(scriptPath).replace(/'/g, "''");
      const safeOuDN = ouDN ? sanitizePSInput(ouDN).replace(/'/g, "''") : '';
      
      const ps = `
        $ErrorActionPreference = 'Stop'
        try {
            Import-Module ActiveDirectory
            Import-Module GroupPolicy
            $gpoName = '${safeGpoName}'
            $scriptLocalPath = '${safeScriptPath}'
            $ouDN = '${safeOuDN}'

            $gpo = Get-GPO -Name $gpoName -ErrorAction SilentlyContinue
            if (-not $gpo) { $gpo = New-GPO -Name $gpoName }
            $gpoGuid = "{" + $gpo.Id.ToString() + "}"
            $domainObj = Get-ADDomain
            if (-not $domainObj) { throw "No se pudo obtener el Dominio de Active Directory (Get-ADDomain vacío)." }
            $domain = $domainObj.DNSRoot

            $machineScriptsPath = "\\\\$domain\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\Startup"
            if (-not (Test-Path $machineScriptsPath)) { New-Item -ItemType Directory -Path $machineScriptsPath -Force | Out-Null }

            $scriptsIni = "\\\\$domain\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\scripts.ini"
            $iniLines = @("[Startup]", "0CmdLine=powershell.exe", "0Parameters=-ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$scriptLocalPath\`"")
            Set-Content -Path $scriptsIni -Value $iniLines -Encoding Unicode -Force

            $gptIni = "\\\\$domain\\sysvol\\$domain\\Policies\\$gpoGuid\\gpt.ini"
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
                $gpoAdObj = Get-ADObject -Identity $adPath -Properties gPCMachineExtensionNames
                $ext = $gpoAdObj.gPCMachineExtensionNames
                $scriptExt = "[{42B5FAAE-6536-11D2-AE5A-0000F87571E3}{40B6664F-4972-11D1-A7CA-0000F87571E3}]"
                if ($null -eq $ext -or $ext -notmatch "42B5FAAE") {
                    $newExt = "$ext$scriptExt"
                    Set-ADObject -Identity $adPath -Replace @{gPCMachineExtensionNames=$newExt}
                }
            } catch {
                Write-Warning "AVISO: No se pudo habilitar el atributo gPCMachineExtensionNames en AD. $_"
            }

            if ($ouDN) {
                New-GPLink -Name $gpoName -Target $ouDN -LinkEnabled Yes -ErrorAction Stop | Out-Null
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
      const ps = `Import-Module GroupPolicy; Remove-GPO -Name '${sanitizePSInput(gpoName).replace(/'/g, "''")}' -ErrorAction Stop`;
      await runPowerShell(ps);
      return { success: true };
    } catch (err) {
      if (err.message.includes('not found')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  },

  async unlinkGPOfromOU(gpoName, ouDN) {
    try {
      const safeGpoName = sanitizePSInput(gpoName).replace(/'/g, "''");
      const safeOuDN = sanitizePSInput(ouDN).replace(/'/g, "''");
      await runPowerShell(
        `Import-Module GroupPolicy; Remove-GPLink -Name '${safeGpoName}' -Target '${safeOuDN}' -ErrorAction Stop`
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
      const safeGpoName = sanitizePSInput(gpoName).replace(/'/g, "''");
      const ps = `
        $ErrorActionPreference = 'Stop'
        Import-Module ActiveDirectory
        Import-Module GroupPolicy
        $gpo = Get-GPO -Name '${safeGpoName}' -ErrorAction Stop
        $gpoGuid = "{" + $gpo.Id.ToString() + "}"
        $domain = (Get-ADDomain).DNSRoot

        # Remove scripts.ini (the startup script registration)
        $scriptsIni = "\\\\$domain\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\scripts.ini"
        if (Test-Path $scriptsIni) { Remove-Item $scriptsIni -Force }

        # Remove Startup folder contents
        $startupDir = "\\\\$domain\\sysvol\\$domain\\Policies\\$gpoGuid\\Machine\\Scripts\\Startup"
        if (Test-Path $startupDir) { Remove-Item "$startupDir\\*" -Recurse -Force -ErrorAction SilentlyContinue }

        # Bump GPT.ini version so clients pick up the change
        $gptIni = "\\\\$domain\\sysvol\\$domain\\Policies\\$gpoGuid\\gpt.ini"
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
            $domainObj = Get-ADDomain
            $adPath = "CN=$gpoGuid,CN=Policies,CN=System,$($domainObj.DistinguishedName)"
            $gpoAdObj = Get-ADObject -Identity $adPath -Properties gPCMachineExtensionNames
            $ext = $gpoAdObj.gPCMachineExtensionNames
            if ($ext) {
                $scriptExt = "[{42B5FAAE-6536-11D2-AE5A-0000F87571E3}{40B6664F-4972-11D1-A7CA-0000F87571E3}]"
                $newExt = $ext -replace [regex]::Escape($scriptExt), ""
                if ([string]::IsNullOrWhiteSpace($newExt)) {
                    Set-ADObject -Identity $adPath -Clear gPCMachineExtensionNames
                } else {
                    Set-ADObject -Identity $adPath -Replace @{gPCMachineExtensionNames=$newExt}
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

  async checkGPOConflicts(ouDN) {
    try {
      const safeOuDN = sanitizePSInput(ouDN).replace(/'/g, "''");
      const json = await runPowerShell(
        `Import-Module GroupPolicy; (Get-GPInheritance -Target '${safeOuDN}').GpoLinks | Select-Object DisplayName,Enabled,Order | ConvertTo-Json -Depth 2`
      );
      const links = JSON.parse(json || '[]');
      return { success: true, data: Array.isArray(links) ? links : [links] };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  }
};

function buildOUTree(ous) {
  const map = {};
  const roots = [];

  // Get domain root DN
  let domainDN = '';
  if (ous.length > 0) {
    const firstDN = ous[0].DistinguishedName;
    const dcParts = firstDN.split(',').filter(p => p.startsWith('DC='));
    domainDN = dcParts.join(',');
  }

  ous.forEach(ou => {
    map[ou.DistinguishedName] = {
      name: ou.Name,
      dn: ou.DistinguishedName,
      description: ou.Description || '',
      children: [],
      expanded: false
    };
  });

  ous.forEach(ou => {
    const parentDN = ou.DistinguishedName.replace(/^OU=[^,]+,/, '');
    if (map[parentDN]) {
      map[parentDN].children.push(map[ou.DistinguishedName]);
    } else {
      roots.push(map[ou.DistinguishedName]);
    }
  });

  return roots;
}

module.exports = adService;
