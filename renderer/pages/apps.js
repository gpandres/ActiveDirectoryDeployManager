// ═══════════════════════════════════════════════════════
// Apps Page – CRUD, Wizard, Bulk GPO Assignment
// ═══════════════════════════════════════════════════════

const AppsPage = {
  selectedIds: new Set(),
  gposCache: null,
  ousCache: null,
  ousTreeCache: null,
  wingetCatalogCache: null,
  _wizardOpening: false,
  _viewMode: 'grid', // 'grid' | 'list'
  _groupBy: 'none',  // 'none' | 'template'
  _updateCheckResults: [],  // { appId, appName, wingetId, currentVersion, latestVersion }
  _checkingUpdates: false,

  async render(container) {
    const apps = await window.api.apps.getAll();
    const templates = await window.api.scripts.getTemplates();

    const deployedCount = apps.filter(a => a.deployed !== false && a.deployedPath).length;
    const pendingCount = apps.length - deployedCount;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>
            <span class="header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </span>
            ${t('apps.title')}
          </h1>
          <p class="page-subtitle">${t('apps.subtitle')}</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" id="btn-manage-templates">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/></svg>
            ${this.tr('apps.manageTemplates', 'Plantillas')}
          </button>
          <button class="btn btn-secondary" id="btn-check-updates">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
            ${t('apps.checkUpdates')}
          </button>
          <button class="btn btn-primary" id="btn-new-app">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${t('apps.newApp')}
          </button>
        </div>
      </div>

      <!-- Status Counters + Search + View Toggle -->
      <div class="apps-toolbar">
        <div class="apps-counters">
          <div class="apps-counter" data-filter="all">
            <span class="apps-counter-value">${apps.length}</span>
            <span class="apps-counter-label">Total</span>
          </div>
          <div class="apps-counter" data-filter="deployed">
            <span class="apps-counter-dot deployed"></span>
            <span class="apps-counter-value">${deployedCount}</span>
            <span class="apps-counter-label">${t('apps.deployedBadge')}</span>
          </div>
          <div class="apps-counter" data-filter="pending">
            <span class="apps-counter-dot pending"></span>
            <span class="apps-counter-value">${pendingCount}</span>
            <span class="apps-counter-label">${t('apps.detailNotDeployed')}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:var(--space-sm); flex:1; justify-content:flex-end;">
          <div style="position:relative; min-width:180px; max-width:280px; flex:1;">
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:.4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="apps-search" placeholder="${t('ous.searchApps')}" autocomplete="off" style="padding-left:34px;">
          </div>
          <select class="form-select" id="apps-group-by" style="width:auto; padding:6px 30px 6px 10px; min-width:120px;">
            <option value="none" ${this._groupBy === 'none' ? 'selected' : ''}>${t('apps.noGroup') || 'Sin agrupar'}</option>
            <option value="template" ${this._groupBy === 'template' ? 'selected' : ''}>${t('apps.groupByTemplate') || 'Por plantilla'}</option>
          </select>
          <div class="view-toggle">
            <button class="view-toggle-btn ${this._viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Cuadrícula">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </button>
            <button class="view-toggle-btn ${this._viewMode === 'list' ? 'active' : ''}" data-view="list" title="Lista">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Bulk Action Bar -->
      <div class="action-bar" id="bulk-action-bar">
        <span class="action-bar-text"><span id="selected-count">0</span> ${t('apps.selected')}</span>
        <button class="btn btn-ghost btn-sm" id="btn-select-all" onclick="AppsPage.selectAll()">${t('apps.filterAll')}</button>
        <div class="action-bar-buttons" style="display:flex; gap:10px; align-items:center;">
          <select class="form-select" id="bulk-gpo-select" style="width:200px; padding:6px 10px;">
            <option value="">${t('apps.selectGpo')}</option>
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-gpo">${t('apps.deploy')}</button>
          <button class="btn btn-warning btn-sm" id="btn-bulk-disable">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            ${t('apps.disable') || 'Deshabilitar'}
          </button>
          <button class="btn btn-danger btn-sm" id="btn-bulk-delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            ${t('common.delete') || 'Borrar'}
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-clear-selection">${t('apps.cancel')}</button>
        </div>
      </div>

      <!-- Updates Panel -->
      <div id="apps-updates-panel" style="display:none;margin-bottom:var(--space-md);"></div>

      <!-- Apps Grid -->
      <div class="app-grid ${this._viewMode === 'list' ? 'list-view' : ''}" id="apps-grid">
        ${apps.length === 0 ? `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <p class="empty-state-title">${t('apps.noAppsConfigured')}</p>
            <p class="empty-state-text">${t('apps.clickNewApp')}</p>
            <button class="btn btn-primary" onclick="AppsPage.openWizard()">${t('apps.newApp')}</button>
          </div>
        ` : this._renderGroupedApps(apps, templates)}
      </div>
    `;

    this.selectedIds.clear();
    this._currentFilter = 'all';

    document.getElementById('btn-new-app').addEventListener('click', () => this.openWizard());
    document.getElementById('btn-manage-templates')?.addEventListener('click', () => this.openTemplateManager());
    document.getElementById('btn-check-updates')?.addEventListener('click', () => this.checkUpdates());
    document.getElementById('btn-bulk-gpo').addEventListener('click', () => this.bulkAssignGPO());
    document.getElementById('btn-bulk-delete')?.addEventListener('click', () => this.bulkDelete());
    document.getElementById('btn-bulk-disable')?.addEventListener('click', () => this.bulkDisable());
    document.getElementById('btn-clear-selection').addEventListener('click', () => this.clearSelection());

    // View toggle buttons
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._viewMode = btn.dataset.view;
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const grid = document.getElementById('apps-grid');
        grid.classList.toggle('list-view', this._viewMode === 'list');
      });
    });

    // Group by selector
    document.getElementById('apps-group-by')?.addEventListener('change', (e) => {
      this._groupBy = e.target.value;
      App.navigate('apps');
    });

    // Counter filters
    document.querySelectorAll('.apps-counter').forEach(ctr => {
      ctr.addEventListener('click', () => {
        const filter = ctr.dataset.filter;
        this._currentFilter = filter;
        document.querySelectorAll('.apps-counter').forEach(c => c.classList.remove('active'));
        ctr.classList.add('active');
        const grid = document.getElementById('apps-grid');
        grid.querySelectorAll('.app-card').forEach(card => {
          const isDeployed = card.dataset.deployed === 'true';
          if (filter === 'all') card.style.display = '';
          else if (filter === 'deployed') card.style.display = isDeployed ? '' : 'none';
          else if (filter === 'pending') card.style.display = !isDeployed ? '' : 'none';
        });
      });
    });
    document.querySelector('.apps-counter[data-filter="all"]')?.classList.add('active');

    document.getElementById('apps-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const grid = document.getElementById('apps-grid');
      let anyVisible = false;
      grid.querySelectorAll('.app-card').forEach(card => {
        const name = card.querySelector('.app-card-name')?.textContent.toLowerCase() || '';
        const tmpl = card.querySelector('.app-card-template')?.textContent.toLowerCase() || '';
        const matches = !q || name.includes(q) || tmpl.includes(q);
        card.style.display = matches ? '' : 'none';
        if (matches) anyVisible = true;
      });
      let noMatch = grid.querySelector('.search-no-match');
      if (!anyVisible && q) {
        if (!noMatch) {
          noMatch = document.createElement('p');
          noMatch.className = 'search-no-match';
          noMatch.style.cssText = 'grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px 0;';
          noMatch.textContent = t('ous.noAppsMatch');
          grid.appendChild(noMatch);
        }
      } else if (noMatch) {
        noMatch.remove();
      }
    });

    // Close dropdown menus on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.app-card-menu')) {
        document.querySelectorAll('.app-card-dropdown.visible').forEach(d => d.classList.remove('visible'));
      }
    });

    // Load GPOs for bulk select
    this.loadGPOsForBulk();
  },

  renderAppCard(app, templates) {
    const templateInfo = templates.find(tmpl => tmpl.id === app.template) || { name: app.templateDefinition?.name || app.template };
    const isDeployed = app.deployed !== false && app.deployedPath;
    const statusClass = isDeployed ? 'deployed' : 'pending';
    const statusText = isDeployed ? t('apps.deployedBadge') : t('apps.detailNotDeployed');
    const icon = this.templateIcon(app.template);
    return `
      <div class="app-card app-card--${statusClass} ${this.selectedIds?.has(app.id) ? 'selected' : ''}" data-id="${app.id}" data-deployed="${!!isDeployed}" onclick="AppsPage.showAppDetail('${app.id}')">
        <input type="checkbox" class="checkbox-select app-card-cb" data-id="${app.id}" onchange="AppsPage.toggleSelect('${app.id}', this.checked)" onclick="event.stopPropagation()" ${this.selectedIds?.has(app.id) ? 'checked' : ''}>
        <div class="app-card-top">
          <div class="app-card-icon">${icon}</div>
          <div class="app-card-info">
            <div class="app-card-name">${this.esc(app.name)}</div>
            <div class="app-card-template">${this.esc(templateInfo.name)}</div>
          </div>
        </div>
        <div class="app-card-badges">
          <span class="badge badge-info app-card-version">v${this.esc(app.version || '1.0.0')}</span>
          ${app.gpoName ? `<span class="badge badge-info" title="GPO">${this.esc(app.gpoName)}</span>` : ''}
          ${(() => { const n = Array.isArray(app.assignedOUs) ? app.assignedOUs.length : (app.ouDN ? 1 : 0); return n > 0 ? `<span class="badge badge-neutral" title="${t('apps.detailAssignedOUs')}">🏢 ${n} OU${n > 1 ? 's' : ''}</span>` : ''; })()}
        </div>
        <div class="app-card-footer" onclick="event.stopPropagation()">
          <div class="app-card-deploy-info">
            <span class="app-status-label ${statusClass}">${statusText}</span>
          </div>
          <div class="app-card-menu">
            <button class="app-card-menu-btn" onclick="event.stopPropagation(); AppsPage.toggleMenu(this)" title="${t('apps.edit')}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            <div class="app-card-dropdown">
              <button class="dropdown-item" onclick="AppsPage.showAppDetail('${app.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                ${t('common.details') || 'Ver detalles'}
              </button>
              <button class="dropdown-item" onclick="AppsPage.previewScript('${app.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ${t('apps.script')}
              </button>
              ${isDeployed ? `
                ${app.template === 'winget' ? `
                <button class="dropdown-item" onclick="AppsPage.wingetUpdateDialog('${app.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
                  ${t('apps.checkUpdates')}
                </button>
                ` : `
                <button class="dropdown-item" onclick="AppsPage.quickUpdate('${app.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
                  ${t('apps.quickUpdate')}
                </button>
                `}
                <button class="dropdown-item dropdown-item--warning" onclick="AppsPage.disableDeploy('${app.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  ${t('apps.disable')}
                </button>
              ` : `
                <button class="dropdown-item dropdown-item--success" onclick="AppsPage.deployApp('${app.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  ${t('apps.deploy')}
                </button>
              `}
              <button class="dropdown-item" onclick="AppsPage.editApp('${app.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                ${t('apps.edit')}
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item dropdown-item--danger" onclick="AppsPage.deleteApp('${app.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                ${t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  toggleMenu(btn) {
    // Remove any existing floating dropdown
    document.querySelectorAll('.app-card-dropdown--floating').forEach(d => d.remove());

    const dropdown = btn.nextElementSibling.cloneNode(true);
    dropdown.classList.add('app-card-dropdown--floating');
    dropdown.classList.add('visible');

    // Position fixed relative to button
    const rect = btn.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    dropdown.style.zIndex = '9999';
    document.body.appendChild(dropdown);

    // Close on outside click
    const close = (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 0);
  },

  _renderGroupedApps(apps, templates) {
    if (this._groupBy === 'none') {
      return apps.map(app => this.renderAppCard(app, templates)).join('');
    }
    // Group by template category
    const groups = {};
    const tmplMap = {};
    templates.forEach(tmpl => { tmplMap[tmpl.id] = tmpl; });
    apps.forEach(app => {
      const tmpl = tmplMap[app.template] || {};
      const cat = tmpl.category || tmpl.name || app.template || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(app);
    });
    const sortedKeys = Object.keys(groups).sort();
    return sortedKeys.map(cat => {
      const catApps = groups[cat];
      return `
        <div class="app-folder-header" onclick="AppsPage.toggleFolder(this)">
          <div class="app-folder-toggle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span class="app-folder-name">${this.esc(cat)}</span>
          <span class="app-folder-count">${catApps.length}</span>
        </div>
        ${catApps.map(app => this.renderAppCard(app, templates)).join('')}
      `;
    }).join('');
  },

  toggleFolder(header) {
    const toggle = header.querySelector('.app-folder-toggle');
    const isCollapsing = !toggle.classList.contains('collapsed');
    toggle.classList.toggle('collapsed');
    // Hide/show sibling cards until next folder header
    let sibling = header.nextElementSibling;
    while (sibling && !sibling.classList.contains('app-folder-header')) {
      sibling.style.display = isCollapsing ? 'none' : '';
      sibling = sibling.nextElementSibling;
    }
  },

  // ─── Helpers ───────────────────────────────────────
  templateIcon(template) {
    const icons = {
      generic: '📦', office: '📎', custom: '⚙️', winget: '🪟', odt: '📎',
      wazuh: '🛡️', sentinelone: '🔰', cortexxdr: '🔷', bitdefender: '🔴',
      crowdstrike: '🦅', zscaler: '☁️', globalprotect: '🌍', ciscosecureclient: '🔐',
      forticlient: '🏰', lansweeper: '📡', ninjaone: '🥷', freshservice: '🍀',
      teamviewer: '📺', anydesk: '🖥️', veeam: '💾', crashplan: '☁️', 'sap-gui': '🔷'
    };
    return icons[template] || '📦';
  },

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  isSupportedInstallerExtension(extension) {
    return ['.exe', '.msi', '.ps1'].includes(String(extension || '').toLowerCase());
  },

  isInstallerTemplateFile(fileField) {
    return fileField?.storageKind === 'installer';
  },

  getInstallerTypeFromPath(installerPath, template = '') {
    if (template === 'winget') return 'winget';
    if (template === 'odt') return 'odt';
    const normalized = String(installerPath || '').toLowerCase();
    if (normalized.endsWith('.msi')) return 'msi';
    if (normalized.endsWith('.ps1')) return 'ps1';
    return 'exe';
  },

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

  // ─── Detail Modal ──────────────────────────────────
  renderDeleteTargetCard({ icon, title, subtitle = '' }) {
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-tertiary);border-radius:6px;">
        <span style="font-size:18px;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.esc(title)}</div>
          ${subtitle ? `<div style="font-size:11px;color:var(--text-muted);">${subtitle}</div>` : ''}
        </div>
      </div>`;
  },

  renderDeleteOptionCard({ id, checked = false, title, hint = '' }) {
    return `
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;border:1px solid var(--border-color);">
        <input type="checkbox" id="${id}" style="margin-top:2px;flex-shrink:0;" ${checked ? 'checked' : ''}>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${title}</div>
          ${hint ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${hint}</div>` : ''}
        </div>
      </label>`;
  },

  renderDeleteFooter(confirmId, confirmLabel) {
    return `
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secondary" id="${confirmId}-cancel">${t('common.cancel')}</button>
        <button class="btn btn-danger" id="${confirmId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          ${confirmLabel}
        </button>
      </div>`;
  },

  async showAppDetail(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const templates = await window.api.scripts.getTemplates();
    const templateInfo = templates.find(tmpl => tmpl.id === app.template) || { name: app.templateDefinition?.name || app.template };
    const isDeployed = app.deployed !== false && app.deployedPath;

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
      ? app.assignedOUs.map(ou => `<div style="font-size:12px; color:var(--text-secondary); padding:4px 8px; background:var(--bg-tertiary); border-radius:4px; margin-top:4px;" title="${this.esc(ou)}">${this.esc(ouNameFromDN(ou))}</div>`).join('')
      : `<span style="color:var(--text-muted); font-size:13px;">${t('apps.detailNoOUs')}</span>`;

    const paramsHtml = app.customParams && Object.keys(app.customParams).length > 0
      ? Object.entries(app.customParams).map(([k, v]) => row(this.esc(k), this.esc(String(v)))).join('')
      : '';

    const body = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Header -->
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:48px; height:48px; border-radius:12px; background:var(--accent-primary-dim); display:flex; align-items:center; justify-content:center; font-size:26px;">
            ${this.templateIcon(app.template)}
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--text-primary);">${this.esc(app.name)}</div>
            <div style="font-size:13px; color:var(--text-muted);">${this.esc(templateInfo.name)}</div>
          </div>
        </div>

        <!-- Status badges -->
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="badge badge-primary">${this.esc((app.installerType || 'exe').toUpperCase())}</span>
          <span class="badge badge-info">v${this.esc(app.version || '1.0.0')}</span>
          ${isDeployed ? `<span class="badge badge-success">${t('apps.deployedBadge')}</span>` : `<span class="badge badge-neutral">${t('apps.detailNotDeployed')}</span>`}
          ${app.gpoName ? `<span class="badge badge-info">${this.esc(app.gpoName)}</span>` : `<span class="badge badge-neutral">${t('apps.noGpoBadge')}</span>`}
          ${app.notifyUser ? `<span class="badge badge-warning">${t('apps.detailNotifyEnabled')}</span>` : ''}
        </div>

        <!-- General Info -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionGeneral')}</div>
          ${row(t('apps.detailTemplate'), this.esc(templateInfo.name))}
          ${app.template === 'winget'
            ? row('Winget ID', `<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">${this.esc(app.wingetId || '-')}</code>`)
            : app.template === 'odt'
              ? row('Producto ODT', `<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">${this.esc((app.odtConfig?.product || 'O365BusinessRetail') + ' · ' + (app.odtConfig?.channel || 'MonthlyEnterprise') + ' · ' + (app.odtConfig?.language || 'es-es'))}</code>`)
              : row(t('apps.detailInstallerType'), this.esc((app.installerType || 'exe').toUpperCase()))
          }
          ${(app.template !== 'winget' && app.template !== 'odt') ? row(t('apps.detailSilentArgs'), app.silentArgs ? '<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">' + this.esc(app.silentArgs) + '</code>' : '-') : ''}
          ${row(t('apps.detailVersion'), this.esc(app.version || '1.0.0'))}
          ${row(t('apps.detailNotifyUser'), app.notifyUser ? '&#10003;' : '&#10007;')}
        </div>

        <!-- Paths -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionPaths')}</div>
          ${(app.template !== 'winget' && app.template !== 'odt') ? row(t('apps.detailInstaller'), displayInstallerPath ? '<span style="font-family:monospace; font-size:12px;">' + this.esc(displayInstallerPath) + '</span>' : '-') : ''}
          ${app.configXmlPath ? row(t('apps.detailConfigXml'), '<span style="font-family:monospace; font-size:12px;">' + this.esc(app.configXmlPath) + '</span>') : ''}
          ${row(t('apps.detailDeployPath'), app.deployedPath ? '<span style="font-family:monospace; font-size:12px;">' + this.esc(app.deployedPath) + '</span>' : '-')}
          ${app.lastDeployHash ? row(t('apps.detailHash'), '<span style="font-family:monospace; font-size:11px;">' + this.esc(app.lastDeployHash.substring(0, 16)) + '...</span>') : ''}
        </div>

        <!-- GPO & OUs -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionTargeting')}</div>
          ${row(t('apps.detailGpo'), app.gpoName ? this.esc(app.gpoName) : '-')}
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
                  <span style="color:var(--text-primary); font-weight:600;">v${this.esc(h.version || '?')}</span>
                  ${h.hash ? `<span style="font-family:monospace; font-size:10px; color:var(--text-muted);">${this.esc(h.hash.substring(0, 16))}...</span>` : ''}
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
      <button class="btn btn-secondary" onclick="App.closeModal(); AppsPage.editApp('${app.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        ${t('apps.edit')}
      </button>
    `);
  },

  // ─── Quick Update ─────────────────────────────────
  compareVersions(a, b) {
    const pa = (a || '0').split('.').map(n => parseInt(n) || 0);
    const pb = (b || '0').split('.').map(n => parseInt(n) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  },

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
              <div style="font-size:17px; font-weight:700; color:var(--text-primary);">${this.esc(app.name)}</div>
              <div style="font-size:12px; color:var(--text-muted);">${this.esc(templateInfo.name)}</div>
            </div>
          </div>

          <!-- Current state -->
          <div class="card" style="padding:12px 16px; margin:0;">
            <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${t('apps.quickUpdateCurrent')}</div>
            <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
              <span style="color:var(--text-muted);">${t('apps.detailVersion')}</span>
              <span style="color:var(--text-primary); font-weight:500;">v${this.esc(app.version || '1.0.0')}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
              <span style="color:var(--text-muted);">${t('apps.detailInstaller')}</span>
              <span style="font-family:monospace; font-size:11px; color:var(--text-primary); max-width:60%; text-align:right; word-break:break-all;">${this.esc(app.installerPath || '-')}</span>
            </div>
            ${app.lastDeployHash ? `
            <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
              <span style="color:var(--text-muted);">SHA-256</span>
              <span style="font-family:monospace; font-size:11px; color:var(--text-muted);">${this.esc(app.lastDeployHash.substring(0, 16))}...</span>
            </div>
            ` : ''}
          </div>

          <!-- File picker -->
          <div>
            <label class="form-label">${t('apps.quickUpdatePickNew')}</label>
            <div class="flex gap-sm">
              <input class="form-input" id="qu-installer-path" value="${this.esc(state.newInstallerPath)}" placeholder="${t('apps.quickUpdatePickPlaceholder')}" readonly style="flex:1">
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
                  <div style="font-weight:700; color:var(--text-primary);">v${this.esc(app.version || '1.0.0')}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                <div style="text-align:center;">
                  <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${t('apps.quickUpdateNewLabel')}</div>
                  <div style="font-weight:700; color:${state.isDowngrade ? 'var(--warning-color)' : 'var(--success-color, #10b981)'};">v${this.esc(state.newVersion || '?')}</div>
                </div>
              </div>
              ${state.newHash ? `
                <div style="display:flex; justify-content:space-between; padding:8px 0 0 0; font-size:11px; font-family:monospace; color:var(--text-muted);">
                  <span>${this.esc((app.lastDeployHash || '').substring(0, 16))}...</span>
                  <span>→</span>
                  <span>${this.esc(state.newHash.substring(0, 16))}...</span>
                </div>
              ` : ''}
            </div>

            ${state.sameFile ? `
              <div style="padding:12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px;">
                <p style="margin:0; color:var(--danger-color); font-size:13px; font-weight:500;">
                  ⚠️ ${t('apps.quickUpdateSameFile')}
                </p>
              </div>
            ` : ''}

            ${state.isDowngrade && !state.sameFile ? `
              <div style="padding:12px; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.3); border-radius:8px;">
                <p style="margin:0; color:var(--warning-color); font-size:13px; font-weight:500;">
                  ⚠️ ${t('apps.quickUpdateDowngradeWarn').replace('{old}', app.version || '1.0.0').replace('{new}', state.newVersion)}
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
        lastDeployHash: deployResult.hash || state.newHash
      });

      // 6. Activity log
      await window.api.activity.add('app_quick_update', {
        appName: app.name,
        oldVersion: app.version,
        newVersion: state.newVersion
      });

      App.toast(t('apps.quickUpdateSuccess').replace('{version}', state.newVersion || '?'), 'success');
      App.closeModal();
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  // ─── Winget Single-App Update Dialog ───────────────
  async wingetUpdateDialog(id) {
    const app = await window.api.apps.get(id);
    if (!app || !app.wingetId) return;

    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:44px;height:44px;border-radius:10px;background:var(--accent-primary-dim);display:flex;align-items:center;justify-content:center;font-size:24px;">🪟</div>
          <div>
            <div style="font-size:17px;font-weight:700;color:var(--text-primary);">${this.esc(app.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);font-family:monospace;">${this.esc(app.wingetId)}</div>
          </div>
        </div>
        <div style="padding:10px 14px;background:var(--bg-input);border-radius:8px;display:flex;justify-content:space-between;font-size:13px;">
          <span style="color:var(--text-muted);">Versión actual</span>
          <span style="font-weight:600;">v${this.esc(app.version || '1.0.0')}</span>
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
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No se pudo verificar la versión más reciente</span>';
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
            <div style="font-weight:700;color:var(--text-primary);">v${this.esc(app.version || '1.0.0')}</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">Disponible</div>
            <div style="font-weight:700;color:var(--accent-secondary);">v${this.esc(latestVersion)}</div>
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
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger-color);font-size:13px;">Error: ${this.esc(e.message)}</span>`;
    }
  },

  // ─── Winget Update Check ────────────────────────────
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
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('apps-updates-panel').style.display='none'">✕</button>
        </div>`;
    }

    const rows = results.map((r, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--bg-input);border-radius:var(--radius-sm);">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--text-primary);font-size:var(--font-sm);">${this.esc(r.appName)}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted);font-family:monospace;">${this.esc(r.wingetId)}</div>
        </div>
        <div style="font-size:var(--font-sm);white-space:nowrap;">
          <span style="color:var(--text-muted);">v${this.esc(r.currentVersion)}</span>
          <span style="color:var(--accent-primary);margin:0 6px;">→</span>
          <span style="color:var(--accent-secondary);font-weight:600;">v${this.esc(r.latestVersion)}</span>
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
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('apps-updates-panel').style.display='none'" style="margin-left:4px;">✕</button>
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

      await window.api.apps.update(appId, { deployed: true, deployedPath: deployResult.path });
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

  // ─── Selection ─────────────────────────────────────
  toggleSelect(id, checked) {
    if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id);
    const card = document.querySelector(`.app-card[data-id="${id}"]`);
    if (card) card.classList.toggle('selected', this.selectedIds.has(id));
    this.updateBulkBar();
  },

  clearSelection() {
    this.selectedIds.clear();
    document.querySelectorAll('#apps-grid .app-card').forEach(c => {
      c.classList.remove('selected');
      const cb = c.querySelector('.checkbox-select');
      if (cb) cb.checked = false;
    });
    this.updateBulkBar();
  },

  selectAll() {
    const cards = document.querySelectorAll('#apps-grid .app-card');
    cards.forEach(card => {
      if (card.style.display !== 'none') {
        this.selectedIds.add(card.dataset.id);
        card.classList.add('selected');
        const cb = card.querySelector('.checkbox-select');
        if (cb) cb.checked = true;
      }
    });
    this.updateBulkBar();
  },

  toggleSelectAll(checked) {
    const cards = document.querySelectorAll('#apps-grid .app-card');
    cards.forEach(card => {
      if (card.style.display !== 'none') {
        const cb = card.querySelector('.checkbox-select');
        if (checked) {
          this.selectedIds.add(card.dataset.id);
          card.classList.add('selected');
          if (cb) cb.checked = true;
        } else {
          this.selectedIds.delete(card.dataset.id);
          card.classList.remove('selected');
          if (cb) cb.checked = false;
        }
      }
    });
    this.updateBulkBar();
  },

  updateBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    const count = this.selectedIds.size;
    document.getElementById('selected-count').textContent = count;
    bar.classList.toggle('visible', count > 0);

    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
      const visibleCards = Array.from(document.querySelectorAll('#apps-grid .app-card')).filter(c => c.style.display !== 'none');
      const total = visibleCards.length;
      selectAllBtn.textContent = count === total && total > 0
        ? t('common.cancel')
        : `${t('apps.filterAll')} (${total})`;
    }
  },

  async loadGPOsForBulk() {
    try {
      const [apps, cfg] = await Promise.all([
        window.api.apps.getAll().catch(() => []),
        window.api.config.get().catch(() => ({}))
      ]);
      const programGPOs = [...new Set([
        ...apps.filter(a => a.gpoName).map(a => a.gpoName),
        cfg.defaultGPO || null
      ].filter(Boolean))];
      const select = document.getElementById('bulk-gpo-select');
      if (select) {
        select.innerHTML = `<option value="">${t('apps.selectGpo')}</option>`;
        programGPOs.forEach(gpoName => {
          const opt = document.createElement('option');
          opt.value = gpoName;
          opt.textContent = gpoName;
          select.appendChild(opt);
        });
      }
    } catch (e) {}
  },

  async bulkAssignGPO() {
    const gpoName = document.getElementById('bulk-gpo-select').value;
    if (!gpoName) { App.toast(t('apps.selectGpoFirst'), 'warning'); return; }
    if (this.selectedIds.size === 0) return;

    try {
      const ids = Array.from(this.selectedIds);
      await window.api.apps.bulkAssignGPO(ids, gpoName);
      App.toast(t('apps.gpoAssignedBulk').replace('{gpo}', gpoName).replace('{count}', ids.length), 'success');

      // Link GPO to all unique OUs across the selected apps
      if (App.rsatAvailable) {
        try {
          const allApps = await window.api.apps.getAll();
          const ouSet = new Set();
          allApps.filter(a => ids.includes(a.id)).forEach(a => {
            const ous = Array.isArray(a.assignedOUs) ? a.assignedOUs : (a.ouDN ? [a.ouDN] : []);
            ous.forEach(ou => ou && ouSet.add(ou));
          });
          if (ouSet.size > 0) {
            await window.api.ad.bulkLinkGPO(gpoName, Array.from(ouSet));
          }
        } catch (e) { /* non-fatal */ }
      }

      this.clearSelection();
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  async bulkDisable() {
    if (this.selectedIds.size === 0) return;
    try {
      const ids = Array.from(this.selectedIds);
      for (const id of ids) {
        const app = await window.api.apps.get(id);
        if (app && app.deployed) {
          app.deployed = false;
          await window.api.apps.update(id, app);
        }
      }
      App.toast(t('apps.bulkDisableSuccess') || `Deshabilitadas ${ids.length} apps correctamente`, 'success');
      this.clearSelection();
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  async bulkDelete() {
    if (this.selectedIds.size === 0) return;
    const ids = Array.from(this.selectedIds);

    // Load app names for the list
    const apps = await Promise.all(ids.map(id => window.api.apps.get(id)));
    const validApps = apps.filter(Boolean);
    const appsWithGPO = validApps.filter(a => a.gpoName);

    // Build app list HTML
    const listHtml = validApps.map(a => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-tertiary);border-radius:6px;">
        <span style="font-size:18px;">${this.templateIcon(a.template)}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.esc(a.name)}</div>
          ${a.gpoName ? `<div style="font-size:11px;color:var(--text-muted);">GPO: ${this.esc(a.gpoName)}</div>` : ''}
        </div>
      </div>`).join('');

    const { confirmed, adCleanup, deleteFiles } = await new Promise(resolve => {
      App.openModal(
        t('apps.bulkDeleteTitle'),
        `<div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:10px 14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;font-size:13px;color:var(--text-secondary);">
            <strong style="color:var(--accent-danger);">⚠ ${t('apps.bulkDeleteWarning').replace('{count}', validApps.length)}</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;">
            ${listHtml}
          </div>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;border:1px solid var(--border-color);">
            <input type="checkbox" id="_bulk-del-files" style="margin-top:2px;flex-shrink:0;" checked>
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${t('apps.bulkDeleteCleanFiles') || 'Eliminar carpeta del share de red'}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${t('apps.bulkDeleteCleanFilesHint') || 'Borra install.ps1, version.json e instaladores del share'}</div>
            </div>
          </label>
          ${appsWithGPO.length > 0 ? `
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;border:1px solid var(--border-color);">
            <input type="checkbox" id="_bulk-del-gpo" style="margin-top:2px;flex-shrink:0;" checked>
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${t('apps.bulkDeleteCleanGpo')}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${appsWithGPO.map(a => this.esc(a.gpoName)).join(', ')}</div>
            </div>
          </label>` : ''}
        </div>`,
        `<div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary" id="_bulk-del-cancel">${t('common.cancel')}</button>
          <button class="btn btn-danger" id="_bulk-del-confirm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            ${t('apps.bulkDeleteConfirm').replace('{count}', validApps.length)}
          </button>
        </div>`
      );
      document.getElementById('_bulk-del-cancel').onclick  = () => { App.closeModal(); resolve({ confirmed: false }); };
      document.getElementById('_bulk-del-confirm').onclick = () => {
        const cbGpo   = document.getElementById('_bulk-del-gpo');
        const cbFiles = document.getElementById('_bulk-del-files');
        App.closeModal();
        resolve({ confirmed: true, adCleanup: cbGpo ? cbGpo.checked : false, deleteFiles: cbFiles ? cbFiles.checked : true });
      };
    });

    if (!confirmed) return;

    App.toast(t('apps.bulkDeleting').replace('{count}', validApps.length), 'info');
    try {
      let successCount = 0;
      for (const app of validApps) {
        if (adCleanup && app.gpoName) {
          try { await window.api.ad.deleteGPO(app.gpoName); } catch (e) { console.warn('GPO cleanup failed for', app.gpoName); }
        }
        await window.api.apps.delete(app.id, deleteFiles);
        successCount++;
      }
      App.toast(t('apps.bulkDeleteSuccess').replace('{count}', successCount), 'success');
      this.clearSelection();
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  // ─── Wizard ────────────────────────────────────────
  async openWizard(existingApp = null) {
    if (this._wizardOpening) return;
    this._wizardOpening = true;

    // Show locked loading modal immediately so user gets feedback and can't double-open
    App.openModalLocked(
      existingApp ? t('apps.edit') : t('apps.newApp'),
      `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:120px;">
        <span class="spinner" style="width:24px;height:24px;border-width:3px;flex-shrink:0;"></span>
        <span style="color:var(--text-secondary);font-size:14px;">${t('bundles.loadingOUs')}</span>
      </div>`,
      ''
    );

    try {
      const [templates, catalogData, config] = await Promise.all([
        window.api.scripts.getTemplates(),
        window.api.winget.getCatalog().catch(() => ({ catalog: [], odtProducts: [], odtApps: [], odtLanguages: [], odtChannels: [] })),
        window.api.config.get().catch(() => ({}))
      ]);
      this.wingetCatalogCache = catalogData;
      const isEdit = !!(existingApp?.id);
      if (existingApp?.templateDefinition?.kind === 'user-template' && !templates.some(tmpl => tmpl.id === existingApp.template)) {
        const fallbackTemplate = this.buildTemplateViewFromDefinition(existingApp.template, existingApp.templateDefinition);
        if (fallbackTemplate) templates.push(fallbackTemplate);
      }

      // Pre-fetch OUs — always refresh for new apps so stale tree/baseOU change is reflected
      if (!isEdit) { this.ousTreeCache = null; this.ousCache = null; }
      if (App.rsatAvailable && !App.rsatMissingGPMC && !this.ousTreeCache) {
        try {
          const ouResult = await window.api.ad.getOUs();
          if (ouResult.success && ouResult.data) {
            this.ousTreeCache = ouResult.data;
            this.ousCache = this.flattenOUs(ouResult.data);
          }
        } catch (e) { /* AD unavailable – OU list will be empty */ }
      }

      // When editing, prefer the installer path on the share (where it actually
      // lives now) instead of the original local path used at creation time.
      let initialInstallerPath = existingApp?.installerPath || '';
      if (existingApp) {
        const sharedPath = await this.resolveSharedInstaller(existingApp.name, existingApp.installerPath);
        if (sharedPath) initialInstallerPath = sharedPath;
      }
      let initialConfigXmlPath = existingApp?.configXmlPath || '';
      let initialTemplateFiles = existingApp?.templateFiles || {};
      if (existingApp?.template) {
        const selectedTemplate = templates.find(tmpl => tmpl.id === existingApp.template) || null;
        const normalizedTemplateSelection = this.reconcileLegacyTemplateXmlSelection(
          selectedTemplate,
          initialTemplateFiles,
          initialConfigXmlPath
        );
        initialTemplateFiles = normalizedTemplateSelection.templateFiles;
        initialConfigXmlPath = normalizedTemplateSelection.configXmlPath;
      }

    // State
    const plantillaTemplateIds = templates.filter(tmpl => tmpl.category !== 'General' || tmpl.id === 'office').map(tmpl => tmpl.id);
    const state = {
      // Skip step 1 if opened from catalog with a pre-selected app (no id = not editing)
      step: (existingApp && !existingApp.id) ? 2 : 1,
      catalogTab: existingApp?.wingetId ? 'catalog' :
                  existingApp?.template === 'odt' ? 'catalog' :
                  (existingApp && plantillaTemplateIds.includes(existingApp.template)) ? 'plantilla' :
                  (existingApp ? 'manual' : 'catalog'),
      catalogSearch: '',
      catalogCat: 'Todo',
      template: existingApp?.template || '',
      wingetId: existingApp?.wingetId || '',
      wingetSource: existingApp?.wingetSource || 'winget',
      odtConfig: existingApp?.odtConfig || {
        product: 'O365BusinessRetail',
        apps: ['Word', 'Excel', 'PowerPoint', 'Outlook', 'OneNote', 'OneDrive'],
        language: 'es-es',
        channel: 'MonthlyEnterprise',
        arch: '64'
      },
      name: existingApp?.name || '',
      silentArgs: existingApp?.silentArgs || '/S',
      templateInstallers: config.templateInstallers || {},
      installerPath: initialInstallerPath || (!isEdit && existingApp?.template ? (config.templateInstallers?.[existingApp.template] || '') : ''),
      configXmlPath: initialConfigXmlPath,
      customParams: existingApp?.customParams || {},
      templateFiles: initialTemplateFiles,
      templateDefinition: existingApp?.templateDefinition || null,
      selectedOUs: (existingApp?.assignedOUs && existingApp.assignedOUs.length > 0)
        ? [...existingApp.assignedOUs]
        : (existingApp?.ouDN ? [existingApp.ouDN] : []),
      ouDN: existingApp?.ouDN || (existingApp?.assignedOUs && existingApp.assignedOUs[0]) || '',
      gpoName: isEdit ? (existingApp?.gpoName || '') : (config.defaultGPO || ''),
      createGPO: false,
      version: existingApp?.version || '1.0.0',
      suggestedVersion: '',
      notifyUser: existingApp?.notifyUser || false,
      wizardWingetResults: [],
      wizardWingetSearching: false,
      _wizardWingetTimer: null,
      _catalogResolutionToken: 0
    };

    const renderWizard = () => {
      let body = `
        <div class="wizard-steps">
          <div class="wizard-step ${state.step >= 1 ? (state.step > 1 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">1</span><span>${t('apps.step1')}</span>
          </div>
          <div class="wizard-step ${state.step >= 2 ? (state.step > 2 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">2</span><span>${t('apps.step2')}</span>
          </div>
          <div class="wizard-step ${state.step >= 3 ? (state.step > 3 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">3</span><span>${t('apps.step3')}</span>
          </div>
          <div class="wizard-step ${state.step >= 4 ? 'active' : ''}">
            <span class="wizard-step-number">4</span><span>${t('apps.step4')}</span>
          </div>
        </div>
        <div class="wizard-content" style="min-height: 480px; display: flex; flex-direction: column;">`;

      if (state.step === 1) {
        const catalog = catalogData?.catalog || [];

        // ── Tab bar ──────────────────────────────────────────────────
        const tabStyle = (active) => `padding:8px 18px;background:none;border:none;border-bottom:2px solid ${active ? 'var(--primary-color)' : 'transparent'};cursor:pointer;font-size:13px;font-weight:600;color:${active ? 'var(--primary-color)' : 'var(--text-secondary)'};margin-bottom:-1px;transition:color .15s,border-color .15s;`;
        body += `
          <div style="display:flex;gap:0;border-bottom:1px solid var(--border-color);margin-bottom:var(--space-md);">
            <button class="wiz-tab" data-tab="catalog" style="${tabStyle(state.catalogTab==='catalog')}">🛒 Catálogo</button>
            <button class="wiz-tab" data-tab="plantilla" style="${tabStyle(state.catalogTab==='plantilla')}">📋 Plantilla</button>
            <button class="wiz-tab" data-tab="manual" style="${tabStyle(state.catalogTab==='manual')}">📦 Manual</button>
          </div>
        `;

        if (state.catalogTab === 'catalog') {
          // ── Search + category filter ─────────────────────────────
          const cats = ['Todo', ...new Set(catalog.map(c => c.category))];
          const catBtnStyle = (active) => `padding:4px 10px;border-radius:20px;border:1px solid var(--border-color);background:${active ? 'var(--primary-color)' : 'transparent'};color:${active ? '#fff' : 'var(--text-secondary)'};cursor:pointer;font-size:11px;white-space:nowrap;`;
          const activeCat = state.catalogCat || 'Todo';
          body += `
            <div style="display:flex;gap:8px;margin-bottom:var(--space-sm);align-items:center;flex-wrap:wrap;">
              <div style="position:relative;flex:1;min-width:160px;">
                <svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%);opacity:.4;pointer-events:none;" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" class="form-input" id="catalog-search" value="${this.esc(state.catalogSearch||'')}" placeholder="Buscar app..." style="padding-left:28px;padding-top:5px;padding-bottom:5px;font-size:13px;" autocomplete="off">
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                ${cats.map(cat => `<button class="catalog-cat-btn" data-cat="${this.esc(cat)}" style="${catBtnStyle(activeCat===cat)}">${this.esc(cat)}</button>`).join('')}
              </div>
            </div>
            <div style="max-height:330px;overflow-y:auto;padding-right:2px;">
          `;

          // Winget catalog by category
          const q = (state.catalogSearch || '').toLowerCase();

          // ODT special card at top (only show if matches search and category)
          const odtSel = state.template === 'odt';
          const odtKeywords = ['office', 'microsoft', '365', 'odt', 'ltsc', 'word', 'excel'];
          const odtMatchesQ = !q || odtKeywords.some(k => k.includes(q));
          const odtMatchesCat = activeCat === 'Todo' || activeCat === 'Tools';
          if (odtMatchesQ && odtMatchesCat) {
            body += `
              <div style="margin-bottom:var(--space-sm);">
                <h5 style="font-size:10px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;letter-spacing:.05em;">Microsoft Office</h5>
                <div class="template-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));">
                  <div class="template-card catalog-item ${odtSel ? 'selected' : ''}" data-catalog-type="odt" style="cursor:pointer;" tabindex="0">
                    <div class="template-card-icon" style="font-size:22px;">🏢</div>
                    <div class="template-card-name" style="font-size:11px;">Microsoft Office</div>
                    <div class="template-card-desc" style="font-size:10px;">365 / LTSC 2021 / 2019</div>
                  </div>
                </div>
              </div>
            `;
          }

          const filteredCatalog = catalog.filter(item => {
            const matchCat = activeCat === 'Todo' || item.category === activeCat;
            const matchQ = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.wingetId.toLowerCase().includes(q);
            return matchCat && matchQ;
          });
          const grouped2 = {};
          filteredCatalog.forEach(item => {
            if (!grouped2[item.category]) grouped2[item.category] = [];
            grouped2[item.category].push(item);
          });
          const catOrder2 = ['Browsers', 'Tools', 'Connectivity', 'Communication', 'Multimedia', 'Development'];
          catOrder2.forEach(cat => {
            if (!grouped2[cat]) return;
            body += `
              <div style="margin-bottom:var(--space-sm);">
                <h5 style="font-size:10px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;letter-spacing:.05em;">${this.esc(cat)}</h5>
                <div class="template-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));">
                  ${grouped2[cat].map(item => {
                    const isSel = state.template === 'winget'
                      && state.wingetId === item.wingetId
                      && (state.wingetSource || 'winget') === (item.wingetSource || 'winget');
                    return `
                      <div class="template-card catalog-item ${isSel ? 'selected' : ''}"
                           data-catalog-type="winget" data-winget-id="${this.esc(item.wingetId)}"
                           data-winget-source="${this.esc(item.wingetSource || 'winget')}"
                           data-app-name="${this.esc(item.name)}" data-app-version="${this.esc(item.defaultVersion)}"
                           style="cursor:pointer;">
                        <div class="template-card-icon" style="font-size:22px;">${item.icon}</div>
                        <div class="template-card-name" style="font-size:11px;">${this.esc(item.name)}</div>
                        <div class="template-card-desc" style="font-size:10px;">v${this.esc(item.defaultVersion)}</div>
                      </div>`;
                  }).join('')}
                </div>
              </div>`;
          });

          if (!filteredCatalog.length && !odtMatchesQ) {
            body += `<p style="text-align:center;color:var(--text-muted);padding:20px 0;font-size:13px;">No se encontraron apps</p>`;
          }
          body += `</div>`; // close scrollable

          // Winget CLI search results (two-phase)
          if (state.wizardWingetSearching) {
            body += `<div id="wiz-winget-section" style="display:flex;align-items:center;gap:6px;padding:8px 2px;font-size:12px;color:var(--text-muted);">
              <span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;"></span>
              Buscando en winget CLI...
            </div>`;
          } else if (state.wizardWingetResults?.length > 0) {
            body += `<div id="wiz-winget-section" style="margin-top:8px;">
              <h5 style="font-size:10px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;letter-spacing:.05em;">Winget CLI</h5>
              <div class="template-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));">
                ${state.wizardWingetResults.map(item => {
                  const isSel = state.template === 'winget'
                    && state.wingetId === item.wingetId
                    && (state.wingetSource || 'winget') === (item.wingetSource || 'winget');
                  return `<div class="template-card catalog-item ${isSel ? 'selected' : ''}"
                       data-catalog-type="winget" data-winget-id="${this.esc(item.wingetId)}"
                       data-winget-source="${this.esc(item.wingetSource || 'winget')}"
                       data-app-name="${this.esc(item.name)}" data-app-version="${this.esc(item.version||'')}"
                       style="cursor:pointer;">
                    <div class="template-card-icon" style="font-size:22px;">📦</div>
                    <div class="template-card-name" style="font-size:11px;">${this.esc(item.name)}</div>
                    ${item.version ? `<div class="template-card-desc" style="font-size:10px;">v${this.esc(item.version)}</div>` : ''}
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          } else {
            body += `<div id="wiz-winget-section"></div>`;
          }

        } else if (state.catalogTab === 'plantilla') {
          // ── Plantilla tab: Non-General templates + Office XML ─────
          const preferredPlantillaCats = ['Security', 'Connectivity', 'RMM', 'Backups', 'Corporate', 'Custom'];
          const plantillaCats = [
            ...preferredPlantillaCats.filter(cat => templates.some(tmpl => tmpl.category === cat && tmpl.id !== 'office')),
            ...[...new Set(
              templates
                .filter(tmpl => tmpl.category && tmpl.category !== 'General' && tmpl.id !== 'office' && !preferredPlantillaCats.includes(tmpl.category))
                .map(tmpl => tmpl.category)
            )]
          ];
          let hasVisibleTemplates = false;

          // Search bar for Plantilla tab
          body += `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:var(--space-sm);flex-wrap:wrap;">
              <div style="position:relative;max-width:360px;flex:1;min-width:260px;">
                <svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%);opacity:.4;pointer-events:none;" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" class="form-input" id="plantilla-search" value="${this.esc(state.plantillaSearch||'')}" placeholder="Buscar plantilla..." style="padding-left:28px;padding-top:6px;padding-bottom:6px;font-size:13px;" autocomplete="off">
              </div>
              <button class="btn btn-secondary btn-sm" type="button" id="btn-open-template-manager">${this.tr('apps.newCustomTemplate', 'Nueva plantilla')}</button>
            </div>
          `;

          const pq = (state.plantillaSearch || '').toLowerCase();
          body += `<div style="max-height:330px;overflow-y:auto;padding-right:2px;">`;

          // Office XML template at the top of Plantilla tab
          const officeTmpl = templates.find(tmpl => tmpl.id === 'office');
          if (officeTmpl) {
            const officeMatches = !pq || 'microsoft office'.includes(pq) || 'office xml'.includes(pq) || officeTmpl.name.toLowerCase().includes(pq) || officeTmpl.description.toLowerCase().includes(pq);
            if (officeMatches) {
              hasVisibleTemplates = true;
              body += `
                <div class="template-category-group" style="margin-bottom:var(--space-md);">
                  <h5 style="margin-bottom:var(--space-sm);color:var(--text-primary);border-bottom:1px solid var(--border-color);padding-bottom:4px;">Microsoft Office</h5>
                  <div class="template-grid">
                    <div class="template-card ${state.template === 'office' ? 'selected' : ''}" data-template="office">
                      <div class="template-card-icon">${this.templateIcon('office')}</div>
                      <div class="template-card-name">${this.esc(officeTmpl.name)}</div>
                      <div class="template-card-desc">${this.esc(officeTmpl.description)}</div>
                    </div>
                  </div>
                </div>`;
            }
          }

          plantillaCats.forEach(cat => {
            const catTmpls = templates.filter(tmpl => {
              if (tmpl.category !== cat) return false;
              if (!pq) return true;
              return tmpl.name.toLowerCase().includes(pq) || tmpl.description.toLowerCase().includes(pq) || tmpl.id.toLowerCase().includes(pq) || cat.toLowerCase().includes(pq);
            });
            if (!catTmpls.length) return;
            hasVisibleTemplates = true;
            body += `
              <div class="template-category-group" style="margin-bottom:var(--space-md);">
                <h5 style="margin-bottom:var(--space-sm);color:var(--text-primary);border-bottom:1px solid var(--border-color);padding-bottom:4px;">${cat === 'Custom' ? this.tr('apps.customTemplatesTitle', 'Plantillas personalizadas') : cat}</h5>
                <div class="template-grid">
                  ${catTmpls.map(tmpl => `
                    <div class="template-card ${state.template === tmpl.id ? 'selected' : ''}" data-template="${tmpl.id}">
                      <div class="template-card-icon">${this.templateIcon(tmpl.id)}</div>
                      <div class="template-card-name">${this.esc(tmpl.name)}</div>
                      <div class="template-card-desc">${this.esc(tmpl.description)}</div>
                    </div>`).join('')}
                </div>
              </div>`;
          });
          if (!hasVisibleTemplates) {
            body += `<div style="padding:16px;border:1px dashed var(--border-color);border-radius:8px;color:var(--text-muted);font-size:12px;">${this.tr('apps.templatesSearchEmpty', 'No se han encontrado plantillas para esa busqueda.')}</div>`;
          }
          body += `</div>`;

        } else {
          // ── Manual tab: only Genérica and Script Custom ──
          const manualTmpls = templates.filter(tmpl => tmpl.id === 'generic' || tmpl.id === 'custom');
          body += `
            <div style="max-height:360px;overflow-y:auto;padding-right:2px;">
              <div style="margin-bottom:var(--space-sm);">
                <div>
                  <div style="font-size:12px;font-weight:700;color:var(--text-primary);">${this.tr('apps.manualTemplatesTitle', 'Plantillas manuales')}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${this.tr('apps.manualTemplatesHint', 'Usa una app generica o un script manual cuando no quieras una plantilla reutilizable.')}</div>
                </div>
              </div>
              <div class="template-grid">
                ${manualTmpls.map(tmpl => `
                  <div class="template-card ${state.template === tmpl.id ? 'selected' : ''}" data-template="${tmpl.id}">
                    <div class="template-card-icon">${this.templateIcon(tmpl.id)}</div>
                    <div class="template-card-name">${this.esc(tmpl.name)}</div>
                  <div class="template-card-desc">${this.esc(tmpl.description)}</div>
                  </div>`).join('')}
              </div>
            </div>`;
        }

      } else if (state.step === 2) {
        const tmpl = templates.find(tmp => tmp.id === state.template);
        const isWinget = state.template === 'winget';
        const isODT = state.template === 'odt';
        const isUserTemplate = !!tmpl?.isUserDefined;
        const showsConfigXmlPicker = ['sap-gui', 'office'].includes(state.template);
        const requiresConfigXml = ['sap-gui', 'office'].includes(state.template);

        body += `
          <div class="form-group">
            <label class="form-label">${t('apps.appName')}</label>
            <input class="form-input" id="wiz-name" value="${this.esc(state.name)}" placeholder="Ej: Google Chrome">
            <p class="form-hint">${t('apps.nameHint')}</p>
          </div>`;

        if (isUserTemplate) {
          const fieldCount = Array.isArray(tmpl?.fields) ? tmpl.fields.length : 0;
          const fileCount = Array.isArray(tmpl?.fileFields) ? tmpl.fileFields.length : 0;
          body += `
            <div class="card" style="padding:14px 16px;margin:0 0 14px 0;background:rgba(30,144,255,0.08);border-color:rgba(30,144,255,0.2);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                <div style="display:flex;align-items:flex-start;gap:10px;">
                  <span style="font-size:28px;line-height:1;">${this.templateIcon(state.template)}</span>
                  <div>
                    <div style="font-size:15px;font-weight:700;color:var(--text-primary);">${this.esc(tmpl.name)}</div>
                    <p style="margin:6px 0 0 0;font-size:13px;line-height:1.5;color:var(--text-secondary);">${this.esc(tmpl.description || this.tr('apps.customTemplateDefaultDescLong', 'Plantilla reutilizable. Completa solo los valores que cambian en cada despliegue.'))}</p>
                  </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <span class="badge badge-info">${fieldCount} ${this.tr('apps.customTemplateArgsBadge', 'campos')}</span>
                  <span class="badge badge-neutral">${fileCount} ${this.tr('apps.customTemplateFilesBadge', 'archivos')}</span>
                  ${tmpl?.hasCustomScript ? `<span class="badge badge-primary">${this.tr('apps.customTemplateScriptBadge', 'script opcional')}</span>` : ''}
                </div>
              </div>
            </div>`;
        } else if (!isWinget && !isODT && tmpl) {
          // Built-in system template banner
          body += `
            <div class="card" style="padding:12px 16px;margin:0 0 14px 0;background:var(--bg-secondary);border-color:var(--border-color);">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:28px;line-height:1;">${this.templateIcon(state.template)}</span>
                <div>
                  <div style="font-size:14px;font-weight:700;color:var(--text-primary);">${this.esc(tmpl.name)}</div>
                  ${tmpl.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${this.esc(tmpl.description)}</div>` : ''}
                </div>
                <span class="badge badge-neutral" style="margin-left:auto;flex-shrink:0;">Sistema</span>
              </div>
            </div>`;
        }

        if (isWinget) {
          // ── Winget mode: info panel + wingetId display ──────────
          body += `
          <div style="padding:12px 14px;background:rgba(108,99,255,0.07);border:1px solid rgba(108,99,255,0.25);border-radius:8px;margin-bottom:12px;">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--primary-color);">📦 Windows Package Manager</div>
            <p style="margin:0 0 8px 0;font-size:12px;color:var(--text-secondary);">Se instalará automáticamente usando winget. No es necesario descargar ningún instalador.</p>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Winget ID</label>
              <input type="text" class="form-input" value="${this.esc(state.wingetId)}" readonly style="background:var(--bg-tertiary);cursor:default;font-family:monospace;font-size:12px;">
            </div>
            <div class="form-group" style="margin-bottom:0;margin-top:8px;">
              <label class="form-label">Fuente</label>
              <input type="text" class="form-input" value="${this.esc(state.wingetSource || 'winget')}" readonly style="background:var(--bg-tertiary);cursor:default;font-family:monospace;font-size:12px;">
            </div>
          </div>`;

        } else if (isODT) {
          // ── ODT mode: product radio-cards + app chip-toggles + options row ──
          const odtProds = catalogData?.odtProducts || [];
          const odtApps2 = catalogData?.odtApps || [];
          const odtLangs = catalogData?.odtLanguages || [];
          const odtChans = catalogData?.odtChannels || [];
          const cfg = state.odtConfig;
          const curProd = odtProds.find(p => p.id === cfg.product);
          const curChan = odtChans.find(c => c.id === cfg.channel);
          const curLang = odtLangs.find(l => l.id === cfg.language);

          body += `
          <div class="odt-wizard">
            <div class="odt-header">
              <div class="odt-header-icon">🏢</div>
              <div>
                <div class="odt-header-title">Microsoft Office</div>
                <div class="odt-header-sub">Office Deployment Tool · Sin descarga manual</div>
              </div>
            </div>

            <div class="odt-section">
              <div class="odt-section-label">Producto</div>
              <div class="odt-product-grid">
                ${odtProds.map(p => `
                  <label class="odt-product-card ${cfg.product === p.id ? 'active' : ''}">
                    <input type="radio" name="odt-product-radio" value="${this.esc(p.id)}" ${cfg.product === p.id ? 'checked' : ''}>
                    <div class="odt-product-name">${this.esc(p.label)}</div>
                    <div class="odt-product-badge">${p.type === 'subscription' ? 'Suscripción' : 'Licencia perpetua'}</div>
                  </label>`).join('')}
              </div>
            </div>

            <div class="odt-section">
              <div class="odt-section-label">Aplicaciones a incluir</div>
              <div class="odt-apps-grid">
                ${odtApps2.map(a => `
                  <label class="odt-app-chip ${cfg.apps.includes(a.id) ? 'active' : ''}">
                    <input type="checkbox" name="odt-app" value="${this.esc(a.id)}" ${cfg.apps.includes(a.id) ? 'checked' : ''}>
                    ${this.esc(a.label)}
                  </label>`).join('')}
              </div>
            </div>

            <div class="odt-section">
              <div class="odt-options-row">
                <div class="odt-option">
                  <label class="odt-option-label">Idioma</label>
                  <select class="form-select" id="odt-language">
                    ${odtLangs.map(l => `<option value="${this.esc(l.id)}" ${cfg.language === l.id ? 'selected' : ''}>${this.esc(l.label)}</option>`).join('')}
                  </select>
                </div>
                <div class="odt-option">
                  <label class="odt-option-label">Canal</label>
                  <select class="form-select" id="odt-channel">
                    ${odtChans.map(c => `<option value="${this.esc(c.id)}" ${cfg.channel === c.id ? 'selected' : ''}>${this.esc(c.label)}</option>`).join('')}
                  </select>
                </div>
                <div class="odt-option odt-option-sm">
                  <label class="odt-option-label">Arquitectura</label>
                  <select class="form-select" id="odt-arch">
                    <option value="64" ${cfg.arch === '64' ? 'selected' : ''}>64 bits</option>
                    <option value="32" ${cfg.arch === '32' ? 'selected' : ''}>32 bits</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="odt-summary" id="odt-summary">
              <div class="odt-summary-row">
                <span class="odt-summary-key">Producto</span>
                <span class="odt-summary-val" id="odt-sum-product">${this.esc(curProd?.label || cfg.product)}</span>
              </div>
              <div class="odt-summary-row">
                <span class="odt-summary-key">Apps</span>
                <span class="odt-summary-val" id="odt-sum-apps">${cfg.apps.length > 0 ? cfg.apps.map(id => { const a = odtApps2.find(x => x.id === id); return this.esc(a?.label || id); }).join(', ') : 'Ninguna seleccionada'}</span>
              </div>
              <div class="odt-summary-row">
                <span class="odt-summary-key">Canal · Idioma · Arq</span>
                <span class="odt-summary-val" id="odt-sum-opts">${this.esc(curChan?.label || cfg.channel)} · ${this.esc(curLang?.label || cfg.language)} · ${cfg.arch} bits</span>
              </div>
              <div class="odt-summary-warning">
                ⏱ La instalación puede tardar entre 20 y 60 minutos en los equipos cliente
              </div>
            </div>
          </div>`;

        } else {
          // ── Standard installer mode ─────────────────────────────
          body += `
          ${state.template !== 'custom' ? `
            <div class="form-group">
              <label class="form-label">${t('apps.installer')}</label>
              <div class="flex gap-sm">
                <input class="form-input" id="wiz-installer" value="${this.esc(state.installerPath)}" placeholder="C:\\Descargas\\app.exe" readonly style="flex:1">
                <button class="btn btn-secondary" id="btn-pick-installer">${t('apps.browse')}</button>
              </div>
              <p class="form-hint">${t('apps.installerHint')}</p>
            </div>
          ` : ''}

          ${showsConfigXmlPicker ? `
            <div class="form-group">
              <label class="form-label">${t('apps.xmlConfig')}${requiresConfigXml ? ' *' : ''}</label>
              <div class="flex gap-sm">
                <input class="form-input" id="wiz-xml" value="${this.esc(state.configXmlPath)}" placeholder="${this.esc(t('apps.xmlHint'))}" readonly style="flex:1">
                <button class="btn btn-secondary" id="btn-pick-xml">${t('apps.browse')}</button>
              </div>
            </div>
          ` : ''}

          ${state.template === 'generic' || isUserTemplate ? `
            <div id="wiz-silent-args-container">
              <div class="form-group">
                <label class="form-label">${t('apps.silentArgs')}</label>
                <div style="display:flex;gap:8px;">
                  <input class="form-input" id="wiz-silentArgs" value="${this.esc(state.silentArgs)}" placeholder="/S, /qn, /norestart" style="flex:1;">
                  <button class="btn btn-secondary btn-sm" type="button" id="btn-show-args-help" style="white-space:nowrap;align-self:center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    ${t('apps.commonArgs')}
                  </button>
                </div>
                ${isUserTemplate ? `<p class="form-hint">${this.tr('apps.customTemplateSilentHint', 'Estos argumentos base se anaden antes de los argumentos definidos en la plantilla.')}</p>` : ''}
              </div>
            </div>
          ` : ''}`;
        }

        body += `
          <div style="display:flex;gap:12px">
            <div class="form-group" style="flex:0 0 220px">
              <label class="form-label">${t('apps.version')}</label>
              <input class="form-input" id="wiz-version" value="${state.version}" placeholder="1.0.0">
              ${state.suggestedVersion && state.suggestedVersion !== state.version ? `
                <div id="wiz-version-suggestion" style="margin-top:6px; display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:rgba(108,99,255,0.12); border:1px solid rgba(108,99,255,0.3); border-radius:20px; font-size:11px; cursor:pointer;" title="${t('apps.applySuggestedVersion')}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  <span style="color:var(--text-secondary);">${t('apps.suggestedVersion')}:</span>
                  <strong style="color:var(--primary-color); font-family:monospace;">${this.esc(state.suggestedVersion)}</strong>
                </div>
              ` : ''}
            </div>
            <div class="form-group" style="flex:1;display:flex;align-items:stretch;">
              <label class="checkbox-wrapper checkbox-panel" style="align-items:center;">
                <input type="checkbox" id="wiz-notify" ${state.notifyUser ? 'checked' : ''}>
                <span>🔔 ${t('apps.notifyUser')}</span>
              </label>
            </div>
          </div>

          ${(!isWinget && !isODT) ? (tmpl?.fields || []).map(f => {
            let inputHtml = '';
            if (f.type === 'select') {
              inputHtml = '<select class="form-select" id="wiz-param-' + f.key + '">\n' +
                (f.options || []).map(opt => '<option value="' + opt.value + '" ' + (state.customParams[f.key] === opt.value || (!state.customParams[f.key] && f.default === opt.value) ? 'selected' : '') + '>' + opt.label + '</option>').join('') +
              '\n</select>';
            } else if (f.type === 'textarea') {
              inputHtml = '<textarea class="form-input" id="wiz-param-' + f.key + '" rows="8" style="font-family: monospace;">' + this.esc(state.customParams[f.key] || f.default) + '</textarea>';
            } else if (f.type === 'checkbox') {
              return `
                <div class="form-group">
                  <label class="checkbox-wrapper">
                    <input type="checkbox" id="wiz-param-${f.key}" ${state.customParams[f.key] === true || (state.customParams[f.key] === undefined && f.default) ? 'checked' : ''}>
                    <span class="form-label mb-0" style="margin: 0; display: inline;">${this.esc(f.label)}</span>
                  </label>
                  ${f.hint ? '<p class="form-hint" style="margin-left: 26px;">' + this.esc(f.hint) + '</p>' : ''}
                </div>
              `;
            } else {
              let val = state.customParams[f.key];
              if (val === undefined) val = f.default;
              inputHtml = '<input class="form-input" id="wiz-param-' + f.key + '" value="' + this.esc(val) + '" placeholder="' + this.esc(f.hint || '') + '">';
            }
            return `
              <div class="form-group">
                <label class="form-label">${this.esc(f.label)}${f.required ? ' *' : ''}</label>
                ${inputHtml}
                ${f.hint ? '<p class="form-hint">' + this.esc(f.hint) + '</p>' : ''}
              </div>
            `;
          }).join('') : ''}

          ${(!isWinget && !isODT && isUserTemplate) ? (tmpl?.fileFields || []).map(fileField => `
            <div class="form-group">
              <label class="form-label">${this.esc(fileField.label)}${fileField.required ? ' *' : ''}</label>
              <div class="flex gap-sm">
                <input class="form-input" id="wiz-file-${fileField.key}" value="${this.esc(state.templateFiles[fileField.key]?.sourcePath || state.templateFiles[fileField.key] || '')}" placeholder="${this.esc(this.describeTemplateFile(fileField))}" readonly style="flex:1">
                <button class="btn btn-secondary btn-template-file" type="button" data-file-key="${this.esc(fileField.key)}">${t('apps.browse')}</button>
              </div>
              <p class="form-hint">${this.esc(this.describeTemplateFile(fileField))}</p>
            </div>
          `).join('') : ''}

          ${isUserTemplate && tmpl?.hasCustomScript ? `
            <div style="padding:12px 14px;background:rgba(30,144,255,0.08);border:1px solid rgba(30,144,255,0.2);border-radius:8px;margin-top:8px;">
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:4px;">${this.tr('apps.customTemplatePostScriptTitle', 'Script adicional')}</div>
              <p style="margin:0;font-size:12px;color:var(--text-secondary);">${this.tr('apps.customTemplatePostScriptHint', 'La plantilla incluye un script opcional que se ejecutara despues del instalador con acceso a los valores y archivos auxiliares definidos.')}</p>
            </div>
          ` : ''}
        `;
      } else if (state.step === 3) {
        const selectedOUs = Array.isArray(state.selectedOUs) ? state.selectedOUs : [];
        body += `
          <div class="form-group mb-md">
            <label class="form-label">${t('apps.selectOus')}</label>
            <div style="position:relative;margin-bottom:8px;">
              <svg style="position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:.4" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" class="form-input" id="wiz-ou-search" placeholder="${t('ous.searchOUs')}" autocomplete="off" style="padding-left:32px;">
            </div>
            <div id="wiz-ou-tree" style="max-height:190px;overflow-y:auto;border:1px solid var(--border-color);border-radius:6px;padding:4px 6px;background:var(--bg-secondary);">
              ${this.ousTreeCache ? App.ouPickerTreeHTML(this.ousTreeCache, '', selectedOUs) : `<p style="padding:8px;font-size:13px;color:var(--text-muted);">${t('ous.noOusFound')}</p>`}
            </div>
            <div id="wiz-ou-selected" style="margin-top:6px;min-height:22px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
              <span style="font-size:12px;color:var(--text-muted);">${t('apps.selectOuRecommended')}</span>
            </div>
            <input type="hidden" id="wiz-ou-dn" value="${JSON.stringify(selectedOUs).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">
          </div>

          <div class="form-group mb-md">
            <label class="checkbox-wrapper checkbox-panel checkbox-panel--accent">
              <input type="checkbox" id="wiz-create-gpo" ${state.createGPO ? 'checked' : ''}>
              <span style="font-weight:600;color:var(--primary-color)">✨ ${t('apps.createGpoCheckbox')}</span>
            </label>
          </div>

          <div class="form-group" style="opacity: ${state.createGPO ? '0.5' : '1'}; pointer-events: ${state.createGPO ? 'none' : 'auto'};">
            <label class="form-label">${t('apps.selectGpo')}</label>
            <select class="form-select" id="wiz-gpo">
              <option value="">${t('apps.noGpoOption')}</option>
            </select>
          </div>`;
      } else if (state.step === 4) {
        body += `
          <div class="mb-md">
            <div class="flex items-center gap-md mb-md">
              <span class="badge badge-primary">${this.esc(state.template)}</span>
              <span style="font-weight:600; font-size:1.1rem">${this.esc(state.name)}</span>
              ${state.gpoName ? `<span class="badge badge-info">${this.esc(state.gpoName)}</span>` : ''}
            </div>
          </div>
          <div class="code-header">
            <span>📄 install.ps1</span>
            <button class="btn btn-ghost btn-sm" onclick="AppsPage.copyScript()">${t('apps.copyBtn')}</button>
          </div>
          <pre class="code-preview" id="script-preview">${t('apps.generatingScript')}</pre>`;
      }

      body += `</div>`;

      const footer = `
        ${state.step > 1 ? `<button class="btn btn-secondary" id="wiz-prev">${t('apps.back')}</button>` : ''}
        <div style="flex:1"></div>
        ${state.step < 4 ?
          `<button class="btn btn-primary" id="wiz-next" ${state.step === 1 && !state.template ? 'disabled' : ''}>${t('apps.next')}</button>` :
          `<button class="btn btn-success" id="wiz-deploy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${isEdit ? t('apps.saveAndDeploy') : t('apps.create')}
          </button>`
        }`;

      App.openModal(isEdit ? t('apps.edit') : t('apps.newApp'), body, footer); // isEdit is !!(existingApp?.id)
      this.bindWizardEvents(state, templates, renderWizard, isEdit, existingApp);
    };

    App._modalLocked = false;  // unlock before rendering the interactive wizard
    this._wizardOpening = false;
    renderWizard();
    // If opened from catalog with a pre-selected app, scroll it into view
    if (existingApp?.wingetId && !isEdit) {
      requestAnimationFrame(() => {
        const sel = document.querySelector('.catalog-item.selected');
        if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
    } catch (err) {
      this._wizardOpening = false;
      App.toast(t('common.error') + ': ' + err.message, 'error');
      App.closeModal();
    }
  },

  bindWizardEvents(state, templates, renderWizard, isEdit, existingApp) {
    // ── Tab switching (catalog / agentes / manual) ──────────────
    document.querySelectorAll('.wiz-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.catalogTab = tab.dataset.tab;
        // Clear template selection when switching tabs so user picks fresh
        state.template = '';
        state.wingetId = '';
        state.wingetSource = 'winget';
        state.customParams = {};
        state.templateFiles = {};
        state.templateDefinition = null;
        state.configXmlPath = '';
        renderWizard();
      });
    });

    // ── Catalog item selection (winget / ODT cards in catalog tab) ──
    document.querySelectorAll('.catalog-item').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent the generic .template-card handler below
        const catalogType = card.dataset.catalogType;
        const nextTemplate = catalogType === 'odt' ? 'odt' : 'winget';
        let selectedPackage = null;
        if (state.template !== nextTemplate) {
          state.customParams = {};
          state.templateFiles = {};
          state.templateDefinition = null;
          state.configXmlPath = '';
        }
        if (catalogType === 'odt') {
          state.template = 'odt';
          state.wingetId = '';
          state.wingetSource = 'winget';
          state.name = 'Microsoft Office';
        } else if (catalogType === 'winget') {
          state.template = 'winget';
          state.wingetId = card.dataset.wingetId || '';
          state.wingetSource = card.dataset.wingetSource || 'winget';
          state.name = card.dataset.appName || '';
          if (card.dataset.appVersion) state.version = card.dataset.appVersion;
          selectedPackage = {
            wingetId: state.wingetId,
            wingetSource: state.wingetSource,
            name: card.dataset.appName || state.name,
            version: card.dataset.appVersion || state.version || ''
          };
        }
        // Keep the user on step 1 in the New App wizard; the catalog page
        // still opens this wizard directly on step 2 via a prefilled state.
        if (state._wizardWingetTimer) clearTimeout(state._wizardWingetTimer);
        state.wizardWingetSearching = false;
        renderWizard();
        if (selectedPackage?.wingetId) {
          this.resolveCatalogPackageSelection(state, renderWizard, selectedPackage);
        }
      });
    });

    // ── Template selection (plantilla / manual tabs) ──────────────
    document.querySelectorAll('.template-card:not(.catalog-item)').forEach(card => {
      card.addEventListener('click', () => {
        if (state.template !== card.dataset.template) {
          state.customParams = {};
          state.templateFiles = {};
          state.templateDefinition = null;
          state.configXmlPath = '';
        }
        state.template = card.dataset.template;
        state.wingetId = '';
        state.wingetSource = 'winget';
        // Auto-fill installer from template pre-configured installer
        const preInstaller = state.templateInstallers?.[state.template];
        if (preInstaller && !state.installerPath) state.installerPath = preInstaller;
        // Stay on step 1 so the user confirms with "Next" from the New App wizard.
        renderWizard();
      });
    });

    const manageTemplatesBtn = document.getElementById('btn-open-template-manager');
    if (manageTemplatesBtn) {
      manageTemplatesBtn.addEventListener('click', () => {
        this.saveStepData(state, templates);
        this.openTemplateManager(async () => {
          const refreshedTemplates = await window.api.scripts.getTemplates();
          templates.splice(0, templates.length, ...refreshedTemplates);
          if (state.template && !refreshedTemplates.some(item => item.id === state.template)) {
            state.template = '';
            state.customParams = {};
            state.templateFiles = {};
            state.templateDefinition = null;
            state.configXmlPath = '';
          }
          renderWizard();
        });
      });
    }

    // ── Catalog search input (two-phase: curated + winget CLI) ──
    const catalogSearchInput = document.getElementById('catalog-search');
    if (catalogSearchInput) {
      // Enter: fire CLI search immediately (don't let it bubble to Next button)
      catalogSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const q = catalogSearchInput.value.trim();
          if (q.length >= 2 && state._wizardWingetTimer) {
            // Cancel debounce and fire immediately
            clearTimeout(state._wizardWingetTimer);
            state._wizardWingetTimer = null;
            this._runWizardWingetSearch(q, state, renderWizard);
          }
        }
      });

      catalogSearchInput.addEventListener('input', () => {
        const q = catalogSearchInput.value;
        state.catalogSearch = q;
        // Clear previous winget search state
        if (state._wizardWingetTimer) clearTimeout(state._wizardWingetTimer);
        state.wizardWingetResults = [];
        state.wizardWingetSearching = q.trim().length >= 2;

        // Phase 1: render curated results immediately
        renderWizard();
        const newInput = document.getElementById('catalog-search');
        if (newInput) { newInput.focus(); newInput.setSelectionRange(newInput.value.length, newInput.value.length); }

        // Phase 2: winget CLI search (debounced 600ms)
        if (q.trim().length >= 2) {
          state._wizardWingetTimer = setTimeout(() => {
            state._wizardWingetTimer = null;
            this._runWizardWingetSearch(q.trim(), state, renderWizard);
          }, 600);
        }
      });
    }

    // ── Plantilla search input ────────────────────────────────
    const plantillaSearchInput = document.getElementById('plantilla-search');
    if (plantillaSearchInput) {
      plantillaSearchInput.addEventListener('input', () => {
        state.plantillaSearch = plantillaSearchInput.value;
        renderWizard();
        // Re-focus and restore cursor position after re-render
        const newInput = document.getElementById('plantilla-search');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
      });
    }

    // ── Catalog category filter buttons ────────────────────────
    document.querySelectorAll('.catalog-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.catalogCat = btn.dataset.cat;
        renderWizard();
      });
    });

    // Navigation
    const nextBtn = document.getElementById('wiz-next');
    const prevBtn = document.getElementById('wiz-prev');
    const deployBtn = document.getElementById('wiz-deploy');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.saveStepData(state, templates);

        // Validate step 2 before advancing
        if (state.step === 2) {
          if (!state.name.trim()) {
            App.toast(t('apps.nameRequired'), 'warning');
            document.getElementById('wiz-name')?.focus();
            return;
          }
          const tmpl = templates.find(tmp => tmp.id === state.template);
          const needsInstaller = state.template !== 'custom' && !(tmpl?.noInstaller);
          if (needsInstaller && !state.installerPath) {
            App.toast(t('apps.installerRequired'), 'warning');
            return;
          }
          const missingRequiredArg = (tmpl?.fields || []).find(field =>
            field.required && !String(state.customParams[field.key] ?? field.default ?? '').trim()
          );
          if (missingRequiredArg) {
            App.toast(this.tr('apps.customTemplateRequiredArg', 'Completa todos los argumentos obligatorios de la plantilla.'), 'warning');
            document.getElementById(`wiz-param-${missingRequiredArg.key}`)?.focus();
            return;
          }
          const missingRequiredFile = (tmpl?.fileFields || []).find(field =>
            field.required && !String(state.templateFiles[field.key]?.sourcePath || state.templateFiles[field.key] || '').trim()
          );
          if (missingRequiredFile) {
            App.toast(this.tr('apps.customTemplateRequiredFile', 'Selecciona todos los archivos obligatorios de la plantilla.'), 'warning');
            return;
          }
          const requiresConfigXml = ['office', 'sap-gui'].includes(state.template);
          if (requiresConfigXml && !String(state.configXmlPath || '').trim()) {
            App.toast(this.tr('apps.customTemplateRequiredXml', 'Selecciona el XML requerido para esta plantilla.'), 'warning');
            return;
          }
        }

        state.step++;
        renderWizard();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        state.step--;
        renderWizard();
      });
    }

    if (deployBtn) {
      deployBtn.addEventListener('click', () => this.finishWizard(state, isEdit, existingApp, renderWizard));
    }

    // Step 2 events
    const btnPickInstaller = document.getElementById('btn-pick-installer');
    if (btnPickInstaller) {
      btnPickInstaller.addEventListener('click', async () => {
        this.saveStepData(state, templates);
        const file = await window.api.config.selectFile([{ name: 'Instaladores', extensions: ['exe', 'msi', 'ps1'] }]);
        if (file) {
          state.installerPath = file;

          if (file.toLowerCase().endsWith('.msi')) {
             if (!state.silentArgs || state.silentArgs === '/S') {
                 state.silentArgs = '/qn /norestart';
             }
          } else if (file.toLowerCase().endsWith('.exe')) {
             if (!state.silentArgs || state.silentArgs === '/qn /norestart' || state.silentArgs === '/qn') {
                 state.silentArgs = '/S';
             }
          } else if (file.toLowerCase().endsWith('.ps1')) {
             if (!state.silentArgs || state.silentArgs === '/S' || state.silentArgs === '/qn /norestart' || state.silentArgs === '/qn') {
                 state.silentArgs = '';
             }
          }

          // Auto-suggest name from filename — only if user hasn't typed one yet
          if (!state.name.trim()) {
            const basename = file.split(/[\\/]/).pop() || '';
            const nameWithoutExt = basename.replace(/\.[^.]+$/, '');
            const suggestedName = nameWithoutExt.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (suggestedName) state.name = suggestedName;
          }

          // Try to auto-detect version from installer metadata
          try {
            const verResult = await window.api.apps.getInstallerVersion(file);
            if (verResult && verResult.success && verResult.version) {
              state.suggestedVersion = verResult.version;
              // Auto-apply only if user hasn't set a meaningful version yet
              if (!state.version || state.version === '1.0.0') {
                state.version = verResult.version;
              }
            } else {
              state.suggestedVersion = '';
            }
          } catch (e) {
            state.suggestedVersion = '';
          }

          renderWizard();
        }
      });
    }

    // Suggested version bubble click → apply to input
    const versionSuggestion = document.getElementById('wiz-version-suggestion');
    if (versionSuggestion) {
      versionSuggestion.addEventListener('click', () => {
        state.version = state.suggestedVersion;
        const versionInput = document.getElementById('wiz-version');
        if (versionInput) versionInput.value = state.suggestedVersion;
        versionSuggestion.style.display = 'none';
      });
    }

    const btnPickXml = document.getElementById('btn-pick-xml');
    if (btnPickXml) {
      btnPickXml.addEventListener('click', async () => {
        this.saveStepData(state, templates);
        const file = await window.api.config.selectFile([{ name: 'Archivos XML', extensions: ['xml'] }]);
        if (file) {
          state.configXmlPath = file;
          renderWizard();
        }
      });
    }

    document.querySelectorAll('.btn-template-file').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.saveStepData(state, templates);
        const tmpl = templates.find(item => item.id === state.template);
        const fileField = (tmpl?.fileFields || []).find(item => item.key === btn.dataset.fileKey);
        if (!fileField) return;
        const extensions = Array.isArray(fileField.extensions) && fileField.extensions.length > 0
          ? fileField.extensions
          : ['*'];
        const normalizedExtensions = this.isInstallerTemplateFile(fileField) && extensions.length === 1 && extensions[0] === '*'
          ? ['exe', 'msi', 'ps1']
          : extensions;
        const file = await window.api.config.selectFile([{
          name: fileField.label || this.tr(
            this.isInstallerTemplateFile(fileField) ? 'apps.customTemplateInstallerFile' : 'apps.customTemplateConfigFile',
            this.isInstallerTemplateFile(fileField) ? 'Instalador adjunto' : 'Archivo de configuracion'
          ),
          extensions: normalizedExtensions
        }]);
        if (file) {
          state.templateFiles[fileField.key] = { sourcePath: file };
          renderWizard();
        }
      });
    });

    // Silent args helper button
    const btnArgsHelp = document.getElementById('btn-show-args-help');
    if (btnArgsHelp) {
      btnArgsHelp.addEventListener('click', () => {
        this.saveStepData(state, templates);
        this.showSilentArgsHelper(state, renderWizard);
      });
    }

    // ODT live summary update
    const odtWizard = document.querySelector('.odt-wizard');
    if (odtWizard) {
      const updateODTSummary = () => {
        const checkedProd = odtWizard.querySelector('input[name="odt-product-radio"]:checked');
        const prodLabel = checkedProd?.closest('.odt-product-card')?.querySelector('.odt-product-name')?.textContent || '';
        const sumProd = document.getElementById('odt-sum-product');
        if (sumProd && prodLabel) sumProd.textContent = prodLabel;

        const checkedApps = [...odtWizard.querySelectorAll('input[name="odt-app"]:checked')]
          .map(cb => cb.closest('.odt-app-chip')?.textContent?.trim() || cb.value);
        const sumApps = document.getElementById('odt-sum-apps');
        if (sumApps) sumApps.textContent = checkedApps.length > 0 ? checkedApps.join(', ') : 'Ninguna seleccionada';

        const lang = document.getElementById('odt-language');
        const chan = document.getElementById('odt-channel');
        const arch = document.getElementById('odt-arch');
        const sumOpts = document.getElementById('odt-sum-opts');
        if (sumOpts && lang && chan && arch) {
          sumOpts.textContent = `${chan.options[chan.selectedIndex]?.text} · ${lang.options[lang.selectedIndex]?.text} · ${arch.value} bits`;
        }

        // Sync active class on radio cards
        odtWizard.querySelectorAll('.odt-product-card').forEach(card => {
          const radio = card.querySelector('input[type="radio"]');
          card.classList.toggle('active', radio?.checked || false);
        });

        // Sync active class on chip toggles
        odtWizard.querySelectorAll('.odt-app-chip').forEach(chip => {
          const cb = chip.querySelector('input[type="checkbox"]');
          chip.classList.toggle('active', cb?.checked || false);
        });
      };

      odtWizard.addEventListener('change', updateODTSummary);
    }

    const checkCreateGpo = document.getElementById('wiz-create-gpo');
    if (checkCreateGpo) {
      checkCreateGpo.addEventListener('change', () => {
        this.saveStepData(state, templates);
        state.createGPO = checkCreateGpo.checked;
        if (state.createGPO) state.gpoName = '';
        renderWizard();
      });
    }

    // Load GPOs and OUs for step 3
    if (state.step === 3 && App.rsatAvailable) {
      this.loadGPOsForWizard(state);
      // OUs are pre-fetched in openWizard; bind tree events.
      // loadOUsForWizard handles the edge case where cache is still empty.
      if (this.ousTreeCache) {
        this.bindOUPickerEvents(state);
      } else {
        this.loadOUsForWizard(state);
      }
    }

    // Generate preview for step 4
    if (state.step === 4) {
      this.generatePreview(state);
    }
  },

  saveStepData(state, templates) {
    // Always try to save all visible inputs regardless of step
    const nameInput = document.getElementById('wiz-name');
    if (nameInput) state.name = nameInput.value;

    const silentInput = document.getElementById('wiz-silentArgs');
    if (silentInput) state.silentArgs = silentInput.value;

    const xmlInput = document.getElementById('wiz-xml');
    if (xmlInput) {
      state.configXmlPath = xmlInput.value;
    }

    if (state.step === 2) {
      const tmpl = templates.find(tmp => tmp.id === state.template);
      (tmpl?.fields || []).forEach(f => {
        const input = document.getElementById(`wiz-param-${f.key}`);
        if (input) {
          if (f.type === 'checkbox') {
            state.customParams[f.key] = input.checked;
          } else {
            state.customParams[f.key] = input.value;
          }
        }
      });

      (tmpl?.fileFields || []).forEach(fileField => {
        const input = document.getElementById(`wiz-file-${fileField.key}`);
        if (input) {
          const existing = state.templateFiles[fileField.key];
          state.templateFiles[fileField.key] = typeof existing === 'object'
            ? { ...existing, sourcePath: input.value }
            : { sourcePath: input.value };
        }
      });

      // Save ODT config fields
      if (state.template === 'odt') {
        const odtProdRadio = document.querySelector('input[name="odt-product-radio"]:checked');
        if (odtProdRadio) state.odtConfig.product = odtProdRadio.value;
        const odtLang = document.getElementById('odt-language');
        if (odtLang) state.odtConfig.language = odtLang.value;
        const odtChan = document.getElementById('odt-channel');
        if (odtChan) state.odtConfig.channel = odtChan.value;
        const odtArch = document.getElementById('odt-arch');
        if (odtArch) state.odtConfig.arch = odtArch.value;
        const odtAppChecks = document.querySelectorAll('input[name="odt-app"]');
        if (odtAppChecks.length > 0) {
          state.odtConfig.apps = [];
          odtAppChecks.forEach(cb => { if (cb.checked) state.odtConfig.apps.push(cb.value); });
        }
      }
    }

    const gpoSelect = document.getElementById('wiz-gpo');
    if (gpoSelect) state.gpoName = gpoSelect.value;
    const ouDnInput = document.getElementById('wiz-ou-dn');
    if (ouDnInput) {
      try {
        const parsed = JSON.parse(ouDnInput.value || '[]');
        state.selectedOUs = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        state.selectedOUs = ouDnInput.value ? [ouDnInput.value] : [];
      }
      state.ouDN = state.selectedOUs[0] || '';
    }

    const versionInput = document.getElementById('wiz-version');
    if (versionInput) state.version = versionInput.value;
    const notifyCheck = document.getElementById('wiz-notify');
    if (notifyCheck) state.notifyUser = notifyCheck.checked;
  },

  async _runWizardWingetSearch(query, state, renderWizard) {
    try {
      const results = await window.api.catalog.searchCLI(query);
      // Abort if the user has already typed something new
      if (state.catalogSearch.trim() !== query) return;
      const curatedIds = new Set(
        (this.wingetCatalogCache?.catalog || [])
          .filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase()) ||
            (item.wingetId || '').toLowerCase().includes(query.toLowerCase())
          )
          .map(item => `${(item.wingetId || '').toLowerCase()}|${(item.wingetSource || 'winget').toLowerCase()}`)
          .filter(Boolean)
      );
      state.wizardWingetResults = results.filter(r =>
        r.wingetId && !curatedIds.has(`${r.wingetId.toLowerCase()}|${(r.wingetSource || 'winget').toLowerCase()}`)
      );
      state.wizardWingetSearching = false;

      const ws = document.getElementById('wiz-winget-section');
      if (!ws) return;

      if (state.wizardWingetResults.length === 0) {
        ws.innerHTML = '';
        return;
      }

      ws.innerHTML = `<div style="margin-top:8px;">
        <h5 style="font-size:10px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;letter-spacing:.05em;">Winget CLI</h5>
        <div class="template-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));">
          ${state.wizardWingetResults.map(item => `
            <div class="template-card catalog-item"
                 data-catalog-type="winget" data-winget-id="${this.esc(item.wingetId)}"
                 data-winget-source="${this.esc(item.wingetSource || 'winget')}"
                 data-app-name="${this.esc(item.name)}" data-app-version="${this.esc(item.version || '')}"
                 style="cursor:pointer;">
              <div class="template-card-icon" style="font-size:22px;">📦</div>
              <div class="template-card-name" style="font-size:11px;">${this.esc(item.name)}</div>
              ${item.version ? `<div class="template-card-desc" style="font-size:10px;">v${this.esc(item.version)}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;

      ws.querySelectorAll('.catalog-item').forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          state.template = 'winget';
          state.wingetId = card.dataset.wingetId || '';
          state.wingetSource = card.dataset.wingetSource || 'winget';
          state.name = card.dataset.appName || '';
          if (card.dataset.appVersion) state.version = card.dataset.appVersion;
          // Stay on step 1 in the New App wizard and normalize the selected package in background.
          if (state._wizardWingetTimer) clearTimeout(state._wizardWingetTimer);
          state.wizardWingetSearching = false;
          renderWizard();
          this.resolveCatalogPackageSelection(state, renderWizard, {
            wingetId: state.wingetId,
            wingetSource: state.wingetSource,
            name: card.dataset.appName || state.name,
            version: card.dataset.appVersion || state.version || ''
          });
        });
      });
    } catch {
      state.wizardWingetSearching = false;
      const ws = document.getElementById('wiz-winget-section');
      if (ws) ws.innerHTML = '';
    }
  },

  async loadGPOsForWizard(state) {
    try {
      const [apps, cfg] = await Promise.all([
        window.api.apps.getAll().catch(() => []),
        window.api.config.get().catch(() => ({}))
      ]);
      const programGPOs = [...new Set([
        ...apps.filter(a => a.gpoName).map(a => a.gpoName),
        cfg.defaultGPO || null
      ].filter(Boolean))];

      const select = document.getElementById('wiz-gpo');
      if (select) {
        programGPOs.forEach(gpoName => {
          const opt = document.createElement('option');
          opt.value = gpoName;
          opt.textContent = gpoName;
          opt.selected = gpoName === state.gpoName;
          select.appendChild(opt);
        });
      }
    } catch (e) {}
  },

  async loadOUsForWizard(state) {
    // Fallback: fetches OUs if not already cached, then renders and binds the tree picker.
    // Under normal flow ousTreeCache is pre-populated in openWizard before step 3 is shown.
    if (!App.rsatAvailable || App.rsatMissingGPMC) return;
    try {
      if (!this.ousTreeCache) {
        const result = await window.api.ad.getOUs();
        if (result.success && result.data) {
          this.ousTreeCache = result.data;
          this.ousCache = this.flattenOUs(result.data);
        }
      }
      const treeContainer = document.getElementById('wiz-ou-tree');
      if (treeContainer && this.ousTreeCache) {
        treeContainer.innerHTML = App.ouPickerTreeHTML(this.ousTreeCache, '', state.selectedOUs || []);
      }
      this.bindOUPickerEvents(state);
    } catch (e) {}
  },

  // Removed ouPickerTreeHTML & ouNodeMatchesSearch to use App globals

  bindOUPickerEvents(state) {
    const searchInput = document.getElementById('wiz-ou-search');
    const treeContainer = document.getElementById('wiz-ou-tree');
    const dnInput = document.getElementById('wiz-ou-dn');
    const selectedDisplay = document.getElementById('wiz-ou-selected');
    if (!treeContainer) return;

    const renderSelectedDisplay = () => {
      if (!selectedDisplay) return;
      const selectedOUs = Array.isArray(state.selectedOUs) ? state.selectedOUs : [];
      if (selectedOUs.length === 0) {
        selectedDisplay.innerHTML = `<span style="font-size:12px;color:var(--text-muted);">${t('apps.selectOuRecommended')}</span>`;
        return;
      }

      selectedDisplay.innerHTML = selectedOUs.map(dn => {
        const name = this.ousCache
          ? (this.ousCache.find(o => o.dn === dn) || {}).name || dn
          : dn;
        return `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(30,144,255,0.15);color:var(--primary-color);padding:2px 10px;border-radius:4px;font-size:12px;">
          📁 ${this.esc(name)}
          <button class="btn btn-ghost btn-sm btn-remove-ou" data-dn="${this.esc(dn)}" style="font-size:11px;padding:0 4px;min-height:auto;">✕</button>
        </span>`;
      }).join('') + `<button class="btn btn-ghost btn-sm" id="btn-clear-ou" style="font-size:11px;margin-left:4px;opacity:.7;">${t('common.clear') || 'Borrar selección'}</button>`;

      // Bind remove-one buttons
      selectedDisplay.querySelectorAll('.btn-remove-ou').forEach(btn => {
        btn.onclick = (ev) => {
          ev.stopPropagation();
          const dn = btn.dataset.dn;
          state.selectedOUs = (state.selectedOUs || []).filter(item => item !== dn);
          state.ouDN = state.selectedOUs[0] || '';
          if (dnInput) dnInput.value = JSON.stringify(state.selectedOUs);
          treeContainer.innerHTML = App.ouPickerTreeHTML(
            this.ousTreeCache, searchInput?.value || '', state.selectedOUs
          );
          bindNodes();
          renderSelectedDisplay();
        };
      });

      // Bind clear-all button
      const clearBtn = document.getElementById('btn-clear-ou');
      if (clearBtn) {
        clearBtn.onclick = (ev) => {
          ev.stopPropagation();
          state.selectedOUs = [];
          state.ouDN = '';
          if (dnInput) dnInput.value = '[]';
          treeContainer.innerHTML = App.ouPickerTreeHTML(
            this.ousTreeCache, searchInput?.value || '', []
          );
          bindNodes();
          renderSelectedDisplay();
        };
      }
    };

    const bindNodes = () => {
      // Toggle expand/collapse
      treeContainer.querySelectorAll('.tree-toggle:not(.empty)').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const li = btn.closest('.tree-item');
          const children = li.querySelector('.tree-children');
          if (children) {
            children.classList.toggle('collapsed');
            btn.classList.toggle('expanded');
          }
        };
      });

      // Click to select (toggle: clicking already-selected OU deselects it)
      treeContainer.querySelectorAll('.tree-node').forEach(node => {
        node.onclick = (e) => {
          if (e.target.closest('.tree-toggle')) return;
          const dn = node.dataset.dn;
          const current = Array.isArray(state.selectedOUs) ? state.selectedOUs : [];
          state.selectedOUs = current.includes(dn)
            ? current.filter(item => item !== dn)
            : [...current, dn];
          state.ouDN = state.selectedOUs[0] || '';
          if (dnInput) dnInput.value = JSON.stringify(state.selectedOUs);
          treeContainer.innerHTML = App.ouPickerTreeHTML(
            this.ousTreeCache, searchInput?.value || '', state.selectedOUs
          );
          bindNodes();
          renderSelectedDisplay();
        };
      });
    };

    bindNodes();
    renderSelectedDisplay();

    if (searchInput) {
      searchInput.oninput = () => {
        treeContainer.innerHTML = App.ouPickerTreeHTML(
          this.ousTreeCache, searchInput.value, state.selectedOUs || []
        );
        bindNodes();
      };
    }
  },

  flattenOUs(roots, depth = 0, flat = []) {
    for (const root of roots) {
      flat.push({ ...root, depth });
      if (root.children && root.children.length) {
        this.flattenOUs(root.children, depth + 1, flat);
      }
    }
    return flat;
  },

  async generatePreview(state) {
    const preview = document.getElementById('script-preview');
    try {
      const templateDefinition = await this.fetchTemplateDefinition(state.template);
      state.templateDefinition = templateDefinition || state.templateDefinition || null;
      const script = await window.api.scripts.generate({
        name: state.name,
        template: state.template,
        silentArgs: state.silentArgs,
        configXmlPath: state.configXmlPath,
        customParams: state.customParams,
        templateFiles: state.templateFiles,
        templateDefinition: templateDefinition || state.templateDefinition || null
      });
      preview.textContent = script;
    } catch (err) {
      preview.textContent = '# ' + t('apps.errorGeneratingScript') + ' ' + err.message;
    }
  },

  async finishWizard(state, isEdit, existingApp, renderWizard) {
    if (!state.name.trim()) {
      App.toast(t('apps.nameRequired'), 'warning');
      return;
    }

    // Check for duplicate name
    const allApps = await window.api.apps.getAll();
    const duplicate = allApps.find(a =>
      a.name.toLowerCase() === state.name.trim().toLowerCase() &&
      (!isEdit || a.id !== existingApp?.id)
    );
    if (duplicate) {
      App.toast(t('apps.nameDuplicate').replace('{name}', state.name.trim()), 'error');
      return;
    }

    // Show confirmation modal with all details before proceeding
    await this.showWizardConfirmation(state, isEdit, existingApp, renderWizard);
  },

  async showWizardConfirmation(state, isEdit, existingApp, renderWizard) {
    const templates = await window.api.scripts.getTemplates();
    const config = await window.api.config.get().catch(() => ({}));
    const templateInfo = templates.find(tmpl => tmpl.id === state.template)
      || (state.templateDefinition ? { name: state.templateDefinition.name } : { name: state.template });

    const row = (label, value) => value ? `
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
        <span style="color:var(--text-muted); font-size:13px;">${label}</span>
        <span style="color:var(--text-primary); font-size:13px; font-weight:500; text-align:right; max-width:60%; word-break:break-all;">${value}</span>
      </div>` : '';

    const ouNameFromDN = (dn) => {
      const match = (dn || '').match(/^OU=([^,]+)/i);
      return match ? match[1] : dn;
    };

    const installerType = state.template === 'winget' ? 'WINGET'
      : state.template === 'odt' ? 'ODT'
      : this.getInstallerTypeFromPath(state.installerPath, state.template).toUpperCase();
    const sanitizedAppFolder = String(state.name || '').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    const wingetScriptPath = state.template === 'winget'
      ? (existingApp?.deployedPath
        || (config?.networkSharePath && sanitizedAppFolder
          ? config.networkSharePath.replace(/[\\/]+$/, '') + '\\' + sanitizedAppFolder + '\\install.ps1'
          : ''))
      : '';
    const gpoDisplay = state.createGPO
      ? `<span style="color:var(--primary-color);">✨ ${t('apps.confirmAutoGpo')}: Deploy_${this.esc(state.name.trim().replace(/\s/g, '_'))}</span>`
      : (state.gpoName ? this.esc(state.gpoName) : `<span style="color:var(--text-muted);">${t('apps.confirmNoGpo')}</span>`);

    const paramsHtml = state.customParams && Object.keys(state.customParams).length > 0
      ? Object.entries(state.customParams)
          .filter(([, v]) => v !== '' && v !== undefined && v !== null)
          .map(([k, v]) => row(this.esc(k), this.esc(String(v)))).join('')
      : '';
    const templateFilesHtml = state.templateFiles && Object.keys(state.templateFiles).length > 0
      ? Object.entries(state.templateFiles)
          .filter(([, v]) => (v?.sourcePath || v))
          .map(([k, v]) => row(this.esc(k), '<span style="font-family:monospace; font-size:12px;">' + this.esc(v?.sourcePath || v) + '</span>')).join('')
      : '';

    const body = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="padding:12px; background:rgba(30,144,255,0.08); border:1px solid rgba(30,144,255,0.2); border-radius:8px;">
          <p style="margin:0; color:var(--text-secondary); font-size:13px;">
            ${t('apps.confirmIntro')}
          </p>
        </div>

        <!-- Header -->
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:10px; background:var(--accent-primary-dim); display:flex; align-items:center; justify-content:center; font-size:24px;">
            ${this.templateIcon(state.template)}
          </div>
          <div>
            <div style="font-size:17px; font-weight:700; color:var(--text-primary);">${this.esc(state.name.trim())}</div>
            <div style="font-size:12px; color:var(--text-muted);">${this.esc(templateInfo.name)}</div>
          </div>
        </div>

        <!-- General -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionGeneral')}</div>
          ${row(t('apps.detailTemplate'), this.esc(templateInfo.name))}
          ${state.template === 'winget'
            ? row('Winget ID', `<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">${this.esc(state.wingetId || '-')}</code>`)
            : state.template === 'odt'
              ? row('Producto ODT', `<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">${this.esc((state.odtConfig?.product || 'O365BusinessRetail') + ' · ' + (state.odtConfig?.channel || 'MonthlyEnterprise'))}</code>`)
              : row(t('apps.detailInstallerType'), installerType)
          }
          ${(state.template !== 'winget' && state.template !== 'odt') ? row(t('apps.detailSilentArgs'), state.silentArgs ? '<code style="background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-size:12px;">' + this.esc(state.silentArgs) + '</code>' : '-') : ''}
          ${row(t('apps.detailVersion'), this.esc(state.version || '1.0.0'))}
          ${row(t('apps.detailNotifyUser'), state.notifyUser ? '&#10003;' : '&#10007;')}
        </div>

        <!-- Paths -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionPaths')}</div>
          ${state.template === 'winget'
            ? row(t('apps.script'), wingetScriptPath ? '<span style="font-family:monospace; font-size:12px;">' + this.esc(wingetScriptPath) + '</span>' : '')
            : row(t('apps.detailInstaller'), state.installerPath ? '<span style="font-family:monospace; font-size:12px;">' + this.esc(state.installerPath) + '</span>' : '-')}
          ${state.configXmlPath ? row(t('apps.detailConfigXml'), '<span style="font-family:monospace; font-size:12px;">' + this.esc(state.configXmlPath) + '</span>') : ''}
          ${templateFilesHtml}
        </div>

        <!-- Targeting -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionTargeting')}</div>
          ${row(t('apps.detailGpo'), gpoDisplay)}
          ${row(
            t('apps.detailAssignedOUs'),
            (state.selectedOUs && state.selectedOUs.length > 0)
              ? state.selectedOUs.map(dn => '<div title="' + this.esc(dn) + '" style="margin:2px 0;">' + this.esc(ouNameFromDN(dn)) + '</div>').join('')
              : '<span style="color:var(--text-muted);">' + t('apps.detailNoOUs') + '</span>'
          )}
        </div>

        ${paramsHtml ? `
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionParams')}</div>
          ${paramsHtml}
        </div>
        ` : ''}
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="btn-confirm-back">${t('apps.back')}</button>
      <div style="flex:1"></div>
      <button class="btn btn-success" id="btn-confirm-create">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        ${isEdit ? t('apps.saveAndDeploy') : t('apps.create')}
      </button>
    `;

    App.openModal(t('apps.confirmTitle'), body, footer);

    document.getElementById('btn-confirm-back').addEventListener('click', () => {
      // Re-render the wizard at step 4 preserving state
      if (typeof renderWizard === 'function') {
        renderWizard();
      } else {
        App.closeModal();
      }
    });

    document.getElementById('btn-confirm-create').addEventListener('click', () => {
      this.performWizardCreate(state, isEdit, existingApp);
    });
  },

  async performWizardCreate(state, isEdit, existingApp) {
    try {
      const deployBtn = document.getElementById('btn-confirm-create');
      if (deployBtn) {
        deployBtn.style.width = deployBtn.offsetWidth + 'px';
        deployBtn.style.height = deployBtn.offsetHeight + 'px';
        deployBtn.disabled = true;
        deployBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>';
      }
      const backBtn = document.getElementById('btn-confirm-back');
      if (backBtn) backBtn.disabled = true;

      const templateDefinition = await this.fetchTemplateDefinition(state.template);
      state.templateDefinition = templateDefinition || state.templateDefinition || null;

      const appData = {
        name: state.name.trim(),
        template: state.template,
        installerType: this.getInstallerTypeFromPath(state.installerPath, state.template),
        silentArgs: state.silentArgs,
        installerPath: state.installerPath,
        configXmlPath: state.configXmlPath,
        customParams: state.customParams,
        templateFiles: state.templateFiles,
        templateDefinition: state.templateDefinition,
        gpoName: state.gpoName,
        ouDN: state.selectedOUs?.[0] || '',
        assignedOUs: Array.isArray(state.selectedOUs) ? state.selectedOUs : [],
        version: state.version || '1.0.0',
        notifyUser: state.notifyUser || false
      };

      // Include wingetId for winget templates
      if (state.template === 'winget' && state.wingetId) {
        try {
          const resolvedWinget = await window.api.catalog.resolvePackage({
            wingetId: state.wingetId,
            wingetSource: state.wingetSource || 'winget',
            name: state.name.trim()
          });
          if (resolvedWinget?.available && resolvedWinget.wingetId) {
            appData.wingetId = resolvedWinget.wingetId;
            appData.wingetSource = resolvedWinget.wingetSource || state.wingetSource || 'winget';
            if (!state.version && resolvedWinget.latestVersion) {
              appData.version = resolvedWinget.latestVersion;
            }
          } else {
            appData.wingetId = state.wingetId;
            appData.wingetSource = state.wingetSource || 'winget';
          }
        } catch {
          appData.wingetId = state.wingetId;
          appData.wingetSource = state.wingetSource || 'winget';
        }
      }
      // Include odtConfig for ODT templates
      if (state.template === 'odt' && state.odtConfig) {
        appData.odtConfig = state.odtConfig;
      }

      let app;
      if (isEdit && existingApp) {
        app = await window.api.apps.update(existingApp.id, appData);
      } else {
        app = await window.api.apps.create(appData);
      }

      if (!app || !app.id) {
        App.toast(t('common.error') + ': Failed to save app', 'error');
        return;
      }

      // Deploy script (Copies files to network share too)
      const deployResult = await window.api.scripts.deploy({
        ...appData,
        id: app.id
      });

      if (deployResult.success) {
        // Mark as deployed with hash for version tracking
        await window.api.apps.update(app.id, {
          deployed: true,
          deployedPath: deployResult.path,
          lastDeployHash: deployResult.hash || ''
        });
        // Log activity
        await window.api.activity.add(isEdit ? 'app_update' : 'app_create', {
          appName: state.name, version: state.version, template: state.template
        });
        App.toast(t('apps.appCreated'), 'success');
        App.toast(t('apps.deploySuccess'), 'success');

        // Create GPO automatically if chosen
        if (state.createGPO) {
          const newGpoName = `Deploy_${state.name.replace(/\s/g, "_")}`;
          await this._handleAutoGPO(newGpoName, deployResult.path, state.selectedOUs || [], app.id);
        } else if (state.gpoName && Array.isArray(state.selectedOUs) && state.selectedOUs.length > 0 && App.rsatAvailable) {
          // Existing GPO: link it to all selected OUs (already-linked ones are silently skipped by AD)
          try {
            const linkResults = await window.api.ad.bulkLinkGPO(state.gpoName, state.selectedOUs);
            const failed = (linkResults || []).filter(r => !r.success);
            if (failed.length > 0) {
              App.toast(`${t('apps.gpoWarningOnlyServer')} ${failed.map(r => r.error).join(', ')}`, 'warning');
            }
          } catch (e) { /* non-fatal — script is deployed even if link fails */ }
        }
      } else {
        if (App.isShareError(deployResult.error)) { App.handleShareError(); App.closeModal(); App.navigate('apps'); return; }
        App.toast(`${t('apps.appSavedDeployError')} ${deployResult.error}`, 'error');
      }

      App.closeModal();
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  copyScript() {
    const preview = document.getElementById('script-preview');
    if (preview) {
      navigator.clipboard.writeText(preview.textContent);
      App.toast(t('apps.scriptCopied'), 'success');
    }
  },

  // ─── GPO conflict handler ──────────────────────────
  // Called when "Create GPO automatically" is checked. If the GPO name already
  // exists in AD (and follows the program's naming convention), asks the user
  // what to do before proceeding.
  async _handleAutoGPO(gpoName, scriptPath, ouDNs, appId) {
    const isOwnGPO = /^(Deploy_|ADDM_)/.test(gpoName);

    // Check existence only for GPOs the program creates
    if (isOwnGPO && App.rsatAvailable) {
      let existsResult = { exists: false };
      try { existsResult = await window.api.ad.checkGPOExists(gpoName); } catch (e) {}

      if (existsResult.exists) {
        const choice = await new Promise(resolve => {
          App.openModal(
            t('apps.gpoConflictTitle') || 'GPO ya existe',
            `<div style="display:flex;flex-direction:column;gap:12px;">
              <div style="padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--accent-warning);">⚠ ${this.esc(gpoName)}</strong><br>
                ${t('apps.gpoConflictBody') || 'Esta GPO ya existe en Active Directory. Fue creada por este programa.'}
              </div>
              <p style="font-size:13px;color:var(--text-muted);margin:0;">${t('apps.gpoConflictQuestion') || '¿Qué deseas hacer?'}</p>
            </div>`,
            `<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
              <button class="btn btn-secondary" id="_gpo-conflict-cancel">${t('common.cancel')}</button>
              <button class="btn btn-secondary" id="_gpo-conflict-update">${t('apps.gpoConflictUpdate') || 'Actualizar script'}</button>
              <button class="btn btn-danger" id="_gpo-conflict-replace">${t('apps.gpoConflictReplace') || 'Eliminar y recrear'}</button>
            </div>`
          );
          const pick = (val) => { App.closeModal(); resolve(val); };
          document.getElementById('_gpo-conflict-cancel').onclick  = () => pick('cancel');
          document.getElementById('_gpo-conflict-update').onclick  = () => pick('update');
          document.getElementById('_gpo-conflict-replace').onclick = () => pick('replace');
        });

        if (choice === 'cancel') {
          App.toast(t('apps.gpoConflictSkipped') || 'GPO sin cambios.', 'info');
          return;
        }
        if (choice === 'replace') {
          App.toast(`${t('apps.gpoConflictDeleting') || 'Eliminando GPO'} ${gpoName}...`, 'info');
          const delResult = await window.api.ad.deleteGPO(gpoName);
          if (!delResult.success) {
            App.toast(`${t('apps.gpoDeleteError') || 'Error al eliminar GPO:'} ${delResult.error}`, 'error');
            return;
          }
        }
        // 'update' or post-'replace' → fall through to createGPO
      }
    }

    App.toast(`${t('apps.generatingGpo')} ${gpoName}...`, 'info');
    const gpoResult = await window.api.ad.createGPO(gpoName, scriptPath, ouDNs);
    if (gpoResult.success) {
      await window.api.apps.update(appId, { gpoName });
      App.toast(t('apps.gpoCreatedSuccess').replace('{gpo}', gpoName), 'success');
      this.gposCache = null;
    } else {
      App.toast(`${t('apps.gpoWarningOnlyServer')} ${gpoResult.error}`, 'warning');
    }
  },

  // ─── Actions ───────────────────────────────────────
  async previewScript(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const script = await window.api.scripts.generate(app);

    App.openModal(`Script: ${app.name}`, `
      <div class="code-header">
        <span>📄 install.ps1</span>
        <button class="btn btn-ghost btn-sm" onclick="AppsPage.copyScript()">${t('apps.copyBtn')}</button>
      </div>
      <pre class="code-preview" id="script-preview">${this.esc(script)}</pre>
    `);
  },

  async deployApp(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    try {
      const result = await window.api.scripts.deploy(app);
      if (result.success) {
        await window.api.apps.update(id, { deployed: true, deployedPath: result.path });
        App.toast(t('apps.deployedToPath').replace('{app}', app.name).replace('{path}', result.path), 'success');
        App.navigate('apps');
      } else {
        if (App.isShareError(result.error)) { App.handleShareError(); return; }
        App.toast(`Error: ${result.error}`, 'error');
      }
    } catch (err) {
      App.toast(t('apps.deployError') + ' ' + err.message, 'error');
    }
  },

  async disableDeploy(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const hasGPO = !!app.gpoName;
    const hasOUs = app.assignedOUs && app.assignedOUs.length > 0;

    App.openModal(t('apps.disableConfirm'), `
      <p>${t('apps.disableMsg').replace('{app}', `<strong>${this.esc(app.name)}</strong>`)}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--warning-color); font-weight:600;">⚠️ Esta app tiene la GPO "${this.esc(app.gpoName)}" asignada</p>
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
          freshApp.gpoName = deleteGPO ? '' : app.gpoName;
          freshApp.assignedOUs = (unlinkGPO || deleteGPO) ? [] : app.assignedOUs;
          await window.api.apps.create(freshApp);
          await window.api.activity.add('app_disable', { appName: app.name, deletedFiles: true, deletedGPO: deleteGPO });
        } else {
          // Just update the app status
          const updateData = { deployed: false, deployedPath: '' };
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
            ${t('apps.deleteMsg').replace('{app}', `<strong>${this.esc(app.name)}</strong>`)}
          </div>
        </div>
        ${this.renderDeleteTargetCard({
          icon: this.templateIcon(app.template),
          title: app.name,
          subtitle: app.gpoName ? `GPO: ${this.esc(app.gpoName)}` : ''
        })}
        ${hasGPO && hasOUs ? this.renderDeleteOptionCard({
          id: 'chk-del-unlink-gpo',
          checked: true,
          title: t('apps.cleanGpoOption'),
          hint: this.tr('apps.cleanGpoOptionHint', 'Quita la vinculacion de la GPO en las OUs asignadas')
        }) : ''}
        ${hasGPO ? this.renderDeleteOptionCard({
          id: 'chk-del-clean-script',
          checked: true,
          title: t('apps.cleanSysvolOption'),
          hint: this.tr('apps.cleanSysvolOptionHint', 'Elimina el script de inicio asociado en SYSVOL')
        }) : ''}
        ${hasGPO ? this.renderDeleteOptionCard({
          id: 'chk-del-delete-gpo',
          checked: true,
          title: t('apps.deleteGpoOption'),
          hint: this.tr('apps.deleteGpoOptionHint', 'Borra la GPO de Active Directory si ya no se necesita')
        }) : ''}
        ${this.renderDeleteOptionCard({
          id: 'chk-delete-files',
          checked: true,
          title: t('apps.keepFilesOption'),
          hint: this.tr('apps.keepFilesOptionHint', 'Desmarca esta opcion si tambien quieres borrar la carpeta del share')
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

  tr(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  },

  async resolveCatalogPackageSelection(state, renderWizard, reference) {
    if (!reference?.wingetId) return;

    state._catalogResolutionToken = (state._catalogResolutionToken || 0) + 1;
    const token = state._catalogResolutionToken;
    const selectedVersion = String(reference.version || '');
    const selectedName = String(reference.name || '');
    const selectedSource = reference.wingetSource || 'winget';

    try {
      const resolved = await window.api.catalog.resolvePackage({
        wingetId: reference.wingetId,
        wingetSource: selectedSource,
        name: selectedName
      });

      if (state._catalogResolutionToken !== token) return;
      if (state.template !== 'winget') return;
      if (!resolved?.available || !resolved.wingetId) return;

      const currentKey = `${state.wingetId || ''}|${state.wingetSource || 'winget'}`;
      const originalKey = `${reference.wingetId || ''}|${selectedSource}`;
      const resolvedKey = `${resolved.wingetId || ''}|${resolved.wingetSource || selectedSource}`;
      if (currentKey !== originalKey && currentKey !== resolvedKey) return;

      const canReplaceName = !state.name || state.name === selectedName || state.name === 'Microsoft Office';
      const canReplaceVersion = !state.version || state.version === '1.0.0' || (selectedVersion && state.version === selectedVersion);

      state.wingetId = resolved.wingetId;
      state.wingetSource = resolved.wingetSource || selectedSource;
      if (canReplaceName && resolved.name) state.name = resolved.name;
      if (resolved.latestVersion && canReplaceVersion) state.version = resolved.latestVersion;

      if (state.step <= 2) renderWizard();
    } catch {
      // Non-blocking: keep the original catalog selection if resolution fails.
    }
  },

  describeTemplateFile(fileField) {
    const parts = [];
    if (this.isInstallerTemplateFile(fileField)) {
      parts.push(this.tr('apps.customTemplateFileTypeInstaller', 'Instalador adjunto'));
    }
    const extensions = Array.isArray(fileField?.extensions) ? fileField.extensions : [];
    if (extensions.length > 0) {
      parts.push(this.tr('apps.customTemplateExtensions', 'Extensiones') + ': ' + extensions.join(', '));
    }
    if (fileField?.argumentName) {
      parts.push(this.tr('apps.customTemplateArgLabel', 'Argumento') + ': ' + fileField.argumentName);
    }
    if (fileField?.destinationName) {
      parts.push(this.tr('apps.customTemplateTargetName', 'Destino') + ': ' + fileField.destinationName);
    }
    return parts.join(' | ') || this.tr('apps.customTemplateConfigFile', 'Archivo de configuracion auxiliar');
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
        label: this.tr('apps.customTemplateXmlLabel', 'Archivo XML'),
        hint: this.tr('apps.customTemplateXmlHint', 'XML solicitado por la plantilla. Se copiara al cache del equipo cliente y el script podra usar $ConfigXmlPath.'),
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
      description: definition.description || this.tr('apps.customTemplateDefaultDesc', 'Plantilla definida por el administrador'),
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

  renderTemplateManager(state, onClose) {
    const draft = state.draft || this.createEmptyTemplateDraft();
    const templates = Array.isArray(state.templates) ? state.templates : [];
    const builtInTemplates = Array.isArray(state.builtInTemplates) ? state.builtInTemplates : [];
    const templateInstallers = state.templateInstallers || {};
    const deleteUsageCount = Number.isFinite(state.deleteUsageCount) ? state.deleteUsageCount : 0;

    const builtInListHtml = builtInTemplates.map(tmpl => {
      const hasInstaller = !!templateInstallers[tmpl.id];
      const isActive = state.selectedBuiltIn === tmpl.id;
      return `
        <button class="template-manager-item ${isActive ? 'active' : ''}" type="button" data-builtin-id="${this.esc(tmpl.id)}">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:14px;">${this.templateIcon(tmpl.id)}</span>
            <div style="font-weight:600;color:var(--text-primary);font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.esc(tmpl.name)}</div>
            ${hasInstaller ? `<span style="font-size:9px;background:rgba(34,197,94,.15);color:var(--accent-success,#22c55e);padding:1px 5px;border-radius:3px;flex-shrink:0;">✓</span>` : ''}
          </div>
        </button>`;
    }).join('');

    const userListHtml = templates.length > 0
      ? templates.map(template => {
          const hasInstaller = !!templateInstallers[template.id];
          return `
          <button class="template-manager-item ${state.selectedId === template.id ? 'active' : ''}" type="button" data-template-id="${this.esc(template.id)}">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="font-weight:600;color:var(--text-primary);font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.esc(template.name)}</div>
              ${hasInstaller ? `<span style="font-size:9px;background:rgba(34,197,94,.15);color:var(--accent-success,#22c55e);padding:1px 5px;border-radius:3px;flex-shrink:0;">✓</span>` : ''}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${this.esc(template.description || this.tr('apps.customTemplateDefaultDesc', 'Plantilla definida por el administrador'))}</div>
          </button>`;
        }).join('')
      : `<div style="padding:14px;border:1px dashed var(--border-color);border-radius:8px;color:var(--text-muted);font-size:12px;">${this.tr('apps.customTemplatesEmpty', 'Todavia no hay plantillas personalizadas.')}</div>`;

    const argumentRows = draft.arguments.map((arg, index) => `
      <div class="tmpl-arg-row" data-index="${index}" style="border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:10px;background:var(--bg-secondary);">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateFieldLabel', 'Etiqueta')}</label>
            <input class="form-input" data-field="label" value="${this.esc(arg.label)}" placeholder="Valor de configuracion">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateArgLabel', 'Argumento')}</label>
            <input class="form-input" data-field="token" value="${this.esc(arg.token)}" placeholder="CONFIG_ID">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateHintLabel', 'Ayuda')}</label>
            <input class="form-input" data-field="hint" value="${this.esc(arg.hint)}" placeholder="${this.esc(this.tr('apps.customTemplateHintPlaceholder', 'Texto mostrado al operador'))}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateDefaultValue', 'Valor por defecto')}</label>
            <input class="form-input" data-field="default" value="${this.esc(arg.defaultValue)}" placeholder="">
          </div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;">
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" data-field="quote" ${arg.quoteValue !== false ? 'checked' : ''}>
            <span>${this.tr('apps.customTemplateQuoteValue', 'Entrecomillar valor')}</span>
          </label>
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" data-field="required" ${arg.required ? 'checked' : ''}>
            <span>${this.tr('apps.customTemplateRequired', 'Obligatorio')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:12px;">
            <span>${this.tr('apps.customTemplateJoiner', 'Separador')}</span>
            <select class="form-select" data-field="joiner" style="width:auto;min-width:110px;">
              <option value="=" ${arg.joiner !== 'space' ? 'selected' : ''}>=</option>
              <option value="space" ${arg.joiner === 'space' ? 'selected' : ''}>espacio</option>
            </select>
          </label>
          <button class="btn btn-ghost btn-sm btn-remove-template-arg" type="button" data-index="${index}">${this.tr('common.delete', 'Borrar')}</button>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">${this.tr('apps.customTemplateArgExample', 'Resultado')}: <code class="tmpl-arg-preview">${this.esc(this.getTemplateArgPreview(arg))}</code></div>
      </div>
    `).join('');

    const fileRows = draft.files.map((file, index) => `
      <div class="tmpl-file-row" data-index="${index}" style="border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:10px;background:var(--bg-secondary);">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateFieldLabel', 'Etiqueta')}</label>
            <input class="form-input" data-field="label" value="${this.esc(file.label)}" placeholder="${this.esc(this.isInstallerTemplateFile(file) ? 'Instalador adicional' : 'Archivo de configuracion')}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateExtensions', 'Extensiones')}</label>
            <input class="form-input" data-field="extensions" value="${this.esc(file.extensions)}" placeholder="${this.esc(this.isInstallerTemplateFile(file) ? 'exe,msi,ps1' : 'xml,json')}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateFileType', 'Tipo')}</label>
            <select class="form-select" data-field="storageKind">
              <option value="file" selected>${this.tr('apps.customTemplateFileTypeFile', 'Archivo auxiliar')}</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateInstallArg', 'Argumento de instalacion')}</label>
            <input class="form-input" data-field="argument" value="${this.esc(file.argumentName)}" placeholder="/configure">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateTargetName', 'Nombre destino')}</label>
            <input class="form-input" data-field="destination" value="${this.esc(file.destinationName)}" placeholder="${this.esc(this.isInstallerTemplateFile(file) ? 'helper_setup.exe' : 'config_app.xml')}">
          </div>
          <div class="form-group" style="margin-bottom:0;grid-column:1 / -1;">
            <label class="form-label">${this.tr('apps.customTemplateHintLabel', 'Ayuda')}</label>
            <input class="form-input" data-field="hint" value="${this.esc(file.hint)}" placeholder="${this.esc(this.isInstallerTemplateFile(file)
              ? this.tr('apps.customTemplateInstallerHintPlaceholder', 'Ejemplo: instalador auxiliar que se copiara al share sin sustituir al principal')
              : this.tr('apps.customTemplateFileHintPlaceholder', 'Ejemplo: XML o CFG exportado desde la herramienta original'))}">
          </div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;">
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" data-field="quote" ${file.quoteValue !== false ? 'checked' : ''}>
            <span>${this.tr('apps.customTemplateQuotePath', 'Entrecomillar ruta')}</span>
          </label>
          <label class="checkbox-wrapper" style="margin:0;">
            <input type="checkbox" data-field="required" ${file.required ? 'checked' : ''}>
            <span>${this.tr('apps.customTemplateRequired', 'Obligatorio')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:12px;">
            <span>${this.tr('apps.customTemplateJoiner', 'Separador')}</span>
            <select class="form-select" data-field="joiner" style="width:auto;min-width:110px;">
              <option value="=" ${file.joiner !== 'space' ? 'selected' : ''}>=</option>
              <option value="space" ${file.joiner === 'space' ? 'selected' : ''}>espacio</option>
            </select>
          </label>
          <button class="btn btn-ghost btn-sm btn-remove-template-file" type="button" data-index="${index}">${this.tr('common.delete', 'Borrar')}</button>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">${this.isInstallerTemplateFile(file)
          ? this.tr('apps.customTemplateInstallerExample', 'El instalador adjunto se copiara al share en una carpeta separada y el script recibira su ruta cacheada en el equipo cliente.')
          : this.tr('apps.customTemplateFileExample', 'Si defines un argumento, el instalador recibira la ruta cacheada del archivo en el equipo cliente.')}: <code class="tmpl-file-preview">${this.esc(this.getTemplateFilePreview(file))}</code></div>
      </div>
    `).join('');

    const deletePanel = state.deleteConfirm && state.selectedId ? `
      <div class="card template-builder-section" style="border-color:rgba(220,38,38,0.28);background:rgba(220,38,38,0.08);">
        <div style="font-weight:700;color:var(--text-primary);margin-bottom:8px;">${this.tr('apps.customTemplateDeleteTitle', 'Borrar plantilla')}</div>
        <p class="form-hint" style="margin:0 0 10px 0;color:var(--text-secondary);">
          ${this.tr('apps.customTemplateDeleteConfirm', 'Seguro que quieres borrar esta plantilla personalizada?')}
        </p>
        ${deleteUsageCount > 0 ? `<p class="form-hint" style="margin:0 0 12px 0;color:var(--accent-warning);">${this.tr('apps.customTemplateDeleteWarning', 'Hay apps usando esta plantilla:')} ${deleteUsageCount}. ${this.tr('apps.customTemplateDeleteSnapshotHint', 'Las apps ya creadas conservaran su configuracion guardada, pero la plantilla dejara de estar disponible para nuevas apps.')}</p>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary" type="button" id="btn-cancel-delete-template">${this.tr('common.cancel', 'Cancelar')}</button>
          <button class="btn btn-danger" type="button" id="btn-confirm-delete-template">${this.tr('apps.customTemplateDeleteAction', 'Eliminar plantilla')}</button>
        </div>
      </div>
    ` : '';

    // Shared installer config panel
    const activeTemplateId = state.selectedBuiltIn || state.selectedId || null;
    const currentInstallerPath = activeTemplateId ? (templateInstallers[activeTemplateId] || '') : '';
    const installerFileName = currentInstallerPath ? currentInstallerPath.replace(/.*[\\/]/, '') : '';
    const installerPanel = `
      <div class="card template-builder-section" style="border-color:rgba(30,144,255,0.25);background:rgba(30,144,255,0.04);">
        <div style="font-weight:700;color:var(--text-primary);margin-bottom:6px;">📦 Instalador preconfigurado</div>
        <p class="form-hint" style="margin:0 0 10px 0;">Si adjuntas el instalador aqui, se completara automaticamente cada vez que alguien cree una app con esta plantilla.</p>
        ${currentInstallerPath ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.35);border-radius:6px;padding:4px 10px;margin-bottom:10px;font-size:12px;color:#16a34a;max-width:100%;overflow:hidden;">
          <span style="flex-shrink:0;">✓</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;" title="${this.esc(currentInstallerPath)}">${this.esc(installerFileName)}</span>
        </div>` : ''}
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="form-input" id="tmpl-installer-path" value="${this.esc(currentInstallerPath)}" placeholder="Sin instalador preconfigurado" readonly style="flex:1;font-family:monospace;font-size:12px;">
          <button class="btn btn-secondary btn-sm" type="button" id="btn-browse-tmpl-installer">Seleccionar</button>
          ${currentInstallerPath ? `<button class="btn btn-ghost btn-sm" type="button" id="btn-clear-tmpl-installer">✕</button>` : ''}
        </div>
        <div id="tmpl-installer-status" style="display:none;margin-top:10px;padding:8px 12px;border-radius:6px;font-size:13px;"></div>
      </div>`;

    // Built-in template view (read-only, just installer config)
    const selectedBuiltInInfo = state.selectedBuiltIn ? builtInTemplates.find(t => t.id === state.selectedBuiltIn) : null;
    const builtInView = selectedBuiltInInfo ? `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border-color);">
        <span style="font-size:32px;">${this.templateIcon(selectedBuiltInInfo.id)}</span>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text-primary);">${this.esc(selectedBuiltInInfo.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${this.esc(selectedBuiltInInfo.description || '')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;opacity:.7;">Plantilla del sistema · Solo lectura</div>
        </div>
      </div>
      ${installerPanel}
    ` : '';

    const body = `
      <div class="template-manager-shell">
        <div class="template-manager-sidebar">
          ${builtInTemplates.length > 0 ? `
            <button type="button" id="btn-toggle-system-section" style="display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:4px 4px 6px;margin-bottom:2px;">
              <span style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;font-weight:600;">Sistema</span>
              <svg id="icon-system-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);transform:${state.systemExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};transition:transform .2s;"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="system-section-list" style="display:${state.systemExpanded ? 'block' : 'none'};">
              ${builtInListHtml}
            </div>
            <div style="height:1px;background:var(--border-color);margin:8px 0;"></div>
          ` : ''}
          <div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;padding:4px 4px 6px;font-weight:600;">Personalizadas</div>
          <button class="btn btn-primary" type="button" id="btn-new-template" style="width:100%;margin-bottom:8px;">${this.tr('apps.newCustomTemplate', 'Nueva plantilla')}</button>
          ${userListHtml}
        </div>
        <div class="template-manager-main">
          ${state.selectedBuiltIn ? builtInView : `
          ${deletePanel}
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateName', 'Nombre de la plantilla')}</label>
            <input class="form-input" id="tmpl-name" value="${this.esc(draft.name)}" placeholder="Plantilla personalizada">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">${this.tr('apps.customTemplateDescription', 'Descripcion')}</label>
            <textarea class="form-input" id="tmpl-description" rows="2" placeholder="${this.esc(this.tr('apps.customTemplateDescriptionPlaceholder', 'Explica que hace esta plantilla y que espera del operador.'))}">${this.esc(draft.description)}</textarea>
          </div>
          ${installerPanel}
          <div class="card template-builder-section">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="font-weight:700;color:var(--text-primary);">${this.tr('apps.customTemplateArgsTitle', 'Argumentos')}</div>
              <button class="btn btn-secondary btn-sm" type="button" id="btn-add-template-arg">${this.tr('apps.customTemplateAddArg', 'Anadir argumento')}</button>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${this.tr('apps.customTemplateArgsHint', 'Cada argumento crea un campo de texto en la app y se traduce a `ARGUMENTO=\"valor\"` o `ARGUMENTO valor`.')}</div>
            ${argumentRows || `<div style="color:var(--text-muted);font-size:12px;">${this.tr('apps.customTemplateArgsEmpty', 'No hay argumentos definidos.')}</div>`}
          </div>
          <div class="card template-builder-section">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="font-weight:700;color:var(--text-primary);">${this.tr('apps.customTemplateFilesTitle', 'Archivos auxiliares')}</div>
              <button class="btn btn-secondary btn-sm" type="button" id="btn-add-template-file">${this.tr('apps.customTemplateAddFile', 'Anadir archivo')}</button>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${this.tr('apps.customTemplateFilesHint', 'Sirve para XML, CFG, JSON o instaladores adjuntos. Si anades aqui un XML, se pedira al crear la app y el script podra usar $ConfigXmlPath. Los instaladores adjuntos se guardan en el share sin sustituir al instalador principal. Si defines un argumento de instalacion, se pasara la ruta del archivo copiado al cache de despliegue.')}</div>
            ${fileRows || `<div style="color:var(--text-muted);font-size:12px;">${this.tr('apps.customTemplateFilesEmpty', 'No hay archivos definidos.')}</div>`}
          </div>
          <div class="card template-builder-section">
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:10px;">${this.tr('apps.customTemplateScriptTitle', 'Script opcional post-instalacion')}</div>
            <textarea class="form-input" id="tmpl-script" rows="8" style="font-family:monospace;" placeholder="${this.esc(this.tr('apps.customTemplateScriptPlaceholder', 'Ejemplo:\nWrite-Host "Configuracion adicional aplicada"'))}">${this.esc(draft.script)}</textarea>
            <p class="form-hint" style="margin-top:8px;">${this.tr('apps.customTemplateScriptHint', 'Variables disponibles: $TemplateValues.<clave>, $TemplateFiles.<clave>, $TemplateFileNames.<clave>, $ConfigXmlPath (si la plantilla incluye un XML), $Instalador y $CacheDir. Este script se ejecuta despues del instalador.')}</p>
          </div>
          `}
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" type="button" id="btn-close-template-manager">${this.tr('common.close', 'Cerrar')}</button>
      <div style="flex:1"></div>
      ${!state.selectedBuiltIn && state.selectedId ? `<button class="btn btn-danger" type="button" id="btn-delete-template">${this.tr('common.delete', 'Borrar')}</button>` : ''}
      ${!state.selectedBuiltIn ? `<button class="btn btn-success" type="button" id="btn-save-template">${this.tr('common.save', 'Guardar')}</button>` : ''}
      ${state.selectedBuiltIn ? `<button class="btn ${state.installerSaved ? 'btn-secondary' : 'btn-success'}" type="button" id="btn-save-tmpl-installer">${state.installerSaved ? this.tr('common.close', 'Cerrar') : 'Guardar instalador'}</button>` : ''}
    `;

    App.openModal(this.tr('apps.manageTemplates', 'Plantillas'), body, footer, { size: 'full' });
    this.bindTemplateManagerEvents(state, onClose);
    if (!state.selectedId && !state.selectedBuiltIn) {
      requestAnimationFrame(() => document.getElementById('tmpl-name')?.focus());
    }
  },

  bindTemplateManagerEvents(state, onClose) {
    document.getElementById('btn-close-template-manager')?.addEventListener('click', async () => {
      App.closeModal();
      if (typeof onClose === 'function') await onClose();
    });

    document.getElementById('btn-new-template')?.addEventListener('click', () => {
      state.draft = this.createEmptyTemplateDraft();
      state.selectedId = null;
      state.selectedBuiltIn = null;
      state.deleteConfirm = false;
      state.deleteUsageCount = 0;
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
        this.renderTemplateManager(state, onClose);
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
        this.renderTemplateManager(state, onClose);
      });
    });

    // Browse installer button (for both built-in and user templates)
    document.getElementById('btn-browse-tmpl-installer')?.addEventListener('click', async () => {
      const file = await window.api.config.selectFile([{ name: 'Instalador (EXE/MSI)', extensions: ['exe', 'msi'] }]);
      if (!file) return;
      state.installerSaved = false; // new file selected — re-enable save button
      document.getElementById('tmpl-installer-path').value = file;
      this.renderTemplateManager(state, onClose);
    });

    document.getElementById('btn-clear-tmpl-installer')?.addEventListener('click', () => {
      const activeId = state.selectedBuiltIn || state.selectedId;
      if (!activeId) return;
      state.templateInstallers = { ...state.templateInstallers };
      delete state.templateInstallers[activeId];
      this.renderTemplateManager(state, onClose);
      window.api.config.set({ templateInstallers: state.templateInstallers }).catch(() => {});
    });

    // Save installer for built-in template (also acts as "Cerrar" after a successful save)
    document.getElementById('btn-save-tmpl-installer')?.addEventListener('click', async () => {
      if (state.installerSaved) {
        App.closeModal();
        if (onClose) await onClose();
        return;
      }
      const activeId = state.selectedBuiltIn;
      if (!activeId) return;
      const localPath = document.getElementById('tmpl-installer-path')?.value?.trim() || '';
      if (!localPath) {
        App.toast('Selecciona un instalador primero', 'warning');
        return;
      }
      const btn = document.getElementById('btn-save-tmpl-installer');
      const statusDiv = document.getElementById('tmpl-installer-status');
      const showStatus = (msg, color) => {
        if (!statusDiv) return;
        statusDiv.style.display = 'block';
        statusDiv.style.background = color === 'error' ? 'rgba(239,68,68,0.1)' : color === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)';
        statusDiv.style.border = `1px solid ${color === 'error' ? 'rgba(239,68,68,0.3)' : color === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`;
        statusDiv.style.color = color === 'error' ? '#dc2626' : color === 'success' ? '#16a34a' : 'var(--text-primary)';
        statusDiv.innerHTML = msg;
      };
      if (btn) { btn.disabled = true; btn.textContent = 'Copiando...'; }
      showStatus('<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;flex-shrink:0;"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/><path d="M21 12a9 9 0 00-9-9"/></svg>Copiando instalador al share, espera un momento...</span>', 'info');
      try {
        const result = await window.api.templates.saveInstaller(activeId, localPath);
        if (!result?.success) {
          showStatus(`<span>✗ Error al copiar: ${result?.error || 'No se pudo copiar al share'}</span>`, 'error');
          App.toast(`Error: ${result?.error || 'No se pudo copiar al share'}`, 'error');
          return;
        }
        state.templateInstallers = { ...state.templateInstallers, [activeId]: result.sharePath };
        await window.api.config.set({ templateInstallers: state.templateInstallers });
        state.installerSaved = true;
        App.toast('Instalador guardado en el share', 'success');
        this.renderTemplateManager(state, onClose);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar instalador'; }
      }
    });

    document.getElementById('btn-add-template-arg')?.addEventListener('click', () => {
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      state.draft.arguments.push({
        label: '',
        token: '',
        joiner: '=',
        quoteValue: true,
        required: false,
        hint: '',
        defaultValue: ''
      });
      this.renderTemplateManager(state, onClose);
    });

    document.querySelectorAll('.btn-remove-template-arg').forEach(btn => {
      btn.addEventListener('click', () => {
        state.draft = this.readTemplateDraftFromDom(state);
        state.deleteConfirm = false;
        state.draft.arguments.splice(Number(btn.dataset.index), 1);
        this.renderTemplateManager(state, onClose);
      });
    });

    document.getElementById('btn-add-template-file')?.addEventListener('click', () => {
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      state.draft.files.push({
        label: '',
        storageKind: 'file',
        argumentName: '',
        joiner: 'space',
        quoteValue: true,
        required: false,
        hint: '',
        destinationName: '',
        extensions: 'xml'
      });
      this.renderTemplateManager(state, onClose);
    });

    document.querySelectorAll('.btn-remove-template-file').forEach(btn => {
      btn.addEventListener('click', () => {
        state.draft = this.readTemplateDraftFromDom(state);
        state.deleteConfirm = false;
        state.draft.files.splice(Number(btn.dataset.index), 1);
        this.renderTemplateManager(state, onClose);
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

    // storageKind is now always 'file' — no change handler needed

    this.refreshTemplateDraftPreview();

    document.getElementById('btn-delete-template')?.addEventListener('click', async () => {
      if (!state.selectedId) return;
      state.draft = this.readTemplateDraftFromDom(state);
      if (state.deleteConfirm) {
        state.deleteConfirm = false;
        state.deleteUsageCount = 0;
        this.renderTemplateManager(state, onClose);
        return;
      }
      const apps = await window.api.apps.getAll().catch(() => []);
      state.deleteUsageCount = apps.filter(app => app.template === state.selectedId).length;
      state.deleteConfirm = true;
      this.renderTemplateManager(state, onClose);
    });

    document.getElementById('btn-cancel-delete-template')?.addEventListener('click', () => {
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      state.deleteUsageCount = 0;
      this.renderTemplateManager(state, onClose);
    });

    document.getElementById('btn-confirm-delete-template')?.addEventListener('click', async () => {
      if (!state.selectedId) return;
      const result = await window.api.templates.delete(state.selectedId);
      if (!result?.success) {
        App.toast((result?.error || this.tr('common.error', 'Error')), 'error');
        return;
      }

      state.templates = await window.api.templates.getAll();
      state.selectedId = null;
      state.draft = this.createEmptyTemplateDraft();
      state.deleteConfirm = false;
      state.deleteUsageCount = 0;
      App.toast(this.tr('apps.customTemplateDeleted', 'Plantilla borrada correctamente'), 'success');
      this.renderTemplateManager(state, onClose);
    });

    document.getElementById('btn-save-template')?.addEventListener('click', async () => {
      state.draft = this.readTemplateDraftFromDom(state);
      state.deleteConfirm = false;
      if (!state.draft.name.trim()) {
        App.toast(this.tr('apps.customTemplateNameRequired', 'Indica un nombre para la plantilla.'), 'warning');
        document.getElementById('tmpl-name')?.focus();
        return;
      }

      const payload = {
        name: state.draft.name,
        description: state.draft.description,
        arguments: state.draft.arguments,
        files: state.draft.files,
        script: state.draft.script
      };

      const saved = state.selectedId
        ? await window.api.templates.update(state.selectedId, payload)
        : await window.api.templates.create(payload);

      if (!saved?.id) {
        App.toast(this.tr('apps.customTemplateSaveError', 'No se pudo guardar la plantilla.'), 'error');
        return;
      }

      // Save pre-configured installer (copy to share if local path selected)
      const installerInputPath = document.getElementById('tmpl-installer-path')?.value?.trim() || '';
      if (installerInputPath) {
        const currentSharePath = state.templateInstallers[saved.id] || '';
        const isAlreadyOnShare = installerInputPath === currentSharePath;
        if (!isAlreadyOnShare) {
          try {
            const result = await window.api.templates.saveInstaller(saved.id, installerInputPath);
            if (result?.success) {
              state.templateInstallers = { ...state.templateInstallers, [saved.id]: result.sharePath };
            }
          } catch (e) { /* non-fatal */ }
        }
      } else {
        state.templateInstallers = { ...state.templateInstallers };
        delete state.templateInstallers[saved.id];
      }
      await window.api.config.set({ templateInstallers: state.templateInstallers });

      state.templates = await window.api.templates.getAll();
      state.selectedId = saved.id;
      state.draft = this.cloneTemplateDraft(saved);
      state.deleteUsageCount = 0;
      App.toast(this.tr('apps.customTemplateSaved', 'Plantilla guardada correctamente'), 'success');
      this.renderTemplateManager(state, onClose);
    });
  },

  async openTemplateManager(onClose = null) {
    const [templates, config, allTemplates] = await Promise.all([
      window.api.templates.getAll().catch(() => []),
      window.api.config.get().catch(() => ({})),
      window.api.scripts.getTemplates().catch(() => [])
    ]);
    const builtInTemplates = allTemplates.filter(t => !t.isUserDefined && !t.noInstaller && t.id !== 'generic' && t.id !== 'custom' && t.id !== 'office');
    const state = {
      templates,
      builtInTemplates,
      templateInstallers: config.templateInstallers || {},
      selectedId: null,
      selectedBuiltIn: null,
      systemExpanded: false,
      installerSaved: false,
      draft: this.createEmptyTemplateDraft(),
      deleteConfirm: false,
      deleteUsageCount: 0
    };
    this.renderTemplateManager(state, onClose);
  },

  templateIcon(id) {
    if (String(id || '').startsWith('user-')) return 'ðŸ§©';
    const icons = {
      generic: '📦',
      office: '📎',
      custom: '⚡',
      wazuh: '🛡️',
      sentinelone: '🟣',
      cortexxdr: '🛡️',
      bitdefender: '🔴',
      crowdstrike: '🦅',
      zscaler: '☁️',
      globalprotect: '🌍',
      ciscosecureclient: '🔒',
      forticlient: '🛡️',
      lansweeper: '📡',
      ninjaone: '🥷',
      freshservice: '🔧',
      teamviewer: '↔️',
      anydesk: '🟥',
      veeam: '🟩',
      crashplan: '☁️',
      chrome: '🌐',
      'sap-gui': '💼'
    };
    return icons[id] || '📦';
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  showSilentArgsHelper(state, renderWizard) {
    const args = [
      { category: t('apps.argsCatMsi'), items: [
        { arg: '/qn', desc: t('apps.argsMsiQn') },
        { arg: '/qb', desc: t('apps.argsMsiQb') },
        { arg: '/qr', desc: t('apps.argsMsiQr') },
        { arg: '/norestart', desc: t('apps.argsMsiNoRestart') },
        { arg: '/passive', desc: t('apps.argsMsiPassive') },
        { arg: '/l*v "C:\\install.log"', desc: t('apps.argsMsiLog') },
        { arg: 'ALLUSERS=1', desc: t('apps.argsMsiAllUsers') },
        { arg: 'INSTALLDIR="C:\\Program Files\\App"', desc: t('apps.argsMsiInstallDir') },
        { arg: '/qn /norestart', desc: t('apps.argsMsiCombo') },
      ]},
      { category: t('apps.argsCatExe'), items: [
        { arg: '/S', desc: t('apps.argsExeNsis') },
        { arg: '/s', desc: t('apps.argsExeLower') },
        { arg: '/silent', desc: t('apps.argsExeInnoSilent') },
        { arg: '/verysilent', desc: t('apps.argsExeInnoVery') },
        { arg: '/SILENT /NORESTART', desc: t('apps.argsExeInnoCombo') },
        { arg: '/quiet', desc: t('apps.argsExeQuiet') },
        { arg: '/quiet /norestart', desc: t('apps.argsExeQuietCombo') },
        { arg: '-ms', desc: t('apps.argsExeMs') },
        { arg: '--silent --accept-license', desc: t('apps.argsExeAcceptLicense') },
      ]},
      { category: t('apps.argsCatSpecial'), items: [
        { arg: 'TRANSFORMS="config.mst"', desc: t('apps.argsSpecialMst') },
        { arg: '/extract:"C:\\temp"', desc: t('apps.argsSpecialExtract') },
        { arg: '/configure config.xml', desc: t('apps.argsSpecialOffice') },
      ]},
    ];

    const body = `
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:var(--font-sm);">${t('apps.clickToCopyArgs')}</p>
      ${args.map(cat => `
        <div style="margin-bottom:20px;">
          <div style="font-weight:600;color:var(--text-primary);margin-bottom:8px;font-size:var(--font-sm);text-transform:uppercase;letter-spacing:0.5px;">${cat.category}</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${cat.items.map(item => `
              <div class="args-helper-row" onclick="document.getElementById('_args_selected').value = '${item.arg.replace(/'/g, "\\'").replace(/"/g, '&quot;')}'; document.querySelectorAll('.args-helper-row').forEach(r=>r.style.background=''); this.style.background='var(--accent-primary-dim)';" style="display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:var(--radius-sm);cursor:pointer;transition:background 0.15s;">
                <code style="background:var(--bg-input);padding:4px 10px;border-radius:4px;font-size:var(--font-sm);color:var(--accent-secondary);white-space:nowrap;border:1px solid var(--border-color);">${this.esc(item.arg)}</code>
                <span style="font-size:var(--font-sm);color:var(--text-muted);">${item.desc}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <input type="hidden" id="_args_selected" value="">
    `;

    App.openModal(t('apps.argsHelpTitle'), body, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-primary" id="btn-apply-arg">${t('apps.applyArg')}</button>
    `);

    document.getElementById('btn-apply-arg').addEventListener('click', () => {
      const selected = document.getElementById('_args_selected').value;
      if (selected) {
        state.silentArgs = selected;
        App.closeModal();
        renderWizard();
        App.toast(t('apps.argsCopied').replace('{arg}', selected), 'success');
      } else {
        App.toast(t('apps.selectArgWarning'), 'warning');
      }
    });
  }
};
