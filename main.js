const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    frame: false,           // Frameless like Discord
    backgroundColor: '#0a0e1a',
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
  const scriptService = require('./services/script-service');
  const fileService = require('./services/file-service');
  const configService = require('./services/config');
  const bundleService = require('./services/bundle-service');
  const activityLog = require('./services/activity-log');
  const i18nService = require('./services/i18n');

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

  // ─── Window Controls (frameless) ───────────────────────────────
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow.close());

  // ─── IPC Handlers: Config ────────────────────────────────────────
  ipcMain.handle('config:get', () => configService.getConfig());
  ipcMain.handle('config:set', (_, data) => configService.setConfig(data));
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
  ipcMain.handle('ad:getOUs', () => adService.getOUs());
  ipcMain.handle('ad:getGPOs', () => adService.getGPOs());
  ipcMain.handle('ad:createGPO', (_, name, path, ouDN) => adService.createGPO(name, path, ouDN));
  ipcMain.handle('ad:linkGPOtoOU', (_, gpoName, ouDN) => adService.linkGPOtoOU(gpoName, ouDN));
  ipcMain.handle('ad:bulkLinkGPO', (_, gpoName, ouDNs) => adService.bulkLinkGPO(gpoName, ouDNs));
  ipcMain.handle('ad:deleteGPO', (_, gpoName) => adService.deleteGPO(gpoName));
  ipcMain.handle('ad:unlinkGPOfromOU', (_, gpoName, ouDN) => adService.unlinkGPOfromOU(gpoName, ouDN));
  ipcMain.handle('ad:removeGPOStartupScript', (_, gpoName) => adService.removeGPOStartupScript(gpoName));
  ipcMain.handle('ad:checkGPOConflicts', (_, ouDN) => adService.checkGPOConflicts(ouDN));

  // ─── IPC Handlers: App Service ───────────────────────────────────
  ipcMain.handle('apps:getAll', () => appService.getAll());
  ipcMain.handle('apps:get', (_, id) => appService.get(id));
  ipcMain.handle('apps:create', (_, data) => appService.create(data));
  ipcMain.handle('apps:update', (_, id, data) => appService.update(id, data));
  ipcMain.handle('apps:delete', (_, id, deleteFiles) => appService.remove(id, deleteFiles));
  ipcMain.handle('apps:bulkAssignGPO', (_, ids, gpoName) => appService.bulkAssignGPO(ids, gpoName));
  ipcMain.handle('apps:applyAssignmentPlan', (_, plan) => appService.applyAssignmentPlan(plan));
  ipcMain.handle('apps:getInstallerVersion', (_, filePath) => appService.getInstallerVersion(filePath));
  ipcMain.handle('apps:computeHash', (_, filePath) => ({ hash: appService.computeFileHash(filePath) }));

  // ─── IPC Handlers: Script Service ────────────────────────────────
  ipcMain.handle('scripts:generate', (_, appConfig) => scriptService.generateScript(appConfig));
  ipcMain.handle('scripts:deploy', (_, appConfig) => scriptService.deployScript(appConfig));
  ipcMain.handle('scripts:getTemplates', () => scriptService.getTemplateList());

  // ─── IPC Handlers: File Service ──────────────────────────────────
  ipcMain.handle('files:listDeployed', () => fileService.listDeployedApps());
  ipcMain.handle('files:getContents', (_, name) => fileService.getAppContents(name));
  ipcMain.handle('files:createFolder', (_, name) => fileService.createAppFolder(name));

  // ─── IPC Handlers: Bundle Service ─────────────────────────────────
  ipcMain.handle('bundles:getAll', () => bundleService.getAll());
  ipcMain.handle('bundles:get', (_, id) => bundleService.get(id));
  ipcMain.handle('bundles:create', (_, data) => bundleService.create(data));
  ipcMain.handle('bundles:update', (_, id, data) => bundleService.update(id, data));
  ipcMain.handle('bundles:delete', (_, id) => bundleService.remove(id));
  ipcMain.handle('bundles:deploy', async (_, bundleId) => {
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
  });
  ipcMain.handle('bundles:generateScript', (_, bundleId) => {
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
      const fsLoad = require('fs');
      const content = fsLoad.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, data: JSON.parse(content) };
    }
    return { success: false };
  });

  // ─── IPC Handlers: i18n Service ──────────────────────────────────
  ipcMain.handle('i18n:getAvailable', () => i18nService.getAvailableLanguages());
  ipcMain.handle('i18n:getTranslations', (_, langCode) => i18nService.getTranslations(langCode));

}).catch(err => {
  console.error('FATAL ERROR:', err);
});

app.on('window-all-closed', () => {
  app.quit();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
