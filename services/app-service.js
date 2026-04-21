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

function isProgramManagedGPOName(value) {
  return /^(Deploy_|ADDM_)/i.test(String(value || '').trim());
}

function normalizeManagedLinkMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  for (const [ouDN, gpoNames] of Object.entries(value)) {
    if (typeof ouDN !== 'string' || !ouDN.trim()) continue;
    const safeOUDN = ouDN.trim();
    const safeGpoNames = Array.isArray(gpoNames)
      ? gpoNames
        .filter(name => typeof name === 'string')
        .map(name => name.trim())
        .filter(Boolean)
        .filter(isProgramManagedGPOName)
      : [];
    if (safeGpoNames.length) {
      normalized[safeOUDN] = Array.from(new Set(safeGpoNames));
    }
  }
  return normalized;
}

function sameDNLists(left, right) {
  const normalize = list => normalizeDNArray(list).map(item => item.toLowerCase()).sort();
  const a = normalize(left);
  const b = normalize(right);
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function reconcileAppsWithManagedLinks(apps, managedLinks) {
  const normalizedLinks = normalizeManagedLinkMap(managedLinks);
  const gpoToOUs = new Map();
  for (const [ouDN, gpoNames] of Object.entries(normalizedLinks)) {
    for (const gpoName of gpoNames) {
      const current = gpoToOUs.get(gpoName) || [];
      current.push(ouDN);
      gpoToOUs.set(gpoName, current);
    }
  }

  let changed = 0;
  const reconciledApps = (Array.isArray(apps) ? apps : []).map(app => {
    const normalizedApp = normalizeAppRecord(app);
    if (!isProgramManagedGPOName(normalizedApp.gpoName)) {
      return normalizedApp;
    }

    const nextAssignedOUs = normalizeDNArray(gpoToOUs.get(normalizedApp.gpoName) || []);
    const currentAssignedOUs = normalizeDNArray(normalizedApp.assignedOUs || normalizedApp.ouDN);
    if (sameDNLists(currentAssignedOUs, nextAssignedOUs)) {
      return normalizedApp;
    }

    changed++;
    return normalizeAppRecord({
      ...normalizedApp,
      assignedOUs: nextAssignedOUs,
      ouDN: nextAssignedOUs[0] || '',
      updatedAt: new Date().toISOString()
    });
  });

  return { apps: reconciledApps, changed, links: normalizedLinks };
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

function normalizeDetectionConfig(value) {
  const raw = value && typeof value === 'object' ? value : {};
  let type = String(raw.type || '').trim().toLowerCase();
  if (!['tracker', 'file', 'registry'].includes(type)) type = 'tracker';

  const str = v => (typeof v === 'string' ? v : '');
  const upper = v => str(v).trim().toUpperCase();

  const fileCheck = ['exists', 'version', 'date'].includes(String(raw.fileCheck || '').toLowerCase())
    ? String(raw.fileCheck).toLowerCase() : 'exists';
  const fileVersionOp = ['=', '>', '>=', '<', '<=', '!='].includes(String(raw.fileVersionOp || '').trim())
    ? String(raw.fileVersionOp).trim() : '>=';

  const registryHive = upper(raw.registryHive) === 'HKCU' ? 'HKCU' : 'HKLM';
  const registryCheck = ['exists', 'equals', 'version', 'contains'].includes(String(raw.registryCheck || '').toLowerCase())
    ? String(raw.registryCheck).toLowerCase() : 'exists';
  const registryOp = ['=', '>', '>=', '<', '<=', '!='].includes(String(raw.registryOp || '').trim())
    ? String(raw.registryOp).trim() : '>=';

  return {
    type,
    filePath: str(raw.filePath).trim(),
    fileCheck,
    fileVersionOp,
    fileVersionValue: str(raw.fileVersionValue).trim(),
    registryHive,
    registryKey: str(raw.registryKey).trim().replace(/^(HKLM|HKCU|HKEY_[A-Z_]+)[:\\\/]+/i, ''),
    registryValueName: str(raw.registryValueName).trim(),
    registryCheck,
    registryOp,
    registryExpectedValue: str(raw.registryExpectedValue).trim()
  };
}

function normalizeDependency(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const appId = typeof raw.appId === 'string' ? raw.appId.trim() : '';
  if (!appId) {
    return { appId: '', appName: '', timeoutMinutes: 0, behavior: 'skip' };
  }
  const appName = typeof raw.appName === 'string' ? raw.appName.trim() : '';
  const timeout = Number(raw.timeoutMinutes);
  const timeoutMinutes = Number.isFinite(timeout) && timeout > 0 && timeout <= 24 * 60
    ? Math.floor(timeout) : 30;
  const behavior = ['skip', 'fail'].includes(String(raw.behavior || '').toLowerCase())
    ? String(raw.behavior).toLowerCase() : 'skip';
  return { appId, appName, timeoutMinutes, behavior };
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
  normalized.detection = normalizeDetectionConfig(normalized.detection);
  normalized.dependsOn = normalizeDependency(normalized.dependsOn);
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

  async reconcileManagedAssignments(ouDNs = []) {
    const adService = require('./ad-service');
    const apps = loadApps();
    const managedGpoNames = Array.from(new Set(
      apps
        .map(app => (typeof app?.gpoName === 'string' ? app.gpoName.trim() : ''))
        .filter(isProgramManagedGPOName)
    ));

    if (managedGpoNames.length === 0) {
      return {
        success: true,
        changed: 0,
        data: apps.map(hydrateAppShareState),
        links: {}
      };
    }

    const adResult = await adService.getManagedGPOLinks(managedGpoNames, ouDNs);
    if (!adResult.success) {
      return {
        success: false,
        error: adResult.error || 'Error desconocido',
        data: apps.map(hydrateAppShareState),
        links: {}
      };
    }

    const reconciled = reconcileAppsWithManagedLinks(apps, adResult.data);
    if (reconciled.changed > 0) {
      saveApps(reconciled.apps);
    }

    return {
      success: true,
      changed: reconciled.changed,
      data: reconciled.apps.map(hydrateAppShareState),
      links: reconciled.links
    };
  },

  // Apply an assignment plan in a single call.
  // plan = { toAssign: [{ appId, ouDN }], toUnassign: [{ appId, ouDN }] }
  // Calls AD link/unlink per pair and updates each app's assignedOUs
  // atomically based on the actual AD result (only persists pairs that
  // AD confirms).
  async applyAssignmentPlan(plan, allVisibleOUs = []) {
    const adService = require('./ad-service');
    const safeVisibleOUs = Array.isArray(allVisibleOUs)
      ? allVisibleOUs.filter(v => typeof v === 'string' && v.trim())
      : [];
    const toAssign = Array.isArray(plan?.toAssign) ? plan.toAssign : [];
    const toUnassign = Array.isArray(plan?.toUnassign) ? plan.toUnassign : [];
    const assignmentApps = loadApps();
    const assignmentById = new Map(assignmentApps.map(app => [app.id, app]));
    const operationErrors = new Map();

    for (const { appId, ouDN } of toUnassign) {
      const app = assignmentById.get(appId);
      if (!app) {
        operationErrors.set(`unassign::${appId}::${ouDN}`, 'App not found');
        continue;
      }
      if (!app.gpoName) continue;

      const adResult = await adService.unlinkGPOfromOU(app.gpoName, ouDN);
      if (!adResult.success) {
        operationErrors.set(`unassign::${appId}::${ouDN}`, adResult.error || 'Error desconocido');
      } else {
        app.assignedOUs = (app.assignedOUs || []).filter(dn => dn !== ouDN);
        app.updatedAt = new Date().toISOString();
      }
    }

    for (const { appId, ouDN } of toAssign) {
      const app = assignmentById.get(appId);
      if (!app) {
        operationErrors.set(`assign::${appId}::${ouDN}`, 'App not found');
        continue;
      }
      if (!app.gpoName) {
        operationErrors.set(`assign::${appId}::${ouDN}`, 'App has no GPO');
        continue;
      }

      const adResult = await adService.linkGPOtoOU(app.gpoName, ouDN);
      if (!adResult.success) {
        operationErrors.set(`assign::${appId}::${ouDN}`, adResult.error || 'Error desconocido');
      } else {
        const nextOUs = new Set(app.assignedOUs || []);
        nextOUs.add(ouDN);
        app.assignedOUs = Array.from(nextOUs);
        app.updatedAt = new Date().toISOString();
      }
    }

    // Use all visible OUs for reconciliation so sibling OUs retain their state.
    // Falls back to only affected OUs if the caller didn't provide the full list.
    const reconcileOUs = safeVisibleOUs.length > 0
      ? safeVisibleOUs
      : Array.from(new Set([
          ...toAssign.map(item => item.ouDN),
          ...toUnassign.map(item => item.ouDN)
        ].filter(Boolean)));

    let reconciledApps = assignmentApps;
    let managedLinks = {};
    try {
      const reconcileResult = await this.reconcileManagedAssignments(reconcileOUs);
      if (reconcileResult.success && Array.isArray(reconcileResult.data)) {
        reconciledApps = reconcileResult.data.map(normalizeAppRecord);
        managedLinks = reconcileResult.links || {};
      } else {
        saveApps(assignmentApps);
        reconciledApps = loadApps();
      }
    } catch {
      saveApps(assignmentApps);
      reconciledApps = loadApps();
    }

    const finalById = new Map(reconciledApps.map(app => [app.id, app]));
    const finalAssignmentResults = {
      success: true,
      assigned: [],
      unassigned: [],
      failures: [],
      apps: reconciledApps.map(hydrateAppShareState),
      links: managedLinks
    };

    for (const { appId, ouDN } of toUnassign) {
      const app = finalById.get(appId) || assignmentById.get(appId);
      if (!app) {
        finalAssignmentResults.success = false;
        finalAssignmentResults.failures.push({ action: 'unassign', appId, ouDN, error: 'App not found' });
        continue;
      }

      if (!(app.assignedOUs || []).includes(ouDN)) {
        finalAssignmentResults.unassigned.push({ appId, ouDN });
        continue;
      }

      finalAssignmentResults.success = false;
      finalAssignmentResults.failures.push({
        action: 'unassign',
        appId,
        ouDN,
        appName: app.name,
        error: operationErrors.get(`unassign::${appId}::${ouDN}`) || 'La GPO sigue vinculada en AD'
      });
    }

    for (const { appId, ouDN } of toAssign) {
      const app = finalById.get(appId) || assignmentById.get(appId);
      if (!app) {
        finalAssignmentResults.success = false;
        finalAssignmentResults.failures.push({ action: 'assign', appId, ouDN, error: 'App not found' });
        continue;
      }

      if ((app.assignedOUs || []).includes(ouDN)) {
        finalAssignmentResults.assigned.push({ appId, ouDN });
        continue;
      }

      finalAssignmentResults.success = false;
      finalAssignmentResults.failures.push({
        action: 'assign',
        appId,
        ouDN,
        appName: app.name,
        error: operationErrors.get(`assign::${appId}::${ouDN}`) || 'La GPO no aparece vinculada en AD'
      });
    }

    return finalAssignmentResults;
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
