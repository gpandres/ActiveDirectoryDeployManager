const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let appsFilePath = null;

function getAppsPath() {
  if (!appsFilePath) {
    const { app } = require('electron');
    appsFilePath = path.join(app.getPath('userData'), 'apps-config.json');
  }
  return appsFilePath;
}

function loadApps() {
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
  fs.writeFileSync(getAppsPath(), JSON.stringify(apps, null, 2), 'utf-8');
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
        const { app } = require('electron');
        const bundlesPath = path.join(app.getPath('userData'), 'bundles-config.json');
        fs.writeFileSync(bundlesPath, JSON.stringify(data.bundles, null, 2), 'utf-8');
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = appService;
