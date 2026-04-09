const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window Controls (frameless)
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },

  // Config
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (data) => ipcRenderer.invoke('config:set', data),
    selectFolder: () => ipcRenderer.invoke('config:selectFolder'),
    selectFile: (filters) => ipcRenderer.invoke('config:selectFile', filters)
  },

  // Active Directory
  ad: {
    checkRSAT: () => ipcRenderer.invoke('ad:checkRSAT'),
    getOUs: () => ipcRenderer.invoke('ad:getOUs'),
    getGPOs: () => ipcRenderer.invoke('ad:getGPOs'),
    createGPO: (name, path, ouDN) => ipcRenderer.invoke('ad:createGPO', name, path, ouDN),
    linkGPOtoOU: (gpoName, ouDN) => ipcRenderer.invoke('ad:linkGPOtoOU', gpoName, ouDN),
    bulkLinkGPO: (gpoName, ouDNs) => ipcRenderer.invoke('ad:bulkLinkGPO', gpoName, ouDNs),
    deleteGPO: (gpoName) => ipcRenderer.invoke('ad:deleteGPO', gpoName),
    unlinkGPOfromOU: (gpoName, ouDN) => ipcRenderer.invoke('ad:unlinkGPOfromOU', gpoName, ouDN),
    removeGPOStartupScript: (gpoName) => ipcRenderer.invoke('ad:removeGPOStartupScript', gpoName),
    checkGPOConflicts: (ouDN) => ipcRenderer.invoke('ad:checkGPOConflicts', ouDN)
  },

  // Apps
  apps: {
    getAll: () => ipcRenderer.invoke('apps:getAll'),
    get: (id) => ipcRenderer.invoke('apps:get', id),
    create: (data) => ipcRenderer.invoke('apps:create', data),
    update: (id, data) => ipcRenderer.invoke('apps:update', id, data),
    delete: (id, deleteFiles) => ipcRenderer.invoke('apps:delete', id, deleteFiles),
    bulkAssignGPO: (ids, gpoName) => ipcRenderer.invoke('apps:bulkAssignGPO', ids, gpoName),
    applyAssignmentPlan: (plan) => ipcRenderer.invoke('apps:applyAssignmentPlan', plan),
    getInstallerVersion: (filePath) => ipcRenderer.invoke('apps:getInstallerVersion', filePath),
    computeHash: (filePath) => ipcRenderer.invoke('apps:computeHash', filePath)
  },

  // Scripts
  scripts: {
    generate: (appConfig) => ipcRenderer.invoke('scripts:generate', appConfig),
    deploy: (appConfig) => ipcRenderer.invoke('scripts:deploy', appConfig),
    getTemplates: () => ipcRenderer.invoke('scripts:getTemplates')
  },

  // Files
  files: {
    listDeployed: () => ipcRenderer.invoke('files:listDeployed'),
    getContents: (name) => ipcRenderer.invoke('files:getContents', name),
    createFolder: (name) => ipcRenderer.invoke('files:createFolder', name)
  },

  // Bundles
  bundles: {
    getAll: () => ipcRenderer.invoke('bundles:getAll'),
    get: (id) => ipcRenderer.invoke('bundles:get', id),
    create: (data) => ipcRenderer.invoke('bundles:create', data),
    update: (id, data) => ipcRenderer.invoke('bundles:update', id, data),
    delete: (id) => ipcRenderer.invoke('bundles:delete', id),
    deploy: (id) => ipcRenderer.invoke('bundles:deploy', id),
    generateScript: (id) => ipcRenderer.invoke('bundles:generateScript', id)
  },

  // Activity Log
  activity: {
    getRecent: (count) => ipcRenderer.invoke('activity:getRecent', count),
    add: (action, details) => ipcRenderer.invoke('activity:add', action, details)
  },

  // Export / Import
  exportAll: () => ipcRenderer.invoke('apps:exportAll'),
  importAll: (data) => ipcRenderer.invoke('apps:importAll', data),
  saveFile: (content, name) => ipcRenderer.invoke('config:saveFile', content, name),
  loadFile: () => ipcRenderer.invoke('config:loadFile'),

  // I18n
  i18n: {
    getAvailable: () => ipcRenderer.invoke('i18n:getAvailable'),
    getTranslations: (langCode) => ipcRenderer.invoke('i18n:getTranslations', langCode)
  }
});
