const fs = require('fs');
const path = require('path');

let bundlesFilePath = null;

function getBundlesPath() {
  if (!bundlesFilePath) {
    const { app } = require('electron');
    bundlesFilePath = path.join(app.getPath('userData'), 'bundles-config.json');
  }
  return bundlesFilePath;
}

// ─── Share-backed storage (Option A: share is source of truth) ────────
function getShareMetaPath(filename) {
  try {
    const configService = require('./config');
    const cfg = configService.getConfig();
    if (!cfg || !cfg.networkSharePath) return null;
    return path.join(cfg.networkSharePath, '.appdeploy-meta', filename);
  } catch (e) {
    return null;
  }
}

function tryReadShare(filename) {
  const sharePath = getShareMetaPath(filename);
  if (!sharePath) return null;
  try {
    if (fs.existsSync(sharePath)) {
      return JSON.parse(fs.readFileSync(sharePath, 'utf-8'));
    }
  } catch (err) {
    console.warn(`[share] Could not read ${filename} from share:`, err.message);
  }
  return null;
}

function tryWriteShare(filename, data) {
  const sharePath = getShareMetaPath(filename);
  if (!sharePath) return false;
  try {
    const dir = path.dirname(sharePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(sharePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn(`[share] Could not write ${filename} to share:`, err.message);
    return false;
  }
}

function loadBundles() {
  // Share is authoritative
  const fromShare = tryReadShare('bundles-config.json');
  if (fromShare !== null) {
    try {
      fs.writeFileSync(getBundlesPath(), JSON.stringify(fromShare, null, 2), 'utf-8');
    } catch (e) {}
    return fromShare;
  }
  // Fallback to local cache
  try {
    const p = getBundlesPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading bundles:', err);
  }
  return [];
}

function saveBundles(bundles) {
  fs.writeFileSync(getBundlesPath(), JSON.stringify(bundles, null, 2), 'utf-8');
  tryWriteShare('bundles-config.json', bundles);
}

function generateId() {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

const bundleService = {
  getAll() {
    return loadBundles();
  },

  get(id) {
    const bundles = loadBundles();
    return bundles.find(b => b.id === id) || null;
  },

  create(data) {
    const bundles = loadBundles();
    const newBundle = {
      id: generateId(),
      name: data.name || 'Nuevo Bundle',
      description: data.description || '',
      apps: data.apps || [],       // [{ appId, name, order }]
      notifyUser: data.notifyUser || false,
      gpoName: data.gpoName || '',
      createGPO: data.createGPO || false,
      ouDN: data.ouDN || '',
      version: data.version || '1.0.0',
      deployed: false,
      deployedPath: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    bundles.push(newBundle);
    saveBundles(bundles);
    return newBundle;
  },

  update(id, data) {
    const bundles = loadBundles();
    const idx = bundles.findIndex(b => b.id === id);
    if (idx === -1) return null;
    bundles[idx] = { ...bundles[idx], ...data, updatedAt: new Date().toISOString() };
    saveBundles(bundles);
    return bundles[idx];
  },

  remove(id) {
    const bundles = loadBundles();
    const filtered = bundles.filter(b => b.id !== id);
    saveBundles(filtered);
    return { success: true };
  },

  replaceAll(bundles) {
    saveBundles(Array.isArray(bundles) ? bundles : []);
    return { success: true };
  },

  generateBundleScript(bundle, apps, config) {
    const appEntries = bundle.apps
      .sort((a, b) => a.order - b.order)
      .map(entry => {
        const app = apps.find(a => a.id === entry.appId);
        if (!app) return null;
        const appFolder = path.join(config.networkSharePath, app.name, 'install.ps1');
        return { name: app.name, scriptPath: appFolder };
      })
      .filter(Boolean);

    const notifyBlock = bundle.notifyUser ? `
# ── Notificación al usuario ──────────────────────────
function Send-UserToast {
    param([string]$Title, [string]$Message, [string]$IconType)
    try {
        $LoggedUser = (Get-CimInstance Win32_ComputerSystem).UserName
        if (-not $LoggedUser) { return }
        $rnd = Get-Random -Minimum 1000 -Maximum 99999
        $toastCode = "Add-Type -AssemblyName System.Windows.Forms; " +
            "\`$b = New-Object System.Windows.Forms.NotifyIcon; " +
            "\`$b.Icon = [System.Drawing.SystemIcons]::$IconType; " +
            "\`$b.BalloonTipTitle = '$Title'; " +
            "\`$b.BalloonTipText = '$Message'; " +
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
` : '';

    const notifyStart = bundle.notifyUser
      ? `Send-UserToast -Title "Instalación en proceso" -Message "Se están instalando ${bundle.apps.length} aplicaciones del pack ${bundle.name}. No apague el equipo." -IconType "Warning"`
      : '';

    const notifyEnd = bundle.notifyUser
      ? `Send-UserToast -Title "Instalación completada" -Message "Todas las aplicaciones del pack ${bundle.name} se han procesado. Ya puede continuar." -IconType "Information"`
      : '';

    const appBlocks = appEntries.map((app, i) => {
      return `
# ── App ${i + 1}/${appEntries.length}: ${app.name} ──
$AppScript = "${app.scriptPath}"
if (Test-Path $AppScript) {
    Write-Output "[$(Get-Date -Format 'HH:mm:ss')] Ejecutando: ${app.name}..."
    try {
        & powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File $AppScript
        Write-Output "[$(Get-Date -Format 'HH:mm:ss')] OK: ${app.name}"
    } catch {
        Write-Output "[$(Get-Date -Format 'HH:mm:ss')] ERROR: ${app.name} - $_"
    }
} else {
    Write-Output "[$(Get-Date -Format 'HH:mm:ss')] SKIP: ${app.name} - Script no encontrado"
}`;
    }).join('\n');

    return `# =========================================================================
# BUNDLE: ${bundle.name}
# Apps: ${appEntries.map(a => a.name).join(', ')}
# Versión: ${bundle.version}
# Generado: ${new Date().toISOString()}
# =========================================================================

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}

$BundleName = "${bundle.name}"
$LogDir = "C:\\ProgramData\\AppDeploy_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$BundleTracker = "$LogDir\\Tracker_Bundle_$($BundleName -replace '\\s','_').txt"
$BundleVersion = "${bundle.version}"

# Comprobar si esta versión exacta ya se ejecutó
$LastVersion = if (Test-Path $BundleTracker) { Get-Content $BundleTracker } else { "" }
if ($LastVersion -eq $BundleVersion) { exit }

Start-Transcript -Path "$LogDir\\BundleLog_$($BundleName -replace '\\s','_').log" -Append -Force
Write-Output "=========================================="
Write-Output "Bundle: $BundleName v$BundleVersion"
Write-Output "Inicio: $(Get-Date)"
Write-Output "=========================================="
${notifyBlock}
${notifyStart}
${appBlocks}

${notifyEnd}

# Marcar versión como ejecutada
Set-Content -Path $BundleTracker -Value $BundleVersion -Force
Write-Output "=========================================="
Write-Output "Bundle completado: $(Get-Date)"
Write-Output "=========================================="
Stop-Transcript
`;
  },

  async deployBundle(bundle, apps, config) {
    try {
      const bundlesDir = path.join(config.networkSharePath, '_bundles');
      const bundleFolder = path.join(bundlesDir, bundle.name.replace(/\s/g, '_'));

      if (!fs.existsSync(bundleFolder)) {
        fs.mkdirSync(bundleFolder, { recursive: true });
      }

      // Generate and write bundle script
      const script = this.generateBundleScript(bundle, apps, config);
      const scriptPath = path.join(bundleFolder, 'bundle_install.ps1');
      fs.writeFileSync(scriptPath, script, 'utf-8');

      // Write bundle manifest
      const manifest = {
        name: bundle.name,
        version: bundle.version,
        apps: bundle.apps,
        notifyUser: bundle.notifyUser,
        deployedAt: new Date().toISOString()
      };
      fs.writeFileSync(path.join(bundleFolder, 'bundle.json'), JSON.stringify(manifest, null, 2), 'utf-8');

      return { success: true, path: scriptPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = bundleService;
