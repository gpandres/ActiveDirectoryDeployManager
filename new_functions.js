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
