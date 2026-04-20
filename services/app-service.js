const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { resolveNamedSubdirectory } = require('./path-utils');

let appsFilePath = null;

function getAppsPath() {
  if (!appsFilePath) {
    const { app } = require('electron');
    appsFilePath = path.join(app.getPath('userData'), 'apps-config.json');
  }
  return appsFilePath;
}

// ─── Share-backed storage (Option A: share is source of truth) ────────
// Local userData copy acts as a cache so the app still works offline.
const { createShareStore } = require('./share-store');
const appsShareStore = createShareStore('apps-config.json');

function loadApps() {
  // Share is authoritative — pull from there if available
  const fromShare = appsShareStore.read();
  if (fromShare !== null) {
    const normalized = Array.isArray(fromShare) ? fromShare.map(normalizeAppRecord) : [];
    // Mirror to local cache for offline fallback
    try {
      fs.writeFileSync(getAppsPath(), JSON.stringify(normalized, null, 2), 'utf-8');
    } catch (e) {}
    return normalized.map(hydrateAppShareState);
  }
  // Fallback to local cache (offline or share not yet configured)
  try {
    const p = getAppsPath();
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeAppRecord) : [];
      return normalized.map(hydrateAppShareState);
    }
  } catch (err) {
    console.error('Error loading apps:', err);
  }
  return [];
}

function saveApps(apps) {
  const normalized = Array.isArray(apps) ? apps.map(normalizeAppRecord) : [];
  // Always write local cache
  fs.writeFileSync(getAppsPath(), JSON.stringify(normalized, null, 2), 'utf-8');
  // Best-effort mirror to share
  appsShareStore.write(normalized);
}

function generateId() {
  return crypto.randomUUID();
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

function inferInstallerType(installerType, installerPath, template) {
  const normalizedTemplate = String(template || '').trim().toLowerCase();
  const normalizedType = String(installerType || '').trim().toLowerCase();
  if (normalizedTemplate === 'winget') return 'winget';
  if (normalizedTemplate === 'odt') return 'odt';
  if (normalizedType) return normalizedType;
  const ext = path.extname(String(installerPath || '')).toLowerCase();
  if (ext === '.msi') return 'msi';
  if (ext === '.ps1') return 'ps1';
  return 'exe';
}

function normalizePublishedAction(value, fallback = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['install', 'uninstall', 'pending'].includes(normalized)) return normalized;
  return fallback;
}

function normalizeUninstallConfig(value, context = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const template = String(context.template || '').trim().toLowerCase();
  const installerType = inferInstallerType(context.installerType, context.installerPath, context.template);
  let mode = String(raw.mode || '').trim().toLowerCase();

  if (!mode) {
    if (template === 'winget') mode = 'winget';
    else if (installerType === 'msi') mode = 'auto-msi';
    else if (template === 'custom' || template === 'odt') mode = 'none';
    else mode = 'auto-registry';
  }

  if (template === 'winget') mode = 'winget';
  if (mode === 'auto-msi' && installerType !== 'msi') {
    mode = template === 'winget' ? 'winget' : 'auto-registry';
  }
  if (!['none', 'auto-msi', 'auto-registry', 'manual', 'winget'].includes(mode)) {
    mode = 'none';
  }

  return {
    mode,
    command: typeof raw.command === 'string' ? raw.command : '',
    args: typeof raw.args === 'string' ? raw.args : '',
    registryMatchName: typeof raw.registryMatchName === 'string'
      ? raw.registryMatchName
      : (typeof context.name === 'string' ? context.name : ''),
    registryMatchPublisher: typeof raw.registryMatchPublisher === 'string' ? raw.registryMatchPublisher : '',
    productCode: typeof raw.productCode === 'string' ? raw.productCode : '',
    scriptPath: typeof raw.scriptPath === 'string' ? raw.scriptPath : '',
    preparedAt: typeof raw.preparedAt === 'string' ? raw.preparedAt : ''
  };
}

function normalizeAppRecord(app) {
  const assignedOUs = normalizeDNArray(app?.assignedOUs || app?.ouDN);
  const normalized = {
    ...app,
    installerType: inferInstallerType(app?.installerType, app?.installerPath, app?.template),
    ouDN: assignedOUs[0] || '',
    assignedOUs
  };

  normalized.uninstall = normalizeUninstallConfig(normalized.uninstall, normalized);
  normalized.uninstallDeployedPath = typeof normalized.uninstallDeployedPath === 'string'
    ? normalized.uninstallDeployedPath
    : (normalized.uninstall?.scriptPath || '');
  normalized.publishedAction = normalizePublishedAction(
    normalized.publishedAction,
    normalized.deployed ? 'install' : 'pending'
  );
  normalized.publishedAt = typeof normalized.publishedAt === 'string' ? normalized.publishedAt : '';

  return normalized;
}

function readAppDeploymentManifest(appRecord) {
  try {
    const shareHealth = require('./share-health');
    if (!shareHealth.isAvailableSync()) return null;
    const configService = require('./config');
    const config = configService.getConfig();
    if (!config?.networkSharePath || !appRecord?.name) return null;

    const { path: appFolder } = resolveNamedSubdirectory(config.networkSharePath, appRecord.name, 'App');
    const manifestPath = path.join(appFolder, 'version.json');
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function hydrateAppShareState(appRecord) {
  const normalized = normalizeAppRecord(appRecord);
  const manifest = readAppDeploymentManifest(normalized);
  if (!manifest || typeof manifest !== 'object') {
    return normalized;
  }

  const uninstallMeta = manifest.uninstall && typeof manifest.uninstall === 'object'
    ? manifest.uninstall
    : {};

  const manifestActionValue = String(manifest.publishedAction || manifest.currentAction || '').trim().toLowerCase();
  const hasExplicitPublishedAction = ['install', 'uninstall', 'pending'].includes(manifestActionValue);
  let publishedAction = normalizePublishedAction(
    manifestActionValue,
    normalized.publishedAction
  );

  if (!hasExplicitPublishedAction && publishedAction === 'pending') {
    const activeScriptPath = String(manifest.activeScriptPath || '').trim().toLowerCase();
    const uninstallScriptPath = String(uninstallMeta.scriptPath || '').trim().toLowerCase();
    if (activeScriptPath && uninstallScriptPath && activeScriptPath === uninstallScriptPath) {
      publishedAction = 'uninstall';
    } else if (manifest.installScriptPath || manifest.deployedAt) {
      publishedAction = 'install';
    }
  }

  const hydrated = {
    ...normalized,
    deployedPath: typeof manifest.installScriptPath === 'string' && manifest.installScriptPath
      ? manifest.installScriptPath
      : normalized.deployedPath,
    uninstallDeployedPath: typeof uninstallMeta.scriptPath === 'string' && uninstallMeta.scriptPath
      ? uninstallMeta.scriptPath
      : normalized.uninstallDeployedPath,
    publishedAction,
    publishedAt: typeof manifest.publishedAt === 'string' && manifest.publishedAt
      ? manifest.publishedAt
      : (
        typeof manifest.lastUninstallPreparedAt === 'string' && manifest.lastUninstallPreparedAt
          ? manifest.lastUninstallPreparedAt
          : (
            typeof manifest.lastInstallAt === 'string' && manifest.lastInstallAt
              ? manifest.lastInstallAt
              : normalized.publishedAt
          )
      )
  };

  hydrated.uninstall = normalizeUninstallConfig({
    ...hydrated.uninstall,
    mode: uninstallMeta.mode || hydrated.uninstall?.mode,
    command: uninstallMeta.command || hydrated.uninstall?.command,
    args: uninstallMeta.args || hydrated.uninstall?.args,
    registryMatchName: uninstallMeta.registryMatchName || hydrated.uninstall?.registryMatchName,
    registryMatchPublisher: uninstallMeta.registryMatchPublisher || hydrated.uninstall?.registryMatchPublisher,
    productCode: uninstallMeta.productCode || hydrated.uninstall?.productCode,
    scriptPath: uninstallMeta.scriptPath || hydrated.uninstall?.scriptPath,
    preparedAt: uninstallMeta.generatedAt || hydrated.uninstall?.preparedAt
  }, hydrated);

  return hydrated;
}

function syncAppShareManifest(appRecord) {
  try {
    const normalized = normalizeAppRecord(appRecord);
    const manifest = readAppDeploymentManifest(normalized);
    if (!manifest || typeof manifest !== 'object') return;

    const publishedAction = normalizePublishedAction(
      normalized.publishedAction,
      manifest.publishedAction || (normalized.deployed ? 'install' : 'pending')
    );
    const publishedAt = typeof normalized.publishedAt === 'string' && normalized.publishedAt
      ? normalized.publishedAt
      : (typeof manifest.publishedAt === 'string' ? manifest.publishedAt : '');
    const installScriptPath = typeof normalized.deployedPath === 'string' && normalized.deployedPath
      ? normalized.deployedPath
      : (typeof manifest.installScriptPath === 'string' ? manifest.installScriptPath : '');
    const existingUninstall = manifest.uninstall && typeof manifest.uninstall === 'object'
      ? manifest.uninstall
      : {};
    const uninstallScriptPath = typeof normalized.uninstallDeployedPath === 'string' && normalized.uninstallDeployedPath
      ? normalized.uninstallDeployedPath
      : (typeof existingUninstall.scriptPath === 'string' ? existingUninstall.scriptPath : '');
    const uninstallConfig = normalizeUninstallConfig({
      ...existingUninstall,
      ...normalized.uninstall,
      scriptPath: uninstallScriptPath
    }, normalized);
    const activeScriptPath = publishedAction === 'uninstall'
      ? uninstallScriptPath
      : (publishedAction === 'install' ? installScriptPath : '');

    const nextManifest = {
      ...manifest,
      app: normalized.name || manifest.app,
      version: normalized.version || manifest.version || '1.0.0',
      template: normalized.template || manifest.template || 'generic',
      notifyUser: typeof normalized.notifyUser === 'boolean' ? normalized.notifyUser : !!manifest.notifyUser,
      installScriptPath,
      publishedAction,
      activeScriptPath,
      publishedAt,
      deployedAt: publishedAction === 'install'
        ? (publishedAt || manifest.deployedAt || '')
        : (manifest.deployedAt || ''),
      lastInstallAt: publishedAction === 'install'
        ? (publishedAt || manifest.lastInstallAt || manifest.deployedAt || '')
        : (manifest.lastInstallAt || manifest.deployedAt || ''),
      lastUninstallPreparedAt: publishedAction === 'uninstall'
        ? (publishedAt || manifest.lastUninstallPreparedAt || existingUninstall.generatedAt || '')
        : (manifest.lastUninstallPreparedAt || existingUninstall.generatedAt || ''),
      uninstall: {
        ...existingUninstall,
        mode: uninstallConfig.mode,
        available: !!uninstallScriptPath,
        command: uninstallConfig.command || '',
        args: uninstallConfig.args || '',
        registryMatchName: uninstallConfig.registryMatchName || '',
        registryMatchPublisher: uninstallConfig.registryMatchPublisher || '',
        productCode: uninstallConfig.productCode || '',
        wingetId: uninstallConfig.wingetId || existingUninstall.wingetId || '',
        wingetSource: uninstallConfig.wingetSource || existingUninstall.wingetSource || '',
        scriptPath: uninstallScriptPath,
        generatedAt: publishedAction === 'uninstall'
          ? (publishedAt || existingUninstall.generatedAt || '')
          : (existingUninstall.generatedAt || '')
      }
    };

    const configService = require('./config');
    const config = configService.getConfig();
    if (!config?.networkSharePath || !normalized.name) return;

    const { path: appFolder } = resolveNamedSubdirectory(config.networkSharePath, normalized.name, 'App');
    const manifestPath = path.join(appFolder, 'version.json');
    fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2), 'utf-8');
  } catch (err) {}
}

const appService = {
  getAll() {
    return loadApps();
  },

  get(id) {
    const apps = loadApps();
    return apps.find(a => a.id === id) || null;
  },

  create(data) {
    const apps = loadApps();
    const assignedOUs = normalizeDNArray(data.assignedOUs || data.ouDN);
    const newApp = normalizeAppRecord({
      id: generateId(),
      name: data.name || 'Nueva App',
      template: data.template || 'generic',
      installerType: inferInstallerType(data.installerType, data.installerPath, data.template),
      silentArgs: data.silentArgs || '/S',
      installerPath: data.installerPath || '',
      configXmlPath: data.configXmlPath || '',
      wingetId: data.wingetId || '',
      wingetSource: data.wingetSource || '',
      odtConfig: data.odtConfig || null,
      customParams: data.customParams || {},
      templateFiles: data.templateFiles || {},
      templateDefinition: data.templateDefinition || null,
      ouDN: assignedOUs[0] || '',
      assignedOUs,
      gpoName: data.gpoName || '',
      createGPO: data.createGPO || false,
      version: data.version || '1.0.0',
      notifyUser: data.notifyUser || false,
      lastDeployHash: '',
      versionHistory: [],
      deployed: data.deployed || false,
      deployedPath: data.deployedPath || '',
      uninstall: data.uninstall || null,
      uninstallDeployedPath: data.uninstallDeployedPath || '',
      publishedAction: data.publishedAction || (data.deployed ? 'install' : 'pending'),
      publishedAt: data.publishedAt || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    apps.push(newApp);
    saveApps(apps);
    syncAppShareManifest(newApp);
    return hydrateAppShareState(newApp);
  },

  update(id, data) {
    const apps = loadApps();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const assignedOUs = normalizeDNArray(
      data.assignedOUs !== undefined ? data.assignedOUs : (data.ouDN !== undefined ? data.ouDN : apps[idx].assignedOUs || apps[idx].ouDN)
    );
    apps[idx] = normalizeAppRecord({
      ...apps[idx],
      ...data,
      ouDN: assignedOUs[0] || '',
      assignedOUs,
      updatedAt: new Date().toISOString()
    });
    saveApps(apps);
    syncAppShareManifest(apps[idx]);
    return hydrateAppShareState(apps[idx]);
  },

  remove(id, deleteFiles) {
    const apps = loadApps();
    const appToDelete = apps.find(a => a.id === id);
    if (!appToDelete) return { success: false, error: 'App not found' };

    if (deleteFiles) {
      const configService = require('./config');
      const cfg = configService.getConfig();
      if (cfg && cfg.networkSharePath) {
        try {
          const { path: folderPath } = resolveNamedSubdirectory(cfg.networkSharePath, appToDelete.name, 'App');
          if (fs.existsSync(folderPath)) {
            fs.rmSync(folderPath, { recursive: true, force: true });
          }
        } catch (err) {
          console.error('Error deleting app files:', err);
        }
      }
    }

    const filtered = apps.filter(a => a.id !== id);
    saveApps(filtered);
    return { success: true };
  },

  bulkAssignGPO(ids, gpoName) {
    const apps = loadApps();
    let updated = 0;
    apps.forEach(a => {
      if (ids.includes(a.id)) {
        a.gpoName = gpoName;
        a.updatedAt = new Date().toISOString();
        updated++;
      }
    });
    saveApps(apps);
    return { success: true, updated };
  },

  // Apply an assignment plan in a single call.
  // plan = { toAssign: [{ appId, ouDN }], toUnassign: [{ appId, ouDN }] }
  // Calls AD link/unlink per pair and updates each app's assignedOUs
  // atomically based on the actual AD result (only persists pairs that
  // AD confirms).
  async applyAssignmentPlan(plan) {
    const adService = require('./ad-service');
    const toAssign = Array.isArray(plan?.toAssign) ? plan.toAssign : [];
    const toUnassign = Array.isArray(plan?.toUnassign) ? plan.toUnassign : [];

    const results = {
      success: true,
      assigned: [],
      unassigned: [],
      failures: []
    };

    // Load once, mutate, save once at the end
    const apps = loadApps();
    const byId = new Map(apps.map(a => [a.id, a]));

    // Unassignments first — reduces chance of unique-link conflicts
    for (const { appId, ouDN } of toUnassign) {
      const app = byId.get(appId);
      if (!app) {
        results.failures.push({ action: 'unassign', appId, ouDN, error: 'App not found' });
        continue;
      }
      if (app.gpoName) {
        const adResult = await adService.unlinkGPOfromOU(app.gpoName, ouDN);
        if (!adResult.success) {
          results.success = false;
          results.failures.push({ action: 'unassign', appId, ouDN, appName: app.name, error: adResult.error });
          continue;
        }
      }
      app.assignedOUs = (app.assignedOUs || []).filter(dn => dn !== ouDN);
      app.updatedAt = new Date().toISOString();
      results.unassigned.push({ appId, ouDN });
    }

    for (const { appId, ouDN } of toAssign) {
      const app = byId.get(appId);
      if (!app) {
        results.failures.push({ action: 'assign', appId, ouDN, error: 'App not found' });
        continue;
      }
      if (app.gpoName) {
        const adResult = await adService.linkGPOtoOU(app.gpoName, ouDN);
        if (!adResult.success) {
          results.success = false;
          results.failures.push({ action: 'assign', appId, ouDN, appName: app.name, error: adResult.error });
          continue;
        }
      } else {
        results.failures.push({ action: 'assign', appId, ouDN, appName: app.name, error: 'App has no GPO' });
        results.success = false;
        continue;
      }
      const ous = new Set(app.assignedOUs || []);
      ous.add(ouDN);
      app.assignedOUs = Array.from(ous);
      app.updatedAt = new Date().toISOString();
      results.assigned.push({ appId, ouDN });
    }

    saveApps(apps);
    return results;
  },

  getInstallerVersion(filePath) {
    return new Promise((resolve) => {
      try {
        if (!filePath || !fs.existsSync(filePath)) {
          return resolve({ success: false, error: 'File not found' });
        }
        const ext = path.extname(filePath).toLowerCase();
        // Security: only allow .exe and .msi, reject paths with dangerous characters
        if (!['.exe', '.msi'].includes(ext)) {
          return resolve({ success: false, error: 'Unsupported file type' });
        }
        if (/[;|`$&{}]/.test(filePath)) {
          return resolve({ success: false, error: 'Invalid file path characters' });
        }
        let psCommand;

        if (ext === '.exe') {
          psCommand = `$v = (Get-Item -LiteralPath '${filePath.replace(/'/g, "''")}').VersionInfo; if ($v.ProductVersion) { Write-Output $v.ProductVersion } elseif ($v.FileVersion) { Write-Output $v.FileVersion } else { Write-Output '' }`;
        } else if (ext === '.msi') {
          psCommand = `
            $msiPath = '${filePath.replace(/'/g, "''")}'
            $installer = New-Object -ComObject WindowsInstaller.Installer
            $db = $installer.GetType().InvokeMember('OpenDatabase','InvokeMethod',$null,$installer,@($msiPath,0))
            $view = $db.GetType().InvokeMember('OpenView','InvokeMethod',$null,$db,@("SELECT Value FROM Property WHERE Property = 'ProductVersion'"))
            $view.GetType().InvokeMember('Execute','InvokeMethod',$null,$view,$null) | Out-Null
            $record = $view.GetType().InvokeMember('Fetch','InvokeMethod',$null,$view,$null)
            if ($record) {
              $ver = $record.GetType().InvokeMember('StringData','GetProperty',$null,$record,1)
              Write-Output $ver
            }
            $view.GetType().InvokeMember('Close','InvokeMethod',$null,$view,$null) | Out-Null
          `;
        } else {
          return resolve({ success: false, error: 'Unsupported file type' });
        }

        const ps = execFile(
          'powershell',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
          { maxBuffer: 1024 * 1024, timeout: 15000 },
          (error, stdout) => {
            if (error) return resolve({ success: false, error: error.message });
            const version = (stdout || '').trim();
            if (!version) return resolve({ success: false, error: 'No version metadata found' });
            resolve({ success: true, version });
          }
        );
        ps.stdin.write(psCommand);
        ps.stdin.end();
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  },

  cleanupTempFiles() {
    // Both runPowerShell (ad-service) and getInstallerVersion now use stdin,
    // so no temp PS scripts are written to disk. This method is kept as a
    // no-op safety net for any orphans from older sessions.
    return { success: true, removed: 0 };
  },

  computeFileHash(filePath) {
    try {
      if (!fs.existsSync(filePath)) return null;
      const buffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (err) {
      console.error('Error computing hash:', err);
      return null;
    }
  },

  exportAll() {
    const configService = require('./config');
    let bundles = [];
    try {
      const bundleService = require('./bundle-service');
      bundles = bundleService.getAll();
    } catch (e) {}
    return {
      exportedAt: new Date().toISOString(),
      config: configService.getConfig(),
      apps: loadApps(),
      bundles
    };
  },

  importAll(data) {
    try {
      const DANGEROUS_KEYS = /^(__proto__|constructor|prototype)$/;
      const isValidKey = (k) => !DANGEROUS_KEYS.test(k) && typeof k === 'string';
      
      if (data.apps && Array.isArray(data.apps)) {
        const validApps = data.apps.filter(app => 
          app && typeof app === 'object' && 
          typeof app.name === 'string' && app.name.length <= 128 &&
          Object.keys(app).every(isValidKey)
        );
        if (validApps.length > 0) {
          saveApps(validApps);
        }
      }
      if (data.config && typeof data.config === 'object') {
        const configService = require('./config');
        const safeConfig = {};
        for (const key of Object.keys(data.config)) {
          if (isValidKey(key)) {
            safeConfig[key] = data.config[key];
          }
        }
        configService.setConfig(safeConfig);
      }
      if (data.bundles && Array.isArray(data.bundles)) {
        const validBundles = data.bundles.filter(b => 
          b && typeof b === 'object' && 
          typeof b.name === 'string' && b.name.length <= 128 &&
          Object.keys(b).every(isValidKey)
        );
        if (validBundles.length > 0) {
          const bundleService = require('./bundle-service');
          bundleService.replaceAll(validBundles);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = appService;
