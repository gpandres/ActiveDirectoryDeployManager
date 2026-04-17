const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    frame: false,           
    backgroundColor: '#0a0e1a',
    // icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Security: Prevent navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    console.warn('Navigation blocked:', url);
  });

  // Security: Prevent creating new windows/tabs
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn('New window blocked:', url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message} (line ${line})`);
  });

  // Log any renderer errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.error('Failed to load:', errorCode, errorDesc);
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });
}

app.whenReady().then(() => {
  console.log('App ready, loading services...');

  const adService = require('./services/ad-service');
  const appService = require('./services/app-service');
  const { assertString, assertStringOrNull, assertArray, assertBoolean, assertObject, assertId } = require('./services/ipc-validators');
  const scriptService = require('./services/script-service');
  const fileService = require('./services/file-service');
  const configService = require('./services/config');
  const bundleService = require('./services/bundle-service');
  const activityLog = require('./services/activity-log');
  const i18nService = require('./services/i18n');
  const catalogService = require('./services/catalog-service');
  const templateService = require('./services/template-service');
  const shareHealth = require('./services/share-health');

  console.log('Initialize i18n...');
  i18nService.initialize();

  // Sweep orphaned temp PS scripts from previous sessions
  try {
    const swept = appService.cleanupTempFiles();
    if (swept && swept.removed) console.log(`Temp cleanup: removed ${swept.removed} orphan script(s)`);
  } catch (e) {
    console.warn('Temp cleanup failed:', e.message);
  }

  console.log('Services loaded, creating window...');
  createWindow();
  console.log('Window created');

  // Run initial share health check (non-blocking) so the cache is warm
  // before the renderer starts making sync share calls.
  shareHealth.check().then(s => {
    console.log(`[share-health] Initial check: ${s.available ? 'OK' : 'UNAVAILABLE'} ${s.error || ''}`);
  });

  // ─── Window Controls (frameless) ───────────────────────────────
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow.close());

  // ─── IPC Handlers: Share Health ───────────────────────────────────
  ipcMain.handle('share:checkHealth', () => shareHealth.check());
  ipcMain.handle('share:getStatus', () => shareHealth.getStatus());

  // ─── IPC Handlers: Config ────────────────────────────────────────
  ipcMain.handle('config:get', () => configService.getConfig());
  ipcMain.handle('config:set', (_, data) => {
    try { assertObject(data, 'data'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    const result = configService.setConfig(data);
    // If share path changed, invalidate the health cache
    if (data?.networkSharePath !== undefined) shareHealth.invalidate();
    return result;
  });
  ipcMain.handle('config:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });
  ipcMain.handle('config:selectFile', async (_, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: 'Todos los archivos', extensions: ['*'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // ─── IPC Handlers: AD Service ────────────────────────────────────
  ipcMain.handle('ad:checkRSAT', () => adService.checkRSAT());
  ipcMain.handle('ad:getOUs', (_, ignoreBaseOU = false) => {
    try { assertBoolean(ignoreBaseOU, 'ignoreBaseOU'); }
    catch (e) { return { success: false, error: 'Invalid arguments', data: [] }; }
    return adService.getOUs(ignoreBaseOU);
  });
  ipcMain.handle('ad:getGPOs', () => adService.getGPOs());
  ipcMain.handle('ad:getGPOLinkCounts', () => adService.getGPOLinkCounts());
  ipcMain.handle('ad:createGPO', (_, name, scriptPath, ouDN) => {
    try {
      assertString(name, 'name');
      assertString(scriptPath, 'scriptPath');
      if (Array.isArray(ouDN)) ouDN.forEach((dn, idx) => assertString(dn, `ouDN[${idx}]`));
      else assertStringOrNull(ouDN, 'ouDN');
    } catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return adService.createGPO(name, scriptPath, ouDN);
  });
  ipcMain.handle('ad:linkGPOtoOU', (_, gpoName, ouDN) => {
    try { assertString(gpoName, 'gpoName'); assertString(ouDN, 'ouDN'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return adService.linkGPOtoOU(gpoName, ouDN);
  });
  ipcMain.handle('ad:bulkLinkGPO', (_, gpoName, ouDNs) => {
    try { assertString(gpoName, 'gpoName'); assertArray(ouDNs, 'ouDNs'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return adService.bulkLinkGPO(gpoName, ouDNs);
  });
  ipcMain.handle('ad:deleteGPO', (_, gpoName) => {
    try { assertString(gpoName, 'gpoName'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return adService.deleteGPO(gpoName);
  });
  ipcMain.handle('ad:checkGPOExists', (_, gpoName) => {
    try { assertString(gpoName, 'gpoName'); }
    catch (e) { return { exists: false }; }
    return adService.checkGPOExists(gpoName);
  });
  ipcMain.handle('ad:unlinkGPOfromOU', (_, gpoName, ouDN) => {
    try { assertString(gpoName, 'gpoName'); assertString(ouDN, 'ouDN'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return adService.unlinkGPOfromOU(gpoName, ouDN);
  });
  ipcMain.handle('ad:removeGPOStartupScript', (_, gpoName) => {
    try { assertString(gpoName, 'gpoName'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return adService.removeGPOStartupScript(gpoName);
  });
  ipcMain.handle('ad:checkGPOConflicts', (_, ouDN) => {
    try { assertString(ouDN, 'ouDN'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return adService.checkGPOConflicts(ouDN);
  });

  // ─── IPC Handlers: App Service ───────────────────────────────────
  ipcMain.handle('apps:getAll', () => appService.getAll());
  ipcMain.handle('apps:get', (_, id) => {
    try { assertString(id, 'id'); } catch (e) { return null; }
    return appService.get(id);
  });
  ipcMain.handle('apps:create', (_, data) => {
    try { assertObject(data, 'data'); } catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return appService.create(data);
  });
  ipcMain.handle('apps:update', (_, id, data) => {
    try { assertString(id, 'id'); assertObject(data, 'data'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return appService.update(id, data);
  });
  ipcMain.handle('apps:delete', (_, id, deleteFiles) => {
    try {
      assertString(id, 'id');
      if (deleteFiles !== undefined) assertBoolean(deleteFiles, 'deleteFiles');
    }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return appService.remove(id, deleteFiles);
  });
  ipcMain.handle('apps:bulkAssignGPO', (_, ids, gpoName) => {
    try { assertArray(ids, 'ids'); assertString(gpoName, 'gpoName'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return appService.bulkAssignGPO(ids, gpoName);
  });
  ipcMain.handle('apps:applyAssignmentPlan', (_, plan) => {
    try { assertObject(plan, 'plan'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return appService.applyAssignmentPlan(plan);
  });
  ipcMain.handle('apps:getInstallerVersion', (_, filePath) => {
    try { assertString(filePath, 'filePath', 1024); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return appService.getInstallerVersion(filePath);
  });
  ipcMain.handle('apps:computeHash', (_, filePath) => {
    try { assertString(filePath, 'filePath', 1024); }
    catch (e) { return { hash: null, error: 'Invalid arguments' }; }
    return { hash: appService.computeFileHash(filePath) };
  });

  // ─── IPC Handlers: Script Service ────────────────────────────────
  ipcMain.handle('scripts:generate', (_, appConfig) => {
    try { assertObject(appConfig, 'appConfig'); }
    catch (e) { return ''; }
    return scriptService.generateScript(appConfig);
  });
  ipcMain.handle('scripts:deploy', (_, appConfig) => {
    try { assertObject(appConfig, 'appConfig'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return scriptService.deployScript(appConfig);
  });
  ipcMain.handle('scripts:getTemplates', () => scriptService.getTemplateList());
  ipcMain.handle('templates:getAll', () => templateService.getAll());
  ipcMain.handle('templates:get', (_, id) => {
    try { assertId(id, 'id'); } catch (e) { return null; }
    return templateService.get(id);
  });
  ipcMain.handle('templates:create', (_, data) => {
    try { assertObject(data, 'data'); } catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return templateService.create(data);
  });
  ipcMain.handle('templates:update', (_, id, data) => {
    try { assertId(id, 'id'); assertObject(data, 'data'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return templateService.update(id, data);
  });
  ipcMain.handle('templates:delete', (_, id) => {
    try { assertId(id, 'id'); } catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return templateService.remove(id);
  });

  ipcMain.handle('templates:saveInstaller', async (_, templateId, localPath) => {
    try {
      const fs = require('fs');
      const pathMod = require('path');
      assertId(templateId, 'templateId');
      if (typeof localPath !== 'string' || !localPath.trim()) return { success: false, error: 'Invalid path' };
      if (!fs.existsSync(localPath)) return { success: false, error: 'File not found' };
      const health = await shareHealth.check();
      if (!health.available) return { success: false, error: 'SHARE_UNAVAILABLE' };
      const config = configService.getConfig();
      if (!config.networkSharePath) return { success: false, error: 'Network share not configured' };
      const destDir = pathMod.join(config.networkSharePath, '_templates', String(templateId).replace(/[^a-zA-Z0-9_\-]/g, '_'));
      await fs.promises.mkdir(destDir, { recursive: true });
      const fileName = pathMod.basename(localPath);
      const destPath = pathMod.join(destDir, fileName);
      await fs.promises.copyFile(localPath, destPath);
      return { success: true, sharePath: destPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── IPC Handlers: Catalog Service (replaces old winget handlers) ──
  // Backward-compatible aliases (used by apps.js wizard)
  ipcMain.handle('winget:getCatalog', () => catalogService.getCatalog());
  ipcMain.handle('winget:checkVersions', (_, catalogIds) => {
    try { assertArray(catalogIds, 'catalogIds'); }
    catch (e) { return []; }
    return catalogService.checkVersions(catalogIds);
  });
  // New catalog endpoints (used by catalog page)
  ipcMain.handle('catalog:getCatalog', () => catalogService.getCatalog());
  ipcMain.handle('catalog:search', (_, query, category) => {
    try {
      if (query !== undefined && query !== null) assertString(query, 'query', 256);
      if (category !== undefined && category !== null) assertString(category, 'category', 64);
    } catch (e) { return []; }
    return catalogService.search(query, category);
  });
  ipcMain.handle('catalog:searchCLI', (_, query) => {
    if (typeof query !== 'string' || query.length > 256) return [];
    return catalogService.searchCLI(query);
  });
  ipcMain.handle('catalog:checkVersions', (_, catalogIds) => {
    try { assertArray(catalogIds, 'catalogIds'); }
    catch (e) { return []; }
    return catalogService.checkVersions(catalogIds);
  });
  ipcMain.handle('catalog:checkSingle', (_, wingetId, wingetSource, name) => {
    try {
      if (wingetId !== undefined && wingetId !== null) assertString(wingetId, 'wingetId', 256);
      if (wingetSource !== undefined && wingetSource !== null) assertString(wingetSource, 'wingetSource', 64);
      if (name !== undefined && name !== null) assertString(name, 'name', 256);
    }
    catch (e) { return { wingetId: null, wingetSource: null, latestVersion: null }; }
    return catalogService.checkSingle(wingetId, wingetSource, name);
  });
  ipcMain.handle('catalog:resolvePackage', (_, reference) => {
    try { assertObject(reference, 'reference'); }
    catch (e) { return { wingetId: '', wingetSource: 'winget', latestVersion: null, name: '', available: false }; }
    return catalogService.resolvePackage(reference);
  });

  // ─── IPC Handlers: File Service ──────────────────────────────────
  ipcMain.handle('files:listDeployed', () => fileService.listDeployedApps());
  ipcMain.handle('files:getContents', (_, name) => {
    try { assertString(name, 'name', 256); }
    catch (e) { return { success: false, error: 'Invalid arguments', data: [] }; }
    return fileService.getAppContents(name);
  });
  ipcMain.handle('files:createFolder', (_, name) => {
    try { assertString(name, 'name', 256); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return fileService.createAppFolder(name);
  });

  // ─── IPC Handlers: Bundle Service ─────────────────────────────────
  ipcMain.handle('bundles:getAll', () => bundleService.getAll());
  ipcMain.handle('bundles:get', (_, id) => {
    try { assertString(id, 'id'); } catch (e) { return null; }
    return bundleService.get(id);
  });
  ipcMain.handle('bundles:create', (_, data) => {
    try { assertObject(data, 'data'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return bundleService.create(data);
  });
  ipcMain.handle('bundles:update', (_, id, data) => {
    try { assertString(id, 'id'); assertObject(data, 'data'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return bundleService.update(id, data);
  });
  ipcMain.handle('bundles:delete', (_, id) => {
    try { assertString(id, 'id'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    return bundleService.remove(id);
  });

  // Backend guard: reject duplicate deploy requests for the same bundle
  const _deployingBundles = new Set();
  ipcMain.handle('bundles:deploy', async (_, bundleId) => {
    try { assertString(bundleId, 'bundleId'); }
    catch (e) { return { success: false, error: 'Invalid arguments' }; }
    if (_deployingBundles.has(bundleId)) {
      return { success: false, error: 'already_deploying' };
    }
    _deployingBundles.add(bundleId);
    try {
      const bundle = bundleService.get(bundleId);
      if (!bundle) return { success: false, error: 'Bundle not found' };
      const apps = appService.getAll();
      const config = configService.getConfig();
      const result = await bundleService.deployBundle(bundle, apps, config);
      if (result.success) {
        bundleService.update(bundleId, { deployed: true, deployedPath: result.path });
        activityLog.add('bundle_deploy', { bundleName: bundle.name, version: bundle.version });
      }
      return result;
    } finally {
      _deployingBundles.delete(bundleId);
    }
  });
  ipcMain.handle('bundles:generateScript', (_, bundleId) => {
    try { assertString(bundleId, 'bundleId'); }
    catch (e) { return ''; }
    const bundle = bundleService.get(bundleId);
    if (!bundle) return '';
    const apps = appService.getAll();
    const config = configService.getConfig();
    return bundleService.generateBundleScript(bundle, apps, config);
  });

  // ─── IPC Handlers: Activity Log ───────────────────────────────────
  ipcMain.handle('activity:getRecent', (_, count) => activityLog.getRecent(count));
  ipcMain.handle('activity:add', (_, action, details) => activityLog.add(action, details));

  // ─── IPC Handlers: Export/Import ──────────────────────────────────
  ipcMain.handle('apps:exportAll', () => appService.exportAll());
  ipcMain.handle('apps:importAll', (_, data) => appService.importAll(data));
  ipcMain.handle('config:saveFile', async (_, content, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!result.canceled && result.filePath) {
      const fsSave = require('fs');
      fsSave.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
  ipcMain.handle('config:loadFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const fsLoad = require('fs');
        const content = fsLoad.readFileSync(result.filePaths[0], 'utf-8');
        return { success: true, data: JSON.parse(content) };
      } catch (err) {
        return { success: false, error: 'Invalid JSON file' };
      }
    }
    return { success: false };
  });

  // ─── IPC Handlers: i18n Service ──────────────────────────────────
  ipcMain.handle('i18n:getAvailable', () => i18nService.getAvailableLanguages());
  ipcMain.handle('i18n:getTranslations', (_, langCode) => i18nService.getTranslations(langCode));

}).catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});

app.on('window-all-closed', () => {
  app.quit();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
