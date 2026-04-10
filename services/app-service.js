const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const os = require('os');

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

function loadApps() {
  // Share is authoritative — pull from there if available
  const fromShare = tryReadShare('apps-config.json');
  if (fromShare !== null) {
    // Mirror to local cache for offline fallback
    try {
      fs.writeFileSync(getAppsPath(), JSON.stringify(fromShare, null, 2), 'utf-8');
    } catch (e) {}
    return fromShare;
  }
  // Fallback to local cache (offline or share not yet configured)
  try {
    const p = getAppsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading apps:', err);
  }
  return [];
}

function saveApps(apps) {
  // Always write local cache
  fs.writeFileSync(getAppsPath(), JSON.stringify(apps, null, 2), 'utf-8');
  // Best-effort mirror to share
  tryWriteShare('apps-config.json', apps);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
    const newApp = {
      id: generateId(),
      name: data.name || 'Nueva App',
      template: data.template || 'generic',
      installerType: data.installerType || 'exe',
      silentArgs: data.silentArgs || '/S',
      installerPath: data.installerPath || '',
      configXmlPath: data.configXmlPath || '',
      wingetId: data.wingetId || '',
      odtConfig: data.odtConfig || null,
      customParams: data.customParams || {},
      assignedOUs: data.assignedOUs || [],
      gpoName: data.gpoName || '',
      createGPO: data.createGPO || false,
      version: data.version || '1.0.0',
      notifyUser: data.notifyUser || false,
      lastDeployHash: '',
      versionHistory: [],
      deployed: data.deployed || false,
      deployedPath: data.deployedPath || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    apps.push(newApp);
    saveApps(apps);
    return newApp;
  },

  update(id, data) {
    const apps = loadApps();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return null;
    apps[idx] = { ...apps[idx], ...data, updatedAt: new Date().toISOString() };
    saveApps(apps);
    return apps[idx];
  },

  remove(id, deleteFiles) {
    const apps = loadApps();
    const appToDelete = apps.find(a => a.id === id);
    if (!appToDelete) return { success: false, error: 'App not found' };

    if (deleteFiles) {
      const configService = require('./config');
      const cfg = configService.getConfig();
      if (cfg && cfg.networkSharePath) {
        const folderPath = path.join(cfg.networkSharePath, appToDelete.name);
        try {
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

        const tmpFile = path.join(os.tmpdir(), `ver_${Date.now()}_${Math.floor(Math.random()*1000)}.ps1`);
        fs.writeFileSync(tmpFile, psCommand, { encoding: 'utf8' });
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
          try { fs.unlinkSync(tmpFile); } catch (e) {}
          if (error) {
            return resolve({ success: false, error: error.message });
          }
          const version = (stdout || '').trim();
          if (!version) {
            return resolve({ success: false, error: 'No version metadata found' });
          }
          resolve({ success: true, version });
        });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  },

  cleanupTempFiles() {
    // Sweep orphaned temp PS scripts (ad_script_*.ps1 and ver_*.ps1)
    // created by runPowerShell() and getInstallerVersion().
    // Only deletes files older than 60 seconds to avoid racing
    // with a concurrent operation that's currently using the file.
    try {
      const tmpDir = os.tmpdir();
      const minAgeMs = 60 * 1000;
      const now = Date.now();
      const patterns = [/^ad_script_\d+_\d+\.ps1$/, /^ver_\d+_\d+\.ps1$/];
      const files = fs.readdirSync(tmpDir);
      let removed = 0;
      for (const file of files) {
        if (!patterns.some(re => re.test(file))) continue;
        const full = path.join(tmpDir, file);
        try {
          const stat = fs.statSync(full);
          if (now - stat.mtimeMs >= minAgeMs) {
            fs.unlinkSync(full);
            removed++;
          }
        } catch (e) {}
      }
      return { success: true, removed };
    } catch (err) {
      return { success: false, error: err.message };
    }
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
      if (data.apps && Array.isArray(data.apps)) {
        saveApps(data.apps);
      }
      if (data.config) {
        const configService = require('./config');
        configService.setConfig(data.config);
      }
      if (data.bundles && Array.isArray(data.bundles)) {
        const bundleService = require('./bundle-service');
        bundleService.replaceAll(data.bundles);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = appService;
