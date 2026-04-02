const fs = require('fs');

let content = fs.readFileSync('services/script-service.js', 'utf8');
const tStart = content.indexOf('const TEMPLATES = {');
const tEnd = content.indexOf('};', tStart) + 2;

const sStart = content.indexOf('    switch (template) {');
const sEnd = content.indexOf('    }', sStart) + 5;

const TEMPLATES = \`const TEMPLATES = {
  // General
  generic: { category: 'General', name: 'Genérica (MSI/EXE)', description: 'Plantilla universal Drop & Run para cualquier instalador', fields: [] },
  office: { category: 'General', name: 'Microsoft Office', description: 'Ejecuta setup.exe con archivo XML', fields: [{ key: 'configXml', label: 'Nombre del XML de Config', default: 'config_office.xml', hint: 'Debe estar en la misma carpeta' }] },
  custom: { category: 'General', name: 'Script Custom', description: 'Escribe tu propio código PowerShell raw', fields: [{ key: 'customScript', label: 'Código PowerShell', type: 'textarea', default: '# Escribe tu código PowerShell aquí\\n', hint: 'Este código no será envuelto, utilízalo con precaución.' }] },
  
  // Seguridad
  wazuh: { category: 'Seguridad', name: 'Wazuh Agent', description: 'Despliegue del agente SIEM/XDR de Wazuh', fields: [{key:'manager', label:'WAZUH_MANAGER', default:'', hint:'IP o FQDN del servidor Wazuh'}, {key:'group', label:'WAZUH_AGENT_GROUP', default:'default', hint:'Grupo de asignación'}, {key:'password', label:'WAZUH_REGISTRATION_PASSWORD', default:'', hint:'Contraseña de registro (opcional)'}] },
  sentinelone: { category: 'Seguridad', name: 'SentinelOne', description: 'Despliegue con inyección de SITE_TOKEN', fields: [{key:'siteToken', label:'SITE_TOKEN', default:'', hint:'Cadena única del tenant SentinelOne'}] },
  cortexxdr: { category: 'Seguridad', name: 'Cortex XDR', description: 'Despliegue XDR (Palo Alto)', fields: [{key:'installDir', label:'Directorio (Opcional)', default:'', hint:'Dejar vacío para predeterminado'}] },
  bitdefender: { category: 'Seguridad', name: 'Bitdefender BEST', description: 'Despliegue estándar BEST', fields: [] },
  crowdstrike: { category: 'Seguridad', name: 'CrowdStrike Falcon', description: 'Instala EXE con inyección de CID', fields: [{ key: 'cid', label: 'Customer ID (CID)', default: '', hint: 'CID de CrowdStrike Falcon' }] },
  
  // Conectividad
  zscaler: { category: 'Conectividad', name: 'Zscaler Client Connector', description: 'Despliegue de Zscaler ZCC', fields: [{key:'cloudName', label:'CLOUDNAME', default:'zscaler', hint:'Ej: zscaler, zscalerone'}, {key:'userDomain', label:'USERDOMAIN', default:'', hint:'Dominio de la empresa para SSO'}, {key:'strictEnforcement', label:'Strict Enforcement', type:'checkbox', default:true, hint:'Prevenir que el usuario lo desactive'}] },
  globalprotect: { category: 'Conectividad', name: 'GlobalProtect', description: 'Instalador MSI con inyección de PORTAL', fields: [{key:'portal', label:'Portal VPN', default:'vpn.tuempresa.com', hint:'FQDN del portal'}] },
  ciscosecureclient: { category: 'Conectividad', name: 'Cisco Secure Client', description: 'Instala MSI y copia profiles XML', fields: [{key:'profileXml', label:'Perfil XML', default:'profile.xml', hint:'Este XML debe estar junto al MSI'}] },
  forticlient: { category: 'Conectividad', name: 'FortiClient VPN', description: 'Instala MSI + configura túnel VPN', fields: [ { key: 'vpnName', label: 'Nombre del túnel VPN', default: 'EMPRESA', hint: 'Nombre del perfil VPN' }, { key: 'vpnDescription', label: 'Descripción', default: 'VPN Corporativa', hint: '' }, { key: 'vpnServer', label: 'Servidor:Puerto', default: '', hint: 'Ej: 192.168.1.1:10443' }, { key: 'ssoEnabled', label: 'Habilitar Single Sign-On (SSO)', type: 'checkbox', default: true, hint: 'Usa SAML/SSO para autenticarse' }, { key: 'serverCert', label: 'Validar Servidor CA', type: 'checkbox', default: false, hint: 'Casilla desmarcada (0) de serie' }, { key: 'noWarnInvalidCert', label: 'Silenciar Alerta de Certificado Inválido', type: 'checkbox', default: true, hint: 'No alertar en certificados auto-firmados' } ] },
  
  // RMM
  lansweeper: { category: 'RMM', name: 'Lansweeper (LsAgent)', description: 'Agente local de inventario LsAgent', fields: [{key:'server', label:'SERVER', default:'', hint:'IP/FQDN de Lansweeper (si es local)'}, {key:'port', label:'PORT', default:'9524', hint:'Puerto'}, {key:'agentKey', label:'AGENTKEY (Cloud Relay)', default:'', hint:'Para sincronización por la nube'}] },
  ninjaone: { category: 'RMM', name: 'NinjaOne / Datto RMM', description: 'Instalación de Agente RMM genérico por token', fields: [{key:'token', label:'Token / Clave', default:'', hint:'Token de organización'}] },
  freshservice: { category: 'RMM', name: 'Freshservice Agent', description: 'Instala MSI con inyección de Token de Registro', fields: [{ key: 'token', label: 'Registration Token', default: '', hint: 'Token de la consola Freshservice' }] },
  teamviewer: { category: 'RMM', name: 'TeamViewer Host', description: 'Despliegue Host MSI con APIToken', fields: [{key:'customId', label:'CUSTOMCONFIGID', default:'', hint:'ID de configuración Host'}, {key:'apiToken', label:'APITOKEN', default:'', hint:'Para autoasignar a la cuenta'}] },
  anydesk: { category: 'RMM', name: 'AnyDesk Custom Client', description: 'Instalación genérica AnyDesk MSI', fields: [] },
  
  // Backups
  veeam: { category: 'Backups', name: 'Veeam Agent', description: 'Despliegue con configuración XML de servidor', fields: [{key:'configXml', label:'XML de Configuración', default:'veeam_config.xml', hint:'Extraído de tu Veeam B&R server'}] },
  crashplan: { category: 'Backups', name: 'CrashPlan Enterprise', description: 'Despliegue de backup endpoint', fields: [{key:'url', label:'DEPLOYMENT_URL', default:'', hint:'URL del authority server'}, {key:'token', label:'DEPLOYMENT_TOKEN', default:'', hint:'Token de la organización'}] },
  
  // Corporativo
  chrome: { category: 'Corporativo', name: 'Chrome Enterprise', description: 'Despliegue MSI genérico Chrome Enterprise', fields: [] },
  'sap-gui': { category: 'Corporativo', name: 'SAP GUI', description: 'Instala EXE + copia XML de configuración', fields: [ { key: 'sapTheme', label: 'Tema SAP', type: 'select', default: '256', hint: '', options: [ {value:'1', label:'SAP Signature (1)'}, {value:'128', label:'Blue Crystal (128)'}, {value:'256', label:'Belize (256)'}, {value:'2048', label:'Quartz (2048)'}, {value:'16384', label:'Quartz Dark (16384)'} ] } ] }
};\`;

const SWITCH = \`    switch (template) {
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
    }\`;

const NEW_FUNCTIONS = \`
function generateWazuh(cfg) {
  const manager = cfg.customParams?.manager || '';
  const group = cfg.customParams?.group || 'default';
  const pwd = cfg.customParams?.password || '';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# WAZUH AGENT - DROP & RUN
# App: \${cfg.name}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" WAZUH_MANAGER=\\\\\\\`"\${manager}\\\\\\\`" WAZUH_AGENT_GROUP=\\\\\\\`"\${group}\\\\\\\`""
    if ("\${pwd}") { $msiArgs += " WAZUH_REGISTRATION_PASSWORD=\\\\\\\`"\${pwd}\\\\\\\`"" }
    $msiArgs += " /qn"
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateSentinelOne(cfg) {
  const st = cfg.customParams?.siteToken || '';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# SENTINELONE - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.(exe|msi)$", notify, cfg.name)}
try {
    if ($Instalador.Extension -eq ".msi") {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" SITE_TOKEN=\\\\\\\`"\${st}\\\\\\\`" /qn" -Wait -NoNewWindow
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList "-t \${st} -q" -Wait -NoNewWindow
    }
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateCortexXDR(cfg) {
  const dir = cfg.customParams?.installDir || '';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# CORTEX XDR - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn"
    if ("\${dir}") { $msiArgs += " INSTALLDIR=\\\\\\\`"\${dir}\\\\\\\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateBitdefender(cfg) {
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# BITDEFENDER BEST - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.(exe|msi)$", notify, cfg.name)}
try {
    if ($Instalador.Extension -eq ".msi") {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn" -Wait -NoNewWindow
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList "/silent" -Wait -NoNewWindow
    }
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateZscaler(cfg) {
  const cloud = cfg.customParams?.cloudName || 'zscaler';
  const domain = cfg.customParams?.userDomain || '';
  const strict = cfg.customParams?.strictEnforcement ? '1' : '0';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# ZSCALER ZCC - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" CLOUDNAME=\\\\\\\`"\${cloud}\\\\\\\`" STRICTENFORCEMENT=\${strict} /qn"
    if ("\${domain}") { $msiArgs += " USERDOMAIN=\\\\\\\`"\${domain}\\\\\\\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateGlobalProtect(cfg) {
  const portal = cfg.customParams?.portal || 'vpn.tuempresa.com';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# GLOBALPROTECT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" PORTAL=\\\\\\\`"\${portal}\\\\\\\`" /qn"
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateCiscoSecureClient(cfg) {
  const xml = cfg.customParams?.profileXml || 'profile.xml';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# CISCO SECURE CLIENT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn" -Wait -NoNewWindow
    
    $xmlSource = Join-Path -Path $PSScriptRoot -ChildPath "\${xml}"
    $xmlDestDir = "C:\\\\ProgramData\\\\Cisco\\\\Cisco Secure Client\\\\VPN\\\\Profile"
    if (-not (Test-Path $xmlDestDir)) { New-Item -ItemType Directory -Path $xmlDestDir -Force | Out-Null }
    if (Test-Path $xmlSource) {
        Copy-Item -Path $xmlSource -Destination "$xmlDestDir\\\\$xml" -Force
    }
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateLansweeper(cfg) {
  const srv = cfg.customParams?.server || '';
  const port = cfg.customParams?.port || '9524';
  const key = cfg.customParams?.agentKey || '';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# LANSWEEPER LSAGENT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.(exe|msi)$", notify, cfg.name)}
try {
    $args = "--mode unattended"
    if ("\${srv}") { $args += " --server \${srv} --port \${port}" }
    if ("\${key}") { $args += " --agentkey \${key}" }
    Start-Process -FilePath $Instalador.FullName -ArgumentList $args -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateNinjaOne(cfg) {
  const tk = cfg.customParams?.token || '';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# NINJAONE / DATTO RMM - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn"
    if ("\${tk}") { $msiArgs += " TOKEN=\\\\\\\`"\${tk}\\\\\\\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateTeamViewer(cfg) {
  const cid = cfg.customParams?.customId || '';
  const api = cfg.customParams?.apiToken || '';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# TEAMVIEWER HOST - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn"
    if ("\${cid}") { $msiArgs += " CUSTOMCONFIGID=\\\\\\\`"\${cid}\\\\\\\`"" }
    if ("\${api}") { $msiArgs += " APITOKEN=\\\\\\\`"\${api}\\\\\\\`"" }
    $msiArgs += " ASSIGNMENTOPTIONS=\\\\\\\`"--grant-easy-access\\\\\\\`""
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateAnyDesk(cfg) {
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# ANYDESK CUSTOM - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn" -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateVeeam(cfg) {
  const xml = cfg.customParams?.configXml || 'veeam_config.xml';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# VEEAM AGENT - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.(exe|msi)$", notify, cfg.name)}
try {
    if ($Instalador.Extension -eq ".msi") {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn /norestart" -Wait -NoNewWindow
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList "/silent /norestart" -Wait -NoNewWindow
    }
    
    $xmlSource = Join-Path -Path $PSScriptRoot -ChildPath "\${xml}"
    if (Test-Path $xmlSource) {
        Start-Sleep -Seconds 15
        Start-Process -FilePath "C:\\\\Program Files\\\\Veeam\\\\Endpoint Backup\\\\Veeam.Agent.Configurator.exe" -ArgumentList "-setVBRsettings /f:\\\\\"$xmlSource\\\\\"" -Wait -NoNewWindow
    }
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateCrashPlan(cfg) {
  const url = cfg.customParams?.url || '';
  const token = cfg.customParams?.token || '';
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# CRASHPLAN ENTERPRISE - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    $msiArgs = "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn"
    if ("\${url}") { $msiArgs += " DEPLOYMENT_URL=\\\\\\\`"\${url}\\\\\\\`"" }
    if ("\${token}") { $msiArgs += " DEPLOYMENT_TOKEN=\\\\\\\`"\${token}\\\\\\\`"" }
    Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}

function generateChrome(cfg) {
  const notify = cfg.notifyUser || false;
  return \\\`# =========================================================================
# CHROME ENTERPRISE - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\\\SysNative\\\\WindowsPowershell\\\\v1.0\\\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
\\\${\`getLocalCachingLogic\`("\\\\.msi$", notify, cfg.name)}
try {
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i \\\\\\\`"$($Instalador.FullName)\\\\\\\`" /qn /norestart" -Wait -NoNewWindow
\\\${\`getTrackerSaveLogic\`(notify)}
} catch {}
\\\`;
}
\`;

let updated = content.substring(0, tStart) + TEMPLATES + content.substring(tEnd, sStart) + SWITCH + content.substring(sEnd);
updated += NEW_FUNCTIONS;
fs.writeFileSync('services/script-service.js', updated);
console.log('Successfully written new script generator routines');
