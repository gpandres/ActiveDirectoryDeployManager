const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const configService = require('./config');
const i18nService = require('./i18n');
const templateService = require('./template-service');
const { resolveNamedSubdirectory } = require('./path-utils');

function sanitizePSForEmbedding(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/`/g, '``')
    .replace(/\$/g, '`$')
    .replace(/"/g, '`"')
    .replace(/'/g, "''");
}

function sanitizeAppName(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^a-zA-Z0-9\s\-_.,()[\]@#]/g, '').trim().substring(0, 128);
}

function sanitizeWingetSource(str) {
  if (typeof str !== 'string') return '';
  const normalized = str.trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(normalized) ? normalized : '';
}

function isInstallerArtifactName(fileName) {
  const normalized = String(fileName || '').toLowerCase();
  return normalized.endsWith('.exe')
    || normalized.endsWith('.msi')
    || (normalized.endsWith('.ps1') && normalized !== 'install.ps1');
}

const TEMPLATES = {
  generic: { category: 'General', name: 'Generic (MSI/EXE)', description: 'Universal Drop & Run template for any installer', fields: [] },
  office: { category: 'General', name: 'Microsoft Office (XML)', description: 'Executes setup.exe with an existing XML file', fields: [] },
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

function getBuiltInTemplateList() {
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
}

const scriptService = {
  getTemplateList() {
    return [
      ...getBuiltInTemplateList(),
      ...templateService.getWizardTemplates()
    ];
  },

  generateScript(appConfig) {
    const customTemplate = templateService.resolve(appConfig?.template, appConfig?.templateDefinition);
    if (customTemplate) {
      return generateUserTemplate(appConfig, customTemplate);
    }

    const generators = getGenerators();
    const fn = generators[appConfig.template] ?? generators.generic;
    return fn(appConfig);
  },

  async deployScript(appConfig) {
    try {
      // Fast-fail if share is known to be down
      const shareHealth = require('./share-health');
      const health = await shareHealth.check();
      if (!health.available) {
        return { success: false, error: 'SHARE_UNAVAILABLE' };
      }

      // Sweep orphaned temp PS scripts before each deploy
      try { require('./app-service').cleanupTempFiles(); } catch (e) {}

      if (appConfig?.template === 'winget') {
        try {
          const catalogService = require('./catalog-service');
          const resolvedPackage = await catalogService.resolvePackage({
            wingetId: appConfig.wingetId,
            wingetSource: appConfig.wingetSource,
            name: appConfig.name
          });
          if (resolvedPackage?.available && resolvedPackage.wingetId) {
            appConfig = {
              ...appConfig,
              wingetId: resolvedPackage.wingetId,
              wingetSource: resolvedPackage.wingetSource || appConfig.wingetSource || 'winget'
            };
          }
        } catch (e) { /* keep configured package reference if resolution fails */ }
      }

      const config = configService.getConfig();
      const { safeName, path: appFolder } = resolveNamedSubdirectory(
        config.networkSharePath,
        appConfig.name,
        'App'
      );

      if (!fs.existsSync(appFolder)) {
        await fs.promises.mkdir(appFolder, { recursive: true });
      }
      const customTemplate = templateService.resolve(appConfig?.template, appConfig?.templateDefinition);

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
            if (isInstallerArtifactName(file)) {
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
          if (isInstallerArtifactName(file)) {
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

      if (customTemplate) {
        await copyCustomTemplateFiles(appFolder, appConfig, customTemplate);
      }

      const scriptContent = this.generateScript(appConfig);
      const scriptPath = path.join(appFolder, 'install.ps1');
      await fs.promises.writeFile(scriptPath, '\uFEFF' + scriptContent, 'utf-8');

      // Generate version.json manifest
      const cfgForManifest = require('./config').getConfig();
      const manifest = {
        app: appConfig.name,
        deploymentFolder: safeName,
        version: appConfig.version || '1.0.0',
        hash: installerHash,
        primaryInstallerName: appConfig.installerPath
          ? sanitizeTemplateFileName(path.basename(appConfig.installerPath))
          : '',
        template: appConfig.template || 'generic',
        templateSource: customTemplate ? 'user' : 'builtin',
        notifyUser: appConfig.notifyUser || false,
        deployedAt: new Date().toISOString(),
        shareId: cfgForManifest.shareId || ''
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

function sanitizeTemplateFileName(fileName) {
  if (typeof fileName !== 'string') return '';
  const base = path.basename(fileName.trim());
  const clean = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 128);
  if (!clean || clean === '.' || clean === '..') return '';
  return clean;
}

function isTemplateInstallerAttachment(fileDef) {
  return fileDef?.storageKind === 'installer';
}

function normalizeTemplateFileSelection(value) {
  if (typeof value === 'string') return { sourcePath: value };
  if (value && typeof value === 'object' && typeof value.sourcePath === 'string') return value;
  return { sourcePath: '' };
}

function resolveCustomTemplateFileEntries(template, appConfig) {
  const selections = (appConfig && appConfig.templateFiles && typeof appConfig.templateFiles === 'object')
    ? appConfig.templateFiles
    : {};

  return (template?.files || []).map(fileDef => {
    const selection = normalizeTemplateFileSelection(selections[fileDef.key]);
    const sourcePath = selection.sourcePath || '';
    const defaultExt = Array.isArray(fileDef.extensions) && fileDef.extensions.length === 1 && fileDef.extensions[0] !== '*'
      ? `.${fileDef.extensions[0]}`
      : '';
    const targetName = sanitizeTemplateFileName(
      fileDef.destinationName
      || (sourcePath ? path.basename(sourcePath) : '')
      || `${fileDef.key}${defaultExt}`
    ) || `${fileDef.key}${defaultExt || '.dat'}`;
    const relativePath = isTemplateInstallerAttachment(fileDef)
      ? path.join('attached-installers', targetName)
      : targetName;

    return {
      ...fileDef,
      sourcePath,
      targetName,
      relativePath
    };
  });
}

function getSelectedXmlTemplateFileEntry(fileEntries) {
  return (Array.isArray(fileEntries) ? fileEntries : []).find(entry => {
    if (!entry?.sourcePath) return false;
    const extensions = Array.isArray(entry.extensions) ? entry.extensions : [];
    return extensions.some(item => String(item || '').trim().toLowerCase() === 'xml');
  }) || null;
}

async function copyCustomTemplateFiles(appFolder, appConfig, template) {
  const fileEntries = resolveCustomTemplateFileEntries(template, appConfig);

  for (const entry of fileEntries) {
    if (!entry.sourcePath) {
      if (entry.required) {
        throw new Error(`Missing required configuration file: ${entry.label}`);
      }
      continue;
    }

    if (!fs.existsSync(entry.sourcePath)) {
      if (entry.required) {
        throw new Error(`Configuration file not found: ${entry.label}`);
      }
      continue;
    }

    const allowedExts = Array.isArray(entry.extensions) ? entry.extensions : ['*'];
    const sourceExt = path.extname(entry.sourcePath).replace(/^\./, '').toLowerCase();
    if (allowedExts.length > 0 && !allowedExts.includes('*') && !allowedExts.includes(sourceExt)) {
      throw new Error(`Invalid file type for ${entry.label}`);
    }

    const destinationPath = path.join(appFolder, entry.relativePath || entry.targetName);
    const sourceResolved = path.resolve(entry.sourcePath).toLowerCase();
    const destinationResolved = path.resolve(destinationPath).toLowerCase();
    if (sourceResolved !== destinationResolved) {
      await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.promises.copyFile(entry.sourcePath, destinationPath);
    }
  }
}

function buildPsObjectLiteral(entries) {
  if (!entries.length) return '([pscustomobject]@{})';
  return [
    '([pscustomobject]@{',
    ...entries.map(entry => `    '${entry.key}' = ${entry.expression}`),
    '})'
  ].join('\n');
}

function buildPsArgumentExpression(name, joiner, quoteValue, valueExpression) {
  const separator = name ? (joiner === 'space' ? ' ' : '=') : '';
  const prefix = sanitizePSForEmbedding(`${name || ''}${separator}`);
  if (quoteValue) {
    return `"${prefix}\`"$(${valueExpression})\`""`;
  }
  return `"${prefix}$(${valueExpression})"`;
}

function getDeployCacheCleanupLogic() {
  return `
function Test-DeployCachePathSafety {
    param([string]$Path)
    if (-not $Path) { return $false }
    try {
        $fullPath = [System.IO.Path]::GetFullPath($Path)
        $cacheRoot = [System.IO.Path]::GetFullPath("C:\\Temp\\Deploy")
        return $fullPath.StartsWith($cacheRoot.TrimEnd("\\") + "\\", [System.StringComparison]::OrdinalIgnoreCase) -and $fullPath.Length -gt ($cacheRoot.Length + 1)
    } catch {
        return $false
    }
}

function Clear-DeployCacheCleanupPending {
    param([string]$MarkerPath)
    if (-not $MarkerPath -or -not (Test-Path -LiteralPath $MarkerPath)) { return }
    try {
        Remove-Item -LiteralPath $MarkerPath -Force -ErrorAction Stop
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: No se pudo borrar el marcador de limpieza: $_"
    }
}

function Register-DeployCacheCleanupPending {
    param(
        [string]$CacheDir,
        [string]$MarkerPath
    )
    if (-not (Test-DeployCachePathSafety -Path $CacheDir) -or -not $MarkerPath) {
        return $false
    }
    try {
        @{
            cacheDir = $CacheDir
            createdAt = (Get-Date).ToString('o')
            computer = $env:COMPUTERNAME
        } | ConvertTo-Json | Set-Content -LiteralPath $MarkerPath -Force -Encoding UTF8
        return $true
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: No se pudo registrar la limpieza diferida: $_"
        return $false
    }
}

function Invoke-DeployCacheCleanup {
    param(
        [string]$CacheDir,
        [int]$MaxAttempts = 5,
        [int]$SleepSeconds = 2,
        [string]$MarkerPath = ""
    )
    if (-not (Test-DeployCachePathSafety -Path $CacheDir)) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Ruta de cache no segura, se omite la limpieza: $CacheDir"
        return $false
    }
    if (-not (Test-Path -LiteralPath $CacheDir)) {
        if ($MarkerPath) { Clear-DeployCacheCleanupPending -MarkerPath $MarkerPath }
        return $true
    }
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            Remove-Item -LiteralPath $CacheDir -Recurse -Force -ErrorAction Stop
            if ($MarkerPath) { Clear-DeployCacheCleanupPending -MarkerPath $MarkerPath }
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Cache local eliminada: $CacheDir"
            return $true
        } catch {
            if ($attempt -lt $MaxAttempts) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Cache en uso, reintentando limpieza ($attempt/$MaxAttempts)..."
                Start-Sleep -Seconds $SleepSeconds
            } else {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: No se pudo eliminar la cache local: $_"
            }
        }
    }
    return $false
}

function Start-DeployCacheCleanupWorker {
    param(
        [string]$CacheDir,
        [string]$MarkerPath
    )
    if (-not (Test-DeployCachePathSafety -Path $CacheDir)) {
        return $false
    }
    try {
        $cacheDirLiteral = $CacheDir.Replace("'", "''")
        $markerLiteral = ([string]$MarkerPath).Replace("'", "''")
        $workerScript = @"
$TargetCacheDir = '$cacheDirLiteral'
$TargetMarkerPath = '$markerLiteral'

function Test-DeployCachePathSafety {
    param([string]$Path)
    if (-not $Path) { return $false }
    try {
        $fullPath = [System.IO.Path]::GetFullPath($Path)
        $cacheRoot = [System.IO.Path]::GetFullPath('C:\\Temp\\Deploy')
        return $fullPath.StartsWith($cacheRoot.TrimEnd('\\') + '\\', [System.StringComparison]::OrdinalIgnoreCase) -and $fullPath.Length -gt ($cacheRoot.Length + 1)
    } catch {
        return $false
    }
}

if (-not (Test-DeployCachePathSafety -Path $TargetCacheDir)) { exit 1 }

for ($attempt = 1; $attempt -le 90; $attempt++) {
    if (-not (Test-Path -LiteralPath $TargetCacheDir)) {
        if ($TargetMarkerPath -and (Test-Path -LiteralPath $TargetMarkerPath)) {
            Remove-Item -LiteralPath $TargetMarkerPath -Force -ErrorAction SilentlyContinue
        }
        exit 0
    }

    try {
        Remove-Item -LiteralPath $TargetCacheDir -Recurse -Force -ErrorAction Stop
        if ($TargetMarkerPath -and (Test-Path -LiteralPath $TargetMarkerPath)) {
            Remove-Item -LiteralPath $TargetMarkerPath -Force -ErrorAction SilentlyContinue
        }
        exit 0
    } catch {
        Start-Sleep -Seconds 10
    }
}

exit 1
"@
        $encodedWorker = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($workerScript))
        $workerShell = Join-Path $env:WINDIR "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        if (-not (Test-Path -LiteralPath $workerShell)) { $workerShell = "PowerShell.exe" }
        Start-Process -FilePath $workerShell -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedWorker) -WindowStyle Hidden | Out-Null
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Cache ocupada; limpieza diferida iniciada."
        return $true
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: No se pudo iniciar la limpieza diferida: $_"
        return $false
    }
}

function Invoke-DeployCacheCleanupWithFallback {
    param(
        [string]$CacheDir,
        [string]$MarkerPath
    )
    if (Invoke-DeployCacheCleanup -CacheDir $CacheDir -MarkerPath $MarkerPath) {
        return $true
    }
    if (Register-DeployCacheCleanupPending -CacheDir $CacheDir -MarkerPath $MarkerPath) {
        return (Start-DeployCacheCleanupWorker -CacheDir $CacheDir -MarkerPath $MarkerPath)
    }
    return $false
}

function Invoke-PendingDeployCacheCleanups {
    param([string]$MarkerDirectory)
    if (-not $MarkerDirectory -or -not (Test-Path -LiteralPath $MarkerDirectory)) {
        return
    }
    Get-ChildItem -LiteralPath $MarkerDirectory -Filter "*.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
        $markerFile = $_.FullName
        try {
            $pending = Get-Content -LiteralPath $markerFile -Raw -ErrorAction Stop | ConvertFrom-Json
            $pendingCacheDir = [string]$pending.cacheDir
        } catch {
            Remove-Item -LiteralPath $markerFile -Force -ErrorAction SilentlyContinue
            return
        }

        if (-not (Test-DeployCachePathSafety -Path $pendingCacheDir)) {
            Remove-Item -LiteralPath $markerFile -Force -ErrorAction SilentlyContinue
            return
        }

        if (Invoke-DeployCacheCleanup -CacheDir $pendingCacheDir -MaxAttempts 2 -SleepSeconds 1 -MarkerPath $markerFile) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Limpieza diferida completada: $pendingCacheDir"
        }
    }
}

Invoke-PendingDeployCacheCleanups -MarkerDirectory $CleanupMarkerDir
`.trim();
}

function getInstallerConflictLogic() {
  return `
$InstallDisposition = 'pending'

function Convert-DetectedAppVersion {
    param([string]$Value)
    $match = [regex]::Match([string]$Value, '\\d+(\\.\\d+){0,3}')
    if (-not $match.Success) { return $null }
    try {
        return [version]$match.Value
    } catch {
        return $null
    }
}

function Normalize-DetectedAppName {
    param([string]$Value)
    return ([string]$Value).ToLowerInvariant() -replace '[^a-z0-9]+', ''
}

function Get-InstalledApplicationEntries {
    if ($script:CachedInstalledApplicationEntries) {
        return $script:CachedInstalledApplicationEntries
    }

    $script:CachedInstalledApplicationEntries = @(
        Get-ItemProperty \`
            "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
            "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" \`
            -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName } |
            ForEach-Object {
                $productCode = ''
                if ([string]$_.PSChildName -match '^\\{[0-9A-F-]+\\}$') {
                    $productCode = $Matches[0]
                } elseif ([string]$_.UninstallString -match '\\{[0-9A-F-]+\\}') {
                    $productCode = $Matches[0]
                }

                [pscustomobject]@{
                    DisplayName = [string]$_.DisplayName
                    NormalizedDisplayName = Normalize-DetectedAppName -Value $_.DisplayName
                    DisplayVersion = [string]$_.DisplayVersion
                    VersionObject = Convert-DetectedAppVersion -Value $_.DisplayVersion
                    ProductCode = $productCode
                    Publisher = [string]$_.Publisher
                    PublisherNormalized = Normalize-DetectedAppName -Value $_.Publisher
                }
            }
    )

    return $script:CachedInstalledApplicationEntries
}

function Get-MsiPackageProperty {
    param(
        [string]$Path,
        [string]$PropertyName
    )

    $windowsInstaller = $null
    $database = $null
    $view = $null
    $record = $null

    try {
        $windowsInstaller = New-Object -ComObject WindowsInstaller.Installer
        $database = $windowsInstaller.GetType().InvokeMember('OpenDatabase', 'InvokeMethod', $null, $windowsInstaller, @($Path, 0))
        $query = "SELECT \`Value\` FROM \`Property\` WHERE \`Property\`='$PropertyName'"
        $view = $database.GetType().InvokeMember('OpenView', 'InvokeMethod', $null, $database, @($query))
        $view.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $view, $null) | Out-Null
        $record = $view.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $view, $null)
        if ($record) {
            return [string]$record.StringData(1)
        }
    } catch {
        return ''
    } finally {
        foreach ($comObject in @($record, $view, $database, $windowsInstaller)) {
            if ($comObject) {
                try { [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($comObject) | Out-Null } catch {}
            }
        }
    }

    return ''
}

function Get-InstallerDetectionMetadata {
    param(
        [string]$InstallerPath,
        [string]$FallbackDisplayName
    )

    $extension = [System.IO.Path]::GetExtension([string]$InstallerPath).ToLowerInvariant()
    $displayCandidates = New-Object System.Collections.Generic.List[string]
    $normalizedCandidates = New-Object System.Collections.Generic.List[string]
    $productCode = ''
    $publisher = ''
    $productVersionRaw = ''

    $candidateSeed = @()
    $fileBaseName = [System.IO.Path]::GetFileNameWithoutExtension([string]$InstallerPath)
    $fileBaseNameWithoutVersion = ($fileBaseName -replace '([._-]?\d+(\.\d+){1,4}.*)$', '')
    if ($extension -eq '.msi') {
        $candidateSeed += Get-MsiPackageProperty -Path $InstallerPath -PropertyName 'ProductName'
        $productVersionRaw = Get-MsiPackageProperty -Path $InstallerPath -PropertyName 'ProductVersion'
        $publisher = Get-MsiPackageProperty -Path $InstallerPath -PropertyName 'Manufacturer'
        $productCode = Get-MsiPackageProperty -Path $InstallerPath -PropertyName 'ProductCode'
    } else {
        $fileInfo = $null
        try { $fileInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($InstallerPath) } catch {}
        if ($fileInfo) {
            $candidateSeed += [string]$fileInfo.ProductName
            $candidateSeed += [string]$fileInfo.FileDescription
            $candidateSeed += [System.IO.Path]::GetFileNameWithoutExtension([string]$fileInfo.OriginalFilename)
            $candidateSeed += [string]$fileInfo.InternalName
            $publisher = [string]$fileInfo.CompanyName
            $productVersionRaw = [string]$fileInfo.ProductVersion
        }
    }

    $candidateSeed += $fileBaseName
    $candidateSeed += $fileBaseNameWithoutVersion
    $candidateSeed += $FallbackDisplayName
    foreach ($candidate in $candidateSeed) {
        $candidateText = [string]$candidate
        if (-not $candidateText) { continue }
        if (-not $displayCandidates.Contains($candidateText)) {
            $displayCandidates.Add($candidateText)
        }

        $normalized = Normalize-DetectedAppName -Value $candidateText
        if ($normalized -and -not $normalizedCandidates.Contains($normalized)) {
            $normalizedCandidates.Add($normalized)
        }
    }

    [pscustomobject]@{
        InstallerPath = $InstallerPath
        Extension = $extension
        DisplayCandidates = @($displayCandidates.ToArray())
        NameCandidates = @($normalizedCandidates.ToArray())
        Publisher = $publisher
        PublisherNormalized = Normalize-DetectedAppName -Value $publisher
        ProductCode = $productCode
        InstallerVersionRaw = $productVersionRaw
        InstallerVersionObject = Convert-DetectedAppVersion -Value $productVersionRaw
    }
}

function Get-InstalledApplicationMatch {
    param([pscustomobject]$InstallerMetadata)

    $bestMatch = $null
    $bestScore = -1
    $bestPublisherMatched = $false

    foreach ($entry in Get-InstalledApplicationEntries) {
        $score = 0
        $publisherMatched = $false

        if ($InstallerMetadata.ProductCode -and $entry.ProductCode -and $InstallerMetadata.ProductCode -eq $entry.ProductCode) {
            $score = 100
        }

        foreach ($candidate in @($InstallerMetadata.NameCandidates)) {
            if (-not $candidate) { continue }
            if ($entry.NormalizedDisplayName -eq $candidate) {
                $score = [Math]::Max($score, 85)
            } elseif ($candidate.Length -ge 8 -and ($entry.NormalizedDisplayName.StartsWith($candidate) -or $candidate.StartsWith($entry.NormalizedDisplayName))) {
                $score = [Math]::Max($score, 70)
            }
        }

        if ($InstallerMetadata.PublisherNormalized -and $entry.PublisherNormalized -eq $InstallerMetadata.PublisherNormalized) {
            $publisherMatched = $true
            if ($score -gt 0) {
                $score += 5
            }
        }

        if ($score -gt $bestScore) {
            $bestScore = $score
            $bestMatch = $entry
            $bestPublisherMatched = $publisherMatched
        }
    }

    if (-not $bestMatch -or $bestScore -lt 70) {
        return $null
    }

    [pscustomobject]@{
        DisplayName = $bestMatch.DisplayName
        DisplayVersion = $bestMatch.DisplayVersion
        VersionObject = $bestMatch.VersionObject
        ProductCode = $bestMatch.ProductCode
        MatchScore = $bestScore
        PublisherMatched = $bestPublisherMatched
    }
}

function Resolve-InstallerConflictState {
    param(
        [pscustomobject]$InstallerMetadata,
        [string]$TargetVersion
    )

    $targetVersionObject = Convert-DetectedAppVersion -Value $TargetVersion
    if (-not $targetVersionObject -and $InstallerMetadata.InstallerVersionObject) {
        $targetVersionObject = $InstallerMetadata.InstallerVersionObject
    }

    $match = Get-InstalledApplicationMatch -InstallerMetadata $InstallerMetadata
    $skipInstall = $false
    $canAutoUninstall = $false
    $reason = ''

    if ($match) {
        $trustedUpgradeMatch = $match.ProductCode -and (
            $match.MatchScore -ge 85 -or
            ($match.PublisherMatched -and $match.MatchScore -ge 75)
        )

        if ($InstallerMetadata.ProductCode -and $match.ProductCode -and $InstallerMetadata.ProductCode -eq $match.ProductCode) {
            $skipInstall = $true
            $reason = 'same-product-code'
        } elseif ($match.VersionObject -and $targetVersionObject -and $match.VersionObject -ge $targetVersionObject) {
            $skipInstall = $true
            $reason = 'same-or-newer-version'
        } elseif ($trustedUpgradeMatch -and $match.VersionObject -and $targetVersionObject -and $match.VersionObject -lt $targetVersionObject) {
            $canAutoUninstall = $true
            $reason = 'older-version-conflict'
        } else {
            $reason = 'existing-installation-detected'
        }
    }

    [pscustomobject]@{
        Match = $match
        TargetVersionObject = $targetVersionObject
        SkipInstall = $skipInstall
        CanAutoUninstall = $canAutoUninstall
        Reason = $reason
    }
}

function Get-InstallerConflictLabel {
    param([pscustomobject]$Conflict)

    if (-not $Conflict -or -not $Conflict.Match) { return '' }
    if ($Conflict.Match.DisplayVersion) {
        return "$($Conflict.Match.DisplayName) (v$($Conflict.Match.DisplayVersion))"
    }
    return [string]$Conflict.Match.DisplayName
}

function Invoke-ManagedInstaller {
    param(
        [ValidateSet('msi', 'exe', 'ps1')][string]$Kind,
        [string]$InstallerPath,
        [string]$ArgumentList = '',
        [string]$FallbackDisplayName = '',
        [int[]]$SuccessCodes = @(0, 3010, 1641)
    )

    if (-not $InstallerPath) {
        throw 'instalador sin ruta'
    }

    $installerMetadata = Get-InstallerDetectionMetadata -InstallerPath $InstallerPath -FallbackDisplayName $FallbackDisplayName
    $conflictState = Resolve-InstallerConflictState -InstallerMetadata $installerMetadata -TargetVersion $CurrentVersion

    if ($conflictState.SkipInstall) {
        $InstallDisposition = 'skipped'
        $conflictLabel = Get-InstallerConflictLabel -Conflict $conflictState
        if ($conflictLabel) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Ya existe una version igual o mas reciente de $conflictLabel. No se ejecuta el instalador."
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Ya existe una version igual o mas reciente. No se ejecuta el instalador."
        }
        return [pscustomobject]@{ Status = 'skipped'; ExitCode = 1638 }
    }

    $launchPath = switch ($Kind) {
        'msi' { 'msiexec.exe' }
        'ps1' { 'PowerShell.exe' }
        default { $InstallerPath }
    }

    $process = Start-Process -FilePath $launchPath -ArgumentList $ArgumentList -Wait -NoNewWindow -PassThru
    if ($SuccessCodes -contains $process.ExitCode) {
        $InstallDisposition = 'installed'
        return [pscustomobject]@{ Status = 'success'; ExitCode = $process.ExitCode }
    }

    if ($process.ExitCode -eq 1638) {
        $conflictState = Resolve-InstallerConflictState -InstallerMetadata $installerMetadata -TargetVersion $CurrentVersion

        if ($conflictState.SkipInstall) {
            $InstallDisposition = 'skipped'
            $conflictLabel = Get-InstallerConflictLabel -Conflict $conflictState
            if ($conflictLabel) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Conflicto 1638 resuelto. Ya existe una version valida de $conflictLabel."
            } else {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Conflicto 1638 resuelto. Ya existe una version valida instalada."
            }
            return [pscustomobject]@{ Status = 'skipped'; ExitCode = 1638 }
        }

        if ($conflictState.CanAutoUninstall) {
            $conflictLabel = Get-InstallerConflictLabel -Conflict $conflictState
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Se detecto una version anterior que bloquea la actualizacion ($conflictLabel). Desinstalando y reintentando..."
            $uninstallArgs = "/x $($conflictState.Match.ProductCode) REBOOT=ReallySuppress /qn"
            $uninstallProcess = Start-Process -FilePath 'msiexec.exe' -ArgumentList $uninstallArgs -Wait -NoNewWindow -PassThru
            if ($uninstallProcess.ExitCode -notin @(0, 3010, 1641, 1605)) {
                throw "desinstalador salio con codigo $($uninstallProcess.ExitCode)"
            }

            Start-Sleep -Seconds 5
            $retryProcess = Start-Process -FilePath $launchPath -ArgumentList $ArgumentList -Wait -NoNewWindow -PassThru
            if ($SuccessCodes -contains $retryProcess.ExitCode) {
                $InstallDisposition = 'installed'
                return [pscustomobject]@{ Status = 'success'; ExitCode = $retryProcess.ExitCode; Retried = $true }
            }

            throw "instalador salio con codigo $($retryProcess.ExitCode) tras reintento por conflicto 1638"
        }

        $conflictLabel = Get-InstallerConflictLabel -Conflict $conflictState
        if ($conflictLabel) {
            throw "instalador salio con codigo 1638: ya existe otra version instalada ($conflictLabel)"
        }
        throw 'instalador salio con codigo 1638: ya existe otra version instalada'
    }

    throw "instalador salio con codigo $($process.ExitCode)"
}
`.trim();
}

function getManagedInstallerInvocation(kind, argumentExpression, options = {}) {
  const installerPathExpression = options.installerPathExpression || '$Instalador.FullName';
  const fallbackDisplayNameExpression = options.fallbackDisplayNameExpression || '$NombreApp';
  const successCodesExpression = options.successCodesExpression || '@(0, 3010, 1641)';
  return `Invoke-ManagedInstaller -Kind '${kind}' -InstallerPath ${installerPathExpression} -ArgumentList ${argumentExpression} -FallbackDisplayName ${fallbackDisplayNameExpression} -SuccessCodes ${successCodesExpression} | Out-Null`;
}

function getCustomTemplateValues(template, appConfig) {
  const params = (appConfig && appConfig.customParams && typeof appConfig.customParams === 'object')
    ? appConfig.customParams
    : {};

  return (template?.arguments || []).map(arg => {
    const raw = params[arg.key];
    const value = raw === undefined || raw === null || raw === ''
      ? String(arg.defaultValue || '')
      : String(raw);
    return {
      ...arg,
      value
    };
  });
}

function buildCustomTemplateArgumentLines(template, appConfig) {
  const argumentValues = getCustomTemplateValues(template, appConfig);
  const fileEntries = resolveCustomTemplateFileEntries(template, appConfig);
  const lines = [];

  for (const arg of argumentValues) {
    if (!arg.value) continue;
    lines.push(
      `    if ($TemplateValues.${arg.key}) { $ArgumentSegments += ${buildPsArgumentExpression(arg.token, arg.joiner, arg.quoteValue !== false, `$TemplateValues.${arg.key}`)} }`
    );
  }

  for (const fileEntry of fileEntries) {
    if (!fileEntry.sourcePath || !fileEntry.argumentName) continue;
    lines.push(
      `    if (Test-Path -LiteralPath $TemplateFiles.${fileEntry.key}) { $ArgumentSegments += ${buildPsArgumentExpression(fileEntry.argumentName, fileEntry.joiner, fileEntry.quoteValue !== false, `$TemplateFiles.${fileEntry.key}`)} }`
    );
  }

  return lines.length > 0 ? lines.join('\n') : '    # No template-specific arguments';
}

function generateUserTemplate(cfg, template) {
  const notify = cfg.notifyUser || false;
  const safeName = sanitizeAppName(cfg.name);
  const silentArgs = sanitizePSForEmbedding(cfg.silentArgs || '/S');
  const valueEntries = getCustomTemplateValues(template, cfg);
  const fileEntries = resolveCustomTemplateFileEntries(template, cfg);
  const templateValuesObject = buildPsObjectLiteral(
    valueEntries.map(entry => ({
      key: entry.key,
      expression: `"${sanitizePSForEmbedding(entry.value)}"`
    }))
  );
  const templateFileNamesObject = buildPsObjectLiteral(
    fileEntries.map(entry => ({
      key: entry.key,
      expression: `"${sanitizePSForEmbedding(entry.targetName)}"`
    }))
  );
  const templateFilesObject = buildPsObjectLiteral(
    fileEntries.map(entry => ({
      key: entry.key,
      expression: `Join-Path -Path $CacheDir -ChildPath "${sanitizePSForEmbedding(entry.relativePath || entry.targetName)}"`
    }))
  );
  const selectedXmlEntry = getSelectedXmlTemplateFileEntry(fileEntries);
  const configXmlName = cfg.configXmlPath
    ? sanitizeTemplateFileName(path.basename(cfg.configXmlPath))
    : (selectedXmlEntry?.targetName
        ? sanitizeTemplateFileName(selectedXmlEntry.targetName)
        : '');
  const customScript = typeof template.script === 'string' && template.script.trim()
    ? `${template.script.trimEnd()}\n`
    : '';

  return `# =========================================================================
# USER TEMPLATE - DROP & RUN
# Template: ${sanitizeAppName(template.name)}
# App: ${safeName}
# Version: ${cfg.version || '1.0.0'}
# Generado: ${new Date().toISOString()}
# =========================================================================
$BaseSilentArgs = "${silentArgs}"

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic(undefined, notify, safeName)}
$TemplateValues = ${templateValuesObject}
$TemplateFileNames = ${templateFileNamesObject}
$TemplateFiles = ${templateFilesObject}
$ConfigXmlName = "${sanitizePSForEmbedding(configXmlName)}"
$ConfigXmlPath = if ($ConfigXmlName) { Join-Path -Path $CacheDir -ChildPath $ConfigXmlName } else { $null }
$HasConfigXml = [bool]($ConfigXmlPath -and (Test-Path -LiteralPath $ConfigXmlPath))
$ArgumentSegments = @()
if ($BaseSilentArgs) { $ArgumentSegments += $BaseSilentArgs }
${buildCustomTemplateArgumentLines(template, cfg)}
$ArgumentosExe = ($ArgumentSegments | Where-Object { $_ -and $_.Trim() }) -join ' '

try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`""
        if ($ArgumentosExe) { $msiArgs += " " + $ArgumentosExe }
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        ${getManagedInstallerInvocation('exe', '$ArgumentosExe')}
    }
${customScript}${getTrackerSaveLogic(notify)}
`;
}

const { getToastSnippet } = require('./ps-snippets');
function getNotificationLogic(_appName) {
  return getToastSnippet();
}

function getLocalCachingLogic(filter = "\\.(exe|msi)$", notifyUser = false, appDisplayName = '') {
  const config = configService.getConfig();
  const dict = i18nService.getTranslations(config.language || 'en');
  const ToastTitleProcess = dict.apps?.toastTitleProcess || "Installation in progress";
  const ToastMsgProcess = dict.apps?.toastMsgProcess || "Installing. Please do not turn off your computer.";

  const { getToastSnippet } = require('./ps-snippets');
  const notifyPrefix = notifyUser ? getToastSnippet(ToastTitleProcess, ToastMsgProcess) : '';
  const notifyBefore = '';
  const safeFilter = String(filter || "\\.(exe|msi)$").replace(/"/g, '""');
  return [
    '# ── Guardia $PSScriptRoot (puede estar vacío en GPO startup / PS4) ────────',
    'if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }',
    'if (-not $PSScriptRoot) { $PSScriptRoot = $PWD.Path }',
    '',
    '# ── Logging ────────────────────────────────────────────────────────────',
    '$LogDir = "C:\\ProgramData\\AppDeploy_Logs"',
    'if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }',
    '# ── Limpieza de logs antiguos (>7 días) ─────────────────────────────────',
    'Get-ChildItem "$LogDir\\*.log" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force -ErrorAction SilentlyContinue',
    '',
    '# Split-Path es pura string — no necesita acceso de red (evita fallo si el share aún no responde)',
    '$NombreApp = if ($PSScriptRoot) { Split-Path -Leaf $PSScriptRoot } else { "UnknownApp" }',
    '$LogFile   = "$LogDir\\Install_$($NombreApp)_$(Get-Date -Format \'yyyyMMdd_HHmmss\').log"',
    'Start-Transcript -Path $LogFile -Force -ErrorAction SilentlyContinue',
    '',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] ===== AppDeploy Manager ============================="',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] App     : $NombreApp"',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Equipo  : $env:COMPUTERNAME"',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Usuario : $env:USERNAME"',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Fuente  : $PSScriptRoot"',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] ====================================================="',
    '',
    '$TrackerFile = "$LogDir\\Tracker_$NombreApp.json"',
    '$CleanupMarkerDir = Join-Path $LogDir "PendingCacheCleanup"',
    'if (-not (Test-Path -LiteralPath $CleanupMarkerDir)) { New-Item -ItemType Directory -Path $CleanupMarkerDir -Force | Out-Null }',
    '$CleanupMarkerPath = Join-Path $CleanupMarkerDir "$NombreApp.json"',
    getDeployCacheCleanupLogic(),
    '',
    '# ── Leer manifiesto ─────────────────────────────────────────────────────',
    '$VersionFile = Join-Path $PSScriptRoot "version.json"',
    'if (-not (Test-Path $VersionFile)) {',
    '    Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] OMITIDO: No se encontro version.json en $PSScriptRoot"',
    '    Stop-Transcript -ErrorAction SilentlyContinue',
    '    exit 0',
    '}',
    'try {',
    '    $Manifest       = Get-Content $VersionFile -Raw | ConvertFrom-Json',
    '    $CurrentHash    = $Manifest.hash',
    '    $CurrentVersion = $Manifest.version',
    '    $PrimaryInstallerName = [string]($Manifest.primaryInstallerName)',
    '} catch {',
    '    Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] ERROR: version.json corrupto - $_"',
    '    Stop-Transcript -ErrorAction SilentlyContinue',
    '    exit 1',
    '}',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Version : $CurrentVersion | Hash: $CurrentHash"',
    '',
    getInstallerConflictLogic(),
    '',
    '# ── Comprobar si ya instalado ────────────────────────────────────────────',
    'if (Test-Path $TrackerFile) {',
    '    try {',
    '        $t = Get-Content $TrackerFile -Raw | ConvertFrom-Json',
    '        if ($t.hash -eq $CurrentHash -and $t.result -eq \'success\') {',
    '            Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] OMITIDO: Ya instalado (v$($t.version), hash coincide)"',
    '            Stop-Transcript -ErrorAction SilentlyContinue',
    '            exit 0',
    '        }',
    '        if ($t.hash -eq $CurrentHash -and $t.result -eq \'failed\') {',
    '            Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] OMITIDO: Instalacion fallida previamente (mismo hash). Actualiza la app para reintentar."',
    '            Stop-Transcript -ErrorAction SilentlyContinue',
    '            exit 0',
    '        }',
    '        Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Hash anterior: $($t.hash) - actualizando a $CurrentHash"',
    '    } catch {',
    '        Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] AVISO: Tracker corrupto, reinstalando"',
    '    }',
    '}',
    '',
    '# ── Localizar instalador en share ────────────────────────────────────────',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Buscando instalador en share..."',
    '$InstaladorRed = $null',
    'if ($PrimaryInstallerName) {',
    '    $PrimaryInstallerPath = Join-Path -Path $PSScriptRoot -ChildPath $PrimaryInstallerName',
    '    if (Test-Path -LiteralPath $PrimaryInstallerPath) {',
    '        $InstaladorRed = Get-Item -LiteralPath $PrimaryInstallerPath -ErrorAction SilentlyContinue',
    '    }',
    '}',
    'if (-not $InstaladorRed) {',
    '    $InstaladorRed = Get-ChildItem -Path $PSScriptRoot -File -ErrorAction SilentlyContinue |',
    '                     Where-Object { $_.Extension -match "' + safeFilter + '" -and $_.Name -ne "install.ps1" } |',
    '                     Select-Object -First 1',
    '}',
    'if (-not $InstaladorRed) {',
    '    Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] ERROR: No se encontro instalador (' + safeFilter + ') en $PSScriptRoot"',
    '    if (Test-Path $VersionFile) {',
    '        @{ hash = $CurrentHash; version = $CurrentVersion; failedAt = (Get-Date).ToString(\'o\'); computer = $env:COMPUTERNAME; result = \'failed\'; error = \'Installer not found in share\' } |',
    '            ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8',
    '    }',
    '    Stop-Transcript -ErrorAction SilentlyContinue',
    '    exit 1',
    '}',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Instalador: $($InstaladorRed.Name) ($([Math]::Round($InstaladorRed.Length/1MB,1)) MB)"',
    '',
    '# ── Copiar a cache local ─────────────────────────────────────────────────',
    '$CacheDir = "C:\\Temp\\Deploy\\$NombreApp"',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Copiando a cache: $CacheDir"',
    'try {',
    '    if (-not (Test-Path $CacheDir)) { New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null }',
    '    Copy-Item -Path "$PSScriptRoot\\*" -Destination $CacheDir -Recurse -Force -ErrorAction Stop',
    '    Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Copia completada."',
    '} catch {',
    '    Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] ERROR copiando desde share: $_"',
    '    Stop-Transcript -ErrorAction SilentlyContinue',
    '    exit 1',
    '}',
    '',
    '# ── Localizar instalador en cache ────────────────────────────────────────',
    '$Instalador = $null',
    'if ($PrimaryInstallerName) {',
    '    $PrimaryInstallerCachePath = Join-Path -Path $CacheDir -ChildPath $PrimaryInstallerName',
    '    if (Test-Path -LiteralPath $PrimaryInstallerCachePath) {',
    '        $Instalador = Get-Item -LiteralPath $PrimaryInstallerCachePath -ErrorAction SilentlyContinue',
    '    }',
    '}',
    'if (-not $Instalador) {',
    '    $Instalador = Get-ChildItem -Path $CacheDir -File |',
    '                  Where-Object { $_.Extension -match "' + safeFilter + '" -and $_.Name -ne "install.ps1" } |',
    '                  Select-Object -First 1',
    '}',
    'if (-not $Instalador) {',
    '    Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] ERROR: Instalador no encontrado en cache tras la copia"',
    '    Stop-Transcript -ErrorAction SilentlyContinue',
    '    exit 1',
    '}',
    'Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Ejecutando instalacion..."',
    '# NOTA: $PSScriptRoot sigue apuntando al share (solo lectura). Usar $CacheDir para rutas locales.',
    notifyPrefix,
    notifyBefore,
  ].join('\n');
}

function getTrackerSaveLogic(notifyUser = false) {
  const config = configService.getConfig();
  const dict = i18nService.getTranslations(config.language || 'en');
  const ToastTitleDone = dict.apps?.toastTitleDone || "Installation complete";
  const ToastMsgDone = dict.apps?.toastMsgDone || "Installation completed successfully. You may continue.";

  const { getToastSnippet } = require('./ps-snippets');
  const toastBlock = notifyUser ? getToastSnippet(ToastTitleDone, ToastMsgDone) : '';
  const notifyAfter = notifyUser
    ? `    Send-UserToast -ToastTitle "${ToastTitleDone.replace(/"/g, '\\"')}" -ToastMessage "${ToastMsgDone.replace(/"/g, '\\"')}" -IconType "Information"`
    : '';
  return `
    # ── Exito ──────────────────────────────────────────────────────────
    if ($InstallDisposition -eq 'skipped') {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Instalador no ejecutado; ya existia una version valida para $NombreApp."
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $NombreApp instalado correctamente (v$CurrentVersion)"
    }
${notifyAfter}
    @{ hash = $CurrentHash; version = $CurrentVersion; installedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'success' } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
    Invoke-DeployCacheCleanupWithFallback -CacheDir $CacheDir -MarkerPath $CleanupMarkerPath | Out-Null

} catch {
    # ── Error ──────────────────────────────────────────────────────────
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Fallo instalando $NombreApp - $_"
    @{ hash = $CurrentHash; version = $CurrentVersion; failedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'failed'; error = $_.ToString() } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
    Invoke-DeployCacheCleanupWithFallback -CacheDir $CacheDir -MarkerPath $CleanupMarkerPath | Out-Null
}
Stop-Transcript -ErrorAction SilentlyContinue`;
}

function generateGeneric(cfg) {
  const silentArgs = sanitizePSForEmbedding(cfg.silentArgs || cfg.customParams?.silentArgs || '/S');
  const notify = cfg.notifyUser || false;
  const safeName = sanitizeAppName(cfg.name);
  return `# =========================================================================
# PLANTILLA GENÉRICA "DROP & RUN"
# App: ${safeName}
# Versión: ${cfg.version || '1.0.0'}
# Generado: ${new Date().toISOString()}
# =========================================================================
$ArgumentosExe = "${silentArgs}"

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.(exe|msi|ps1)$", notify, safeName)}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" " + $ArgumentosExe
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } elseif ($Instalador.Extension -eq ".ps1") {
        $psArgs = "-ExecutionPolicy Bypass -File \`"$($Instalador.FullName)\`""
        if ($ArgumentosExe) { $psArgs += " " + $ArgumentosExe }
        ${getManagedInstallerInvocation('ps1', '$psArgs')}
    } else {
        ${getManagedInstallerInvocation('exe', '$ArgumentosExe')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateFreshservice(cfg) {
  const token = sanitizePSForEmbedding(cfg.customParams?.token || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# FRESHSERVICE AGENT - DROP & RUN
# App: ${sanitizeAppName(cfg.name)}
# Version: ${cfg.version || '1.0.0'}
# Generado: ${new Date().toISOString()}
# =========================================================================
$Token = "${token}"

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" REGISTRATIONTOKEN=\`"$Token\`" /qn /norestart"
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        ${getManagedInstallerInvocation('exe', '"/S REGISTRATIONTOKEN=\`"$Token\`""')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateCrowdstrike(cfg) {
  const cid = sanitizePSForEmbedding(cfg.customParams?.cid || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CROWDSTRIKE FALCON - DROP & RUN
# App: ${sanitizeAppName(cfg.name)}
# Version: ${cfg.version || '1.0.0'}
# Generado: ${new Date().toISOString()}
# =========================================================================
$CID = "${cid}"

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$", notify, sanitizeAppName(cfg.name))}
try {
    ${getManagedInstallerInvocation('exe', '"/S /quiet /install CID=$CID"')}
${getTrackerSaveLogic(notify)}
`;
}

function generateSapGui(cfg) {
  const notify = cfg.notifyUser || false;
  const safeName = sanitizeAppName(cfg.name);
  const sapTheme = /^\d+$/.test(String(cfg.customParams?.sapTheme)) ? parseInt(cfg.customParams.sapTheme) : 1;
  return `# =========================================================================
# SAP GUI - DROP & RUN
# App: ${safeName}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$", notify, safeName)}
try {
    ${getManagedInstallerInvocation('exe', '"/silent"')}

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
    New-ItemProperty -Path $themePath -Name "SelectedTheme" -Value ${sapTheme} -PropertyType DWord -Force | Out-Null
${getTrackerSaveLogic(notify)}
`;
}

function generateForticlient(cfg) {
  const vpnName = sanitizeAppName(cfg.customParams?.vpnName || 'VPN');
  const vpnDesc = sanitizePSForEmbedding(cfg.customParams?.vpnDescription || 'VPN Corporativa');
  const vpnServer = sanitizePSForEmbedding(cfg.customParams?.vpnServer || '0.0.0.0:443');
  const sso = cfg.customParams?.ssoEnabled === false ? 0 : 1;
  const srvCert = cfg.customParams?.serverCert === true ? 1 : 0;
  const noWarn = cfg.customParams?.noWarnInvalidCert === false ? 0 : 1;
  const notify = cfg.notifyUser || false;
  
  return `# =========================================================================
# FORTICLIENT VPN - DROP & RUN
# App: ${sanitizeAppName(cfg.name)}
# Generado: ${new Date().toISOString()}
# =========================================================================
$FcVpnName   = "${vpnName}"
$FcVpnDesc   = "${vpnDesc}"
$FcVpnServer = "${vpnServer}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.(exe|msi)$", notify, vpnName)}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" REBOOT=ReallySuppress /qn"
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        ${getManagedInstallerInvocation('exe', '"/S /silent /NORESTART"')}
    }

    $vpnPath = "HKLM:\\SOFTWARE\\Fortinet\\FortiClient\\Sslvpn\\Tunnels\\$FcVpnName"
    if (-not (Test-Path -LiteralPath $vpnPath)) { New-Item $vpnPath -Force -ea SilentlyContinue | Out-Null }

    New-ItemProperty -LiteralPath $vpnPath -Name 'Description' -Value $FcVpnDesc  -PropertyType String -Force -ea SilentlyContinue | Out-Null
    New-ItemProperty -LiteralPath $vpnPath -Name 'Server'      -Value $FcVpnServer -PropertyType String -Force -ea SilentlyContinue | Out-Null
    New-ItemProperty -LiteralPath $vpnPath -Name 'sso_enabled' -Value ${sso} -PropertyType DWord -Force -ea SilentlyContinue | Out-Null
    New-ItemProperty -LiteralPath $vpnPath -Name 'ServerCert' -Value '${srvCert}' -PropertyType String -Force -ea SilentlyContinue | Out-Null

    $sslPath = "HKLM:\\SOFTWARE\\Fortinet\\FortiClient\\Sslvpn"
    if (-not (Test-Path -LiteralPath $sslPath)) { New-Item $sslPath -Force -ea SilentlyContinue | Out-Null }
    New-ItemProperty -LiteralPath $sslPath -Name 'no_warn_invalid_cert' -Value ${noWarn} -PropertyType DWord -Force -ea SilentlyContinue | Out-Null
${getTrackerSaveLogic(notify)}
`;
}

function generateOffice(cfg) {
  const configXml = cfg.configXmlPath
    ? sanitizeTemplateFileName(path.basename(cfg.configXmlPath))
    : (sanitizeTemplateFileName(cfg.customParams?.configXml || 'config_office.xml') || 'config_office.xml');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# MICROSOFT OFFICE - DROP & RUN
# App: ${sanitizeAppName(cfg.name)}
# Generado: ${new Date().toISOString()}
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}
${getLocalCachingLogic("\\.exe$", notify, sanitizeAppName(cfg.name))}
try {
    $RutaXML = Join-Path -Path $CacheDir -ChildPath "${configXml}"
    ${getManagedInstallerInvocation('exe', '"/configure \`"$RutaXML\`""')}
${getTrackerSaveLogic(notify)}
`;
}

function generateCustom(cfg) {
  const safeName = sanitizeAppName(cfg.name);
  const code = cfg.customParams?.customScript || '';
  const safeCode = code.replace(/[`$]/g, '`$&');
  return `# =========================================================================
# SCRIPT CUSTOM RAW
# App: ${safeName}
# Generado: ${new Date().toISOString()}
# ADVERTENCIA: Este script ejecuta codigo personalizado. Usar con cautela.
# =========================================================================
${safeCode}
`;
}

function generateWazuh(cfg) {
  const manager = sanitizePSForEmbedding(cfg.customParams?.manager || '');
  const group = sanitizePSForEmbedding(cfg.customParams?.group || 'default');
  const pwd = sanitizePSForEmbedding(cfg.customParams?.password || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# WAZUH AGENT - DROP & RUN
# App: ${sanitizeAppName(cfg.name)}
# =========================================================================
$WazuhManager = "${manager}"
$WazuhGroup   = "${group}"
$WazuhPwd     = "${pwd}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" WAZUH_MANAGER=\`"$WazuhManager\`" WAZUH_AGENT_GROUP=\`"$WazuhGroup\`""
        if ($WazuhPwd) { $msiArgs += " WAZUH_REGISTRATION_PASSWORD=\`"$WazuhPwd\`"" }
        $msiArgs += " /qn"
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        $exeArgs = "WAZUH_MANAGER=\`"$WazuhManager\`" WAZUH_AGENT_GROUP=\`"$WazuhGroup\`""
        if ($WazuhPwd) { $exeArgs += " WAZUH_REGISTRATION_PASSWORD=\`"$WazuhPwd\`"" }
        $exeArgs += " /S"
        ${getManagedInstallerInvocation('exe', '$exeArgs')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateSentinelOne(cfg) {
  const st = sanitizePSForEmbedding(cfg.customParams?.siteToken || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# SENTINELONE - DROP & RUN
# =========================================================================
$SiteToken = "${st}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" SITE_TOKEN=\`"$SiteToken\`" /qn"
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        ${getManagedInstallerInvocation('exe', '"-t $SiteToken -q"')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateCortexXDR(cfg) {
  const dir = sanitizePSForEmbedding(cfg.customParams?.installDir || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CORTEX XDR - DROP & RUN
# =========================================================================
$CortexDir = "${dir}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
        if ($CortexDir) { $msiArgs += " INSTALLDIR=\`"$CortexDir\`"" }
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        $exeArgs = "/S /quiet"
        if ($CortexDir) { $exeArgs += " /D=\`"$CortexDir\`"" }
        ${getManagedInstallerInvocation('exe', '$exeArgs')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateBitdefender(cfg) {
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# BITDEFENDER BEST - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        ${getManagedInstallerInvocation('exe', '"/silent"')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateZscaler(cfg) {
  const cloud = sanitizePSForEmbedding(cfg.customParams?.cloudName || 'zscaler');
  const domain = sanitizePSForEmbedding(cfg.customParams?.userDomain || '');
  const strict = cfg.customParams?.strictEnforcement ? '1' : '0';
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# ZSCALER ZCC - DROP & RUN
# =========================================================================
$ZscCloud  = "${cloud}"
$ZscDomain = "${domain}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" CLOUDNAME=\`"$ZscCloud\`" STRICTENFORCEMENT=${strict} /qn"
        if ($ZscDomain) { $msiArgs += " USERDOMAIN=\`"$ZscDomain\`"" }
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        $exeArgs = "/S /CLOUDNAME=\`"$ZscCloud\`" /STRICTENFORCEMENT=${strict}"
        if ($ZscDomain) { $exeArgs += " /USERDOMAIN=\`"$ZscDomain\`"" }
        ${getManagedInstallerInvocation('exe', '$exeArgs')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateGlobalProtect(cfg) {
  const portal = sanitizePSForEmbedding(cfg.customParams?.portal || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# GLOBALPROTECT - DROP & RUN
# =========================================================================
$VpnPortal = "${portal}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" PORTAL=\`"$VpnPortal\`" /qn"
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        $exeArgs = "/s"
        if ($VpnPortal) { $exeArgs += " PORTAL=\`"$VpnPortal\`"" }
        ${getManagedInstallerInvocation('exe', '$exeArgs')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateCiscoSecureClient(cfg) {
  const xml = sanitizeAppName(cfg.customParams?.profileXml || 'profile.xml');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CISCO SECURE CLIENT - DROP & RUN
# =========================================================================
$XmlProfile = "${xml}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        ${getManagedInstallerInvocation('exe', '"/S /s"')}
    }

    $xmlSource = Join-Path -Path $CacheDir -ChildPath $XmlProfile
    $xmlDestDir = "C:\\ProgramData\\Cisco\\Cisco Secure Client\\VPN\\Profile"
    if (-not (Test-Path $xmlDestDir)) { New-Item -ItemType Directory -Path $xmlDestDir -Force | Out-Null }
    if (Test-Path $xmlSource) {
        Copy-Item -Path $xmlSource -Destination "$xmlDestDir\\$XmlProfile" -Force
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateLansweeper(cfg) {
  const srv = sanitizePSForEmbedding(cfg.customParams?.server || '');
  const port = sanitizePSForEmbedding(cfg.customParams?.port || '9524');
  const key = sanitizePSForEmbedding(cfg.customParams?.agentKey || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# LANSWEEPER LSAGENT - DROP & RUN
# =========================================================================
$LsServer = "${srv}"
$LsPort   = "${port}"
$LsKey    = "${key}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    $args = "--mode unattended"
    if ($LsServer) { $args += " --server $LsServer --port $LsPort" }
    if ($LsKey)    { $args += " --agentkey $LsKey" }
    ${getManagedInstallerInvocation('exe', '$args')}
${getTrackerSaveLogic(notify)}
`;
}

function generateNinjaOne(cfg) {
  const tk = sanitizePSForEmbedding(cfg.customParams?.token || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# NINJAONE / DATTO RMM - DROP & RUN
# =========================================================================
$NinjaTk = "${tk}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
        if ($NinjaTk) { $msiArgs += " TOKEN=\`"$NinjaTk\`"" }
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        $exeArgs = "/S /silent"
        if ($NinjaTk) { $exeArgs += " /TOKEN=\`"$NinjaTk\`"" }
        ${getManagedInstallerInvocation('exe', '$exeArgs')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateTeamViewer(cfg) {
  const cid = sanitizePSForEmbedding(cfg.customParams?.customId || '');
  const api = sanitizePSForEmbedding(cfg.customParams?.apiToken || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# TEAMVIEWER HOST - DROP & RUN
# =========================================================================
$TvCid = "${cid}"
$TvApi = "${api}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
        if ($TvCid) { $msiArgs += " CUSTOMCONFIGID=\`"$TvCid\`"" }
        if ($TvApi) { $msiArgs += " APITOKEN=\`"$TvApi\`"" }
        $msiArgs += " ASSIGNMENTOPTIONS=\`"--grant-easy-access\`""
        ${getManagedInstallerInvocation('msi', '$msiArgs')}
    } else {
        $exeArgs = "--silent"
        if ($TvCid) { $exeArgs += " --id $TvCid" }
        if ($TvApi) { $exeArgs += " --token $TvApi" }
        ${getManagedInstallerInvocation('exe', '$exeArgs')}
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateAnyDesk(cfg) {
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# ANYDESK CUSTOM - DROP & RUN
# =========================================================================
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
        Invoke-ManagedInstaller -Kind 'msi' -InstallerPath $Instalador.FullName -ArgumentList $msiArgs -FallbackDisplayName $NombreApp -SuccessCodes @(0, 3010, 1641) | Out-Null
    } else {
        Start-Process -FilePath $Instalador.FullName -ArgumentList "--install --start-with-win --silent" -Wait -NoNewWindow
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateVeeam(cfg) {
  const xml = sanitizeAppName(cfg.customParams?.configXml || 'veeam_config.xml');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# VEEAM AGENT - DROP & RUN
# =========================================================================
$XmlProfile = "${xml}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn /norestart"
        Invoke-ManagedInstaller -Kind 'msi' -InstallerPath $Instalador.FullName -ArgumentList $msiArgs -FallbackDisplayName $NombreApp -SuccessCodes @(0, 3010, 1641) | Out-Null
    } else {
        Invoke-ManagedInstaller -Kind 'exe' -InstallerPath $Instalador.FullName -ArgumentList "/silent /norestart" -FallbackDisplayName $NombreApp -SuccessCodes @(0, 3010, 1641) | Out-Null
    }

    $xmlSource = Join-Path -Path $CacheDir -ChildPath $XmlProfile
    if (Test-Path $xmlSource) {
        Start-Sleep -Seconds 15
        Start-Process -FilePath "C:\\Program Files\\Veeam\\Endpoint Backup\\Veeam.Agent.Configurator.exe" -ArgumentList "-setVBRsettings /f:\`"$xmlSource\`"" -Wait -NoNewWindow
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateCrashPlan(cfg) {
  const url = sanitizePSForEmbedding(cfg.customParams?.url || '');
  const token = sanitizePSForEmbedding(cfg.customParams?.token || '');
  const notify = cfg.notifyUser || false;
  return `# =========================================================================
# CRASHPLAN ENTERPRISE - DROP & RUN
# =========================================================================
$CpUrl   = "${url}"
$CpToken = "${token}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") { Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit }
${getLocalCachingLogic("\\.(exe|msi)$", notify, sanitizeAppName(cfg.name))}
try {
    if ($Instalador.Extension -eq ".msi") {
        $msiArgs = "/i \`"$($Instalador.FullName)\`" /qn"
        if ($CpUrl)   { $msiArgs += " DEPLOYMENT_URL=\`"$CpUrl\`"" }
        if ($CpToken) { $msiArgs += " DEPLOYMENT_TOKEN=\`"$CpToken\`"" }
        Invoke-ManagedInstaller -Kind 'msi' -InstallerPath $Instalador.FullName -ArgumentList $msiArgs -FallbackDisplayName $NombreApp -SuccessCodes @(0, 3010, 1641) | Out-Null
    } else {
        $exeArgs = "/S"
        if ($CpUrl)   { $exeArgs += " /DEPLOYMENT_URL=\`"$CpUrl\`"" }
        if ($CpToken) { $exeArgs += " /DEPLOYMENT_TOKEN=\`"$CpToken\`"" }
        Invoke-ManagedInstaller -Kind 'exe' -InstallerPath $Instalador.FullName -ArgumentList $exeArgs -FallbackDisplayName $NombreApp -SuccessCodes @(0, 3010, 1641) | Out-Null
    }
${getTrackerSaveLogic(notify)}
`;
}

function generateWinget(cfg) {
  const wingetId = sanitizePSForEmbedding(cfg.wingetId || '');
  const wingetSource = sanitizePSForEmbedding(sanitizeWingetSource(cfg.wingetSource || 'winget'));
  const version  = sanitizePSForEmbedding(cfg.version || '1.0.0');
  const notify   = cfg.notifyUser || false;
  const config   = configService.getConfig();
  const dict     = i18nService.getTranslations(config.language || 'en');
  const ToastTitleProcess = dict.apps?.toastTitleProcess || 'Installation in progress';
  const ToastMsgProcess   = dict.apps?.toastMsgProcess   || 'Installing. Please do not turn off your computer.';
  const ToastTitleDone    = dict.apps?.toastTitleDone    || 'Installation complete';
  const ToastMsgDone      = dict.apps?.toastMsgDone      || 'Installation completed successfully.';

  const { getToastSnippet } = require('./ps-snippets');
  const notifyPrefix = notify ? getToastSnippet(ToastTitleProcess, ToastMsgProcess) : '';
  const notifyAfter  = notify ? `    Send-UserToast -ToastTitle "${ToastTitleDone.replace(/"/g, '\\"')}" -ToastMessage "${ToastMsgDone.replace(/"/g, '\\"')}" -IconType "Information"` : '';

  return `# =========================================================================
# WINGET INSTALL - DROP & RUN
# App: ${sanitizeAppName(cfg.name)} [${wingetId}]
# Version: ${version}
# Generado: ${new Date().toISOString()}
# =========================================================================
$wingetId = "${wingetId}"
$wingetSource = "${wingetSource}"
If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}

# Guardia $PSScriptRoot (puede estar vacío en GPO startup / PS4)
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $PSScriptRoot) { $PSScriptRoot = $PWD.Path }

$LogDir = "C:\\ProgramData\\AppDeploy_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
Get-ChildItem "$LogDir\\*.log" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force -ErrorAction SilentlyContinue
# Split-Path es pura string — no necesita acceso de red
$NombreApp = if ($PSScriptRoot) { Split-Path -Leaf $PSScriptRoot } else { "UnknownApp" }
$LogFile   = "$LogDir\\Install_$($NombreApp)_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Start-Transcript -Path $LogFile -Force -ErrorAction SilentlyContinue

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ===== AppDeploy Manager ============================="
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] App     : $NombreApp [winget: $wingetId | source: $wingetSource]"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Equipo  : $env:COMPUTERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Usuario : $env:USERNAME"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ====================================================="

$TrackerFile = "$LogDir\\Tracker_$NombreApp.json"
$UserTaskName = "ADDM_Install_$NombreApp"
$UserTaskPs1  = Join-Path $LogDir ("WingetUserInstall_" + $NombreApp + ".ps1")
$UserTaskVbs  = Join-Path $LogDir ("WingetUserInstall_" + $NombreApp + ".vbs")

function Clear-UserWingetArtifacts {
    param(
        [switch]$Quiet
    )

    try { Unregister-ScheduledTask -TaskName $UserTaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
    foreach ($artifact in @($UserTaskPs1, $UserTaskVbs)) {
        try {
            if (Test-Path $artifact) { Remove-Item -Path $artifact -Force -ErrorAction SilentlyContinue }
        } catch {}
    }
    if (-not $Quiet) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] INFO: Artefactos user-scope limpiados para $NombreApp"
    }
}

# ── Leer version desde manifiesto de red ─────────────────
$CurrentVersion = "$version"
$VersionFile = Join-Path $PSScriptRoot "version.json"
if (Test-Path $VersionFile) {
    try { $CurrentVersion = (Get-Content $VersionFile -Raw | ConvertFrom-Json).version } catch {}
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Version : $CurrentVersion"

# ── Salir si ya esta instalado en esta version ───────────
${notifyPrefix}

# ── Localizar winget (contexto SYSTEM / GPO startup) ─────
# Varios métodos porque SYSTEM no tiene acceso normal a WindowsApps
$Winget = $null

# Método 1: PATH / stub sistema (Windows 11 22H2+)
$fromPath = (Get-Command winget.exe -ErrorAction SilentlyContinue).Source
if ($fromPath -and (Test-Path $fromPath)) { $Winget = $fromPath }

# Método 2: Symlink en System32 (Windows 11 23H2+)
if (-not $Winget) {
    $p = "$env:SystemRoot\System32\winget.exe"
    if (Test-Path $p) { $Winget = $p }
}

# Método 3: Enumerar WindowsApps con cmd /c dir (evita ACL de SYSTEM)
if (-not $Winget) {
    $appsBase = "$env:ProgramFiles\WindowsApps"
    $entry = (& cmd.exe /c "dir /b /ad \`"$appsBase\`" 2>nul") -split "\`n" |
             Where-Object { $_ -like 'Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe' } |
             Sort-Object -Descending | Select-Object -First 1
    if ($entry) { $Winget = "$appsBase\$($entry.Trim())\winget.exe" }
}

# Método 4: Get-AppxPackage (puede fallar en inicio, pero se intenta)
if (-not $Winget) {
    try {
        $pkg = Get-AppxPackage -AllUsers "Microsoft.DesktopAppInstaller" -ErrorAction SilentlyContinue |
               Sort-Object { [version]($_.Version -replace '[^0-9.]','') } -Descending | Select-Object -First 1
        if ($pkg) {
            $p = Join-Path $pkg.InstallLocation "winget.exe"
            if (Test-Path $p) { $Winget = $p }
        }
    } catch {}
}

if (-not $Winget) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: winget.exe no encontrado. Requiere Windows 10 21H2+ con App Installer (Microsoft Store)."
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] winget: $Winget"

function Test-WingetPackageInstalled {
    param(
        [string]$WingetPath,
        [string]$PackageId,
        [string]$PackageSource = ''
    )

    try {
        $listArgs = @('list', '--id', "$PackageId", '--exact', '--accept-source-agreements', '--disable-interactivity')
        if ($PackageSource) { $listArgs += @('--source', "$PackageSource") }
        $output = & $WingetPath @listArgs 2>&1 | Out-String
        return ($LASTEXITCODE -eq 0 -and $output -match [regex]::Escape($PackageId))
    } catch {
        return $false
    }
}

function Wait-WingetPackageInstalled {
    param(
        [string]$WingetPath,
        [string]$PackageId,
        [string]$PackageSource = '',
        [int]$MaxAttempts = 5,
        [int]$SleepSeconds = 3
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if (Test-WingetPackageInstalled -WingetPath $WingetPath -PackageId $PackageId -PackageSource $PackageSource) {
            return $true
        }
        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds $SleepSeconds
        }
    }
    return $false
}

function Test-WingetUserTaskPending {
    try {
        return [bool](Get-ScheduledTask -TaskName $UserTaskName -ErrorAction SilentlyContinue)
    } catch {
        return $false
    }
}

if (Test-Path $TrackerFile) {
    try {
        $t = Get-Content $TrackerFile -Raw | ConvertFrom-Json
        if ($t.version -eq $CurrentVersion -and $t.result -in @('success', 'scheduled')) {
            $installedNow = Wait-WingetPackageInstalled -WingetPath $Winget -PackageId $wingetId -PackageSource $wingetSource -MaxAttempts 2 -SleepSeconds 2
            if ($installedNow) {
                Clear-UserWingetArtifacts -Quiet
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Ya instalado (v$CurrentVersion, estado real verificado)"
                Stop-Transcript -ErrorAction SilentlyContinue
                exit 0
            }

            if ($t.result -eq 'scheduled' -and (Test-WingetUserTaskPending)) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Instalacion programada pendiente para $wingetId"
                Stop-Transcript -ErrorAction SilentlyContinue
                exit 0
            }

            if ($t.result -eq 'success') {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Tracker marcaba exito, pero $wingetId no aparece instalado. Se reintentara."
            } else {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Tracker marcaba instalacion programada, pero no hay app ni tarea pendiente. Se reintentara."
            }
            Clear-UserWingetArtifacts -Quiet
        }
    } catch {}
}

# Actualizar fuentes (necesario en contexto SYSTEM; ignorar error si falla)
try { & $Winget source update --disable-interactivity 2>&1 | Out-Null } catch {}

# ── Instalar ─────────────────────────────────────────────
# Códigos de salida conocidos de winget:
#   0            = éxito
#   1618         = otra instalación en curso (Windows Installer busy)
#  -1978335212  = APPINSTALLER_CLI_ERROR_UPDATE_NOT_APPLICABLE (ya actualizado, éxito)
#  -1978335189  = APPINSTALLER_CLI_ERROR_PACKAGE_ALREADY_INSTALLED (éxito)
#  -1978335140  = APPINSTALLER_CLI_ERROR_NO_APPLICABLE_UPDATE (sin actualización, éxito)
#  -1978335160  = APPINSTALLER_CLI_ERROR_NO_APPLICABLE_INSTALLER → reintentar sin --scope machine
$WingetSuccess = @(0, 1618, -1978335212, -1978335189, -1978335140)
$WingetNoScope = @(-1978335160, -1978335215, -1978335216)  # no machine-scope installer → retry sin scope
$WingetUserOnly = @(-1978335146, -1978335215, -1978335216) # app solo usuario → instalar via tarea programada
try {
    $packageInstalled = $false
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Ejecutando: winget install --id $wingetId --source $wingetSource --scope machine"
    & $Winget install --id "$wingetId" --source "$wingetSource" --silent --accept-package-agreements --accept-source-agreements --scope machine 2>&1 | Out-Null
    $ec = $LASTEXITCODE
    if ($ec -in $WingetNoScope) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: --scope machine no soportado (codigo $ec). Reintentando sin --scope..."
        & $Winget install --id "$wingetId" --source "$wingetSource" --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        $ec = $LASTEXITCODE
    }
    if ($ec -in $WingetSuccess) {
        $packageInstalled = Wait-WingetPackageInstalled -WingetPath $Winget -PackageId $wingetId -PackageSource $wingetSource
        if (-not $packageInstalled) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: winget devolvio codigo de exito ($ec), pero $wingetId no quedo detectable. Se intentara resolver en contexto de usuario."
            $ec = -1
        }
    }
    if ($ec -notin $WingetSuccess) {
        # Último intento: --scope user (apps solo usuario)
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Reintentando con --scope user (app solo usuario, codigo $ec)..."
        & $Winget install --id "$wingetId" --source "$wingetSource" --silent --accept-package-agreements --accept-source-agreements --scope user 2>&1 | Out-Null
        $ec = $LASTEXITCODE
        if ($ec -in $WingetSuccess) {
            $packageInstalled = Wait-WingetPackageInstalled -WingetPath $Winget -PackageId $wingetId -PackageSource $wingetSource -MaxAttempts 3 -SleepSeconds 2
            if (-not $packageInstalled) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: winget devolvio codigo de exito en --scope user ($ec), pero la app no quedo detectable en SYSTEM. Se programara la instalacion en la siguiente sesion."
                $ec = -1
            }
        }
    }
    if ($ec -notin $WingetSuccess) {
        # App solo usuario que no puede instalarse en contexto SYSTEM → programar tarea de usuario
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: App de usuario ($wingetId). Creando tarea programada para instalacion en proximo inicio de sesion..."
        $taskName = $UserTaskName
        try {
            Clear-UserWingetArtifacts -Quiet
            $userInstallPs1 = $UserTaskPs1
            $userInstallVbs = $UserTaskVbs
            $userInstallScript = @'
$taskName = '__TASKNAME__'
$wingetId = '__WINGET_ID__'
$wingetSource = '__WINGET_SOURCE__'
$trackerFile = '__TRACKER_FILE__'
$currentVersion = '__CURRENT_VERSION__'
$helperPs1 = '__HELPER_PS1__'
$helperVbs = '__HELPER_VBS__'
$appName = '__APP_NAME__'
$successCodes = @(0, 1618, -1978335212, -1978335189, -1978335140)

function Complete-UserWingetTask {
    param(
        [string]$Method = 'winget-usertask'
    )

    try {
        @{
            version = $currentVersion
            installedAt = (Get-Date).ToString('o')
            computer = $env:COMPUTERNAME
            user = $env:USERNAME
            result = 'success'
            method = $Method
            wingetId = $wingetId
        } | ConvertTo-Json | Set-Content -Path $trackerFile -Force -Encoding UTF8
    } catch {}

    try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
    foreach ($file in @($helperPs1, $helperVbs)) {
        try { Remove-Item -Path $file -Force -ErrorAction SilentlyContinue } catch {}
    }
    exit 0
}

function Test-WingetPackageInstalled {
    param(
        [string]$WingetPath,
        [string]$PackageId,
        [string]$PackageSource = ''
    )

    try {
        $listArgs = @('list', '--id', "$PackageId", '--exact', '--accept-source-agreements', '--disable-interactivity')
        if ($PackageSource) { $listArgs += @('--source', "$PackageSource") }
        $output = & $WingetPath @listArgs 2>&1 | Out-String
        return ($LASTEXITCODE -eq 0 -and $output -match [regex]::Escape($PackageId))
    } catch {
        return $false
    }
}

function Wait-WingetPackageInstalled {
    param(
        [string]$WingetPath,
        [string]$PackageId,
        [string]$PackageSource = '',
        [int]$MaxAttempts = 5,
        [int]$SleepSeconds = 3
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if (Test-WingetPackageInstalled -WingetPath $WingetPath -PackageId $PackageId -PackageSource $PackageSource) {
            return $true
        }
        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds $SleepSeconds
        }
    }
    return $false
}

$WingetUser = (Get-Command winget.exe -ErrorAction SilentlyContinue).Source
if (-not $WingetUser -or -not (Test-Path $WingetUser)) {
    $candidate = Join-Path $env:LOCALAPPDATA 'Microsoft\\WindowsApps\\winget.exe'
    if (Test-Path $candidate) { $WingetUser = $candidate }
}
if (-not $WingetUser) {
    $candidate = "$env:SystemRoot\\System32\\winget.exe"
    if (Test-Path $candidate) { $WingetUser = $candidate }
}
if (-not $WingetUser) { exit 1 }

if (Test-WingetPackageInstalled -WingetPath $WingetUser -PackageId $wingetId -PackageSource $wingetSource) {
    Complete-UserWingetTask -Method 'winget-usertask-detected'
}

& $WingetUser install --id "$wingetId" --source "$wingetSource" --silent --accept-package-agreements --accept-source-agreements --scope user 2>&1 | Out-Null
$ec = $LASTEXITCODE
if (($ec -in $successCodes) -and (Wait-WingetPackageInstalled -WingetPath $WingetUser -PackageId $wingetId -PackageSource $wingetSource)) {
    Complete-UserWingetTask
}
exit $ec
'@
            $userInstallScript = $userInstallScript.Replace('__TASKNAME__', $taskName)
            $userInstallScript = $userInstallScript.Replace('__WINGET_ID__', $wingetId)
            $userInstallScript = $userInstallScript.Replace('__WINGET_SOURCE__', $wingetSource)
            $userInstallScript = $userInstallScript.Replace('__TRACKER_FILE__', $TrackerFile)
            $userInstallScript = $userInstallScript.Replace('__CURRENT_VERSION__', $CurrentVersion)
            $userInstallScript = $userInstallScript.Replace('__HELPER_PS1__', $userInstallPs1)
            $userInstallScript = $userInstallScript.Replace('__HELPER_VBS__', $userInstallVbs)
            $userInstallScript = $userInstallScript.Replace('__APP_NAME__', $NombreApp)
            Set-Content -Path $userInstallPs1 -Value $userInstallScript -Encoding UTF8 -Force

            $userInstallVbsContent = @'
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""__HELPER_PS1__""", 0, False
'@
            $userInstallVbsContent = $userInstallVbsContent.Replace('__HELPER_PS1__', $userInstallPs1)
            Set-Content -Path $userInstallVbs -Value $userInstallVbsContent -Encoding ASCII -Force

            $action   = New-ScheduledTaskAction -Execute "wscript.exe" \`
                          -Argument "//B //NoLogo \`"$userInstallVbs\`""
            $trigger  = New-ScheduledTaskTrigger -AtLogOn
            $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries \`
                          -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable
            # Ejecutar como usuario interactivo que inicie sesion; evita depender de GroupId/idioma del SO
            $principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\\INTERACTIVE" -LogonType Interactive -RunLevel Limited
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger \`
                -Settings $settings -Principal $principal \`
                -Description "Instalacion de $NombreApp vía AD Deploy Manager" -Force -ErrorAction Stop | Out-Null
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: Tarea programada '$taskName' creada - se instalara en el proximo inicio de sesion del usuario"
            @{ version = $CurrentVersion; scheduledAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'scheduled'; method = 'winget-usertask'; wingetId = "$wingetId" } |
                ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
            Stop-Transcript -ErrorAction SilentlyContinue
            exit 0
        } catch {
            throw "No se pudo crear la tarea programada '$taskName': $($_.Exception.Message)"
        }
    }

    if (-not $packageInstalled) {
        throw "winget finalizo sin error bloqueante, pero no se pudo confirmar la instalacion real de $wingetId"
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $NombreApp instalado correctamente (v$CurrentVersion)"
    Clear-UserWingetArtifacts -Quiet
${notifyAfter}
    @{ version = $CurrentVersion; installedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'success'; method = 'winget'; wingetId = "$wingetId" } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Fallo instalando $NombreApp - $_"
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

  // All known ODT apps that can be excluded
  const ALL_ODT_APPS = ['Access', 'Excel', 'Groove', 'InfoPath', 'Lync', 'OneNote', 'OneDrive', 'Outlook', 'PowerPoint', 'Publisher', 'SharePointDesigner', 'Teams', 'Word'];
  const alwaysExclude = ['Groove', 'Lync'];

  // If user selected specific apps, exclude everything else
  let userExclude = odtConfig.excludeApps || [];
  if (Array.isArray(odtConfig.apps) && odtConfig.apps.length > 0) {
    // apps contains the IDs to INCLUDE; exclude everything not in the list
    userExclude = ALL_ODT_APPS.filter(a => !odtConfig.apps.includes(a));
  }
  const allExcluded   = [...new Set([...alwaysExclude, ...userExclude])];
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

# Guardia $PSScriptRoot (puede estar vacío en GPO startup / PS4)
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $PSScriptRoot) { $PSScriptRoot = $PWD.Path }

$LogDir = "C:\\ProgramData\\AppDeploy_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
Get-ChildItem "$LogDir\\*.log" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force -ErrorAction SilentlyContinue
$NombreApp = if ($PSScriptRoot) { Split-Path -Leaf $PSScriptRoot } else { "UnknownApp" }
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
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: No se encontro version.json en $PSScriptRoot"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 0
}
try {
    $Manifest       = Get-Content $VersionFile -Raw | ConvertFrom-Json
    $CurrentHash    = $Manifest.hash
    $CurrentVersion = $Manifest.version
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: version.json corrupto - $_"
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Version : $CurrentVersion"

# ── Comprobar si ya instalado (Office en registro + tracker) ─
$OfficeInstalled = Get-ItemProperty \`
    "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
    "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" \`
    -ErrorAction SilentlyContinue |
    Where-Object {
        ($_.DisplayName -like "*Microsoft Office*" -or $_.DisplayName -like "*Microsoft 365*") -and
        $_.DisplayName -notlike "*Language Pack*" -and
        $_.DisplayName -notlike "*Proofing Tools*" -and
        $_.DisplayName -notlike "*Update*"
    } |
    Select-Object -First 1
$ClickToRunConfig = Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration" -ErrorAction SilentlyContinue
$InstalledOfficeProducts = @()
if ($ClickToRunConfig -and $ClickToRunConfig.ProductReleaseIds) {
    $InstalledOfficeProducts = @($ClickToRunConfig.ProductReleaseIds -split '[,;]') |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ }
}
$TargetOfficeInstalled = $InstalledOfficeProducts -contains "${productId}"
if ($TargetOfficeInstalled -or $OfficeInstalled) {
    $OfficeDetectedName = if ($TargetOfficeInstalled) { "${productId}" } else { $OfficeInstalled.DisplayName }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OMITIDO: Office ya instalado - $OfficeDetectedName"
    @{ version = $CurrentVersion; hash = $CurrentHash; installedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'success'; method = 'odt-detected'; product = "${productId}" } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
    Stop-Transcript -ErrorAction SilentlyContinue
    exit 0
}

# ── Localizar ODT setup.exe ──────────────────────────────
# Si el admin dejó setup.exe en el share, usarlo directamente
$OdtSetup = Join-Path $PSScriptRoot "setup.exe"

if (-not (Test-Path $OdtSetup)) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] setup.exe no encontrado en share. Descargando Office Deployment Tool..."
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] RECOMENDADO: coloca setup.exe del ODT en $PSScriptRoot para evitar esta descarga."
    $OdtTemp    = "$env:TEMP\\odt_installer_$(Get-Random).exe"
    $OdtExtract = "$env:TEMP\\odt_$(Get-Random)"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    # ── Intento 1: FWLink oficial (descarga directa sin HEAD) ──
    if (-not (Test-Path $OdtSetup -ErrorAction SilentlyContinue)) {
        try {
            $wc1 = New-Object System.Net.WebClient
            $wc1.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            $wc1.DownloadFile("https://go.microsoft.com/fwlink/?linkid=2232433", $OdtTemp)
            if ((Get-Item $OdtTemp -ErrorAction SilentlyContinue).Length -gt 512KB) {
                New-Item -ItemType Directory -Path $OdtExtract -Force | Out-Null
                Start-Process $OdtTemp -ArgumentList "/quiet /extract:\`"$OdtExtract\`"" -Wait -NoNewWindow
                $candidate = Join-Path $OdtExtract "setup.exe"
                if (Test-Path $candidate) { $OdtSetup = $candidate; Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ODT listo via FWLink: $OdtSetup" }
            } else { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: FWLink devolvio archivo invalido (probablemente redireccion)" }
        } catch { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Intento FWLink fallido: $_" }
    }

    # ── Intento 2: URL de fallback conocida ──
    if (-not (Test-Path $OdtSetup -ErrorAction SilentlyContinue)) {
        try {
            $OdtUrl2 = "https://download.microsoft.com/download/2/7/A/27AF1BE6-DD20-4CB4-B154-EBAB8A7D4A7E/officedeploymenttool_17531-20046.exe"
            $OdtTemp2 = "$env:TEMP\\odt2_$(Get-Random).exe"
            $OdtExtract2 = "$env:TEMP\\odt2_$(Get-Random)"
            $wc2 = New-Object System.Net.WebClient
            $wc2.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            $wc2.DownloadFile($OdtUrl2, $OdtTemp2)
            if ((Get-Item $OdtTemp2 -ErrorAction SilentlyContinue).Length -gt 512KB) {
                New-Item -ItemType Directory -Path $OdtExtract2 -Force | Out-Null
                Start-Process $OdtTemp2 -ArgumentList "/quiet /extract:\`"$OdtExtract2\`"" -Wait -NoNewWindow
                $candidate2 = Join-Path $OdtExtract2 "setup.exe"
                if (Test-Path $candidate2) { $OdtSetup = $candidate2; Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ODT listo via URL fallback: $OdtSetup" }
            }
        } catch { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] AVISO: Intento URL fallback fallido: $_" }
    }

    if (-not (Test-Path $OdtSetup -ErrorAction SilentlyContinue)) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: No se pudo descargar el ODT por ninguna via"
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] SOLUCION: Coloca setup.exe del ODT manualmente en $PSScriptRoot"
        Stop-Transcript -ErrorAction SilentlyContinue
        exit 1
    }
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
    if ($LASTEXITCODE -ne 0) { throw "ODT setup.exe salio con codigo $LASTEXITCODE" }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $NombreApp instalado correctamente (v$CurrentVersion)"
${notifyAfter}
    @{ version = $CurrentVersion; hash = $CurrentHash; installedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'success'; method = 'odt'; product = "${productId}" } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: Fallo instalando $NombreApp - $_"
    @{ version = $CurrentVersion; hash = $CurrentHash; failedAt = (Get-Date).ToString('o'); computer = $env:COMPUTERNAME; result = 'failed'; error = $_.ToString() } |
        ConvertTo-Json | Set-Content -Path $TrackerFile -Force -Encoding UTF8
}
Stop-Transcript -ErrorAction SilentlyContinue
`;
}

module.exports = scriptService;
