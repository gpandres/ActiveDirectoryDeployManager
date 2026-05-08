// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Apps Page â€“ CRUD, Wizard, Bulk GPO Assignment
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const AppsPage = {
  // State still used by wizard/catalog/quickflow (not yet extracted)
  gposCache:              null,
  ousCache:               null,
  ousTreeCache:           null,
  wingetCatalogCache:     null,
  _wizardOpening:         false,
  _updateCheckResults:    [],
  _checkingUpdates:       false,
  _regeneratingScriptIds: new Set(),

  // ── Delegations → AppsListModule ──────────────────────────────────────
  async render(container)            { return AppsListModule.render(container); },
  isAdvancedUIMode()                 { return AppsListModule.isAdvancedUIMode(); },
  isSimpleUIMode()                   { return AppsListModule.isSimpleUIMode(); },
  stopScriptUpdatePolling(c = true)  { return AppsListModule.stopScriptUpdatePolling(c); },
  keepAppCardVisible(id)             { return AppsListModule.keepAppCardVisible(id); },
  toggleMenu(btn)                    { return AppsListModule.toggleMenu(btn); },
  toggleFolder(header)               { return AppsListModule.toggleFolder(header); },
  toggleSelect(id, checked)          { return AppsListModule.toggleSelect(id, checked); },
  clearSelection()                   { return AppsListModule.clearSelection(); },
  selectAll()                        { return AppsListModule.selectAll(); },
  toggleSelectAll(checked)           { return AppsListModule.toggleSelectAll(checked); },
  updateBulkBar()                    { return AppsListModule.updateBulkBar(); },

  // ── Delegations → AppsWizardModule ─────────────────────────────────
  openWizard(app)                     { return AppsWizardModule.openWizard(app); },
  copyScript()                        { return AppsWizardModule.copyScript(); },

  // ── Delegations → AppsTemplateModule ──────────────────────────────────
  openTemplateManager(cb)                         { return AppsTemplateModule.openTemplateManager(cb); },
  buildTemplateViewFromDefinition(id, def)        { return AppsTemplateModule.buildTemplateViewFromDefinition(id, def); },
  describeTemplateFile(f)                         { return AppsTemplateModule.describeTemplateFile(f); },
  fetchTemplateDefinition(id)                     { return AppsTemplateModule.fetchTemplateDefinition(id); },
  reconcileLegacyTemplateXmlSelection(v, f, x)   { return AppsTemplateModule.reconcileLegacyTemplateXmlSelection(v, f, x); },

  // ── AppUtils delegates ─────────────────────────────────────────────────
  templateIcon(tmpl)                  { return AppUtils.templateIcon(tmpl); },
  isSupportedInstallerExtension(ext)  { return AppUtils.isSupportedInstallerExtension(ext); },
  isInstallerTemplateFile(ff)         { return AppUtils.isInstallerTemplateFile(ff); },
  getInstallerTypeFromPath(p, tmpl)   { return AppUtils.getInstallerTypeFromPath(p, tmpl); },
  getDefaultUninstallMode(tmpl,p,it)  { return AppUtils.getDefaultUninstallMode(tmpl, p, it); },
  normalizeUninstallState(src, fb)    { return AppUtils.normalizeUninstallState(src, fb); },
  getUninstallModeLabel(mode)         { return AppUtils.getUninstallModeLabel(mode); },
  canGenerateUninstall(appLike)       { return AppUtils.canGenerateUninstall(appLike); },
  getUninstallSummary(appLike)        { return AppUtils.getUninstallSummary(appLike); },
  getPublishedAction(appLike)         { return AppUtils.getPublishedAction(appLike); },
  getDeploymentVisualState(appLike)   { return AppUtils.getDeploymentVisualState(appLike); },
  getDeploymentStatusLabel(appLike)   { return AppUtils.getDeploymentStatusLabel(appLike); },
  getInstallActionLabel(appLike)      { return AppUtils.getInstallActionLabel(appLike); },
  renderDeleteTargetCard(args)        { return AppUtils.renderDeleteTargetCard(args); },
  renderDeleteOptionCard(args)        { return AppUtils.renderDeleteOptionCard(args); },
  renderDeleteFooter(id, label)       { return AppUtils.renderDeleteFooter(id, label); },
  compareVersions(a, b)               { return AppUtils.compareVersions(a, b); },

  // -- Delegations -> AppsUpdatesModule ------------------------------------------
  async wingetUpdateDialog(id)  { return AppsUpdatesModule.wingetUpdateDialog(id); },
  async checkUpdates()          { return AppsUpdatesModule.checkUpdates(); },

  // -- Delegations -> AppsActionsModule ------------------------------------------
  async resolveSharedInstaller(n, p)   { return AppsActionsModule.resolveSharedInstaller(n, p); },
  async showAppDetail(id)               { return AppsActionsModule.showAppDetail(id); },
  async quickUpdate(id)                 { return AppsActionsModule.quickUpdate(id); },
  async performQuickUpdate(app, state)  { return AppsActionsModule.performQuickUpdate(app, state); },
  async previewScript(id)               { return AppsActionsModule.previewScript(id); },
  async previewUninstallScript(id)      { return AppsActionsModule.previewUninstallScript(id); },
  async deployApp(id)                   { return AppsActionsModule.deployApp(id); },
  async regenerateScripts(id)           { return AppsActionsModule.regenerateScripts(id); },
  async uninstallApp(id)                { return AppsActionsModule.uninstallApp(id); },
  async disableDeploy(id)               { return AppsActionsModule.disableDeploy(id); },
  async editApp(id)                     { return AppsActionsModule.editApp(id); },
  async deleteApp(id)                   { return AppsActionsModule.deleteApp(id); },

};