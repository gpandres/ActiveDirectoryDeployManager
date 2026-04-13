const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const configService = require('./config');
const i18nService = require('./i18n');

const TEMPLATES = {
  generic: { category: 'General', name: 'Generic (MSI/EXE)', description: 'Universal Drop & Run template for any installer', fields: [] },
  office: { category: 'General', name: 'Microsoft Office (XML)', description: 'Executes setup.exe with an existing XML file', fields: [{ key: 'configXml', label: 'Config XML Name', default: 'config_office.xml', hint: 'Must be placed in the same folder' }] },
  custom: { category: 'General', name: 'Custom Script', description: 'Write your own raw PowerShell code', fields: [{ key: 'customScript', label: 'PowerShell Code', type: 'textarea', default: '# Write your PowerShell code here\\n', hint: 'This code will not be wrapped. Use with caution.' }] },
  winget: { category: 'General', name: 'Winget Package', description: 'Installs from Windows Package Manager', fields: [], noInstaller: true },
  odt: { category: 'General', name: 'Microsoft Office (ODT)', description: 'Office 365/LTSC without manual download — generates XML automatically', fields: [], noInstaller: true },
  wazuh: { category: 'Security', name: 'Wazuh Agent', description: 'Wazuh SIEM/XDR agent deployment', fields: [{key:'manager', label:'WAZUH_MANAGER', default:'', hint:'Wazuh server IP or FQDN'}, {key:'group', label:'WAZUH_AGENT_GROUP', default:'default', hint:'Assignment group'}, {key:'password', label:'WAZUH_REGISTRATION_PASSWORD', default:'', hint:'Registration password (optional)'}] },
  sentinelone: { category: 'Security', name: 'SentinelOne', description: 'Deployment with SITE_TOKEN injection', fields: [{key:'siteToken', label:'SITE_TOKEN', default:'', hint:'SentinelOne tenant unique string'}] },
  cortexxdr: { category: 'Security', name: 'Cortex XDR', description: 'Cortex XDR Deployment (Palo Alto)', fields: [{key:'installDir', label:'Directory (Optional)', default:'', hint:'Leave empty for default directory'}] },
  bitdefender: { category: 'Security', name: 'Bitdefender BEST', description: 'Standard BEST deployment', fields: [] },
  crowdstrike: { category: 'Security', name: 'CrowdStrike Falcon', description: 'Installs EXE with CID injection', fields: [{ key: 'cid', label: 'Customer ID (CID)', default: '', hint: 'CrowdStrike Falcon CID' }] },
  zscaler: { category: 'Connectivity', name: 'Zscaler Client Connector', description: 'Zscaler ZCC deployment', fields: [{key:'cloudName', label:'CLOUDNAME', default:'zscaler', hint:'i.e: zscaler, zscalerone'}, {key:'userDomain', label:'USERDOMAIN', default:'', hint:'Company domain for SSO'}, {key:'strictEnforcement', label:'Strict Enforcement', type:'checkbox', default:true, hint:'Prevent user disabling'}] },
  globalprotect: { category: 'Connectivity', name: 'GlobalProtect', description: 'MSI installer with PORTAL injection', fields: [{key:'portal', label:'VPN Portal', default:'', hint:'Portal FQDN (i.e. vpn.company.com)'}] },
  ciscosecureclient: { category: 'Connectivity', name: 'Cisco Secure Client', description: 'Installs MSI and copies XML profiles', fields: [{key:'profileXml', label:'XML Profile', default:'profile.xml', hint:'XML must be next to the MSI'}] },
  forticlient: { category: 'Connectivity', name: 'FortiClient VPN', description: 'Installs MSI + configures VPN tunnel', fields: [ { key: 'vpnName', label: 'VPN Tunnel Name', default: '', hint: 'VPN Profile Name' }, { key: 'vpnDescription', label: 'Description', default: 'Corporate VPN', hint: '' }, { key: 'vpnServer', label: 'Server:Port', default: '', hint: 'i.e: 192.168.1.1:10443' }, { key: 'ssoEnabled', label: 'Enable Single Sign-On (SSO)', type: 'checkbox', default: true, hint: 'Use SAML/SSO for authentication' }, { key: 'serverCert', label: 'Validate CA Server', type: 'checkbox', default: false, hint: 'Unchecked (0) internally by default' }, { key: 'noWarnInvalidCert', label: 'Silence Invalid Cert Warning', type: 'checkbox', default: true, hint: 'Do not alert on self-signed certs' } ] },
  lansweeper: { category: 'RMM', name: 'Lansweeper (LsAgent)', description: 'Local inventory LsAgent', fields: [{key:'server', label:'SERVER', default:'', hint:'Lansweeper IP/FQDN (if local)'}, {key:'port', label:'PORT', default:'9524', hint:'Port'}, {key:'agentKey', label:'AGENTKEY (Cloud Relay)', default:'', hint:'For cloud synchronization'}] },
  ninjaone: { category: 'RMM', name: 'NinjaOne / Datto RMM', description: 'Generic RMM installation via token', fields: [{key:'token', label:'Token / Key', default:'', hint:'Organization token'}] },
  freshservice: { category: 'RMM', name: 'Freshservice Agent', description: 'Installs MSI with Registration Token injection', fields: [{ key: 'token', label: 'Registration Token', default: '', hint: 'Freshservice console Token' }] },
  teamviewer: { category: 'RMM', name: 'TeamViewer Host', description: 'MSI Host Deployment with APIToken', fields: [{key:'customId', label:'CUSTOMCONFIGID', default:'', hint:'Host config ID'}, {key:'apiToken', label:'APITOKEN', default:'', hint:'For account auto-assignment'}] },
  anydesk: { category: 'RMM', name: 'AnyDesk Custom Client', description: 'Generic AnyDesk MSI installation', fields: [] },
  veeam: { category: 'Backups', name: 'Veeam Agent', description: 'Deployment with server XML configuration', fields: [{key:'configXml', label:'Configuration XML', default:'veeam_config.xml', hint:'Extracted from your Veeam B&R server'}] },
  crashplan: { category: 'Backups', name: 'CrashPlan Enterprise', description: 'Endpoint backup deployment', fields: [{key:'url', label:'DEPLOYMENT_URL', default:'', hint:'Authority server URL'}, {key:'token', label:'DEPLOYMENT_TOKEN', default:'', hint:'Organization Token'}] },
  'sap-gui': { category: 'Corporate', name: 'SAP GUI', description: 'Installs EXE + copies configuration XML', fields: [ { key: 'sapTheme', label: 'SAP Theme', type: 'select', default: '256', hint: '', options: [ {value:'1', label:'SAP Signature (1)'}, {value:'128', label:'Blue Crystal (128)'}, {value:'256', label:'Belize (256)'}, {value:'2048', label:'Quartz (2048)'}, {value:'16384', label:'Quartz Dark (16384)'} ] } ] }
};

// ─── Generator map — adding a new template only requires one entry here ───
// (declared after all generateX functions are hoisted / defined)
let GENERATORS;
function getGenerators() {
  if (!GENERATORS) {
    GENERATORS = {
      generic:           generateGeneric,
      office:            generateOffice,
      custom:            generateCustom,
      winget:            generateWinget,
      odt:               generateODT,
      wazuh:             generateWazuh,
      sentinelone:       generateSentinelOne,
      cortexxdr:         generateCortexXDR,
      bitdefender:       generateBitdefender,
      crowdstrike:       generateCrowdstrike,
      zscaler:           generateZscaler,
      globalprotect:     generateGlobalProtect,
      ciscosecureclient: generateCiscoSecureClient,
      forticlient:       generateForticlient,
      lansweeper:        generateLansweeper,
      ninjaone:          generateNinjaOne,
      freshservice:      generateFreshservice,
      teamviewer:        generateTeamViewer,
      anydesk:           generateAnyDesk,
      veeam:             generateVeeam,
      crashplan:         generateCrashPlan,
      'sap-gui':         generateSapGui,
    };
  }
  return GENERATORS;
}

const scriptService = {
  getTemplateList() {
    const config = configService.getConfig();
    const dict = i18nService.getTranslations(config.language || 'en');
    
    return Object.entries(TEMPLATES).map(([key, val]) => {
      const tplDict = dict.templates?.[key] || {};
      
      const localizedFields = (val.fields || []).map(f => {
        const fieldDict = tplDict.fields?.[f.key] || {};
        return {
          ...f,
          label: fieldDict.label || f.label,
          hint: fieldDict.hint || f.hint
        };
      });

      return {
        id: key,
        category: tplDict.category || val.category || 'General',
        name: tplDict.name || val.name,
        description: tplDict.description || val.description,
        fields: localizedFields,
        noInstaller: val.noInstaller || false
      };
    });
  },

  generateScript(appConfig) {
    const generators = getGenerators();
    const fn = generators[appConfig.template] ?? generators.generic;
    return fn(appConfig);
  },

  async deployScript(appConfig) {
    try {
      // Sweep orphaned temp PS scripts before each deploy
      try { require('./app-service').cleanupTempFiles(); } catch (e) {}

      const config = configService.getConfig();
      const appFolder = path.join(config.networkSharePath, appConfig.name);

      if (!fs.existsSync(appFolder)) {
        await fs.promises.mkdir(appFolder, { recursive: true });
      }

      // winget and odt modes don't use local installer files — skip copy entirely
      const isNoInstaller = appConfig.template === 'winget' || appConfig.template === 'odt';

      // Cleanup existing binaries if new one provided
      let installerHash = '';
      if (!isNoInstaller && appConfig.installerPath && fs.existsSync(appConfig.installerPath)) {
        // If the source is already inside this app's share folder, don't
        // delete+copy (would delete the source first). Just rehash in place.
        const sourceResolved = path.resolve(appConfig.installerPath).toLowerCase();
        const folderResolved = path.resolve(appFolder).toLowerCase();
        const isAlreadyInFolder = sourceResolved.startsWith(folderResolved + path.sep);

        if (isAlreadyInFolder) {
          const buffer = await fs.promises.readFile(appConfig.installerPath);
          installerHash = crypto.createHash('sha256').update(buffer).digest('hex');
        } else {
          const files = await fs.promises.readdir(appFolder);
          for (const file of files) {
            if (file.toLowerCase().endsWith('.exe') || file.toLowerCase().endsWith('.msi')) {
              try { await fs.promises.unlink(path.join(appFolder, file)); } catch (e) {}
            }
          }
          const fileName = path.basename(appConfig.installerPath);
          await fs.promises.copyFile(appConfig.installerPath, path.join(appFolder, fileName));

          // Compute SHA256 hash of installer
          const buffer = await fs.promises.readFile(path.join(appFolder, fileName));
          installerHash = crypto.createHash('sha256').update(buffer).digest('hex');
        }
      } else if (!isNoInstaller) {
        // Compute hash of existing installer if any
        const files = await fs.promises.readdir(appFolder);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.exe') || file.toLowerCase().endsWith('.msi')) {
            const buffer = await fs.promises.readFile(path.join(appFolder, file));
            installerHash = crypto.createHash('sha256').update(buffer).digest('hex');
            break;
          }
        }
      }

      // Cleanup existing XML config if new one provided
      if (!isNoInstaller && appConfig.configXmlPath && fs.existsSync(appConfig.configXmlPath)) {
        const files = await fs.promises.readdir(appFolder);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.xml')) {
            try { await fs.promises.unlink(path.join(appFolder, file)); } catch (e) {}
          }
        }
        const fileName = path.basename(appConfig.configXmlPath);
        await fs.promises.copyFile(appConfig.configXmlPath, path.join(appFolder, fileName));
      }

      const scriptContent = this.generateScript(appConfig);
      const scriptPath = path.join(appFolder, 'install.ps1');
      await fs.promises.writeFile(scriptPath, scriptContent, 'utf-8');

      // Generate version.json manifest
      const manifest = {
        app: appConfig.name,
        version: appConfig.version || '1.0.0',
        hash: installerHash,
        notifyUser: appConfig.notifyUser || false,
        deployedAt: new Date().toISOString()
      };
      await fs.promises.writeFile(
        path.join(appFolder, 'version.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );

      return { success: true, path: scriptPath, hash: installerHash };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

const { getToastSnippet } = require('./ps-snippets');
function getNotificationLogic(_appName) {
  return getToastSnippet();
}

function getLocalCachingLogic(filter = "\\.(exe|msi)$", notifyUser = false, appDisplayName = '') {
  const config = configService.getConfig();
  const dict = i18nService.getTranslations(config.language || 'en');
  const ToastTitleProcess = dict.apps?.toastTitleProcess || "Installation in progress";
  const ToastMsgProcess = dict.apps?.toastMsgProcess || "Installing $NombreApp. Please do not turn off your computer.";

  const notifyPrefix = notifyUser ? getNotificationLogic(appDisplayName) : '';
  const notifyBefore = notifyUser
    ? `Send-UserToast -ToastTitle "${ToastTitleProcess}" -ToastMessage "${ToastMsgProcess}" -IconType "Warning"`
    : '';
  return `
# ── Logging ────────────────────────────────────────────────────────────
$LogDir = "C:\\ProgramData\\AppDeploy_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$NombreApp = (Get-Item $PSScriptRoot).Name
$LogFile   = "$LogDir\\Install_$($NombreApp)_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Start-Transcript -Path $LogFile -Force -ErrorAction SilentlyContinue

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ===== AppDeploy Manager ============================="
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] App     : $NombreApp"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Equipo  : $env:COMPUTERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Usuario : $env:USERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Fuente  : $PSScriptRoot"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ====================================================="

$TrackerFile = "$LogDir\\Tracker_$NombreApp.json"

# ── Leer manifiesto ─────────────────────────────────────────────────────
$VersionFile = Join-Path $PSScriptRoot "version.json"
if (-not (Test-Path $VersionFile)) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: No se encontró version.json en $PSScriptRoot"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 0
}
try {
    $Manifest       = Get-Content $VersionFile -Raw | ConvertFrom-Json
    $CurrentHash    = $Manifest.hash
    $CurrentVersion = $Manifest.version
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: version.json corrupto — $_"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Versión : $CurrentVersion | Hash: $CurrentHash"

# ── Comprobar si ya instalado ────────────────────────────────────────────
if (Test-Path $TrackerFile) {
    try {
        $t = Get-Content $TrackerFile -Raw | ConvertFrom-Json
        if ($t.hash -eq $CurrentHash) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Ya instalado (resultado anterior: $($t.result))"
            Stop-Transcript -ErrorAction SilentlyContinue
            exit 0
        }
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Hash anterior: $($t.hash) — actualizando a $CurrentHash"
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Tracker corrupto, reinstalando"
    }
}

# ── Localizar instalador en share ────────────────────────────────────────
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Buscando instalador en share..."
$InstaladorRed = Get-ChildItem -Path $PSScriptRoot -File -ErrorAction SilentlyContinue |
                 Where-Object { $_.Extension -match "${filter}" } |
                 Select-Object -First 1
if (-not $InstaladorRed) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: No se encontró instalador (${filter}) en $PSScriptRoot"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Instalador: $($InstaladorRed.Name) ($([Math]::Round($InstaladorRed.Length/1MB,1)) MB)"

# ── Copiar a caché local ─────────────────────────────────────────────────
$CacheDir = "C:\\Temp\\Deploy\\$NombreApp"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Copiando a caché: $CacheDir"
try {
    if (-not (Test-Path $CacheDir)) { New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null }
    Copy-Item -Path "$PSScriptRoot\\*" -Destination $CacheDir -Recurse -Force -ErrorAction Stop
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Copia completada."
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR copiando desde share: $_"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}

# ── Localizar instalador en caché ────────────────────────────────────────
$Instalador = Get-ChildItem -Path $CacheDir -File |
              Where-Object { $_.Extension -match "${filter}" } |
              Select-Object -First 1
if (-not $Instalador) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Instalador no encontrado en caché tras la copia"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Ejecutando instalación..."
# NOTA: $PSScriptRoot sigue apuntando al share (solo lectura). Usar $CacheDir para rutas locales.
${notifyPrefix}
${notifyBefore}
`;
}

function getTrackerSaveLogic(notifyUser = false) {
  const config = configService.getConfig();
  const dict = i18nService.getTranslations(config.language || 'en');
  const ToastTitleDone = dict.apps?.toastTitleDone || "Installation complete";
  const ToastMsgDone = dict.apps?.toastMsgDone || "$NombreApp has been installed successfully. You may continue.";

  const notifyAfter = notifyUser
    ? `    Send-UserToast -ToastTitle "${ToastTitleDone}" -ToastMessage "${ToastMsgDone}" -IconType "Information"`
    : '';
  // NOTE: this snippet closes the caller's `try {` block, adds catch + Stop-Transcript.
  // Templates must NOT have their own `} catch {}` after this interpolation.
  return `
    # ── Éxito ──────────────────────────────────────────────────────────
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $NombreApp instalado correctamente (v$CurrentVersion)"
${notifyAfter}
    @{ hash = $CurrentHash; version = $CurrentVersion; installedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'success' } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8

} catch {
    # ── Error ──────────────────────────────────────────────────────────
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Fallo instalando $NombreApp — $_"
    @{ hash = $CurrentHash; version = $CurrentVersion; failedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'failed'; error = $_.ToString() } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
}
Stop-Transcript -ErrorAction SilentlyContinue`;
}

function generateGeneric(cfg) {
  const silentArgs = cfg.silentArgs || cfg.customParams?.silentArgs || '/S';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# PLANTILLA GENÉRICA "DROP & RUN"
# App: ${cfg.name}
# Versión: ${cfg.version || '1.0.0'}
# Generado: ${new Date().toISOString()}
# =========================================================================
$ArgumentosExe = "${silentArgs}"

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic(undefined, notify, cfg.name)}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" " + $ArgumentosExe
        Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList $ArgumentosExe -Wait -NoNewWindow
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateFreshservice(cfg) {
  const token = cfg.customParams?.token || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# FRESHSERVICE AGENT - DROP & RUN
# App: ${cfg.name}
# Versión: ${cfg.version || '1.0.0'}
# Generado: ${new Date().toISOString()}
# =========================================================================
$Token = "${token}"

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" REGISTRATIONTOKEN=\`"$Token\`" /qn /norestart"
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateCrowdstrike(cfg) {
  const cid = cfg.customParams?.cid || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CROWDSTRIKE FALCON - DROP & RUN
# App: ${cfg.name}
# Versión: ${cfg.version || '1.0.0'}
# Generado: ${new Date().toISOString()}
# =========================================================================
$CID = "${cid}"

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$", notify, cfg.name)}
try {
    Start-Process -FilePath $Instalador.FullName -ArgumentList "/S /quiet /install CID=$CID" -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateSapGui(cfg) {
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# SAP GUI - DROP & RUN
# App: ${cfg.name}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$", notify, cfg.name)}
try {
    Start-Process -FilePath $Instalador.FullName -ArgumentList "/silent" -Wait -NoNewWindow

    $xmlSource = Join-Path -Path $CacheDir -ChildPath "SAPUILandscapeGlobal.xml"
    $xmlDestDir = "C:\\connectionsap"
    $xmlDestFile = "$xmlDestDir\\SAPUILandscapeGlobal.xml"

    if (-not (Test-Path $xmlDestDir)) { New-Item -Path $xmlDestDir -ItemType Directory -Force | Out-Null }
    if (Test-Path $xmlSource) {
        Copy-Item -Path $xmlSource -Destination $xmlDestFile -Force
        [Environment]::SetEnvironmentVariable("SAPLOGON_LSXML_FILE", $xmlDestFile, "Machine")

        if (!(Test-Path "HKLM:\\SOFTWARE\\SAP\\SAPLogon\\Options")) { New-Item "HKLM:\\SOFTWARE\\SAP\\SAPLogon\\Options" -Force | Out-Null }
        New-ItemProperty -Path "HKLM:\\SOFTWARE\\SAP\\SAPLogon\\Options" -Name "LandscapeFileOnServer" -Value $xmlDestFile -PropertyType String -Force | Out-Null

        if (!(Test-Path "HKLM:\\SOFTWARE\\WOW6432Node\\SAP\\SAPLogon\\Options")) { New-Item "HKLM:\\SOFTWARE\\WOW6432Node\\SAP\\SAPLogon\\Options" -Force | Out-Null }
        New-ItemProperty -Path "HKLM:\\SOFTWARE\\WOW6432Node\\SAP\\SAPLogon\\Options" -Name "LandscapeFileOnServer" -Value $xmlDestFile -PropertyType String -Force | Out-Null
    }

    $themePath = "HKLM:\\SOFTWARE\\SAP\\General\\Appearance"
    if (!(Test-Path $themePath)) { New-Item -Path $themePath -Force | Out-Null }
    New-ItemProperty -Path $themePath -Name "SelectedTheme" -Value ${cfg.customParams?.sapTheme != null ? cfg.customParams.sapTheme : 1} -PropertyType DWord -Force | Out-Null
${getTrackerSaveLogic(notify)}
`;
}

function generateForticlient(cfg) {
  const vpnName = cfg.customParams?.vpnName || 'VPN';
  const vpnDesc = cfg.customParams?.vpnDescription || 'VPN Corporativa';
  const vpnServer = cfg.customParams?.vpnServer || '0.0.0.0:443';
  const sso = cfg.customParams?.ssoEnabled === false ? 0 : 1;
  const srvCert = cfg.customParams?.serverCert === true ? 1 : 0;
  const noWarn = cfg.customParams?.noWarnInvalidCert === false ? 0 : 1;
  
  return `# =========================================================================
# FORTICLIENT VPN - DROP & RUN
# App: ${cfg.name}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.msi$")}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" REBOOT=ReallySuppress /qn"
    $installProcess = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow -PassThru

    if ($installProcess.ExitCode -notin @(0, 3010, 1641)) {
        throw "msiexec salió con código $($installProcess.ExitCode)"
    }

    $vpnPath = "HKLM:\\SOFTWARE\\Fortinet\\FortiClient\\Sslvpn\\Tunnels\\${vpnName}"
    if (-not (Test-Path -LiteralPath $vpnPath)) { New-Item $vpnPath -Force -ea SilentlyContinue | Out-Null }

    New-ItemProperty -LiteralPath $vpnPath -Name 'Description' -Value '${vpnDesc}' -PropertyType String -Force -ea SilentlyContinue | Out-Null
    New-ItemProperty -LiteralPath $vpnPath -Name 'Server' -Value '${vpnServer}' -PropertyType String -Force -ea SilentlyContinue | Out-Null
    New-ItemProperty -LiteralPath $vpnPath -Name 'sso_enabled' -Value ${sso} -PropertyType DWord -Force -ea SilentlyContinue | Out-Null
    New-ItemProperty -LiteralPath $vpnPath -Name 'ServerCert' -Value '${srvCert}' -PropertyType String -Force -ea SilentlyContinue | Out-Null

    $sslPath = "HKLM:\\SOFTWARE\\Fortinet\\FortiClient\\Sslvpn"
    if (-not (Test-Path -LiteralPath $sslPath)) { New-Item $sslPath -Force -ea SilentlyContinue | Out-Null }
    New-ItemProperty -LiteralPath $sslPath -Name 'no_warn_invalid_cert' -Value ${noWarn} -PropertyType DWord -Force -ea SilentlyContinue | Out-Null
${getTrackerSaveLogic(notify)}
`;
}

function generateOffice(cfg) {
  const configXml = cfg.customParams?.configXml || 'config_office.xml';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# MICROSOFT OFFICE - DROP & RUN
# App: ${cfg.name}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$", notify, cfg.name)}
try {
    $RutaXML = Join-Path -Path $CacheDir -ChildPath "${configXml}"
    Start-Process -FilePath $Instalador.FullName -ArgumentList "/configure \`"$RutaXML\`"" -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateCustom(cfg) {
  const code = cfg.customParams?.customScript || '# Escribe tu código aquí';
  return `# =========================================================================
# SCRIPT CUSTOM RAW
# App: ${cfg.name}
# Generado: ${new Date().toISOString()}
# =========================================================================
${code}
`;
}

function generateWazuh(cfg) {
  const manager = cfg.customParams?.manager || '';
  const group = cfg.customParams?.group || 'default';
  const pwd = cfg.customParams?.password || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# WAZUH AGENT - DROP & RUN
# App: ${cfg.name}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" WAZUH_MANAGER=\`"${manager}\`" WAZUH_AGENT_GROUP=\`"${group}\`""
    if ("${pwd}") { $msiArgs += " WAZUH_REGISTRATION_PASSWORD=\`"${pwd}\`"" }
    $msiArgs += " /qn"
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateSentinelOne(cfg) {
  const st = cfg.customParams?.siteToken || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# SENTINELONE - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, cfg.name)}
try {
    if ($Instalador.Extension -eq ".msi") {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \`"$($Instalador.FullName)\`" SITE_TOKEN=\`"${st}\`" /qn" -Wait -NoNewWindow
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList "-t ${st} -q" -Wait -NoNewWindow
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateCortexXDR(cfg) {
  const dir = cfg.customParams?.installDir || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CORTEX XDR - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
    if ("${dir}") { $msiArgs += " INSTALLDIR=\`"${dir}\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateBitdefender(cfg) {
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# BITDEFENDER BEST - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, cfg.name)}
try {
    if ($Instalador.Extension -eq ".msi") {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \`"$($Instalador.FullName)\`" /qn" -Wait -NoNewWindow
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList "/silent" -Wait -NoNewWindow
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateZscaler(cfg) {
  const cloud = cfg.customParams?.cloudName || 'zscaler';
  const domain = cfg.customParams?.userDomain || '';
  const strict = cfg.customParams?.strictEnforcement ? '1' : '0';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# ZSCALER ZCC - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" CLOUDNAME=\`"${cloud}\`" STRICTENFORCEMENT=${strict} /qn"
    if ("${domain}") { $msiArgs += " USERDOMAIN=\`"${domain}\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateGlobalProtect(cfg) {
  const portal = cfg.customParams?.portal || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# GLOBALPROTECT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" PORTAL=\`"${portal}\`" /qn"
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateCiscoSecureClient(cfg) {
  const xml = cfg.customParams?.profileXml || 'profile.xml';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CISCO SECURE CLIENT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \`"$($Instalador.FullName)\`" /qn" -Wait -NoNewWindow

    $xmlSource = Join-Path -Path $CacheDir -ChildPath "${xml}"
    $xmlDestDir = "C:\\ProgramData\\Cisco\\Cisco Secure Client\\VPN\\Profile"
    if (-not (Test-Path $xmlDestDir)) { New-Item -ItemType Directory -Path $xmlDestDir -Force | Out-Null }
    if (Test-Path $xmlSource) {
        Copy-Item -Path $xmlSource -Destination "$xmlDestDir\\${xml}" -Force
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateLansweeper(cfg) {
  const srv = cfg.customParams?.server || '';
  const port = cfg.customParams?.port || '9524';
  const key = cfg.customParams?.agentKey || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# LANSWEEPER LSAGENT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, cfg.name)}
try {
    $args = "--mode unattended"
    if ("${srv}") { $args += " --server ${srv} --port ${port}" }
    if ("${key}") { $args += " --agentkey ${key}" }
    Start-Process -FilePath $Instalador.FullName -ArgumentList $args -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateNinjaOne(cfg) {
  const tk = cfg.customParams?.token || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# NINJAONE / DATTO RMM - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
    if ("${tk}") { $msiArgs += " TOKEN=\`"${tk}\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateTeamViewer(cfg) {
  const cid = cfg.customParams?.customId || '';
  const api = cfg.customParams?.apiToken || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# TEAMVIEWER HOST - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
    if ("${cid}") { $msiArgs += " CUSTOMCONFIGID=\`"${cid}\`"" }
    if ("${api}") { $msiArgs += " APITOKEN=\`"${api}\`"" }
    $msiArgs += " ASSIGNMENTOPTIONS=\`"--grant-easy-access\`""
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateAnyDesk(cfg) {
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# ANYDESK CUSTOM - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \`"$($Instalador.FullName)\`" /qn" -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateVeeam(cfg) {
  const xml = cfg.customParams?.configXml || 'veeam_config.xml';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# VEEAM AGENT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, cfg.name)}
try {
    if ($Instalador.Extension -eq ".msi") {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \`"$($Instalador.FullName)\`" /qn /norestart" -Wait -NoNewWindow
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList "/silent /norestart" -Wait -NoNewWindow
    }

    $xmlSource = Join-Path -Path $CacheDir -ChildPath "${xml}"
    if (Test-Path $xmlSource) {
        Start-Sleep -Seconds 15
        Start-Process -FilePath "C:\\Program Files\\Veeam\\Endpoint Backup\\Veeam.Agent.Configurator.exe" -ArgumentList "-setVBRsettings /f:\`"$xmlSource\`"" -Wait -NoNewWindow
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateCrashPlan(cfg) {
  const url = cfg.customParams?.url || '';
  const token = cfg.customParams?.token || '';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CRASHPLAN ENTERPRISE - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
    if ("${url}") { $msiArgs += " DEPLOYMENT_URL=\`"${url}\`"" }
    if ("${token}") { $msiArgs += " DEPLOYMENT_TOKEN=\`"${token}\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
`;
}

function generateWinget(cfg) {
  const wingetId = cfg.wingetId || '';
  const version  = cfg.version || '1.0.0';
  const notify   = cfg.notifyUser || false;
  const notifyPrefix = notify ? getNotificationLogic(cfg.name) : '';
  const config   = configService.getConfig();
  const dict     = i18nService.getTranslations(config.language || 'en');
  const ToastTitleProcess = dict.apps?.toastTitleProcess || 'Installation in progress';
  const ToastMsgProcess   = dict.apps?.toastMsgProcess   || 'Installing $NombreApp. Please do not turn off your computer.';
  const ToastTitleDone    = dict.apps?.toastTitleDone    || 'Installation complete';
  const ToastMsgDone      = dict.apps?.toastMsgDone      || '$NombreApp has been installed successfully.';
  const notifyBefore = notify ? `Send-UserToast -ToastTitle "${ToastTitleProcess}" -ToastMessage "${ToastMsgProcess}" -IconType "Warning"` : '';
  const notifyAfter  = notify ? `    Send-UserToast -ToastTitle "${ToastTitleDone}" -ToastMessage "${ToastMsgDone}" -IconType "Information"` : '';

  return `# =========================================================================
# WINGET INSTALL - DROP & RUN
# App: ${cfg.name} [${wingetId}]
# Versión: ${version}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}

$LogDir = "C:\\ProgramData\\AppDeploy_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$NombreApp = (Get-Item $PSScriptRoot).Name
$LogFile   = "$LogDir\\Install_$($NombreApp)_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Start-Transcript -Path $LogFile -Force -ErrorAction SilentlyContinue

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ===== AppDeploy Manager ============================="
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] App     : $NombreApp [winget: ${wingetId}]"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Equipo  : $env:COMPUTERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Usuario : $env:USERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ====================================================="

$TrackerFile = "$LogDir\\Tracker_$NombreApp.json"

# ── Leer versión desde manifiesto de red ─────────────────
$CurrentVersion = "${version}"
$VersionFile = Join-Path $PSScriptRoot "version.json"
if (Test-Path $VersionFile) {
    try { $CurrentVersion = (Get-Content $VersionFile -Raw | ConvertFrom-Json).version } catch {}
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Versión : $CurrentVersion"

# ── Salir si ya está instalado en esta versión ───────────
if (Test-Path $TrackerFile) {
    try {
        $t = Get-Content $TrackerFile -Raw | ConvertFrom-Json
        if ($t.version -eq $CurrentVersion -and $t.result -eq 'success') {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Ya instalado (v$CurrentVersion)"
            Stop-Transcript -ErrorAction SilentlyContinue
            exit 0
        }
    } catch {}
}
${notifyPrefix}
${notifyBefore}

# ── Localizar winget (funciona como SYSTEM) ──────────────
$Winget = $null
try {
    $pkg = Get-AppxPackage -AllUsers "Microsoft.DesktopAppInstaller" -ErrorAction SilentlyContinue |
           Sort-Object { [version]($_.Version -replace '[^0-9.]','') } -Descending |
           Select-Object -First 1
    if ($pkg) {
        $candidate = Join-Path $pkg.InstallLocation "winget.exe"
        if (Test-Path $candidate) { $Winget = $candidate }
    }
} catch {}

if (-not $Winget) {
    $pattern = "$env:ProgramFiles\\WindowsApps\\Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe\\winget.exe"
    $found = Get-Item $pattern -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { $Winget = $found.FullName }
}

if (-not $Winget) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: winget no encontrado. Instalar App Installer desde Microsoft Store (requiere Windows 10 21H2+)."
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] winget: $Winget"

# ── Instalar ─────────────────────────────────────────────
try {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Ejecutando: winget install --id ${wingetId} --scope machine"
    & $Winget install --id "${wingetId}" --silent --accept-package-agreements --accept-source-agreements --scope machine
    if ($LASTEXITCODE -notin @(0, 1618, -1978335212)) { throw "winget salió con código $LASTEXITCODE" }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $NombreApp instalado correctamente (v$CurrentVersion)"
${notifyAfter}
    @{ version = $CurrentVersion; installedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'success'; method = 'winget'; wingetId = "${wingetId}" } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Fallo instalando $NombreApp — $_"
    @{ version = $CurrentVersion; failedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'failed'; error = $_.ToString() } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
}
Stop-Transcript -ErrorAction SilentlyContinue
`;
}

function generateODT(cfg) {
  const odtConfig  = cfg.odtConfig || {};
  const productId  = odtConfig.product  || 'O365BusinessRetail';
  const channel    = odtConfig.channel  || 'MonthlyEnterprise';
  const language   = odtConfig.language || 'es-es';
  const arch       = odtConfig.arch     || '64';
  const version    = cfg.version || '1.0.0';
  const notify     = cfg.notifyUser || false;
  const config     = configService.getConfig();
  const dict       = i18nService.getTranslations(config.language || 'en');
  const ToastTitleProcess = dict.apps?.toastTitleProcess || 'Installation in progress';
  const ToastMsgProcess   = dict.apps?.toastMsgProcess   || 'Installing $NombreApp. Please do not turn off your computer.';
  const ToastTitleDone    = dict.apps?.toastTitleDone    || 'Installation complete';
  const ToastMsgDone      = dict.apps?.toastMsgDone      || '$NombreApp has been installed successfully.';
  const notifyPrefix = notify ? getNotificationLogic(cfg.name) : '';
  const notifyBefore = notify ? `Send-UserToast -ToastTitle "${ToastTitleProcess}" -ToastMessage "${ToastMsgProcess}" -IconType "Warning"` : '';
  const notifyAfter  = notify ? `    Send-UserToast -ToastTitle "${ToastTitleDone}" -ToastMessage "${ToastMsgDone}" -IconType "Information"` : '';

  // Always exclude Groove (OneDrive Music) and Lync (old Skype for Business)
  const alwaysExclude = ['Groove', 'Lync'];
  const allExcluded   = [...new Set([...alwaysExclude, ...(odtConfig.excludeApps || [])])];
  const excludeLines  = allExcluded.map(a => `      <ExcludeApp ID="${a}" />`).join('\n');

  return `# =========================================================================
# MICROSOFT OFFICE ODT - DROP & RUN
# Producto: ${productId}  Canal: ${channel}  Idioma: ${language}
# Versión: ${version}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}

$LogDir = "C:\\ProgramData\\AppDeploy_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$NombreApp = (Get-Item $PSScriptRoot).Name
$LogFile   = "$LogDir\\Install_$($NombreApp)_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Start-Transcript -Path $LogFile -Force -ErrorAction SilentlyContinue

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ===== AppDeploy Manager ============================="
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] App     : $NombreApp (Office ODT)"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Producto: ${productId} | Canal: ${channel} | Idioma: ${language} | Arq: ${arch}"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Equipo  : $env:COMPUTERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Usuario : $env:USERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ====================================================="

$TrackerFile = "$LogDir\\Tracker_$NombreApp.json"

# ── Leer manifiesto ──────────────────────────────────────
$CurrentVersion = "${version}"
$VersionFile = Join-Path $PSScriptRoot "version.json"
if (-not (Test-Path $VersionFile)) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: No se encontró version.json en $PSScriptRoot"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 0
}
try {
    $Manifest       = Get-Content $VersionFile -Raw | ConvertFrom-Json
    $CurrentHash    = $Manifest.hash
    $CurrentVersion = $Manifest.version
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: version.json corrupto — $_"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Versión : $CurrentVersion"

# ── Comprobar si ya instalado (Office en registro + tracker) ─
$LastTracker = $null
if (Test-Path $TrackerFile) {
    try { $LastTracker = Get-Content $TrackerFile -Raw | ConvertFrom-Json } catch {}
}
$OfficeInstalled = Get-ItemProperty \`
    "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
    "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" \`
    -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "*Microsoft Office*" -or $_.DisplayName -like "*Microsoft 365*" } |
    Select-Object -First 1
if ($OfficeInstalled -and $LastTracker -and $LastTracker.result -eq 'success' -and $LastTracker.version -eq $CurrentVersion) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Office ya instalado — $($OfficeInstalled.DisplayName)"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 0
}

# ── Localizar ODT setup.exe ──────────────────────────────
# Si el admin dejó setup.exe en el share, usarlo directamente
$OdtSetup = Join-Path $PSScriptRoot "setup.exe"

if (-not (Test-Path $OdtSetup)) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Descargando Office Deployment Tool..."
    $OdtTemp    = "$env:TEMP\\odt_installer_$(Get-Random).exe"
    $OdtExtract = "$env:TEMP\\odt_$(Get-Random)"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("User-Agent", "Mozilla/5.0")
        # Intentar detectar la URL actual desde la página oficial de Microsoft
        $OdtUrl = $null
        try {
            $page     = $wc.DownloadString("https://www.microsoft.com/en-us/download/confirmation.aspx?id=49117")
            $urlMatch = [regex]::Match($page, 'https://download\\.microsoft\\.com/download/[^\\s"]+officedeploymenttool[^\\s"]+\\.exe')
            if ($urlMatch.Success) { $OdtUrl = $urlMatch.Value }
        } catch {}
        if (-not $OdtUrl) {
            $OdtUrl = "https://download.microsoft.com/download/2/7/A/27AF1BE6-DD20-4CB4-B154-EBAB8A7D4A7E/officedeploymenttool_17531-20046.exe"
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Usando URL de fallback del ODT"
        }
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] URL: $OdtUrl"
        $wc.DownloadFile($OdtUrl, $OdtTemp)
        New-Item -ItemType Directory -Path $OdtExtract -Force | Out-Null
        Start-Process $OdtTemp -ArgumentList "/quiet /extract:\`"$OdtExtract\`"" -Wait -NoNewWindow
        $OdtSetup = Join-Path $OdtExtract "setup.exe"
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ODT listo: $OdtSetup"
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR descargando ODT: $_"
        Stop-Transcript -ErrorAction SilentlyContinue
        exit 1
    }
}

if (-not (Test-Path $OdtSetup)) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: setup.exe no encontrado"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}

# ── Generar XML de configuración ─────────────────────────
$XmlContent = @"
<Configuration>
  <Add OfficeClientEdition="${arch}" Channel="${channel}">
    <Product ID="${productId}">
      <Language ID="${language}" />
${excludeLines}
    </Product>
  </Add>
  <Display Level="None" AcceptEULA="TRUE" />
  <Property Name="FORCEAPPSHUTDOWN" Value="TRUE" />
  <Property Name="SharedComputerLicensing" Value="0" />
  <Updates Enabled="TRUE" />
  <Logging Level="Standard" Path="C:\\ProgramData\\AppDeploy_Logs" />
</Configuration>
"@

$XmlPath = "$env:TEMP\\office_config_${productId}_$(Get-Random).xml"
$XmlContent | Set-Content -Path $XmlPath -Encoding UTF8
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] XML generado: $XmlPath"
${notifyPrefix}
${notifyBefore}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Instalando Office. AVISO: Este proceso puede tardar entre 20 y 60 minutos."

# ── Instalar ─────────────────────────────────────────────
try {
    Start-Process -FilePath $OdtSetup -ArgumentList "/configure \`"$XmlPath\`"" -Wait -NoNewWindow
    if ($LASTEXITCODE -ne 0) { throw "ODT setup.exe salió con código $LASTEXITCODE" }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $NombreApp instalado correctamente (v$CurrentVersion)"
${notifyAfter}
    @{ version = $CurrentVersion; hash = $CurrentHash; installedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'success'; method = 'odt'; product = "${productId}" } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Fallo instalando $NombreApp — $_"
    @{ version = $CurrentVersion; hash = $CurrentHash; failedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'failed'; error = $_.ToString() } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
}
Stop-Transcript -ErrorAction SilentlyContinue
`;
}

module.exports = scriptService;
