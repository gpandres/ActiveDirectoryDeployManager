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
const { createShareStore } = require('./share-store');
const bundlesShareStore = createShareStore('bundles-config.json');

function loadBundles() {
  // Share is authoritative
  const fromShare = bundlesShareStore.read();
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
  bundlesShareStore.write(bundles);
}

function generateId() {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
    const ouDNs = normalizeDNArray(data.ouDNs || data.ouDN);
    const newBundle = {
      id: generateId(),
      name: data.name || 'Nuevo Bundle',
      description: data.description || '',
      apps: data.apps || [],       // [{ appId, name, order }]
      notifyUser: data.notifyUser || false,
      gpoName: data.gpoName || '',
      createGPO: data.createGPO || false,
      ouDN: ouDNs[0] || '',
      ouDNs,
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
    const ouDNs = normalizeDNArray(
      data.ouDNs !== undefined ? data.ouDNs : (data.ouDN !== undefined ? data.ouDN : bundles[idx].ouDNs || bundles[idx].ouDN)
    );
    bundles[idx] = { ...bundles[idx], ...data, ouDN: ouDNs[0] || '', ouDNs, updatedAt: new Date().toISOString() };
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
    const safeBundleName = (bundle.name || 'Bundle').replace(/[^a-zA-Z0-9\s\-_.,()]/g, '').substring(0, 128);
    const appEntries = bundle.apps
      .sort((a, b) => a.order - b.order)
      .map(entry => {
        const app = apps.find(a => a.id === entry.appId);
        if (!app) return null;
        const safeAppName = (app.name || 'App').replace(/[^a-zA-Z0-9\s\-_.,()]/g, '');
        const appFolder = path.join(config.networkSharePath, app.name, 'install.ps1');
        return { name: safeAppName, scriptPath: appFolder };
      })
      .filter(Boolean);

    const { getToastSnippet } = require('./ps-snippets');
    const notifyBlock = bundle.notifyUser ? getToastSnippet() : '';
    const startMsg = `Se estan instalando ${bundle.apps.length} aplicaciones del pack. No apague.`;
    const endMsg = `Todas las apps del pack ${safeBundleName} se han procesado.`;

    const notifyStart = bundle.notifyUser
      ? `Send-UserToast -ToastTitle "Instalacion en proceso" -ToastMessage "${startMsg}" -IconType "Warning"`
      : '';

    const notifyEnd = bundle.notifyUser
      ? `Send-UserToast -ToastTitle "Instalacion completada" -ToastMessage "${endMsg}" -IconType "Information"`
      : '';

    const appBlocks = appEntries.map((app, i) => {
      return `
# ── App ${i + 1}/${appEntries.length}: ${app.name} ──
$AppScript = "${app.scriptPath.replace(/"/g, '`"')}"
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
# BUNDLE: ${safeBundleName}
# Apps: ${appEntries.map(a => a.name).join(', ')}
# Version: ${bundle.version}
# Generado: ${new Date().toISOString()}
# =========================================================================

If ($ENV:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
    Try { &"$ENV:WINDIR\\SysNative\\WindowsPowershell\\v1.0\\PowerShell.exe" -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCOMMANDPATH } Catch { } ; Exit
}

$BundleName = "${safeBundleName}"
$LogDir = "C:\\ProgramData\\AppDeploy_Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$BundleTracker = "$LogDir\\Tracker_Bundle_$($BundleName -replace '\\s','_').txt"
$BundleVersion = "${(bundle.version || '1.0.0').replace(/[^a-zA-Z0-9.]/g, '')}"

# Comprobar si esta version exacta ya se ejecuto
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

# Marcar version como ejecutada
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
      const safeName = (bundle.name || 'bundle').replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 64);
      const bundleFolder = path.normalize(path.join(bundlesDir, safeName));

      if (!bundleFolder.startsWith(path.normalize(bundlesDir))) {
        return { success: false, error: 'Invalid bundle name' };
      }

      if (!fs.existsSync(bundleFolder)) {
        fs.mkdirSync(bundleFolder, { recursive: true });
      }

      // Generate and write bundle script
      const script = this.generateBundleScript(bundle, apps, config);
      const scriptPath = path.join(bundleFolder, 'bundle_install.ps1');
      fs.writeFileSync(scriptPath, '\uFEFF' + script, 'utf-8');

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
