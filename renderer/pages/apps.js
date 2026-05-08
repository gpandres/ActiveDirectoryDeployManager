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


  // Returns the installer path inside the app's share folder, or null if
  // the app isn't deployed / no installer is present on the share.
  async resolveSharedInstaller(appName, preferredInstallerPath = '') {
    try {
      if (!appName) return null;
      const result = await window.api.files.getContents(appName);
      if (!result || !result.success || !Array.isArray(result.data)) return null;
      const preferredName = String(preferredInstallerPath || '').split(/[\\/]/).pop()?.toLowerCase() || '';
      const installers = result.data.filter(f =>
        this.isSupportedInstallerExtension(f.extension)
        && String(f.name || '').toLowerCase() !== 'install.ps1'
        && String(f.name || '').toLowerCase() !== 'uninstall.ps1'
      );
      const installer = installers.find(f => String(f.name || '').toLowerCase() === preferredName) || installers[0];
      if (!installer) return null;
      const config = await window.api.config.get();
      if (!config || !config.networkSharePath) return null;
      const base = config.networkSharePath.replace(/[\\/]+$/, '');
      return base + '\\' + appName + '\\' + installer.name;
    } catch (e) {
      return null;
    }
  },

  // â”€â”€â”€ Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderDeleteTargetCard(args)        { return AppUtils.renderDeleteTargetCard(args); },
  renderDeleteOptionCard(args)        { return AppUtils.renderDeleteOptionCard(args); },
  renderDeleteFooter(id, label)       { return AppUtils.renderDeleteFooter(id, label); },

  async showAppDetail(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const templates = await window.api.scripts.getTemplates();
    const templateInfo = templates.find(tmpl => tmpl.id === app.template) || { name: app.templateDefinition?.name || app.template };
    const isDeployed = app.deployed !== false && app.deployedPath;
    const publishedAction = this.getPublishedAction(app);
    const statusClass = this.getDeploymentVisualState(app);
    const statusText = this.getDeploymentStatusLabel(app);

    // Prefer the share location for the installer (where it actually lives now)
    const sharedInstaller = await this.resolveSharedInstaller(app.name, app.installerPath);
    const displayInstallerPath = sharedInstaller || app.installerPath;

    const row = (label, value) => value ? `
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
        <span style="color:var(--text-muted); font-size:13px;">${label}</span>
        <span style="color:var(--text-primary); font-size:13px; font-weight:500; text-align:right; max-width:60%; word-break:break-all;">${value}</span>
      </div>` : '';

    const ouNameFromDN = (dn) => {
      const match = (dn || '').match(/^OU=([^,]+)/i);
      return match ? match[1] : dn;
    };

    const ousHtml = app.assignedOUs && app.assignedOUs.length > 0
      ? app.assignedOUs.map(ou => `<div style="font-size:12px; color:var(--text-secondary); padding:4px 8px; background:var(--bg-tertiary); border-radius:4px; margin-top:4px;" title="${App._esc(ou)}">${App._esc(ouNameFromDN(ou))}</div>`).join('')
      : `<span style="color:var(--text-muted); font-size:13px;">${t('apps.detailNoOUs')}</span>`;

    const paramsHtml = app.customParams && Object.keys(app.customParams).length > 0
      ? Object.entries(app.customParams).map(([k, v]) => row(App._esc(k), App._esc(String(v)))).join('')
      : '';
    const uninstallSummary = this.getUninstallSummary(app);
    const canUninstall = this.canGenerateUninstall(app);
    const canPublishUninstall = isDeployed && publishedAction !== 'uninstall';

    const body = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Header -->
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:48px; height:48px; border-radius:12px; background:var(--accent-primary-dim); display:flex; align-items:center; justify-content:center; font-size:26px;">
            ${this.templateIcon(app.template)}
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--text-primary);">${App._esc(app.name)}</div>
            <div style="font-size:13px; color:var(--text-muted);">${App._esc(templateInfo.name)}</div>
          </div>
        </div>

        <!-- Status badges -->
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="badge badge-primary">${App._esc((app.installerType || 'exe').toUpperCase())}</span>
          <span class="badge badge-info">v${App._esc(app.version || '1.0.0')}</span>
          ${statusClass === 'uninstalling'
            ? `<span class="badge badge-warning">${t('apps.uninstallPublished', 'Desinstalacion')}</span>`
            : (isDeployed
                ? `<span class="badge badge-success">${t('apps.installPublished', 'Instalacion')}</span>`
                : `<span class="badge badge-neutral">${t('apps.detailNotDeployed')}</span>`)}
          ${app.gpoName ? `<span class="badge badge-info">${App._esc(app.gpoName)}</span>` : `<span class="badge badge-neutral">${t('apps.noGpoBadge')}</span>`}
          ${app.notifyUser ? `<span class="badge badge-warning">${t('apps.detailNotifyEnabled')}</span>` : ''}
        </div>

        <!-- General Info -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionGeneral')}</div>
          ${row(t('apps.detailTemplate'), App._esc(templateInfo.name))}
          ${app.template === 'winget'
            ? row('Winget ID', `<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">${App._esc(app.wingetId || '-')}</code>`)
            : app.template === 'odt'
              ? row('Producto ODT', `<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">${App._esc((app.odtConfig?.product || 'O365BusinessRetail') + ' · ' + (app.odtConfig?.channel || 'MonthlyEnterprise') + ' · ' + (app.odtConfig?.language || 'es-es'))}</code>`)
              : row(t('apps.detailInstallerType'), App._esc((app.installerType || 'exe').toUpperCase()))
          }
          ${(app.template !== 'winget' && app.template !== 'odt') ? row(t('apps.detailSilentArgs'), app.silentArgs ? '<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">' + App._esc(app.silentArgs) + '</code>' : '-') : ''}
          ${row(t('apps.publishedState', 'Estado publicado'), App._esc(statusText))}
          ${row(t('apps.uninstallMode', 'Modo de desinstalacion'), App._esc(uninstallSummary))}
          ${row(t('apps.detailVersion'), App._esc(app.version || '1.0.0'))}
          ${row(t('apps.detailNotifyUser'), app.notifyUser ? '&#10003;' : '&#10007;')}
        </div>

        <!-- Paths -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionPaths')}</div>
          ${(app.template !== 'winget' && app.template !== 'odt') ? row(t('apps.detailInstaller'), displayInstallerPath ? '<span style="font-family:monospace; font-size:12px;">' + App._esc(displayInstallerPath) + '</span>' : '-') : ''}
          ${app.configXmlPath ? row(t('apps.detailConfigXml'), '<span style="font-family:monospace; font-size:12px;">' + App._esc(app.configXmlPath) + '</span>') : ''}
          ${row(t('apps.detailDeployPath'), app.deployedPath ? '<span style="font-family:monospace; font-size:12px;">' + App._esc(app.deployedPath) + '</span>' : '-')}
          ${row(t('apps.uninstallDeployPath', 'Ruta uninstall'), app.uninstallDeployedPath ? '<span style="font-family:monospace; font-size:12px;">' + App._esc(app.uninstallDeployedPath) + '</span>' : '-')}
          ${app.lastDeployHash ? row(t('apps.detailHash'), '<span style="font-family:monospace; font-size:11px;">' + App._esc(app.lastDeployHash.substring(0, 16)) + '...</span>') : ''}
        </div>

        <!-- GPO & OUs -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionTargeting')}</div>
          ${row(t('apps.detailGpo'), app.gpoName ? App._esc(app.gpoName) : '-')}
          <div style="padding:10px 0; border-bottom:1px solid var(--border-color);">
            <span style="color:var(--text-muted); font-size:13px;">${t('apps.detailAssignedOUs')}</span>
            <div style="margin-top:6px;">${ousHtml}</div>
          </div>
        </div>

        ${paramsHtml ? `
        <!-- Custom Parameters -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionParams')}</div>
          ${paramsHtml}
        </div>
        ` : ''}

        ${app.versionHistory && app.versionHistory.length > 0 ? `
        <!-- Version History -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${t('apps.detailSectionHistory')} (${app.versionHistory.length})</div>
          <div style="display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto;">
            ${app.versionHistory.slice().reverse().map(h => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-tertiary); border-radius:6px; font-size:12px;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                  <span style="color:var(--text-primary); font-weight:600;">v${App._esc(h.version || '?')}</span>
                  ${h.hash ? `<span style="font-family:monospace; font-size:10px; color:var(--text-muted);">${App._esc(h.hash.substring(0, 16))}...</span>` : ''}
                </div>
                <span style="color:var(--text-muted); font-size:11px;">${h.replacedAt ? new Date(h.replacedAt).toLocaleString() : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Timestamps -->
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); padding-top:4px;">
          <span>${t('apps.detailCreated')}: ${app.createdAt ? new Date(app.createdAt).toLocaleString() : '-'}</span>
          <span>${t('apps.detailUpdated')}: ${app.updatedAt ? new Date(app.updatedAt).toLocaleString() : '-'}</span>
        </div>
      </div>
    `;

    App.openModal(t('apps.detailTitle'), body, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.close')}</button>
      ${canPublishUninstall && canUninstall ? `<button class="btn btn-warning" onclick="App.closeModal(); AppsPage.uninstallApp('${app.id}')">${t('apps.uninstallAction', 'Desinstalar')}</button>` : ''}
      ${(!isDeployed || publishedAction === 'uninstall') ? `<button class="btn btn-success" onclick="App.closeModal(); AppsPage.deployApp('${app.id}')">${this.getInstallActionLabel(app)}</button>` : ''}
      <button class="btn btn-secondary" onclick="App.closeModal(); AppsPage.editApp('${app.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        ${t('apps.edit')}
      </button>
    `);

    this.keepAppCardVisible(id);
  },

  // â”€â”€â”€ Quick Update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  compareVersions(a, b)               { return AppUtils.compareVersions(a, b); },

  async quickUpdate(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const templates = await window.api.scripts.getTemplates();
    const templateInfo = templates.find(tmpl => tmpl.id === app.template) || { name: app.templateDefinition?.name || app.template };

    // Local state for the quick update flow
    const state = {
      newInstallerPath: '',
      newVersion: '',
      newHash: '',
      sameFile: false,
      isDowngrade: false
    };

    const renderModal = () => {
      const body = `
        <div style="display:flex; flex-direction:column; gap:14px;">
          <!-- Info banner -->
          <div style="padding:12px; background:rgba(30,144,255,0.08); border:1px solid rgba(30,144,255,0.2); border-radius:8px;">
            <p style="margin:0; color:var(--text-secondary); font-size:13px;">
              ${t('apps.quickUpdateIntro')}
            </p>
          </div>

          <!-- Header -->
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:44px; height:44px; border-radius:10px; background:var(--accent-primary-dim); display:flex; align-items:center; justify-content:center; font-size:24px;">
              ${this.templateIcon(app.template)}
            </div>
            <div>
              <div style="font-size:17px; font-weight:700; color:var(--text-primary);">${App._esc(app.name)}</div>
              <div style="font-size:12px; color:var(--text-muted);">${App._esc(templateInfo.name)}</div>
            </div>
          </div>

          <!-- Current state -->
          <div class="card" style="padding:12px 16px; margin:0;">
            <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${t('apps.quickUpdateCurrent')}</div>
            <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
              <span style="color:var(--text-muted);">${t('apps.detailVersion')}</span>
              <span style="color:var(--text-primary); font-weight:500;">v${App._esc(app.version || '1.0.0')}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
              <span style="color:var(--text-muted);">${t('apps.detailInstaller')}</span>
              <span style="font-family:monospace; font-size:11px; color:var(--text-primary); max-width:60%; text-align:right; word-break:break-all;">${App._esc(app.installerPath || '-')}</span>
            </div>
            ${app.lastDeployHash ? `
            <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
              <span style="color:var(--text-muted);">SHA-256</span>
              <span style="font-family:monospace; font-size:11px; color:var(--text-muted);">${App._esc(app.lastDeployHash.substring(0, 16))}...</span>
            </div>
            ` : ''}
          </div>

          <!-- File picker -->
          <div>
            <label class="form-label">${t('apps.quickUpdatePickNew')}</label>
            <div class="flex gap-sm">
              <input class="form-input" id="qu-installer-path" value="${App._esc(state.newInstallerPath)}" placeholder="${t('apps.quickUpdatePickPlaceholder')}" readonly style="flex:1">
              <button class="btn btn-secondary" id="qu-pick-btn">${t('apps.browse')}</button>
            </div>
          </div>

          <!-- Comparison (only if new file picked) -->
          ${state.newInstallerPath ? `
            <div class="card" style="padding:12px 16px; margin:0;">
              <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${t('apps.quickUpdateComparison')}</div>
              <div style="display:flex; align-items:center; justify-content:center; gap:16px; padding:10px; background:var(--bg-tertiary); border-radius:6px;">
                <div style="text-align:center;">
                  <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${t('apps.quickUpdateOldLabel')}</div>
                  <div style="font-weight:700; color:var(--text-primary);">v${App._esc(app.version || '1.0.0')}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                <div style="text-align:center;">
                  <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${t('apps.quickUpdateNewLabel')}</div>
                  <div style="font-weight:700; color:${state.isDowngrade ? 'var(--warning-color)' : 'var(--success-color, #10b981)'};">v${App._esc(state.newVersion || '?')}</div>
                </div>
              </div>
              ${state.newHash ? `
                <div style="display:flex; justify-content:space-between; padding:8px 0 0 0; font-size:11px; font-family:monospace; color:var(--text-muted);">
                  <span>${App._esc((app.lastDeployHash || '').substring(0, 16))}...</span>
                  <span>&#8594;</span>
                  <span>${App._esc(state.newHash.substring(0, 16))}...</span>
                </div>
              ` : ''}
            </div>

            ${state.sameFile ? `
              <div style="padding:12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px;">
                <p style="margin:0; color:var(--danger-color); font-size:13px; font-weight:500;">
                  &#9888;&#65039; ${t('apps.quickUpdateSameFile')}
                </p>
              </div>
            ` : ''}

            ${state.isDowngrade && !state.sameFile ? `
              <div style="padding:12px; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.3); border-radius:8px;">
                <p style="margin:0; color:var(--warning-color); font-size:13px; font-weight:500;">
                  &#9888;&#65039; ${t('apps.quickUpdateDowngradeWarn').replace('{old}', app.version || '1.0.0').replace('{new}', state.newVersion)}
                </p>
              </div>
            ` : ''}
          ` : ''}
        </div>
      `;

      const canUpdate = state.newInstallerPath && !state.sameFile;
      const footer = `
        <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
        <div style="flex:1"></div>
        <button class="btn btn-success" id="qu-confirm-btn" ${canUpdate ? '' : 'disabled'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          ${t('apps.quickUpdateConfirm')}
        </button>
      `;

      App.openModal(t('apps.quickUpdateTitle'), body, footer);

      document.getElementById('qu-pick-btn').addEventListener('click', async () => {
        const file = await window.api.config.selectFile([{ name: 'Installers', extensions: ['exe', 'msi'] }]);
        if (!file) return;

        state.newInstallerPath = file;
        state.newVersion = '';
        state.newHash = '';
        state.sameFile = false;
        state.isDowngrade = false;

        // Detect version
        try {
          const verResult = await window.api.apps.getInstallerVersion(file);
          if (verResult && verResult.success && verResult.version) {
            state.newVersion = verResult.version;
            state.isDowngrade = this.compareVersions(verResult.version, app.version || '0') < 0;
          }
        } catch (e) {}

        // Compute hash and compare
        try {
          const hashResult = await window.api.apps.computeHash(file);
          if (hashResult && hashResult.hash) {
            state.newHash = hashResult.hash;
            if (app.lastDeployHash && app.lastDeployHash === hashResult.hash) {
              state.sameFile = true;
            }
          }
        } catch (e) {}

        renderModal();
      });

      const confirmBtn = document.getElementById('qu-confirm-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          this.performQuickUpdate(app, state);
        });
      }
    };

    renderModal();
  },

  async performQuickUpdate(app, state) {
    const confirmBtn = document.getElementById('qu-confirm-btn');
    if (confirmBtn) {
      confirmBtn.style.width = confirmBtn.offsetWidth + 'px';
      confirmBtn.style.height = confirmBtn.offsetHeight + 'px';
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>';
    }

    try {
      // 1. Push current version to history
      const history = Array.isArray(app.versionHistory) ? [...app.versionHistory] : [];
      history.push({
        version: app.version || '1.0.0',
        hash: app.lastDeployHash || '',
        replacedAt: new Date().toISOString(),
        replacedBy: 'quick-update'
      });

      // 2. Build updated app data
      const newInstallerType = this.getInstallerTypeFromPath(state.newInstallerPath, app.template);
      const updatedData = {
        installerPath: state.newInstallerPath,
        installerType: newInstallerType,
        version: state.newVersion || app.version,
        versionHistory: history
      };

      // 3. Update app record
      await window.api.apps.update(app.id, updatedData);

      // 4. Redeploy (copies new installer + regenerates install.ps1)
      const fullAppData = { ...app, ...updatedData, id: app.id };
      const deployResult = await window.api.scripts.deploy(fullAppData);

      if (!deployResult.success) {
        if (App.isShareError(deployResult.error)) { App.handleShareError(); return; }
        App.toast(`${t('apps.appSavedDeployError')} ${deployResult.error}`, 'error');
        return;
      }

      // 5. Save new hash & deployedPath
      await window.api.apps.update(app.id, {
        deployed: true,
        deployedPath: deployResult.path,
        lastDeployHash: deployResult.hash || state.newHash,
        publishedAction: 'install',
        publishedAt: new Date().toISOString()
      });

      // 6. Activity log
      await window.api.activity.add('app_quick_update', {
        appName: app.name,
        oldVersion: app.version,
        newVersion: state.newVersion
      });

      App.toast(t('apps.quickUpdateSuccess').replace('{version}', state.newVersion || '?'), 'success');
      App.closeModal();
      AppsListModule.setPendingFocus(app.id);
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  // â”€â”€â”€ Winget Single-App Update Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async wingetUpdateDialog(id) {
    const app = await window.api.apps.get(id);
    if (!app || !app.wingetId) return;

    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:44px;height:44px;border-radius:10px;background:var(--accent-primary-dim);display:flex;align-items:center;justify-content:center;font-size:24px;">&#128230;</div>
          <div>
            <div style="font-size:17px;font-weight:700;color:var(--text-primary);">${App._esc(app.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);font-family:monospace;">${App._esc(app.wingetId)}</div>
          </div>
        </div>
        <div style="padding:10px 14px;background:var(--bg-input);border-radius:8px;display:flex;justify-content:space-between;font-size:13px;">
          <span style="color:var(--text-muted);">VersiÃ³n actual</span>
          <span style="font-weight:600;">v${App._esc(app.version || '1.0.0')}</span>
        </div>
        <div id="wud-status" style="text-align:center;padding:16px;">
          <span class="spinner" style="width:18px;height:18px;display:inline-block;border-width:2px;margin-right:8px;"></span>
          <span style="color:var(--text-secondary);font-size:13px;">${t('apps.checkingUpdates')}</span>
        </div>
      </div>`;

    App.openModal(t('apps.checkUpdates'), body,
      `<button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button><div style="flex:1"></div><button class="btn btn-success" id="wud-update-btn" style="display:none;"></button>`
    );

    try {
      const r = await window.api.catalog.checkSingle(app.wingetId, app.wingetSource, app.name);
      const latestVersion = r?.latestVersion;
      const statusEl = document.getElementById('wud-status');
      const updateBtn = document.getElementById('wud-update-btn');

      if (!latestVersion) {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No se pudo verificar la versiÃ³n mÃ¡s reciente</span>';
        return;
      }

      if (latestVersion === (app.version || '1.0.0')) {
        if (statusEl) statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" stroke-width="2" style="margin-right:8px;vertical-align:middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span style="color:var(--text-secondary);font-size:13px;">${t('apps.noUpdatesFound')}</span>`;
        return;
      }

      if (statusEl) statusEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:10px;background:var(--bg-tertiary);border-radius:8px;">
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">Actual</div>
            <div style="font-weight:700;color:var(--text-primary);">v${App._esc(app.version || '1.0.0')}</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">Disponible</div>
            <div style="font-weight:700;color:var(--accent-secondary);">v${App._esc(latestVersion)}</div>
          </div>
        </div>`;

      if (updateBtn) {
        updateBtn.style.display = '';
        updateBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg> ${t('apps.updateToVersion').replace('{version}', latestVersion)}`;
        updateBtn.addEventListener('click', () => {
          this.performWingetAutoUpdate(app.id, latestVersion, app.name, updateBtn);
        });
      }
    } catch (e) {
      const statusEl = document.getElementById('wud-status');
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger-color);font-size:13px;">Error: ${App._esc(e.message)}</span>`;
    }
  },

  // â”€â”€â”€ Winget Update Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async checkUpdates() {
    const panel = document.getElementById('apps-updates-panel');
    if (!panel) return;

    panel.style.display = '';
    this._checkingUpdates = true;
    this._updateCheckResults = [];
    panel.innerHTML = this._renderUpdatesPanelHTML();

    try {
      const apps = await window.api.apps.getAll();
      const wingetApps = apps.filter(a => a.wingetId && a.template === 'winget');

      if (wingetApps.length === 0) {
        this._checkingUpdates = false;
        this._updateCheckResults = [];
        panel.innerHTML = this._renderUpdatesPanelHTML();
        return;
      }

      // Check each winget app's latest version in parallel
      const checks = await Promise.allSettled(
        wingetApps.map(async (app) => {
          const r = await window.api.catalog.checkSingle(app.wingetId, app.wingetSource, app.name);
          return { app, latestVersion: r.latestVersion };
        })
      );

      this._updateCheckResults = checks
        .filter(c => c.status === 'fulfilled')
        .map(c => c.value)
        .filter(({ app, latestVersion }) => {
          if (!latestVersion) return false;
          // Only show if latest version is different from current
          return latestVersion !== (app.version || '1.0.0');
        })
        .map(({ app, latestVersion }) => ({
          appId: app.id,
          appName: app.name,
          wingetId: app.wingetId,
          currentVersion: app.version || '1.0.0',
          latestVersion
        }));

    } catch (err) {
      this._updateCheckResults = [];
    }

    this._checkingUpdates = false;
    panel.innerHTML = this._renderUpdatesPanelHTML();
    this._bindUpdatesPanelEvents(panel);
  },

  _renderUpdatesPanelHTML() {
    if (this._checkingUpdates) {
      return `
        <div class="card" style="padding:20px;display:flex;align-items:center;gap:12px;">
          <span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;flex-shrink:0;"></span>
          <span style="color:var(--text-secondary);font-size:var(--font-sm);">${t('apps.checkingUpdates')}</span>
        </div>`;
    }

    const results = this._updateCheckResults;
    if (results.length === 0) {
      return `
        <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span style="font-size:var(--font-sm);color:var(--text-secondary);">${t('apps.noUpdatesFound')}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('apps-updates-panel').style.display='none'">&times;</button>
        </div>`;
    }

    const rows = results.map((r, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--bg-input);border-radius:var(--radius-sm);">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--text-primary);font-size:var(--font-sm);">${App._esc(r.appName)}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted);font-family:monospace;">${App._esc(r.wingetId)}</div>
        </div>
        <div style="font-size:var(--font-sm);white-space:nowrap;">
          <span style="color:var(--text-muted);">v${App._esc(r.currentVersion)}</span>
          <span style="color:var(--accent-primary);margin:0 6px;">&#8594;</span>
          <span style="color:var(--accent-secondary);font-weight:600;">v${App._esc(r.latestVersion)}</span>
        </div>
        <button class="btn btn-primary btn-sm update-app-btn" data-idx="${i}" style="white-space:nowrap;min-width:90px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
          ${t('apps.updateToVersion').replace('{version}', r.latestVersion)}
        </button>
      </div>
    `).join('');

    return `
      <div class="card" style="padding:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
          <span style="font-weight:600;font-size:var(--font-sm);">${t('apps.updatesFound').replace('{count}', results.length)}</span>
          <div style="flex:1"></div>
          ${results.length > 1 ? `<button class="btn btn-success btn-sm" id="btn-update-all-apps">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
            ${t('apps.updateAll')}
          </button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('apps-updates-panel').style.display='none'" style="margin-left:4px;">&times;</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${rows}
        </div>
      </div>`;
  },

  _bindUpdatesPanelEvents(panel) {
    panel.querySelectorAll('.update-app-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const r = this._updateCheckResults[idx];
        if (r) this.performWingetAutoUpdate(r.appId, r.latestVersion, r.appName, btn);
      });
    });

    document.getElementById('btn-update-all-apps')?.addEventListener('click', () => {
      this.bulkWingetUpdate();
    });
  },

  async performWingetAutoUpdate(appId, newVersion, appName, btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = `<span class="spinner" style="width:12px;height:12px;display:inline-block;border-width:2px;"></span> ${t('apps.updatingApp')}`;
    }

    try {
      const app = await window.api.apps.get(appId);
      if (!app) throw new Error('App not found');

      const history = Array.isArray(app.versionHistory) ? [...app.versionHistory] : [];
      history.push({
        version: app.version || '1.0.0',
        hash: app.lastDeployHash || '',
        replacedAt: new Date().toISOString(),
        replacedBy: 'auto-update'
      });

      const updatedData = { version: newVersion, versionHistory: history };
      await window.api.apps.update(appId, updatedData);

      const fullApp = { ...app, ...updatedData, id: appId };
      const deployResult = await window.api.scripts.deploy(fullApp);

      if (!deployResult.success) {
        throw new Error(deployResult.error);
      }

      await window.api.apps.update(appId, {
        deployed: true,
        deployedPath: deployResult.path,
        publishedAction: 'install',
        publishedAt: new Date().toISOString()
      });
      await window.api.activity.add('app_auto_update', { appName, newVersion });

      App.toast(t('apps.updateSuccess').replace('{name}', appName).replace('{version}', newVersion), 'success');

      // Update the card version badge in-place without a full page reload
      const card = document.querySelector(`.app-card[data-id="${appId}"]`);
      if (card) {
        const vBadge = card.querySelector('.app-card-version');
        if (vBadge) vBadge.textContent = `v${newVersion}`;
      }

      // Remove from results list
      this._updateCheckResults = this._updateCheckResults.filter(r => r.appId !== appId);
      const panel = document.getElementById('apps-updates-panel');
      if (panel) {
        panel.innerHTML = this._renderUpdatesPanelHTML();
        this._bindUpdatesPanelEvents(panel);
      }
    } catch (err) {
      App.toast(`Error actualizando ${appName}: ${err.message}`, 'error');
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg> ${t('apps.updateToVersion').replace('{version}', this._updateCheckResults.find(r => r.appId === appId)?.latestVersion || '')}`;
      }
    }
  },

  async bulkWingetUpdate() {
    const results = [...this._updateCheckResults];
    if (results.length === 0) return;

    const updateAllBtn = document.getElementById('btn-update-all-apps');
    if (updateAllBtn) {
      updateAllBtn.disabled = true;
      updateAllBtn.innerHTML = `<span class="spinner" style="width:12px;height:12px;display:inline-block;border-width:2px;"></span> ${t('apps.updatingApp')}`;
    }

    for (const r of results) {
      await this.performWingetAutoUpdate(r.appId, r.latestVersion, r.appName, null);
    }
  },

  // â”€â”€â”€ Wizard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async previewScript(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const script = await window.api.scripts.generate(app);

    App.openModal(`Script: ${app.name}`, `
      <div class="code-header">
        <span>&#128196; install.ps1</span>
        <button class="btn btn-ghost btn-sm" onclick="AppsPage.copyScript()">${t('apps.copyBtn')}</button>
      </div>
      <pre class="code-preview" id="script-preview">${App._esc(script)}</pre>
    `);
  },

  async previewUninstallScript(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;
    if (!this.canGenerateUninstall(app)) {
      App.toast(t('apps.uninstallNotConfigured', 'Esta app no tiene una desinstalacion configurada.'), 'warning');
      return;
    }

    const script = await window.api.scripts.generateUninstall(app);
    App.openModal(`${t('apps.uninstallScript', 'Script uninstall')}: ${app.name}`, `
      <div class="code-header">
        <span>&#128196; uninstall.ps1</span>
        <button class="btn btn-ghost btn-sm" onclick="AppsPage.copyScript()">${t('apps.copyBtn')}</button>
      </div>
      <pre class="code-preview" id="script-preview">${App._esc(script)}</pre>
    `);
  },

  async deployApp(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    try {
      const result = await window.api.scripts.deploy(app);
      if (result.success) {
        await window.api.apps.update(id, {
          deployed: true,
          deployedPath: result.path,
          uninstallDeployedPath: result.uninstallPath || '',
          publishedAction: 'install',
          publishedAt: new Date().toISOString()
        });
        App.toast(t('apps.deployedToPath').replace('{app}', app.name).replace('{path}', result.path), 'success');
        AppsListModule.setPendingFocus(id);
        App.navigate('apps');
      } else {
        if (App.isShareError(result.error)) { App.handleShareError(); return; }
        App.toast(`Error: ${result.error}`, 'error');
      }
    } catch (err) {
      App.toast(t('apps.deployError') + ' ' + err.message, 'error');
    }
  },

  async regenerateScripts(id) {
    if (this._regeneratingScriptIds.has(id)) return;

    const app = await window.api.apps.get(id);
    if (!app) return;

    this._regeneratingScriptIds.add(id);
    try {
      const result = await window.api.scripts.regenerate(app);
      if (!result?.success) {
        if (App.isShareError(result?.error)) { App.handleShareError(); return; }
        throw new Error(result?.error || t('apps.regenerateScriptsError', 'No se pudieron regenerar los scripts.'));
      }

      const nextPublishedAction = String(result.publishedAction || app.publishedAction || '').trim().toLowerCase() === 'uninstall'
        ? 'uninstall'
        : 'install';
      await window.api.apps.update(id, {
        deployed: true,
        deployedPath: result.installPath || app.deployedPath || '',
        uninstallDeployedPath: result.uninstallPath || app.uninstallDeployedPath || '',
        publishedAction: nextPublishedAction,
        publishedAt: new Date().toISOString(),
        lastDeployHash: result.hash || app.lastDeployHash || ''
      });
      await window.api.activity.add('app_scripts_regenerated', {
        appName: app.name,
        publishedAction: nextPublishedAction
      });
      App.toast(t('apps.regenerateScriptsSuccess', 'Scripts regenerados correctamente para {app}.').replace('{app}', app.name), 'success');
      AppsListModule.setPendingFocus(id);
      App.navigate('apps');
    } catch (err) {
      App.toast(`${t('apps.regenerateScriptsError', 'No se pudieron regenerar los scripts.')}: ${err.message}`, 'error');
    } finally {
      this._regeneratingScriptIds.delete(id);
    }
  },

  async uninstallApp(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;
    if (!this.canGenerateUninstall(app)) {
      App.toast(t('apps.uninstallNotConfigured', 'Esta app no tiene una desinstalacion configurada.'), 'warning');
      return;
    }

    const hasGPO = !!app.gpoName;
    const targetOUs = Array.isArray(app.assignedOUs) && app.assignedOUs.length > 0
      ? app.assignedOUs
      : (app.ouDN ? [app.ouDN] : []);

    App.openModal(t('apps.uninstallAction', 'Desinstalar'), `
      <p>${t('apps.uninstallPrepareMsg', 'Se preparará el script de desinstalacion para')} <strong>${App._esc(app.name)}</strong>.</p>
      <div class="card" style="padding:12px 14px; margin:12px 0 0 0;">
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">${t('apps.uninstallMode', 'Modo de desinstalacion')}</div>
        <div style="font-weight:600; color:var(--text-primary);">${App._esc(this.getUninstallSummary(app))}</div>
      </div>
      ${hasGPO ? `
        <label class="checkbox-wrapper checkbox-panel" style="margin-top:12px;">
          <input type="checkbox" class="checkbox-select" id="chk-switch-uninstall-gpo" checked>
          <span>${t('apps.uninstallSwitchGpo', 'Reapuntar la GPO al uninstall.ps1')}</span>
        </label>
        <p class="form-hint">${t('apps.uninstallSwitchGpoHint', 'La GPO conservará sus enlaces OU y ejecutará ahora el script de desinstalacion.')}</p>
      ` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-warning" id="btn-confirm-uninstall-app">${t('apps.uninstallAction', 'Desinstalar')}</button>
    `);

    document.getElementById('btn-confirm-uninstall-app').addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-uninstall-app');
      btn.style.width = btn.offsetWidth + 'px';
      btn.style.height = btn.offsetHeight + 'px';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>';

      try {
        const deployResult = await window.api.scripts.deployUninstall(app);
        if (!deployResult.success) {
          if (App.isShareError(deployResult.error)) { App.handleShareError(); return; }
          throw new Error(deployResult.error || 'No se pudo preparar uninstall.ps1');
        }

        const uninstallPath = deployResult.uninstallPath || deployResult.path || '';
        await window.api.apps.update(app.id, {
          uninstallDeployedPath: uninstallPath,
          publishedAction: 'uninstall',
          publishedAt: new Date().toISOString()
        });

        const switchGPO = document.getElementById('chk-switch-uninstall-gpo')?.checked ?? false;
        if (hasGPO && switchGPO && uninstallPath) {
          if (!App.rsatAvailable) {
            App.toast(t('apps.uninstallGpoSkipped', 'La GPO no se pudo actualizar porque RSAT/GPMC no está disponible.'), 'warning');
          } else {
            const gpoResult = await window.api.ad.createGPO(app.gpoName, uninstallPath, targetOUs);
            if (!gpoResult.success) {
              App.toast(`${t('apps.uninstallGpoWarn', 'El script uninstall se generó, pero no se pudo reapuntar la GPO.')}: ${gpoResult.error}`, 'warning');
            }
          }
        }

        await window.api.activity.add('app_uninstall_prepare', {
          appName: app.name,
          mode: this.normalizeUninstallState(app, app).mode
        });
        App.toast(t('apps.uninstallPrepared', 'Script de desinstalacion preparado correctamente.'), 'success');
        App.closeModal();
        AppsListModule.setPendingFocus(id);
        App.navigate('apps');
      } catch (err) {
        App.toast(`${t('common.error')}: ${err.message}`, 'error');
        btn.disabled = false;
        btn.textContent = t('apps.uninstallAction', 'Desinstalar');
      }
    });
  },

  async disableDeploy(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const hasGPO = !!app.gpoName;
    const hasOUs = app.assignedOUs && app.assignedOUs.length > 0;

    App.openModal(t('apps.disableConfirm'), `
      <p>${t('apps.disableMsg').replace('{app}', `<strong>${App._esc(app.name)}</strong>`)}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--warning-color); font-weight:600;">&#9888;&#65039; Esta app tiene la GPO "${App._esc(app.gpoName)}" asignada</p>
          ${hasOUs ? `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <input type="checkbox" id="chk-unlink-gpo" checked style="width:auto; cursor:pointer;">
              <label for="chk-unlink-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanGpoOption')}</label>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <input type="checkbox" id="chk-clean-script" checked style="width:auto; cursor:pointer;">
            <label for="chk-clean-script" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanSysvolOption')}</label>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk-delete-gpo" style="width:auto; cursor:pointer;">
            <label for="chk-delete-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-muted);">${t('apps.deleteGpoOption')}</label>
          </div>
        </div>
      ` : ''}
      <div class="form-group mt-md" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="chk-delete-deploy-files" style="width:auto; cursor:pointer;" checked>
        <label for="chk-delete-deploy-files" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-muted);">${t('apps.keepFilesOption')}</label>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-warning" id="btn-confirm-disable">${t('apps.disable')}</button>
    `);

    document.getElementById('btn-confirm-disable').addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-disable');
      btn.style.width = btn.offsetWidth + 'px';
      btn.style.height = btn.offsetHeight + 'px';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>';

      try {
        // Checkbox = "keep files" (checked by default), so invert to get deleteFiles
        const deleteFiles = !document.getElementById('chk-delete-deploy-files').checked;
        const unlinkGPO = document.getElementById('chk-unlink-gpo')?.checked ?? false;
        const cleanScript = document.getElementById('chk-clean-script')?.checked ?? false;
        const deleteGPO = document.getElementById('chk-delete-gpo')?.checked ?? false;

        // 1. Unlink GPO from all assigned OUs
        if (hasGPO && unlinkGPO && hasOUs) {
          for (const ouDN of app.assignedOUs) {
            const result = await window.api.ad.unlinkGPOfromOU(app.gpoName, ouDN);
            if (result.success) {
              App.toast(t('apps.gpoUnlinkedOu').replace('{ou}', ouDN.split(',')[0]), 'success');
            } else {
              App.toast(t('apps.gpoUnlinkFailed').replace('{ou}', ouDN.split(',')[0]) + ' ' + result.error, 'warning');
            }
          }
        }

        // 2. Clean startup script from SYSVOL
        if (hasGPO && cleanScript) {
          const cleanResult = await window.api.ad.removeGPOStartupScript(app.gpoName);
          if (cleanResult.success) {
            App.toast(t('apps.sysvolCleaned'), 'success');
          } else {
            App.toast(`${t('apps.sysvolCleanWarn')} ${cleanResult.error}`, 'warning');
          }
        }

        // 3. Delete GPO entirely if requested
        if (hasGPO && deleteGPO) {
          const delResult = await window.api.ad.deleteGPO(app.gpoName);
          if (delResult.success) {
            App.toast(t('apps.gpoDeletedMsg').replace('{gpo}', app.gpoName), 'success');
          } else {
            App.toast(`${t('apps.gpoDeleteFailed')} ${delResult.error}`, 'warning');
          }
        }

        // 4. Delete files from network share if requested
        if (deleteFiles) {
          await window.api.apps.delete(id, true);
          // Re-create the app record without files
          const freshApp = { ...app };
          delete freshApp.id;
          freshApp.deployed = false;
          freshApp.deployedPath = '';
          freshApp.publishedAction = 'pending';
          freshApp.publishedAt = '';
          freshApp.gpoName = deleteGPO ? '' : app.gpoName;
          freshApp.assignedOUs = (unlinkGPO || deleteGPO) ? [] : app.assignedOUs;
          await window.api.apps.create(freshApp);
          await window.api.activity.add('app_disable', { appName: app.name, deletedFiles: true, deletedGPO: deleteGPO });
        } else {
          // Just update the app status
          const updateData = { deployed: false, deployedPath: '', publishedAction: 'pending', publishedAt: '' };
          if (deleteGPO) updateData.gpoName = '';
          if (unlinkGPO || deleteGPO) updateData.assignedOUs = [];
          await window.api.apps.update(id, updateData);
          await window.api.activity.add('app_disable', { appName: app.name, deletedFiles: false, deletedGPO: deleteGPO });
        }

        App.toast(t('apps.disableSuccess').replace('{app}', app.name), 'success');
        App.closeModal();
        App.navigate('apps');
      } catch (err) {
        App.toast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('apps.disable');
      }
    });
  },

  async editApp(id) {
    const app = await window.api.apps.get(id);
    if (app) this.openWizard(app);
  },

  async deleteApp(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const hasGPO = !!app.gpoName;
    const hasOUs = app.assignedOUs && app.assignedOUs.length > 0;
    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="padding:10px 14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;">
          <div style="font-size:13px;font-weight:700;color:var(--accent-danger);">${t('apps.deleteConfirm')}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
            ${t('apps.deleteMsg').replace('{app}', `<strong>${App._esc(app.name)}</strong>`)}
          </div>
        </div>
        ${this.renderDeleteTargetCard({
          icon: this.templateIcon(app.template),
          title: app.name,
          subtitle: app.gpoName ? `GPO: ${App._esc(app.gpoName)}` : ''
        })}
        ${hasGPO && hasOUs ? this.renderDeleteOptionCard({
          id: 'chk-del-unlink-gpo',
          checked: true,
          title: t('apps.cleanGpoOption'),
          hint: t('apps.cleanGpoOptionHint', 'Quita la vinculacion de la GPO en las OUs asignadas')
        }) : ''}
        ${hasGPO ? this.renderDeleteOptionCard({
          id: 'chk-del-clean-script',
          checked: true,
          title: t('apps.cleanSysvolOption'),
          hint: t('apps.cleanSysvolOptionHint', 'Elimina el script de inicio asociado en SYSVOL')
        }) : ''}
        ${hasGPO ? this.renderDeleteOptionCard({
          id: 'chk-del-delete-gpo',
          checked: true,
          title: t('apps.deleteGpoOption'),
          hint: t('apps.deleteGpoOptionHint', 'Borra la GPO de Active Directory si ya no se necesita')
        }) : ''}
        ${this.renderDeleteOptionCard({
          id: 'chk-delete-files',
          checked: true,
          title: t('apps.keepFilesOption'),
          hint: t('apps.keepFilesOptionHint', 'Desmarca esta opcion si tambien quieres borrar la carpeta del share')
        })}
      </div>
    `;

    App.openModal(
      t('apps.deleteConfirm'),
      body,
      this.renderDeleteFooter('btn-confirm-delete', t('common.delete'))
    );

    document.getElementById('btn-confirm-delete-cancel')?.addEventListener('click', () => App.closeModal());
    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-delete');
      btn.style.width = btn.offsetWidth + 'px';
      btn.style.height = btn.offsetHeight + 'px';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>';

      try {
        const deleteFiles = !document.getElementById('chk-delete-files').checked;
        const unlinkGPO = document.getElementById('chk-del-unlink-gpo')?.checked ?? false;
        const cleanScript = document.getElementById('chk-del-clean-script')?.checked ?? false;
        const deleteGPO = document.getElementById('chk-del-delete-gpo')?.checked ?? false;

        if (hasGPO && unlinkGPO && hasOUs) {
          for (const ouDN of app.assignedOUs) {
            await window.api.ad.unlinkGPOfromOU(app.gpoName, ouDN);
          }
        }
        if (hasGPO && cleanScript) {
          await window.api.ad.removeGPOStartupScript(app.gpoName);
        }
        if (hasGPO && deleteGPO) {
          await window.api.ad.deleteGPO(app.gpoName);
        }

        await window.api.apps.delete(id, deleteFiles);
        App.toast(t('apps.deleteSuccess').replace('{app}', app.name), 'success');
        App.closeModal();
        App.navigate('apps');
      } catch (err) {
        App.toast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = t('common.delete');
      }
    });
  },


  describeTemplateFile(fileField) {
    const parts = [];
    if (this.isInstallerTemplateFile(fileField)) {
      parts.push(t('apps.customTemplateFileTypeInstaller', 'Instalador adjunto'));
    }
    const extensions = Array.isArray(fileField?.extensions) ? fileField.extensions : [];
    if (extensions.length > 0) {
      parts.push(t('apps.customTemplateExtensions', 'Extensiones') + ': ' + extensions.join(', '));
    }
    if (fileField?.argumentName) {
      parts.push(t('apps.customTemplateArgLabel', 'Argumento') + ': ' + fileField.argumentName);
    }
    if (fileField?.destinationName) {
      parts.push(t('apps.customTemplateTargetName', 'Destino') + ': ' + fileField.destinationName);
    }
    return parts.join(' | ') || t('apps.customTemplateConfigFile', 'Archivo de configuración auxiliar');
  },

  isXmlTemplateFile(fileField) {
    const extensions = Array.isArray(fileField?.extensions) ? fileField.extensions : [];
    return extensions.some(item => String(item || '').trim().toLowerCase() === 'xml');
  },

  normalizeTemplateViewFileFields(definition) {
    const fileFields = (definition?.files || []).map(field => ({
      key: field.key,
      label: field.label,
      hint: field.hint || '',
      storageKind: field.storageKind === 'installer' ? 'installer' : 'file',
      required: field.required === true,
      extensions: Array.isArray(field.extensions)
        ? field.extensions
        : (typeof field.extensions === 'string'
            ? field.extensions.split(/[\s,;]+/).map(item => item.replace(/^\./, '').trim().toLowerCase()).filter(Boolean)
            : ['*']),
      destinationName: field.destinationName || '',
      argumentName: field.argumentName || '',
      joiner: field.joiner === 'space' ? 'space' : '=',
      quoteValue: field.quoteValue !== false
    }));

    const needsLegacyXml = definition?.requiresConfigXml === true && !fileFields.some(field => this.isXmlTemplateFile(field));
    if (needsLegacyXml) {
      let key = 'config_xml';
      const usedKeys = new Set(fileFields.map(field => field.key));
      let counter = 2;
      while (usedKeys.has(key)) {
        key = `config_xml_${counter++}`;
      }
      fileFields.push({
        key,
        label: t('apps.customTemplateXmlLabel', 'Archivo XML'),
        hint: t('apps.customTemplateXmlHint', 'XML solicitado por la plantilla. Se copiará al caché del equipo cliente y el script podrá usar $ConfigXmlPath.'),
        storageKind: 'file',
        required: true,
        extensions: ['xml'],
        destinationName: 'config.xml',
        argumentName: '',
        joiner: '=',
        quoteValue: true
      });
    }

    return fileFields;
  },

  reconcileLegacyTemplateXmlSelection(templateView, templateFiles, configXmlPath) {
    const normalizedTemplateFiles = templateFiles && typeof templateFiles === 'object'
      ? { ...templateFiles }
      : {};
    const legacyXmlPath = String(configXmlPath || '').trim();

    if (!templateView?.isUserDefined || !legacyXmlPath) {
      return { templateFiles: normalizedTemplateFiles, configXmlPath };
    }

    const xmlField = (templateView.fileFields || []).find(field => this.isXmlTemplateFile(field));
    if (!xmlField?.key) {
      return { templateFiles: normalizedTemplateFiles, configXmlPath };
    }

    const currentValue = normalizedTemplateFiles[xmlField.key];
    const currentPath = typeof currentValue === 'object' ? currentValue?.sourcePath : currentValue;
    if (!String(currentPath || '').trim()) {
      normalizedTemplateFiles[xmlField.key] = { sourcePath: legacyXmlPath };
    }

    return {
      templateFiles: normalizedTemplateFiles,
      configXmlPath: ''
    };
  },

  async fetchTemplateDefinition(templateId) {
    if (!templateId) return null;
    try {
      const template = await window.api.templates.get(templateId);
      return template && template.kind === 'user-template' ? template : null;
    } catch {
      return null;
    }
  },

  buildTemplateViewFromDefinition(templateId, definition) {
    if (!definition || definition.kind !== 'user-template') return null;
    return {
      id: templateId || definition.id,
      category: definition.category || 'Custom',
      name: definition.name,
      description: definition.description || t('apps.customTemplateDefaultDesc', 'Plantilla definida por el administrador'),
      noInstaller: false,
      source: 'user',
      isUserDefined: true,
      fields: (definition.arguments || []).map(field => ({
        key: field.key,
        label: field.label,
        default: field.defaultValue || '',
        hint: field.hint || '',
        required: field.required === true
      })),
      fileFields: this.normalizeTemplateViewFileFields(definition),
      hasCustomScript: !!definition.script
    };
  },

  createEmptyTemplateDraft() {
    return {
      name: '',
      description: '',
      arguments: [{
        label: '',
        token: '',
        joiner: '=',
        quoteValue: true,
        required: false,
        hint: '',
        defaultValue: ''
      }],
      files: [],
      script: ''
    };
  },

  cloneTemplateDraft(template) {
    if (!template) return this.createEmptyTemplateDraft();
    return {
      id: template.id,
      name: template.name || '',
      description: template.description || '',
      arguments: Array.isArray(template.arguments) && template.arguments.length > 0
        ? template.arguments.map(item => ({
            label: item.label || '',
            token: item.token || '',
            joiner: item.joiner === 'space' ? 'space' : '=',
            quoteValue: item.quoteValue !== false,
            required: item.required === true,
            hint: item.hint || '',
            defaultValue: item.defaultValue || ''
          }))
        : [{
            label: '',
            token: '',
            joiner: '=',
            quoteValue: true,
            required: false,
            hint: '',
            defaultValue: ''
          }],
      files: Array.isArray(template.files)
        ? template.files.map(item => ({
            label: item.label || '',
            storageKind: item.storageKind === 'installer' ? 'installer' : 'file',
            argumentName: item.argumentName || '',
            joiner: item.joiner === 'space' ? 'space' : '=',
            quoteValue: item.quoteValue !== false,
            required: item.required === true,
            hint: item.hint || '',
            destinationName: item.destinationName || '',
            extensions: Array.isArray(item.extensions) ? item.extensions.join(',') : ''
          }))
        : [],
      script: template.script || ''
    };
  },

  readTemplateDraftFromDom(state) {
    const current = state?.draft ? this.cloneTemplateDraft(state.draft) : this.createEmptyTemplateDraft();
    const nameInput = document.getElementById('tmpl-name');
    const descInput = document.getElementById('tmpl-description');
    const scriptInput = document.getElementById('tmpl-script');

    if (nameInput) current.name = nameInput.value;
    if (descInput) current.description = descInput.value;
    if (scriptInput) current.script = scriptInput.value;

    const argRows = [...document.querySelectorAll('.tmpl-arg-row')];
    current.arguments = argRows.map(row => ({
      label: row.querySelector('[data-field="label"]')?.value || '',
      token: row.querySelector('[data-field="token"]')?.value || '',
      joiner: row.querySelector('[data-field="joiner"]')?.value === 'space' ? 'space' : '=',
      quoteValue: row.querySelector('[data-field="quote"]')?.checked ?? true,
      required: row.querySelector('[data-field="required"]')?.checked ?? false,
      hint: row.querySelector('[data-field="hint"]')?.value || '',
      defaultValue: row.querySelector('[data-field="default"]')?.value || ''
    }));

    const fileRows = [...document.querySelectorAll('.tmpl-file-row')];
    current.files = fileRows.map(row => ({
      label: row.querySelector('[data-field="label"]')?.value || '',
      storageKind: row.querySelector('[data-field="storageKind"]')?.value === 'installer' ? 'installer' : 'file',
      argumentName: row.querySelector('[data-field="argument"]')?.value || '',
      joiner: row.querySelector('[data-field="joiner"]')?.value === 'space' ? 'space' : '=',
      quoteValue: row.querySelector('[data-field="quote"]')?.checked ?? true,
      required: row.querySelector('[data-field="required"]')?.checked ?? false,
      hint: row.querySelector('[data-field="hint"]')?.value || '',
      destinationName: row.querySelector('[data-field="destination"]')?.value || '',
      extensions: row.querySelector('[data-field="extensions"]')?.value || ''
    }));

    return current;
  },

  getTemplateArgPreview(arg = {}) {
    const token = String(arg.token || 'ARGUMENT').trim() || 'ARGUMENT';
    const separator = arg.joiner === 'space' ? ' ' : '=';
    const value = arg.quoteValue === false ? 'VALOR' : '"VALOR"';
    return `${token}${separator}${value}`;
  },

  getTemplateFilePreview(file = {}) {
    if (!file.argumentName) return this.isInstallerTemplateFile(file) ? 'setup_auxiliar.exe' : 'archivo.xml';
    const separator = file.joiner === 'space' ? ' ' : '=';
    const sampleName = this.isInstallerTemplateFile(file) ? 'setup_auxiliar.exe' : 'archivo.xml';
    const value = file.quoteValue === false ? sampleName : `"${sampleName}"`;
    return `${file.argumentName}${separator}${value}`;
  },

  refreshTemplateDraftPreview() {
    document.querySelectorAll('.tmpl-arg-row').forEach(row => {
      const preview = row.querySelector('.tmpl-arg-preview');
      if (!preview) return;
      const token = row.querySelector('[data-field="token"]')?.value || '';
      const joiner = row.querySelector('[data-field="joiner"]')?.value === 'space' ? 'space' : '=';
      const quoteValue = row.querySelector('[data-field="quote"]')?.checked ?? true;
      preview.textContent = this.getTemplateArgPreview({ token, joiner, quoteValue });
    });

    document.querySelectorAll('.tmpl-file-row').forEach(row => {
      const preview = row.querySelector('.tmpl-file-preview');
      if (!preview) return;
      const argumentName = row.querySelector('[data-field="argument"]')?.value || '';
      const joiner = row.querySelector('[data-field="joiner"]')?.value === 'space' ? 'space' : '=';
      const quoteValue = row.querySelector('[data-field="quote"]')?.checked ?? true;
      const storageKind = row.querySelector('[data-field="storageKind"]')?.value === 'installer' ? 'installer' : 'file';
      preview.textContent = this.getTemplateFilePreview({ argumentName, joiner, quoteValue, storageKind });
    });
  },

  buildTemplateManagerRestoreState(extra = {}) {
    const modalBody = document.getElementById('modal-body');
    return {
      scrollTop: modalBody ? modalBody.scrollTop : 0,
      ...extra
    };
  },

  restoreTemplateManagerAfterRender(state) {
    const restore = state?.templateManagerRestore || null;
    const shouldFocusName = state?.focusTemplateNameOnRender === true;
    state.templateManagerRestore = null;
    state.focusTemplateNameOnRender = false;

    if (!restore && !shouldFocusName) return;

    requestAnimationFrame(() => {
      const modalBody = document.getElementById('modal-body');
      if (modalBody && restore && Number.isFinite(restore.scrollTop)) {
        modalBody.scrollTop = restore.scrollTop;
      }

      if (restore?.anchorSelector) {
        const anchor = document.querySelector(restore.anchorSelector);
        if (anchor) {
          anchor.scrollIntoView({ block: restore.block || 'nearest', inline: 'nearest' });
        }
      }

      const focusTarget = restore?.focusSelector ? document.querySelector(restore.focusSelector) : null;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
        if (restore.selectText && typeof focusTarget.select === 'function') {
          focusTarget.select();
        }
        return;
      }

      if (shouldFocusName) {
        document.getElementById('tmpl-name')?.focus({ preventScroll: true });
      }
    });
  },

  rerenderTemplateManager(state, onClose, restore = {}) {
    state.templateManagerRestore = this.buildTemplateManagerRestoreState(restore);
    this.renderTemplateManager(state, onClose);
  },

  getConfiguredTemplateInstallerPath(state) {
    const activeTemplateId = state?.selectedBuiltIn || state?.selectedId || null;
    return activeTemplateId ? (state?.templateInstallers?.[activeTemplateId] || '') : '';
  },

  getPendingTemplateInstallerPath(state) {
    const activeTemplateId = state?.selectedBuiltIn || state?.selectedId || null;
    if (activeTemplateId) {
      return state?.pendingTemplateInstallers?.[activeTemplateId] || '';
    }
    return state?.pendingNewInstallerPath || '';
  },

  setPendingTemplateInstallerPath(state, localPath) {
    const normalizedPath = typeof localPath === 'string' ? localPath.trim() : '';
    const activeTemplateId = state?.selectedBuiltIn || state?.selectedId || null;
    if (activeTemplateId) {
      state.pendingTemplateInstallers = { ...(state.pendingTemplateInstallers || {}) };
      if (normalizedPath) {
        state.pendingTemplateInstallers[activeTemplateId] = normalizedPath;
      } else {
        delete state.pendingTemplateInstallers[activeTemplateId];
      }
      return;
    }
    state.pendingNewInstallerPath = normalizedPath;
  },

  clearPendingTemplateInstallerPath(state) {
    this.setPendingTemplateInstallerPath(state, '');
  },

  renderTemplateManager(state, onClose) {
    const draft = state.draft || this.createEmptyTemplateDraft();
    const templates = Array.isArray(state.templates) ? state.templates : [];
    const builtInTemplates = Array.isArray(state.builtInTemplates) ? state.builtInTemplates : [];
    const templateInstallers = state.templateInstallers || {};
    const deleteUsageCount = Number.isFinite(state.deleteUsageCount) ? state.deleteUsageCount : 0;
    const isSavingTemplate = state.isSavingTemplate === true;
    const activeTemplateId = state.selectedBuiltIn || state.selectedId || null;
    const configuredInstallerPath = this.getConfiguredTemplateInstallerPath(state);
    const pendingInstallerPath = this.getPendingTemplateInstallerPath(state);
    const currentInstallerPath = pendingInstallerPath || configuredInstallerPath;
    const installerFileName = currentInstallerPath ? currentInstallerPath.replace(/.*[\\/]/, '') : '';
    const hasPendingInstaller = !!pendingInstallerPath;
    const installerStatus = state.installerStatus && typeof state.installerStatus.message === 'string'
      ? state.installerStatus
      : null;
    const installerStatusTone = installerStatus?.type === 'error'
      ? 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#dc2626;'
      : installerStatus?.type === 'success'
        ? 'background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#16a34a;'
        : 'background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:var(--text-primary);';
    const installerBadgeTone = hasPendingInstaller
      ? 'background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.35);color:var(--accent-info);'
      : 'background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.35);color:#16a34a;';

    const builtInListHtml = builtInTemplates.map(tmpl => {
      const hasInstaller = !!templateInstallers[tmpl.id];
      const isActive = state.selectedBuiltIn === tmpl.id;
      return `
        <button class="template-manager-item ${isActive ? 'active' : ''}" type="button" data-builtin-id="${App._esc(tmpl.id)}">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:14px;">${this.templateIcon(tmpl.id)}</span>
            <div style="font-weight:600;color:var(--text-primary);font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${App._esc(tmpl.name)}</div>
            ${hasInstaller ? `<span style="font-size:9px;background:rgba(34,197,94,.15);color:var(--accent-success,#22c55e);padding:1px 5px;border-radius:3px;flex-shrink:0;">&#10003;</span>` : ''}
          </div>
        </button>`;
    }).join('');

    const userListHtml = templates.length > 0
      ? templates.map(template => {
          const hasInstaller = !!templateInstallers[template.id];
          return `
          <button class="template-manager-item ${state.selectedId === template.id ? 'active' : ''}" type="button" data-template-id="${App._esc(template.id)}">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="font-weight:600;color:var(--text-primary);font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${App._esc(template.name)}</div>
              ${hasInstaller ? `<span style="font-size:9px;background:rgba(34,197,94,.15);color:var(--accent-success,#22c55e);padding:1px 5px;border-radius:3px;flex-shrink:0;">&#10003;</span>` : ''}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${App._esc(template.description || t('apps.customTemplateDefaultDesc', 'Plantilla definida por el administrador'))}</div>
          </button>`;
        }).join('')
      : `<div style="padding:14px;border:1px dashed var(--border-color);border-radius:8px;color:var(--text-muted);font-size:12px;">${t('apps.customTemplatesEmpty', 'Todavía no hay plantillas personalizadas.')}</div>`;

    const argumentRows = draft.arguments.map((arg, index) => `
      <div class="tmpl-arg-row" data-index="${index}" style="border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:10px;background:var(--bg-secondary);">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateFieldLabel', 'Etiqueta')}</label>
            <input class="form-input" data-field="label" value="${App._esc(arg.label)}" placeholder="Valor de configuración">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateArgLabel', 'Argumento')}</label>
            <input class="form-input" data-field="token" value="${App._esc(arg.token)}" placeholder="CONFIG_ID">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateHintLabel', 'Ayuda')}</label>
            <input class="form-input" data-field="hint" value="${App._esc(arg.hint)}" placeholder="${App._esc(t('apps.customTemplateHintPlaceholder', 'Texto mostrado al operador'))}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateDefaultValue', 'Valor por defecto')}</label>
            <input class="form-input" data-field="default" value="${App._esc(arg.defaultValue)}" placeholder="">
          </div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;">
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" class="checkbox-select" data-field="quote" ${arg.quoteValue !== false ? 'checked' : ''}>
            <span>${t('apps.customTemplateQuoteValue', 'Entrecomillar valor')}</span>
          </label>
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" class="checkbox-select" data-field="required" ${arg.required ? 'checked' : ''}>
            <span>${t('apps.customTemplateRequired', 'Obligatorio')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:12px;">
            <span>${t('apps.customTemplateJoiner', 'Separador')}</span>
            <select class="form-select" data-field="joiner" style="width:auto;min-width:110px;">
              <option value="=" ${arg.joiner !== 'space' ? 'selected' : ''}>=</option>
              <option value="space" ${arg.joiner === 'space' ? 'selected' : ''}>espacio</option>
            </select>
          </label>
          <button class="btn btn-ghost btn-sm btn-remove-template-arg" type="button" data-index="${index}">${t('common.delete', 'Borrar')}</button>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">${t('apps.customTemplateArgExample', 'Resultado')}: <code class="tmpl-arg-preview">${App._esc(this.getTemplateArgPreview(arg))}</code></div>
      </div>
    `).join('');

    const fileRows = draft.files.map((file, index) => `
      <div class="tmpl-file-row" data-index="${index}" style="border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:10px;background:var(--bg-secondary);">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateFieldLabel', 'Etiqueta')}</label>
            <input class="form-input" data-field="label" value="${App._esc(file.label)}" placeholder="${App._esc(this.isInstallerTemplateFile(file) ? 'Instalador adicional' : 'Archivo de configuración')}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateExtensions', 'Extensiones')}</label>
            <input class="form-input" data-field="extensions" value="${App._esc(file.extensions)}" placeholder="${App._esc(this.isInstallerTemplateFile(file) ? 'exe,msi,ps1' : 'xml,json')}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateFileType', 'Tipo')}</label>
            <select class="form-select" data-field="storageKind">
              <option value="file" selected>${t('apps.customTemplateFileTypeFile', 'Archivo auxiliar')}</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateInstallArg', 'Argumento de instalación')}</label>
            <input class="form-input" data-field="argument" value="${App._esc(file.argumentName)}" placeholder="/configure">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateTargetName', 'Nombre destino')}</label>
            <input class="form-input" data-field="destination" value="${App._esc(file.destinationName)}" placeholder="${App._esc(this.isInstallerTemplateFile(file) ? 'helper_setup.exe' : 'config_app.xml')}">
          </div>
          <div class="form-group" style="margin-bottom:0;grid-column:1 / -1;">
            <label class="form-label">${t('apps.customTemplateHintLabel', 'Ayuda')}</label>
            <input class="form-input" data-field="hint" value="${App._esc(file.hint)}" placeholder="${App._esc(this.isInstallerTemplateFile(file)
              ? t('apps.customTemplateInstallerHintPlaceholder', 'Ejemplo: instalador auxiliar que se copiará al share sin sustituir al principal')
              : t('apps.customTemplateFileHintPlaceholder', 'Ejemplo: XML o CFG exportado desde la herramienta original'))}">
          </div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;">
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" class="checkbox-select" data-field="quote" ${file.quoteValue !== false ? 'checked' : ''}>
            <span>${t('apps.customTemplateQuotePath', 'Entrecomillar ruta')}</span>
          </label>
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" class="checkbox-select" data-field="required" ${file.required ? 'checked' : ''}>
            <span>${t('apps.customTemplateRequired', 'Obligatorio')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:12px;">
            <span>${t('apps.customTemplateJoiner', 'Separador')}</span>
            <select class="form-select" data-field="joiner" style="width:auto;min-width:110px;">
              <option value="=" ${file.joiner !== 'space' ? 'selected' : ''}>=</option>
              <option value="space" ${file.joiner === 'space' ? 'selected' : ''}>espacio</option>
            </select>
          </label>
          <button class="btn btn-ghost btn-sm btn-remove-template-file" type="button" data-index="${index}">${t('common.delete', 'Borrar')}</button>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">${this.isInstallerTemplateFile(file)
          ? t('apps.customTemplateInstallerExample', 'El instalador adjunto se copiará al share en una carpeta separada y el script recibirá su ruta en caché en el equipo cliente.')
          : t('apps.customTemplateFileExample', 'Si defines un argumento, recibirá la ruta en caché del archivo en el equipo cliente.')}: <code class="tmpl-file-preview">${App._esc(this.getTemplateFilePreview(file))}</code></div>
      </div>
    `).join('');

    const deletePanel = state.deleteConfirm && state.selectedId ? `
      <div class="card template-builder-section" style="border-color:rgba(220,38,38,0.28);background:rgba(220,38,38,0.08);">
        <div style="font-weight:700;color:var(--text-primary);margin-bottom:8px;">${t('apps.customTemplateDeleteTitle', 'Borrar plantilla')}</div>
        <p class="form-hint" style="margin:0 0 10px 0;color:var(--text-secondary);">
          ${t('apps.customTemplateDeleteConfirm', '¿Seguro que quieres borrar esta plantilla personalizada?')}
        </p>
        ${deleteUsageCount > 0 ? `<p class="form-hint" style="margin:0 0 12px 0;color:var(--accent-warning);">${t('apps.customTemplateDeleteWarning', 'Hay apps usando esta plantilla:')} ${deleteUsageCount}. ${t('apps.customTemplateDeleteSnapshotHint', 'Las apps ya creadas conservarán su configuración guardada, pero la plantilla dejará de estar disponible para nuevas apps.')}</p>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary" type="button" id="btn-cancel-delete-template">${t('common.cancel', 'Cancelar')}</button>
          <button class="btn btn-danger" type="button" id="btn-confirm-delete-template">${t('apps.customTemplateDeleteAction', 'Eliminar plantilla')}</button>
        </div>
      </div>
    ` : '';

    // Shared installer config panel
    const installerPanel = `
      <div class="card template-builder-section" style="border-color:rgba(30,144,255,0.25);background:rgba(30,144,255,0.04);">
        <div style="font-weight:700;color:var(--text-primary);margin-bottom:6px;">Instalador preconfigurado</div>
        <p class="form-hint" style="margin:0 0 10px 0;">Si adjuntas el instalador aquí, se completará automáticamente cada vez que alguien cree una app con esta plantilla.</p>
        ${currentInstallerPath ? `<div style="display:inline-flex;align-items:center;gap:6px;${installerBadgeTone}border-radius:6px;padding:4px 10px;margin-bottom:10px;font-size:12px;max-width:100%;overflow:hidden;">
          <span style="flex-shrink:0;">${hasPendingInstaller ? '&#8599;' : '&#10003;'}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;" title="${App._esc(currentInstallerPath)}">${App._esc(installerFileName)}</span>
        </div>` : ''}
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="form-input" id="tmpl-installer-path" value="${App._esc(currentInstallerPath)}" placeholder="Sin instalador preconfigurado" readonly style="flex:1;font-family:monospace;font-size:12px;">
          <button class="btn btn-secondary btn-sm" type="button" id="btn-browse-tmpl-installer" ${isSavingTemplate ? 'disabled' : ''}>Seleccionar</button>
          ${currentInstallerPath ? `<button class="btn btn-ghost btn-sm" type="button" id="btn-clear-tmpl-installer" ${isSavingTemplate ? 'disabled' : ''}>&times;</button>` : ''}
        </div>
        <div id="tmpl-installer-status" style="display:${installerStatus ? 'block' : 'none'};margin-top:10px;padding:8px 12px;border-radius:6px;font-size:13px;${installerStatusTone}">${installerStatus ? App._esc(installerStatus.message) : ''}</div>
      </div>`;

    // Built-in template view (read-only, just installer config)
    const selectedBuiltInInfo = state.selectedBuiltIn ? builtInTemplates.find(t => t.id === state.selectedBuiltIn) : null;
    const builtInView = selectedBuiltInInfo ? `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border-color);">
        <span style="font-size:32px;">${this.templateIcon(selectedBuiltInInfo.id)}</span>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text-primary);">${App._esc(selectedBuiltInInfo.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${App._esc(selectedBuiltInInfo.description || '')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;opacity:.7;">Plantilla del sistema - Solo lectura</div>
        </div>
      </div>
      ${installerPanel}
    ` : '';

    const body = `
      <div class="template-manager-shell">
        <div class="template-manager-sidebar">
          ${builtInTemplates.length > 0 ? `
            <button type="button" id="btn-toggle-system-section" style="display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:4px 4px 6px;margin-bottom:2px;" ${isSavingTemplate ? 'disabled' : ''}>
              <span style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;font-weight:600;">Sistema</span>
              <svg id="icon-system-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);transform:${state.systemExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};transition:transform .2s;"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="system-section-list" style="display:${state.systemExpanded ? 'block' : 'none'};">
              ${builtInListHtml}
            </div>
            <div style="height:1px;background:var(--border-color);margin:8px 0;"></div>
          ` : ''}
          <div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;padding:4px 4px 6px;font-weight:600;">Personalizadas</div>
          <button class="btn btn-primary" type="button" id="btn-new-template" style="width:100%;margin-bottom:8px;" ${isSavingTemplate ? 'disabled' : ''}>${t('apps.newCustomTemplate', 'Nueva plantilla')}</button>
          ${userListHtml}
        </div>
        <div class="template-manager-main">
          ${state.selectedBuiltIn ? builtInView : `
          ${deletePanel}
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateName', 'Nombre de la plantilla')}</label>
            <input class="form-input" id="tmpl-name" value="${App._esc(draft.name)}" placeholder="Plantilla personalizada">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${t('apps.customTemplateDescription', 'Descripción')}</label>
            <textarea class="form-input" id="tmpl-description" rows="2" placeholder="${App._esc(t('apps.customTemplateDescriptionPlaceholder', 'Explica qué hace esta plantilla y qué espera del operador.'))}">${App._esc(draft.description)}</textarea>
          </div>
          ${installerPanel}
          <div class="card template-builder-section">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="font-weight:700;color:var(--text-primary);">${t('apps.customTemplateArgsTitle', 'Argumentos')}</div>
              <button class="btn btn-secondary btn-sm" type="button" id="btn-add-template-arg" ${isSavingTemplate ? 'disabled' : ''}>${t('apps.customTemplateAddArg', 'Añadir argumento')}</button>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${t('apps.customTemplateArgsHint', 'Cada argumento crea un campo de texto en la app y se traduce a `ARGUMENTO=\"valor\"` o `ARGUMENTO valor`.')}</div>
            ${argumentRows || `<div style="color:var(--text-muted);font-size:12px;">${t('apps.customTemplateArgsEmpty', 'No hay argumentos definidos.')}</div>`}
          </div>
          <div class="card template-builder-section">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="font-weight:700;color:var(--text-primary);">${t('apps.customTemplateFilesTitle', 'Archivos auxiliares')}</div>
              <button class="btn btn-secondary btn-sm" type="button" id="btn-add-template-file" ${isSavingTemplate ? 'disabled' : ''}>${t('apps.customTemplateAddFile', 'Añadir archivo')}</button>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${t('apps.customTemplateFilesHint', 'Sirve para XML, CFG, JSON o instaladores adjuntos. Si añades aquí un XML, se pedirá al crear la app y el script podrá usar $ConfigXmlPath. Los instaladores adjuntos se guardan en el share sin sustituir al instalador principal. Si defines un argumento de instalación, se pasará la ruta del archivo copiado al caché de despliegue.')}</div>
            ${fileRows || `<div style="color:var(--text-muted);font-size:12px;">${t('apps.customTemplateFilesEmpty', 'No hay archivos definidos.')}</div>`}
          </div>
          <div class="card template-builder-section">
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:10px;">${t('apps.customTemplateScriptTitle', 'Script opcional post-instalación')}</div>
            <textarea class="form-input" id="tmpl-script" rows="8" style="font-family:monospace;" placeholder="${App._esc(t('apps.customTemplateScriptPlaceholder', 'Ejemplo:\nWrite-Host "Configuración adicional aplicada"'))}">${App._esc(draft.script)}</textarea>
            <p class="form-hint" style="margin-top:8px;">${t('apps.customTemplateScriptHint', 'Variables disponibles: $TemplateValues.<clave>, $TemplateFiles.<clave>, $TemplateFileNames.<clave>, $ConfigXmlPath (si la plantilla incluye un XML), $Instalador y $CacheDir. Este script se ejecuta después del instalador.')}</p>
          </div>
          `}
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" type="button" id="btn-close-template-manager" ${isSavingTemplate ? 'disabled' : ''}>${t('common.close', 'Cerrar')}</button>
      <div style="flex:1"></div>
      ${!state.selectedBuiltIn && state.selectedId ? `<button class="btn btn-danger" type="button" id="btn-delete-template" ${isSavingTemplate ? 'disabled' : ''}>${t('common.delete', 'Borrar')}</button>` : ''}
      ${!state.selectedBuiltIn ? `<button class="btn btn-success" type="button" id="btn-save-template" ${isSavingTemplate ? 'disabled' : ''}>${isSavingTemplate ? 'Guardando...' : t('common.save', 'Guardar')}</button>` : ''}
      ${state.selectedBuiltIn ? `<button class="btn ${state.installerSaved ? 'btn-secondary' : 'btn-success'}" type="button" id="btn-save-tmpl-installer" ${isSavingTemplate ? 'disabled' : ''}>${isSavingTemplate ? 'Guardando...' : (state.installerSaved ? t('common.close', 'Cerrar') : 'Guardar instalador')}</button>` : ''}
    `;

    App.openModal(t('apps.manageTemplates', 'Plantillas'), body, footer, { size: 'full' });
    App._modalLocked = isSavingTemplate;
    this.bindTemplateManagerEvents(state, onClose);
    this.restoreTemplateManagerAfterRender(state);
  },

  bindTemplateManagerEvents(state, onClose) {
    document.getElementById('btn-close-template-manager')?.addEventListener('click', async () => {
      if (state.isSavingTemplate) return;
      App.closeModal();
      if (typeof onClose === 'function') await onClose();
    });

    document.getElementById('btn-new-template')?.addEventListener('click', () => {
      state.draft = this.createEmptyTemplateDraft();
      state.selectedId = null;
      state.selectedBuiltIn = null;
      state.deleteConfirm = false;
      state.deleteUsageCount = 0;
      state.pendingNewInstallerPath = '';
      state.installerStatus = null;
      state.isSavingTemplate = false;
      state.installerSaved = false;
      state.focusTemplateNameOnRender = true;
      this.renderTemplateManager(state, onClose);
    });

    // Toggle Sistema section
    document.getElementById('btn-toggle-system-section')?.addEventListener('click', () => {
      state.systemExpanded = !state.systemExpanded;
      const list = document.getElementById('system-section-list');
      const chevron = document.getElementById('icon-system-chevron');
      if (list) list.style.display = state.systemExpanded ? 'block' : 'none';
      if (chevron) chevron.style.transform = state.systemExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    // Built-in template selection
    document.querySelectorAll('[data-builtin-id]').forEach(item => {
      item.addEventListener('click', () => {
        state.selectedBuiltIn = item.dataset.builtinId;
        state.selectedId = null;
        state.deleteConfirm = false;
        state.installerStatus = null;
        state.isSavingTemplate = false;
        state.installerSaved = false;
        state.focusTemplateNameOnRender = false;
        this.rerenderTemplateManager(state, onClose);
      });
    });

    // User template selection
    document.querySelectorAll('[data-template-id]').forEach(item => {
      item.addEventListener('click', async () => {
        state.draft = this.readTemplateDraftFromDom(state);
        const templateId = item.dataset.templateId;
        const template = state.templates.find(entry => entry.id === templateId);
        state.selectedId = templateId;
        state.selectedBuiltIn = null;
        state.draft = this.cloneTemplateDraft(template);
        state.deleteConfirm = false;
        state.deleteUsageCount = 0;
        state.installerStatus = null;
        state.isSavingTemplate = false;
        state.installerSaved = false;
        state.focusTemplateNameOnRender = false;
        this.rerenderTemplateManager(state, onClose);
      });
    });

    // Browse installer button (for both built-in and user templates)
    document.getElementById('btn-browse-tmpl-installer')?.addEventListener('click', async () => {
      if (state.isSavingTemplate) return;
      const file = await window.api.config.selectFile([{ name: 'Instalador (EXE/MSI)', extensions: ['exe', 'msi'] }]);
      if (!file) return;
      state.installerSaved = false; // new file selected â€” re-enable save button
      this.setPendingTemplateInstallerPath(state, file);
      state.installerStatus = {
        type: 'info',
        message: state.selectedBuiltIn
          ? 'Instalador seleccionado. Pulsa Guardar instalador para subirlo al share.'
          : 'Instalador seleccionado. Se subirá al share al guardar la plantilla.'
      };
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose);
    });

    document.getElementById('btn-clear-tmpl-installer')?.addEventListener('click', async () => {
      if (state.isSavingTemplate) return;
      const activeId = state.selectedBuiltIn || state.selectedId;
      if (this.getPendingTemplateInstallerPath(state)) {
        this.clearPendingTemplateInstallerPath(state);
        state.installerStatus = null;
        state.installerSaved = false;
        state.focusTemplateNameOnRender = false;
        this.rerenderTemplateManager(state, onClose);
        return;
      }
      const configuredInstallerPath = this.getConfiguredTemplateInstallerPath(state).trim();
      if (!activeId || !configuredInstallerPath) return;
      state.isSavingTemplate = true;
      state.installerStatus = {
        type: 'info',
        message: 'Eliminando instalador del share...'
      };
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose);
      try {
        const deleteResult = await window.api.templates.deleteInstaller(activeId);
        if (!deleteResult?.success) {
          state.isSavingTemplate = false;
          state.installerStatus = {
            type: 'error',
            message: `No se pudo eliminar el instalador: ${deleteResult?.error || 'Error desconocido'}`
          };
          App.toast(`Error: ${deleteResult?.error || 'No se pudo eliminar el instalador'}`, 'error');
          this.rerenderTemplateManager(state, onClose);
          return;
        }

        const nextTemplateInstallers = { ...state.templateInstallers };
        delete nextTemplateInstallers[activeId];
        const saveConfigResult = await window.api.config.set({ templateInstallers: nextTemplateInstallers });
        if (saveConfigResult?.success === false) {
          throw new Error(saveConfigResult.error || 'No se pudo actualizar la configuración');
        }

        state.templateInstallers = nextTemplateInstallers;
        state.isSavingTemplate = false;
        state.installerStatus = {
          type: 'success',
          message: 'Instalador preconfigurado eliminado.'
        };
        state.installerSaved = !!state.selectedBuiltIn;
        App.toast('Instalador preconfigurado eliminado.', 'success');
        this.rerenderTemplateManager(state, onClose);
      } catch (err) {
        state.isSavingTemplate = false;
        state.installerStatus = {
          type: 'error',
          message: `No se pudo eliminar el instalador: ${err?.message || 'Error desconocido'}`
        };
        App.toast(`Error: ${err?.message || 'No se pudo eliminar el instalador'}`, 'error');
        this.rerenderTemplateManager(state, onClose);
      }
    });

    // Save installer for built-in template (also acts as "Cerrar" after a successful save)
    document.getElementById('btn-save-tmpl-installer')?.addEventListener('click', async () => {
      if (state.installerSaved) {
        App.closeModal();
        if (onClose) await onClose();
        return;
      }
      if (state.isSavingTemplate) return;
      const activeId = state.selectedBuiltIn;
      if (!activeId) return;
      const localPath = this.getPendingTemplateInstallerPath(state).trim()
        || document.getElementById('tmpl-installer-path')?.value?.trim()
        || '';
      if (!localPath) {
        App.toast('Selecciona un instalador primero', 'warning');
        return;
      }
      state.isSavingTemplate = true;
      state.installerStatus = {
        type: 'info',
        message: 'Copiando instalador al share, espera un momento...'
      };
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose);
      try {
        const result = await window.api.templates.saveInstaller(activeId, localPath);
        if (!result?.success) {
          state.isSavingTemplate = false;
          state.installerStatus = {
            type: 'error',
            message: `Error al copiar el instalador: ${result?.error || 'No se pudo copiar al share'}`
          };
          App.toast(`Error: ${result?.error || 'No se pudo copiar al share'}`, 'error');
          this.rerenderTemplateManager(state, onClose);
          return;
        }
        state.templateInstallers = { ...state.templateInstallers, [activeId]: result.sharePath };
        const saveConfigResult = await window.api.config.set({ templateInstallers: state.templateInstallers });
        if (saveConfigResult?.success === false) {
          throw new Error(saveConfigResult.error || 'No se pudo actualizar la configuración');
        }
        this.clearPendingTemplateInstallerPath(state);
        state.installerSaved = true;
        state.isSavingTemplate = false;
        state.installerStatus = {
          type: 'success',
          message: 'Instalador guardado en el share.'
        };
        App.toast('Instalador guardado en el share', 'success');
        state.focusTemplateNameOnRender = false;
        this.rerenderTemplateManager(state, onClose);
      } catch (err) {
        state.isSavingTemplate = false;
        state.installerStatus = {
          type: 'error',
          message: `Error al copiar el instalador: ${err?.message || 'No se pudo copiar al share'}`
        };
        App.toast(`Error: ${err?.message || 'No se pudo copiar al share'}`, 'error');
        this.rerenderTemplateManager(state, onClose);
      }
    });
    document.getElementById('btn-add-template-arg')?.addEventListener('click', () => {
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      const newIndex = state.draft.arguments.push({
        label: '',
        token: '',
        joiner: '=',
        quoteValue: true,
        required: false,
        hint: '',
        defaultValue: ''
      }) - 1;
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose, {
        anchorSelector: `.tmpl-arg-row[data-index="${newIndex}"]`,
        focusSelector: `.tmpl-arg-row[data-index="${newIndex}"] [data-field="label"]`,
        block: 'nearest'
      });
    });

    document.querySelectorAll('.btn-remove-template-arg').forEach(btn => {
      btn.addEventListener('click', () => {
        state.draft = this.readTemplateDraftFromDom(state);
        state.deleteConfirm = false;
        state.draft.arguments.splice(Number(btn.dataset.index), 1);
        state.focusTemplateNameOnRender = false;
        this.rerenderTemplateManager(state, onClose);
      });
    });

    document.getElementById('btn-add-template-file')?.addEventListener('click', () => {
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      const newIndex = state.draft.files.push({
        label: '',
        storageKind: 'file',
        argumentName: '',
        joiner: 'space',
        quoteValue: true,
        required: false,
        hint: '',
        destinationName: '',
        extensions: 'xml'
      }) - 1;
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose, {
        anchorSelector: `.tmpl-file-row[data-index="${newIndex}"]`,
        focusSelector: `.tmpl-file-row[data-index="${newIndex}"] [data-field="label"]`,
        block: 'nearest'
      });
    });

    document.querySelectorAll('.btn-remove-template-file').forEach(btn => {
      btn.addEventListener('click', () => {
        state.draft = this.readTemplateDraftFromDom(state);
        state.deleteConfirm = false;
        state.draft.files.splice(Number(btn.dataset.index), 1);
        state.focusTemplateNameOnRender = false;
        this.rerenderTemplateManager(state, onClose);
      });
    });

    document.querySelectorAll('.tmpl-arg-row [data-field="token"], .tmpl-arg-row [data-field="joiner"], .tmpl-arg-row [data-field="quote"]').forEach(input => {
      input.addEventListener('input', () => this.refreshTemplateDraftPreview());
      input.addEventListener('change', () => this.refreshTemplateDraftPreview());
    });

    document.querySelectorAll('.tmpl-file-row [data-field="argument"], .tmpl-file-row [data-field="joiner"], .tmpl-file-row [data-field="quote"]').forEach(input => {
      input.addEventListener('input', () => this.refreshTemplateDraftPreview());
      input.addEventListener('change', () => this.refreshTemplateDraftPreview());
    });

    // storageKind is now always 'file' â€” no change handler needed

    this.refreshTemplateDraftPreview();

    document.getElementById('btn-delete-template')?.addEventListener('click', async () => {
      if (!state.selectedId) return;
      state.draft = this.readTemplateDraftFromDom(state);
      if (state.deleteConfirm) {
        state.deleteConfirm = false;
        state.deleteUsageCount = 0;
        state.focusTemplateNameOnRender = false;
        this.rerenderTemplateManager(state, onClose);
        return;
      }
      const apps = await window.api.apps.getAll().catch(() => []);
      state.deleteUsageCount = apps.filter(app => app.template === state.selectedId).length;
      state.deleteConfirm = true;
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose);
    });

    document.getElementById('btn-cancel-delete-template')?.addEventListener('click', () => {
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      state.deleteUsageCount = 0;
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose);
    });

    document.getElementById('btn-confirm-delete-template')?.addEventListener('click', async () => {
      if (!state.selectedId) return;
      const result = await window.api.templates.delete(state.selectedId);
      if (!result?.success) {
        App.toast((result?.error || t('common.error', 'Error')), 'error');
        return;
      }

      state.templates = await window.api.templates.getAll();
      state.selectedId = null;
      state.draft = this.createEmptyTemplateDraft();
      state.deleteConfirm = false;
      state.deleteUsageCount = 0;
      state.focusTemplateNameOnRender = true;
      App.toast(t('apps.customTemplateDeleted', 'Plantilla borrada correctamente'), 'success');
      this.renderTemplateManager(state, onClose);
    });

    document.getElementById('btn-save-template')?.addEventListener('click', async () => {
      if (state.isSavingTemplate) return;
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      if (!state.draft.name.trim()) {
        App.toast(t('apps.customTemplateNameRequired', 'Indica un nombre para la plantilla.'), 'warning');
        document.getElementById('tmpl-name')?.focus();
        return;
      }

      const wasNewTemplate = !state.selectedId;
      const pendingInstallerPath = this.getPendingTemplateInstallerPath(state).trim();
      const payload = {
        name: state.draft.name,
        description: state.draft.description,
        arguments: state.draft.arguments,
        files: state.draft.files,
        script: state.draft.script
      };

      state.isSavingTemplate = true;
      state.installerStatus = {
        type: 'info',
        message: pendingInstallerPath
          ? 'Guardando plantilla y subiendo instalador al share...'
          : 'Guardando plantilla...'
      };
      state.focusTemplateNameOnRender = false;
      this.rerenderTemplateManager(state, onClose);

      let saved;
      try {
        saved = state.selectedId
          ? await window.api.templates.update(state.selectedId, payload)
          : await window.api.templates.create(payload);
      } catch (err) {
        state.isSavingTemplate = false;
        state.installerStatus = {
          type: 'error',
          message: `No se pudo guardar la plantilla: ${err?.message || 'Error desconocido'}`
        };
        App.toast(t('apps.customTemplateSaveError', 'No se pudo guardar la plantilla.'), 'error');
        this.rerenderTemplateManager(state, onClose);
        return;
      }

      if (!saved?.id) {
        state.isSavingTemplate = false;
        state.installerStatus = {
          type: 'error',
          message: 'No se pudo guardar la plantilla.'
        };
        App.toast(t('apps.customTemplateSaveError', 'No se pudo guardar la plantilla.'), 'error');
        this.rerenderTemplateManager(state, onClose);
        return;
      }

      if (wasNewTemplate && pendingInstallerPath) {
        state.pendingNewInstallerPath = '';
        state.pendingTemplateInstallers = { ...(state.pendingTemplateInstallers || {}), [saved.id]: pendingInstallerPath };
      }

      let installerUploadError = '';
      if (pendingInstallerPath) {
        try {
          const result = await window.api.templates.saveInstaller(saved.id, pendingInstallerPath);
          if (result?.success) {
            state.templateInstallers = { ...state.templateInstallers, [saved.id]: result.sharePath };
            state.pendingTemplateInstallers = { ...(state.pendingTemplateInstallers || {}) };
            delete state.pendingTemplateInstallers[saved.id];
          } else {
            installerUploadError = result?.error || 'No se pudo copiar al share';
          }
        } catch (err) {
          installerUploadError = err?.message || 'No se pudo copiar al share';
        }
      }

      const saveConfigResult = await window.api.config.set({ templateInstallers: state.templateInstallers });
      if (saveConfigResult?.success === false) {
        state.isSavingTemplate = false;
        state.installerStatus = {
          type: 'error',
          message: `La plantilla se guardó, pero no se pudo actualizar la configuración: ${saveConfigResult.error || 'Error desconocido'}`
        };
        App.toast(`Error: ${saveConfigResult.error || 'No se pudo actualizar la configuración'}`, 'error');
        this.rerenderTemplateManager(state, onClose);
        return;
      }

      state.templates = await window.api.templates.getAll();
      state.selectedId = saved.id;
      state.selectedBuiltIn = null;
      state.draft = this.cloneTemplateDraft(saved);
      state.deleteUsageCount = 0;
      state.installerSaved = false;
      state.isSavingTemplate = false;
      state.focusTemplateNameOnRender = false;

      if (installerUploadError) {
        state.installerStatus = {
          type: 'error',
          message: `Plantilla guardada, pero no se pudo subir el instalador: ${installerUploadError}`
        };
        App.toast(`Plantilla guardada, pero el instalador no se pudo subir: ${installerUploadError}`, 'warning');
      } else {
        state.installerStatus = {
          type: 'success',
          message: pendingInstallerPath
            ? 'Plantilla guardada e instalador subido al share.'
            : 'Plantilla guardada correctamente.'
        };
        App.toast(t('apps.customTemplateSaved', 'Plantilla guardada correctamente'), 'success');
      }

      this.rerenderTemplateManager(state, onClose);
    });
  },

  async openTemplateManager(onClose = null) {
    const config = await window.api.config.get().catch(() => ({}));
    if (String(config?.uiMode || '').trim().toLowerCase() !== 'advanced') {
      App.toast(t('apps.manageTemplatesAdvancedOnly', 'Cambia al modo avanzado para gestionar plantillas.'), 'info');
      return;
    }
    const [templates, allTemplates] = await Promise.all([
      window.api.templates.getAll().catch(() => []),
      window.api.scripts.getTemplates().catch(() => [])
    ]);
    const builtInTemplates = allTemplates.filter(t => !t.isUserDefined && !t.noInstaller && t.id !== 'generic' && t.id !== 'custom' && t.id !== 'office');
    const state = {
      templates,
      builtInTemplates,
      templateInstallers: config.templateInstallers || {},
      pendingTemplateInstallers: {},
      pendingNewInstallerPath: '',
      installerStatus: null,
      isSavingTemplate: false,
      selectedId: null,
      selectedBuiltIn: null,
      systemExpanded: false,
      installerSaved: false,
      draft: this.createEmptyTemplateDraft(),
      deleteConfirm: false,
      deleteUsageCount: 0,
      focusTemplateNameOnRender: true,
      templateManagerRestore: null
    };
    this.renderTemplateManager(state, onClose);
  },

};