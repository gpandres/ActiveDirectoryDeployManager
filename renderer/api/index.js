// =============================================================
// renderer/api/index.js — Capa de acceso IPC del renderer
// =============================================================
// Propósito:
//   Centraliza TODAS las llamadas a window.api.* en un único
//   módulo. Ningún archivo de página debe llamar a window.api.*
//   directamente. Si un canal IPC cambia de nombre o firma,
//   solo se toca este archivo.
//
// Objetos exportados (disponibles como globales):
//   AppApi      — apps, exportAll, importAll
//   ScriptApi   — scripts, templates, scriptUpdates
//   GpoApi      — GPO CRUD (vía ad.*)
//   AdApi       — OUs, RSAT
//   BundleApi   — bundles
//   ShareApi    — share health, archivos desplegados
//   CatalogApi  — catálogo winget
//   LogApi      — logs (query, stats, estado backend)
//   SettingsApi — config, i18n, cert, admin
//   ActivityApi — actividad interna
//   UpdateApi   — actualizaciones de la app y scripts
//   WindowApi   — controles de ventana frameless
//
// Uso (cargado como <script src="api/index.js"> antes de las páginas):
//   const apps = await AppApi.getAll();
//   await GpoApi.create(name, path, ouDN);
// =============================================================

// ─── Helper de error centralizado ────────────────────────────
// Registra en consola e intenta loguear en el backend de actividad.
// El .catch() silencioso previene recursión si activity.add falla.
function _ipcErr(channel, err) {
  console.error(`[IPC:${channel}]`, err);
  window.api.activity?.add('ipc_error', { channel, message: err?.message ?? String(err) })
    ?.catch(() => {});
}


// =============================================================
// AppApi — Gestión de aplicaciones
// =============================================================
const AppApi = {

  async getAll() {
    try { return await window.api.apps.getAll(); }
    catch (err) { _ipcErr('apps:getAll', err); throw err; }
  },

  async get(id) {
    try { return await window.api.apps.get(id); }
    catch (err) { _ipcErr('apps:get', err); throw err; }
  },

  async create(data) {
    try { return await window.api.apps.create(data); }
    catch (err) { _ipcErr('apps:create', err); throw err; }
  },

  async update(id, data) {
    try { return await window.api.apps.update(id, data); }
    catch (err) { _ipcErr('apps:update', err); throw err; }
  },

  async remove(id, deleteFiles) {
    try { return await window.api.apps.delete(id, deleteFiles); }
    catch (err) { _ipcErr('apps:delete', err); throw err; }
  },

  async bulkAssignGPO(ids, gpoName) {
    try { return await window.api.apps.bulkAssignGPO(ids, gpoName); }
    catch (err) { _ipcErr('apps:bulkAssignGPO', err); throw err; }
  },

  async getInstallerVersion(filePath) {
    try { return await window.api.apps.getInstallerVersion(filePath); }
    catch (err) { _ipcErr('apps:getInstallerVersion', err); throw err; }
  },

  async computeHash(filePath) {
    try { return await window.api.apps.computeHash(filePath); }
    catch (err) { _ipcErr('apps:computeHash', err); throw err; }
  },

  async applyAssignmentPlan(plan, visibleOUs = []) {
    try { return await window.api.apps.applyAssignmentPlan(plan, visibleOUs); }
    catch (err) { _ipcErr('apps:applyAssignmentPlan', err); throw err; }
  },

  async reconcileManagedAssignments(ouDNs = []) {
    try { return await window.api.apps.reconcileManagedAssignments(ouDNs); }
    catch (err) { _ipcErr('apps:reconcileManagedAssignments', err); throw err; }
  },

  async exportAll() {
    try { return await window.api.exportAll(); }
    catch (err) { _ipcErr('apps:exportAll', err); throw err; }
  },

  async importAll(data) {
    try { return await window.api.importAll(data); }
    catch (err) { _ipcErr('apps:importAll', err); throw err; }
  },
};


// =============================================================
// ScriptApi — Generación/despliegue de scripts y plantillas
// =============================================================
const ScriptApi = {

  async getTemplates() {
    try { return await window.api.scripts.getTemplates(); }
    catch (err) { _ipcErr('scripts:getTemplates', err); throw err; }
  },

  async generate(appConfig) {
    try { return await window.api.scripts.generate(appConfig); }
    catch (err) { _ipcErr('scripts:generate', err); throw err; }
  },

  async deploy(appConfig) {
    try { return await window.api.scripts.deploy(appConfig); }
    catch (err) { _ipcErr('scripts:deploy', err); throw err; }
  },

  async regenerate(appConfig) {
    try { return await window.api.scripts.regenerate(appConfig); }
    catch (err) { _ipcErr('scripts:regenerate', err); throw err; }
  },

  async generateUninstall(appConfig) {
    try { return await window.api.scripts.generateUninstall(appConfig); }
    catch (err) { _ipcErr('scripts:generateUninstall', err); throw err; }
  },

  async deployUninstall(appConfig) {
    try { return await window.api.scripts.deployUninstall(appConfig); }
    catch (err) { _ipcErr('scripts:deployUninstall', err); throw err; }
  },

  async getUpdateStatus() {
    try { return await window.api.scriptUpdates.getStatus(); }
    catch (err) { _ipcErr('scriptUpdates:getStatus', err); throw err; }
  },

  // ── Plantillas personalizadas ──

  async templateGetAll() {
    try { return await window.api.templates.getAll(); }
    catch (err) { _ipcErr('templates:getAll', err); throw err; }
  },

  async templateGet(id) {
    try { return await window.api.templates.get(id); }
    catch (err) { _ipcErr('templates:get', err); throw err; }
  },

  async templateCreate(data) {
    try { return await window.api.templates.create(data); }
    catch (err) { _ipcErr('templates:create', err); throw err; }
  },

  async templateUpdate(id, data) {
    try { return await window.api.templates.update(id, data); }
    catch (err) { _ipcErr('templates:update', err); throw err; }
  },

  async templateDelete(id) {
    try { return await window.api.templates.delete(id); }
    catch (err) { _ipcErr('templates:delete', err); throw err; }
  },

  async templateSaveInstaller(templateId, localPath) {
    try { return await window.api.templates.saveInstaller(templateId, localPath); }
    catch (err) { _ipcErr('templates:saveInstaller', err); throw err; }
  },

  async templateDeleteInstaller(templateId) {
    try { return await window.api.templates.deleteInstaller(templateId); }
    catch (err) { _ipcErr('templates:deleteInstaller', err); throw err; }
  },
};


// =============================================================
// GpoApi — CRUD de GPOs (operaciones sobre ad.* relacionadas con GPO)
// =============================================================
const GpoApi = {

  async getAll() {
    try { return await window.api.ad.getGPOs(); }
    catch (err) { _ipcErr('ad:getGPOs', err); throw err; }
  },

  async getLinkCounts() {
    try { return await window.api.ad.getGPOLinkCounts(); }
    catch (err) { _ipcErr('ad:getGPOLinkCounts', err); throw err; }
  },

  async create(name, scriptPath, ouDN) {
    try { return await window.api.ad.createGPO(name, scriptPath, ouDN); }
    catch (err) { _ipcErr('ad:createGPO', err); throw err; }
  },

  async remove(name) {
    try { return await window.api.ad.deleteGPO(name); }
    catch (err) { _ipcErr('ad:deleteGPO', err); throw err; }
  },

  async checkExists(name) {
    try { return await window.api.ad.checkGPOExists(name); }
    catch (err) { _ipcErr('ad:checkGPOExists', err); throw err; }
  },

  async linkToOU(gpoName, ouDN) {
    try { return await window.api.ad.linkGPOtoOU(gpoName, ouDN); }
    catch (err) { _ipcErr('ad:linkGPOtoOU', err); throw err; }
  },

  async bulkLink(gpoName, ouDNs) {
    try { return await window.api.ad.bulkLinkGPO(gpoName, ouDNs); }
    catch (err) { _ipcErr('ad:bulkLinkGPO', err); throw err; }
  },

  async unlinkFromOU(gpoName, ouDN) {
    try { return await window.api.ad.unlinkGPOfromOU(gpoName, ouDN); }
    catch (err) { _ipcErr('ad:unlinkGPOfromOU', err); throw err; }
  },

  async removeStartupScript(gpoName) {
    try { return await window.api.ad.removeGPOStartupScript(gpoName); }
    catch (err) { _ipcErr('ad:removeGPOStartupScript', err); throw err; }
  },

  async getManagedLinks(gpoNames, ouDNs = []) {
    try { return await window.api.ad.getManagedGPOLinks(gpoNames, ouDNs); }
    catch (err) { _ipcErr('ad:getManagedGPOLinks', err); throw err; }
  },
};


// =============================================================
// AdApi — Navegación de OUs y estado de RSAT
// =============================================================
const AdApi = {

  async checkRSAT() {
    try { return await window.api.ad.checkRSAT(); }
    catch (err) { _ipcErr('ad:checkRSAT', err); throw err; }
  },

  async getOUs(ignoreBaseOU = false) {
    try { return await window.api.ad.getOUs(ignoreBaseOU); }
    catch (err) { _ipcErr('ad:getOUs', err); throw err; }
  },
};


// =============================================================
// BundleApi — Gestión de bundles
// =============================================================
const BundleApi = {

  async getAll() {
    try { return await window.api.bundles.getAll(); }
    catch (err) { _ipcErr('bundles:getAll', err); throw err; }
  },

  async get(id) {
    try { return await window.api.bundles.get(id); }
    catch (err) { _ipcErr('bundles:get', err); throw err; }
  },

  async create(data) {
    try { return await window.api.bundles.create(data); }
    catch (err) { _ipcErr('bundles:create', err); throw err; }
  },

  async update(id, data) {
    try { return await window.api.bundles.update(id, data); }
    catch (err) { _ipcErr('bundles:update', err); throw err; }
  },

  async remove(id) {
    try { return await window.api.bundles.delete(id); }
    catch (err) { _ipcErr('bundles:delete', err); throw err; }
  },

  async deploy(id) {
    try { return await window.api.bundles.deploy(id); }
    catch (err) { _ipcErr('bundles:deploy', err); throw err; }
  },

  async deployUninstall(id) {
    try { return await window.api.bundles.deployUninstall(id); }
    catch (err) { _ipcErr('bundles:deployUninstall', err); throw err; }
  },

  async generateScript(id) {
    try { return await window.api.bundles.generateScript(id); }
    catch (err) { _ipcErr('bundles:generateScript', err); throw err; }
  },

  async generateUninstallScript(id) {
    try { return await window.api.bundles.generateUninstallScript(id); }
    catch (err) { _ipcErr('bundles:generateUninstallScript', err); throw err; }
  },
};


// =============================================================
// ShareApi — Share de red y archivos desplegados
// =============================================================
const ShareApi = {

  async checkHealth() {
    try { return await window.api.share.checkHealth(); }
    catch (err) { _ipcErr('share:checkHealth', err); throw err; }
  },

  async detectLoggingConfig() {
    try { return await window.api.share.detectLoggingConfig(); }
    catch (err) { _ipcErr('share:detectLoggingConfig', err); throw err; }
  },

  async enrollFromConfig() {
    try { return await window.api.share.enrollFromConfig(); }
    catch (err) { _ipcErr('share:enrollFromConfig', err); throw err; }
  },

  async publishLoggingConfig(options) {
    try { return await window.api.share.publishLoggingConfig(options); }
    catch (err) { _ipcErr('share:publishLoggingConfig', err); throw err; }
  },

  async listDeployed() {
    try { return await window.api.files.listDeployed(); }
    catch (err) { _ipcErr('files:listDeployed', err); throw err; }
  },

  async getContents(appName) {
    try { return await window.api.files.getContents(appName); }
    catch (err) { _ipcErr('files:getContents', err); throw err; }
  },
};


// =============================================================
// CatalogApi — Catálogo winget y resolución de paquetes
// =============================================================
const CatalogApi = {

  async get() {
    try { return await window.api.catalog.getCatalog(); }
    catch (err) { _ipcErr('catalog:getCatalog', err); throw err; }
  },

  async searchCLI(query) {
    try { return await window.api.catalog.searchCLI(query); }
    catch (err) { _ipcErr('catalog:searchCLI', err); throw err; }
  },

  async checkSingle(wingetId, wingetSource, name) {
    try { return await window.api.catalog.checkSingle(wingetId, wingetSource, name); }
    catch (err) { _ipcErr('catalog:checkSingle', err); throw err; }
  },

  async checkVersions(ids) {
    try { return await window.api.catalog.checkVersions(ids); }
    catch (err) { _ipcErr('catalog:checkVersions', err); throw err; }
  },

  async resolve(reference) {
    try { return await window.api.catalog.resolvePackage(reference); }
    catch (err) { _ipcErr('catalog:resolvePackage', err); throw err; }
  },
};


// =============================================================
// LogApi — Logs centralizados (query, stats, estado del backend)
// =============================================================
const LogApi = {

  async status() {
    try { return await window.api.logs.status(); }
    catch (err) { _ipcErr('logs:status', err); throw err; }
  },

  async query(filters) {
    try { return await window.api.logs.query(filters); }
    catch (err) { _ipcErr('logs:query', err); throw err; }
  },

  async recent(count) {
    try { return await window.api.logs.recent(count); }
    catch (err) { _ipcErr('logs:recent', err); throw err; }
  },

  async statsSummary(window_) {
    try { return await window.api.logs.statsSummary(window_); }
    catch (err) { _ipcErr('logs:statsSummary', err); throw err; }
  },

  async equipos(search) {
    try { return await window.api.logs.equipos(search); }
    catch (err) { _ipcErr('logs:equipos', err); throw err; }
  },

  async reload() {
    try { return await window.api.logs.reload(); }
    catch (err) { _ipcErr('logs:reload', err); throw err; }
  },

  async useLocal() {
    try { return await window.api.logs.useLocal(); }
    catch (err) { _ipcErr('logs:useLocal', err); throw err; }
  },
};


// =============================================================
// SettingsApi — Configuración, i18n, TLS, admin API
// =============================================================
const SettingsApi = {

  // ── Configuración de la app ──

  async getConfig() {
    try { return await window.api.config.get(); }
    catch (err) { _ipcErr('config:get', err); throw err; }
  },

  async setConfig(data) {
    try { return await window.api.config.set(data); }
    catch (err) { _ipcErr('config:set', err); throw err; }
  },

  async selectFile(filters) {
    try { return await window.api.config.selectFile(filters); }
    catch (err) { _ipcErr('config:selectFile', err); throw err; }
  },

  async selectFolder() {
    try { return await window.api.config.selectFolder(); }
    catch (err) { _ipcErr('config:selectFolder', err); throw err; }
  },

  async saveFile(content, filename) {
    try { return await window.api.saveFile(content, filename); }
    catch (err) { _ipcErr('config:saveFile', err); throw err; }
  },

  async loadFile() {
    try { return await window.api.loadFile(); }
    catch (err) { _ipcErr('config:loadFile', err); throw err; }
  },

  // ── Internacionalización ──

  async getTranslations(langCode) {
    try { return await window.api.i18n.getTranslations(langCode); }
    catch (err) { _ipcErr('i18n:getTranslations', err); throw err; }
  },

  async getAvailableLangs() {
    try { return await window.api.i18n.getAvailable(); }
    catch (err) { _ipcErr('i18n:getAvailable', err); throw err; }
  },

  // ── Certificados TLS ──

  async certInspect(baseUrl) {
    try { return await window.api.cert.inspect(baseUrl); }
    catch (err) { _ipcErr('cert:inspect', err); throw err; }
  },

  async certTrust(baseUrl) {
    try { return await window.api.cert.trust(baseUrl); }
    catch (err) { _ipcErr('cert:trust', err); throw err; }
  },

  // ── Panel de administración (API keys, secrets, tokens) ──

  async adminStatus() {
    try { return await window.api.admin.status(); }
    catch (err) { _ipcErr('admin:status', err); throw err; }
  },

  async adminLogin(payload) {
    try { return await window.api.admin.login(payload); }
    catch (err) { _ipcErr('admin:login', err); throw err; }
  },

  async adminLogout() {
    try { return await window.api.admin.logout(); }
    catch (err) { _ipcErr('admin:logout', err); throw err; }
  },

  async adminListKeys() {
    try { return await window.api.admin.listKeys(); }
    catch (err) { _ipcErr('admin:listKeys', err); throw err; }
  },

  async adminCreateKey(options) {
    try { return await window.api.admin.createKey(options); }
    catch (err) { _ipcErr('admin:createKey', err); throw err; }
  },

  async adminRevokeKey(id) {
    try { return await window.api.admin.revokeKey(id); }
    catch (err) { _ipcErr('admin:revokeKey', err); throw err; }
  },

  async adminProvisionIngestKey(name) {
    try { return await window.api.admin.provisionIngestKey(name); }
    catch (err) { _ipcErr('admin:provisionIngestKey', err); throw err; }
  },

  async adminListShareSecrets() {
    try { return await window.api.admin.listShareSecrets(); }
    catch (err) { _ipcErr('admin:listShareSecrets', err); throw err; }
  },

  async adminCreateShareSecret(id) {
    try { return await window.api.admin.createShareSecret(id); }
    catch (err) { _ipcErr('admin:createShareSecret', err); throw err; }
  },

  async adminListEnrollTokens() {
    try { return await window.api.admin.listEnrollTokens(); }
    catch (err) { _ipcErr('admin:listEnrollTokens', err); throw err; }
  },

  async adminCreateEnrollToken(payload) {
    try { return await window.api.admin.createEnrollToken(payload); }
    catch (err) { _ipcErr('admin:createEnrollToken', err); throw err; }
  },
};


// =============================================================
// ActivityApi — Registro de actividad interna
// (El _ipcErr de este módulo NO llama a activity.add para evitar recursión)
// =============================================================
const ActivityApi = {

  async getRecent(count) {
    try { return await window.api.activity.getRecent(count); }
    catch (err) { console.error('[IPC:activity:getRecent]', err); throw err; }
  },

  async add(action, details) {
    try { return await window.api.activity.add(action, details); }
    catch (err) { console.error('[IPC:activity:add]', err); throw err; }
  },
};


// =============================================================
// UpdateApi — Actualizaciones de la app y de scripts
// =============================================================
const UpdateApi = {

  async check() {
    try { return await window.api.updates.check(); }
    catch (err) { _ipcErr('updates:check', err); throw err; }
  },

  async getCurrent() {
    try { return await window.api.updates.getCurrent(); }
    catch (err) { _ipcErr('updates:getCurrent', err); throw err; }
  },

  async openReleasePage() {
    try { return await window.api.updates.openReleasePage(); }
    catch (err) { _ipcErr('updates:openReleasePage', err); throw err; }
  },
};


// =============================================================
// WindowApi — Controles de ventana frameless
// =============================================================
const WindowApi = {
  minimize() { window.api.window.minimize(); },
  maximize() { window.api.window.maximize(); },
  close()    { window.api.window.close(); },
};


// =============================================================
// Exposición global — compatible con <script> sin bundler.
// Si en el futuro se añade un bundler, agregar `export` delante
// de cada `const` y eliminar este bloque.
// =============================================================
window.AppApi      = AppApi;
window.ScriptApi   = ScriptApi;
window.GpoApi      = GpoApi;
window.AdApi       = AdApi;
window.BundleApi   = BundleApi;
window.ShareApi    = ShareApi;
window.CatalogApi  = CatalogApi;
window.LogApi      = LogApi;
window.SettingsApi = SettingsApi;
window.ActivityApi = ActivityApi;
window.UpdateApi   = UpdateApi;
window.WindowApi   = WindowApi;
