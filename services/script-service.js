const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const configService = require('./config');
const i18nService = require('./i18n');

const TEMPLATES = {
  generic: { category: 'General', name: 'Genérica (MSI/EXE)', description: 'Plantilla universal Drop & Run para cualquier instalador', fields: [] },
  office: { category: 'General', name: 'Microsoft Office', description: 'Ejecuta setup.exe con archivo XML', fields: [{ key: 'configXml', label: 'Nombre del XML de Config', default: 'config_office.xml', hint: 'Debe estar en la misma carpeta' }] },
  custom: { category: 'General', name: 'Script Custom', description: 'Escribe tu propio código PowerShell raw', fields: [{ key: 'customScript', label: 'Código PowerShell', type: 'textarea', default: '# Escribe tu código PowerShell aquí\\n', hint: 'Este código no será envuelto, utilízalo con precaución.' }] },
  wazuh: { category: 'Seguridad', name: 'Wazuh Agent', description: 'Despliegue del agente SIEM/XDR de Wazuh', fields: [{key:'manager', label:'WAZUH_MANAGER', default:'', hint:'IP o FQDN del servidor Wazuh'}, {key:'group', label:'WAZUH_AGENT_GROUP', default:'default', hint:'Grupo de asignación'}, {key:'password', label:'WAZUH_REGISTRATION_PASSWORD', default:'', hint:'Contraseña de registro (opcional)'}] },
  sentinelone: { category: 'Seguridad', name: 'SentinelOne', description: 'Despliegue con inyección de SITE_TOKEN', fields: [{key:'siteToken', label:'SITE_TOKEN', default:'', hint:'Cadena única del tenant SentinelOne'}] },
  cortexxdr: { category: 'Seguridad', name: 'Cortex XDR', description: 'Despliegue XDR (Palo Alto)', fields: [{key:'installDir', label:'Directorio (Opcional)', default:'', hint:'Dejar vacío para predeterminado'}] },
  bitdefender: { category: 'Seguridad', name: 'Bitdefender BEST', description: 'Despliegue estándar BEST', fields: [] },
  crowdstrike: { category: 'Seguridad', name: 'CrowdStrike Falcon', description: 'Instala EXE con inyección de CID', fields: [{ key: 'cid', label: 'Customer ID (CID)', default: '', hint: 'CID de CrowdStrike Falcon' }] },
  zscaler: { category: 'Conectividad', name: 'Zscaler Client Connector', description: 'Despliegue de Zscaler ZCC', fields: [{key:'cloudName', label:'CLOUDNAME', default:'zscaler', hint:'Ej: zscaler, zscalerone'}, {key:'userDomain', label:'USERDOMAIN', default:'', hint:'Dominio de la empresa para SSO'}, {key:'strictEnforcement', label:'Strict Enforcement', type:'checkbox', default:true, hint:'Prevenir que el usuario lo desactive'}] },
  globalprotect: { category: 'Conectividad', name: 'GlobalProtect', description: 'Instalador MSI con inyección de PORTAL', fields: [{key:'portal', label:'Portal VPN', default:'vpn.tuempresa.com', hint:'FQDN del portal'}] },
  ciscosecureclient: { category: 'Conectividad', name: 'Cisco Secure Client', description: 'Instala MSI y copia profiles XML', fields: [{key:'profileXml', label:'Perfil XML', default:'profile.xml', hint:'Este XML debe estar junto al MSI'}] },
  forticlient: { category: 'Conectividad', name: 'FortiClient VPN', description: 'Instala MSI + configura túnel VPN', fields: [ { key: 'vpnName', label: 'Nombre del túnel VPN', default: 'EMPRESA', hint: 'Nombre del perfil VPN' }, { key: 'vpnDescription', label: 'Descripción', default: 'VPN Corporativa', hint: '' }, { key: 'vpnServer', label: 'Servidor:Puerto', default: '', hint: 'Ej: 192.168.1.1:10443' }, { key: 'ssoEnabled', label: 'Habilitar Single Sign-On (SSO)', type: 'checkbox', default: true, hint: 'Usa SAML/SSO para autenticarse' }, { key: 'serverCert', label: 'Validar Servidor CA', type: 'checkbox', default: false, hint: 'Casilla desmarcada (0) de serie' }, { key: 'noWarnInvalidCert', label: 'Silenciar Alerta de Certificado Inválido', type: 'checkbox', default: true, hint: 'No alertar en certificados auto-firmados' } ] },
  lansweeper: { category: 'RMM', name: 'Lansweeper (LsAgent)', description: 'Agente local de inventario LsAgent', fields: [{key:'server', label:'SERVER', default:'', hint:'IP/FQDN de Lansweeper (si es local)'}, {key:'port', label:'PORT', default:'9524', hint:'Puerto'}, {key:'agentKey', label:'AGENTKEY (Cloud Relay)', default:'', hint:'Para sincronización por la nube'}] },
  ninjaone: { category: 'RMM', name: 'NinjaOne / Datto RMM', description: 'Instalación genérica RMM por token', fields: [{key:'token', label:'Token / Clave', default:'', hint:'Token de organización'}] },
  freshservice: { category: 'RMM', name: 'Freshservice Agent', description: 'Instala MSI con inyección de Token de Registro', fields: [{ key: 'token', label: 'Registration Token', default: '', hint: 'Token de la consola Freshservice' }] },
  teamviewer: { category: 'RMM', name: 'TeamViewer Host', description: 'Despliegue Host MSI con APIToken', fields: [{key:'customId', label:'CUSTOMCONFIGID', default:'', hint:'ID de configuración Host'}, {key:'apiToken', label:'APITOKEN', default:'', hint:'Para autoasignar a la cuenta'}] },
  anydesk: { category: 'RMM', name: 'AnyDesk Custom Client', description: 'Instalación genérica AnyDesk MSI', fields: [] },
  veeam: { category: 'Backups', name: 'Veeam Agent', description: 'Despliegue con configuración XML de servidor', fields: [{key:'configXml', label:'XML de Configuración', default:'veeam_config.xml', hint:'Extraído de tu Veeam B&R server'}] },
  crashplan: { category: 'Backups', name: 'CrashPlan Enterprise', description: 'Despliegue de backup endpoint', fields: [{key:'url', label:'DEPLOYMENT_URL', default:'', hint:'URL del authority server'}, {key:'token', label:'DEPLOYMENT_TOKEN', default:'', hint:'Token de la organización'}] },
  chrome: { category: 'Corporativo', name: 'Chrome Enterprise', description: 'Despliegue MSI genérico Chrome Enterprise', fields: [] },
  'sap-gui': { category: 'Corporativo', name: 'SAP GUI', description: 'Instala EXE + copia XML de configuración', fields: [ { key: 'sapTheme', label: 'Tema SAP', type: 'select', default: '256', hint: '', options: [ {value:'1', label:'SAP Signature (1)'}, {value:'128', label:'Blue Crystal (128)'}, {value:'256', label:'Belize (256)'}, {value:'2048', label:'Quartz (2048)'}, {value:'16384', label:'Quartz Dark (16384)'} ] } ] }
};

const scriptService = {
  getTemplateList() {
    return Object.entries(TEMPLATES).map(([key, val]) => ({
      id: key,
      category: val.category || 'General',
      name: val.name,
      description: val.description,
      fields: val.fields
    }));
  },

  generateScript(appConfig) {
    const template = appConfig.template || 'generic';
    switch (template) {
      case 'generic': return generateGeneric(appConfig);
      case 'office': return generateOffice(appConfig);
      case 'custom': return generateCustom(appConfig);
      case 'wazuh': return generateWazuh(appConfig);
      case 'sentinelone': return generateSentinelOne(appConfig);
      case 'cortexxdr': return generateCortexXDR(appConfig);
      case 'bitdefender': return generateBitdefender(appConfig);
      case 'crowdstrike': return generateCrowdstrike(appConfig);
      case 'zscaler': return generateZscaler(appConfig);
      case 'globalprotect': return generateGlobalProtect(appConfig);
      case 'ciscosecureclient': return generateCiscoSecureClient(appConfig);
      case 'forticlient': return generateForticlient(appConfig);
      case 'lansweeper': return generateLansweeper(appConfig);
      case 'ninjaone': return generateNinjaOne(appConfig);
      case 'freshservice': return generateFreshservice(appConfig);
      case 'teamviewer': return generateTeamViewer(appConfig);
      case 'anydesk': return generateAnyDesk(appConfig);
      case 'veeam': return generateVeeam(appConfig);
      case 'crashplan': return generateCrashPlan(appConfig);
      case 'chrome': return generateChrome(appConfig);
      case 'sap-gui': return generateSapGui(appConfig);
      default: return generateGeneric(appConfig);
    }
  },

  async deployScript(appConfig) {
    try {
      const config = configService.getConfig();
      const appFolder = path.join(config.networkSharePath, appConfig.name);

      if (!fs.existsSync(appFolder)) {
        await fs.promises.mkdir(appFolder, { recursive: true });
      }

      // Cleanup existing binaries if new one provided
      let installerHash = '';
      if (appConfig.installerPath && fs.existsSync(appConfig.installerPath)) {
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
      } else {
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
      if (appConfig.configXmlPath && fs.existsSync(appConfig.configXmlPath)) {
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

function getNotificationLogic(appName) {
  return `
# ── Notificación al usuario (Session 0 workaround) ──
function Send-UserToast {
    param([string]$ToastTitle, [string]$ToastMessage, [string]$IconType)
    try {
        $LoggedUser = (Get-CimInstance Win32_ComputerSystem).UserName
        if (-not $LoggedUser) { return }
        $rnd = Get-Random -Minimum 1000 -Maximum 99999
        $toastCode = "Add-Type -AssemblyName System.Windows.Forms; " +
            "\`$b = New-Object System.Windows.Forms.NotifyIcon; " +
            "\`$b.Icon = [System.Drawing.SystemIcons]::$IconType; " +
            "\`$b.BalloonTipTitle = '$ToastTitle'; " +
            "\`$b.BalloonTipText = '$ToastMessage'; " +
            "\`$b.Visible = \`$true; " +
            "\`$b.ShowBalloonTip(10000); " +
            "Start-Sleep -Seconds 12; " +
            "\`$b.Dispose()"
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -EP Bypass -Command $toastCode"
        $principal = New-ScheduledTaskPrincipal -UserId $LoggedUser -LogonType Interactive
        $taskName = "DeployNotify_$rnd"
        Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Force | Out-Null
        Start-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 15
        Unregister-ScheduledTask -TaskName $taskName -Confirm:\`$false -ErrorAction SilentlyContinue
    } catch {}
}
`;
}

function getLocalCachingLogic(filter = "\\.(exe|msi)$", notifyUser = false, appDisplayName = '') {
  const config = configService.getConfig();
  const dict = i18nService.getTranslations(config.language || 'en');
  const ToastTitleProcess = dict.apps?.toastTitleProcess || "Instalación en proceso";
  const ToastMsgProcess = dict.apps?.toastMsgProcess || "Se está instalando $NombreApp. No apague el equipo.";

  const notifyPrefix = notifyUser ? getNotificationLogic(appDisplayName) : '';
  const notifyBefore = notifyUser
    ? `Send-UserToast -ToastTitle "${ToastTitleProcess}" -ToastMessage "${ToastMsgProcess}" -IconType "Warning"`
    : '';
  return `
$LogDir = "C:\\ProgramData\\Maqueta_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$NombreApp = (Get-Item $PSScriptRoot).Name
$TrackerFile = "$LogDir\\Tracker_$NombreApp.json"

# Leer manifiesto de versión desde red
$VersionFile = Join-Path $PSScriptRoot "version.json"
if (-not (Test-Path $VersionFile)) { exit }
$Manifest = Get-Content $VersionFile -Raw | ConvertFrom-Json
$CurrentHash = $Manifest.hash
$CurrentVersion = $Manifest.version

# Comparar con última instalación registrada
$LastTracker = if (Test-Path $TrackerFile) { Get-Content $TrackerFile -Raw | ConvertFrom-Json } else { $null }
if ($LastTracker -and $LastTracker.hash -eq $CurrentHash) { exit }

# Comprobar instalador en red
$InstaladorRed = Get-ChildItem -Path $PSScriptRoot -File | Where-Object { $_.Extension -match "${filter}" } | Select-Object -First 1
if (-not $InstaladorRed) { exit }

# Copiar a caché local
$CacheDir = "C:\\Temp\\Deploy\\$NombreApp"
if (-not (Test-Path $CacheDir)) { New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null }
Copy-Item -Path "$PSScriptRoot\\*" -Destination $CacheDir -Recurse -Force

# Ejecutar localmente
$Instalador = Get-ChildItem -Path $CacheDir -File | Where-Object { $_.Extension -match "${filter}" } | Select-Object -First 1
$PSScriptRoot = $CacheDir
${notifyPrefix}
${notifyBefore}
`;
}

function getTrackerSaveLogic(notifyUser = false) {
  const config = configService.getConfig();
  const dict = i18nService.getTranslations(config.language || 'en');
  const ToastTitleDone = dict.apps?.toastTitleDone || "Instalación completada";
  const ToastMsgDone = dict.apps?.toastMsgDone || "$NombreApp se ha instalado correctamente. Ya puede continuar.";

  const notifyAfter = notifyUser
    ? `    Send-UserToast -ToastTitle "${ToastTitleDone}" -ToastMessage "${ToastMsgDone}" -IconType "Information"`
    : '';
  return `
    $trackerData = @{ hash = $CurrentHash; version = $CurrentVersion; installedAt = (Get-Date).ToString('o') } | ConvertTo-Json
    Set-Content -Path $TrackerFile -Value $trackerData
${notifyAfter}`;
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
} catch {}
`;
}

function generateFreshservice(cfg) {
  const token = cfg.customParams?.token || 'TU_TOKEN_AQUI';
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
} catch {}
`;
}

function generateCrowdstrike(cfg) {
  const cid = cfg.customParams?.cid || 'TU_CID_AQUI';
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
} catch {}
`;
}

function generateSapGui(cfg) {
  return `# =========================================================================
# SAP GUI - DROP & RUN
# App: ${cfg.name}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$")}
try {
    Start-Process -FilePath $Instalador.FullName -ArgumentList "/silent" -Wait -NoNewWindow

    $xmlSource = Join-Path -Path $PSScriptRoot -ChildPath "SAPUILandscapeGlobal.xml"
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

    Set-Content -Path $TrackerFile -Value $Instalador.Name
} catch {}
`;
}

function generateForticlient(cfg) {
  const vpnName = cfg.customParams?.vpnName || 'EMPRESA';
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

    if ($installProcess.ExitCode -eq 0 -or $installProcess.ExitCode -eq 3010 -or $installProcess.ExitCode -eq 1641) {
        $vpnPath = "HKLM:\\SOFTWARE\\Fortinet\\FortiClient\\Sslvpn\\Tunnels\\${vpnName}"
        if (-not (Test-Path -LiteralPath $vpnPath)) { New-Item $vpnPath -Force -ea SilentlyContinue | Out-Null }

        New-ItemProperty -LiteralPath $vpnPath -Name 'Description' -Value '${vpnDesc}' -PropertyType String -Force -ea SilentlyContinue | Out-Null
        New-ItemProperty -LiteralPath $vpnPath -Name 'Server' -Value '${vpnServer}' -PropertyType String -Force -ea SilentlyContinue | Out-Null
        New-ItemProperty -LiteralPath $vpnPath -Name 'sso_enabled' -Value ${sso} -PropertyType DWord -Force -ea SilentlyContinue | Out-Null
        New-ItemProperty -LiteralPath $vpnPath -Name 'ServerCert' -Value '${srvCert}' -PropertyType String -Force -ea SilentlyContinue | Out-Null
        
        $sslPath = "HKLM:\\SOFTWARE\\Fortinet\\FortiClient\\Sslvpn"
        if (-not (Test-Path -LiteralPath $sslPath)) { New-Item $sslPath -Force -ea SilentlyContinue | Out-Null }
        New-ItemProperty -LiteralPath $sslPath -Name 'no_warn_invalid_cert' -Value ${noWarn} -PropertyType DWord -Force -ea SilentlyContinue | Out-Null

        Set-Content -Path $TrackerFile -Value $Instalador.Name
    }
} catch {}
`;
}

function generateOffice(cfg) {
  const configXml = cfg.customParams?.configXml || 'config_office.xml';
  return `# =========================================================================
# MICROSOFT OFFICE - DROP & RUN
# App: ${cfg.name}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$")}
try {
    $RutaXML = Join-Path -Path $PSScriptRoot -ChildPath "${configXml}"
    Start-Process -FilePath $Instalador.FullName -ArgumentList "/configure \`"$RutaXML\`"" -Wait -NoNewWindow
    Set-Content -Path $TrackerFile -Value $Instalador.Name
} catch {}
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

module.exports = scriptService;
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
} catch {}
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
} catch {}
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
} catch {}
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
} catch {}
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
} catch {}
`;
}

function generateGlobalProtect(cfg) {
  const portal = cfg.customParams?.portal || 'vpn.tuempresa.com';
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
} catch {}
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
    
    $xmlSource = Join-Path -Path $PSScriptRoot -ChildPath "${xml}"
    $xmlDestDir = "C:\\ProgramData\\Cisco\\Cisco Secure Client\\VPN\\Profile"
    if (-not (Test-Path $xmlDestDir)) { New-Item -ItemType Directory -Path $xmlDestDir -Force | Out-Null }
    if (Test-Path $xmlSource) {
        Copy-Item -Path $xmlSource -Destination "$xmlDestDir\\$xml" -Force
    }
${getTrackerSaveLogic(notify)}
} catch {}
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
} catch {}
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
} catch {}
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
} catch {}
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
} catch {}
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
    
    $xmlSource = Join-Path -Path $PSScriptRoot -ChildPath "${xml}"
    if (Test-Path $xmlSource) {
        Start-Sleep -Seconds 15
        Start-Process -FilePath "C:\\Program Files\\Veeam\\Endpoint Backup\\Veeam.Agent.Configurator.exe" -ArgumentList "-setVBRsettings /f:\`"$xmlSource\`"" -Wait -NoNewWindow
    }
${getTrackerSaveLogic(notify)}
} catch {}
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
} catch {}
`;
}

function generateChrome(cfg) {
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CHROME ENTERPRISE - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.msi$", notify, cfg.name)}
try {
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \`"$($Instalador.FullName)\`" /qn /norestart" -Wait -NoNewWindow
${getTrackerSaveLogic(notify)}
} catch {}
`;
}
