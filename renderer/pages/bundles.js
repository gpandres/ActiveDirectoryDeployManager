// ═══════════════════════════════════════════════════════
// Bundles Page — Group apps into deployment packs
// ═══════════════════════════════════════════════════════

const BundlesPage = {
  bundles: [],
  apps: [],
  selectedIds: new Set(),
  _wizardOpening: false,       // prevents double-click opening multiple wizards
  _deployingIds: new Set(),    // prevents concurrent deploy of the same bundle
  _viewMode: 'grid',

  async render(container) {
    this.apps = await window.api.apps.getAll();
    this.bundles = await window.api.bundles.getAll();

    const deployedCount = this.bundles.filter(b => b.deployed && b.deployedPath).length;
    const pendingCount = this.bundles.length - deployedCount;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>
            <span class="header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </span>
            ${t('bundles.title')}
          </h1>
          <p class="page-subtitle">${t('bundles.subtitle')}</p>
        </div>
        <button class="btn btn-primary" onclick="BundlesPage.openWizard()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('bundles.newBundle')}
        </button>
      </div>

      ${App.rsatWarningHTML()}

      ${this.bundles.length > 0 ? `
        <div class="apps-toolbar">
          <div class="apps-counters">
            <div class="apps-counter active" data-filter="all">
              <span class="apps-counter-value">${this.bundles.length}</span>
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
            <label class="checkbox-wrapper" style="margin-right: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" class="checkbox-select" id="select-all-bundles" style="position:static" onchange="BundlesPage.toggleSelectAll(this.checked)">
              <span style="font-size:var(--font-sm); color:var(--text-secondary);">${t('apps.selectAll') || 'Seleccionar Todo'}</span>
            </label>
            <div style="position:relative; min-width:180px; max-width:280px; flex:1;">
              <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:.4" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" class="form-input" id="bundles-search" placeholder="${t('bundles.search')}" autocomplete="off" style="padding-left:34px;">
            </div>
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
      ` : ''}

      <!-- Bulk Action Bar -->
      <div class="action-bar" id="bulk-action-bar">
        <span class="action-bar-text"><span id="selected-count">0</span> ${t('apps.selected')}</span>
        <div class="action-bar-buttons" style="display:flex; gap:10px; align-items:center;">
          <button class="btn btn-primary btn-sm" id="btn-bulk-deploy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${t('apps.deploy') || 'Desplegar'}
          </button>
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

      <div id="bundles-list">
        ${this.bundles.length === 0 ? `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted);margin-bottom:16px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <p>${t('bundles.noBundles')}</p>
            <p style="font-size:var(--font-sm);margin-top:8px">${t('bundles.createBundleHint')}</p>
          </div>
        ` : `
          <div class="cards-grid ${this._viewMode === 'list' ? 'list-view' : ''}" id="bundles-grid">
            ${this.bundles.map(b => this.renderBundleCard(b)).join('')}
          </div>
        `}
      </div>
    `;

    this.selectedIds.clear();

    document.getElementById('btn-clear-selection')?.addEventListener('click', () => this.clearSelection());
    document.getElementById('btn-bulk-delete')?.addEventListener('click', () => this.bulkDelete());
    document.getElementById('btn-bulk-disable')?.addEventListener('click', () => this.bulkDisable());
    document.getElementById('btn-bulk-deploy')?.addEventListener('click', () => this.bulkDeploy());

    // View toggle
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._viewMode = btn.dataset.view;
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const grid = document.getElementById('bundles-grid');
        if (grid) grid.classList.toggle('list-view', this._viewMode === 'list');
      });
    });

    // Search
    document.getElementById('bundles-search')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const grid = document.getElementById('bundles-grid');
      if (!grid) return;
      let anyVisible = false;
      grid.querySelectorAll('.bundle-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        const matches = !q || text.includes(q);
        card.style.display = matches ? '' : 'none';
        if (matches) anyVisible = true;
      });
      let noMatch = grid.querySelector('.search-no-match');
      if (!anyVisible && q) {
        if (!noMatch) {
          noMatch = document.createElement('p');
          noMatch.className = 'search-no-match';
          noMatch.style.cssText = 'grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px 0;';
          noMatch.textContent = t('bundles.noBundlesMatch');
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
  },

  renderBundleCard(bundle) {
    const isDeployed = bundle.deployed && bundle.deployedPath;
    const statusClass = isDeployed ? 'deployed' : 'pending';
    const statusText = isDeployed ? t('apps.deployedBadge') : t('apps.detailNotDeployed');
    return `
      <div class="bundle-card bundle-card--${statusClass}" data-deployed="${!!isDeployed}" data-id="${bundle.id}" onclick="BundlesPage.showBundleDetail('${bundle.id}')">
        <input type="checkbox" class="checkbox-select bundle-card-cb" data-id="${bundle.id}" onchange="BundlesPage.toggleSelect('${bundle.id}', this.checked)" onclick="event.stopPropagation()">
        <div class="bundle-card-top">
          <div class="bundle-card-icon">📦</div>
          <div class="bundle-card-info">
            <div class="bundle-card-name">${this.esc(bundle.name)}</div>
            <div class="bundle-card-desc">${this.esc(bundle.description || '')}</div>
          </div>
        </div>
        <div class="app-card-badges">
          <span class="badge badge-info">v${this.esc(bundle.version)}</span>
          <span class="badge badge-primary">${bundle.apps.length} ${t('bundles.appsIncluded')}</span>
          ${bundle.gpoName ? `<span class="badge badge-info">${this.esc(bundle.gpoName)}</span>` : ''}
          ${bundle.createGPO ? `<span class="badge badge-info">${t('bundles.autoGpo')}</span>` : ''}
          ${bundle.notifyUser ? '<span class="badge badge-info">🔔</span>' : ''}
        </div>
        <div class="bundle-card-apps">
          ${bundle.apps.map(a => `<span class="app-chip">${this.esc(a.name)}</span>`).join('')}
        </div>
        <div class="bundle-card-footer">
          <span class="app-status-label ${statusClass}">${statusText}</span>
          <div class="app-card-menu">
            <button class="app-card-menu-btn" onclick="event.stopPropagation(); BundlesPage.toggleMenu(this)" title="${t('apps.edit') || 'Acciones'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            <div class="app-card-dropdown">
              <button class="dropdown-item" onclick="BundlesPage.showBundleDetail('${bundle.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                ${t('common.details') || 'Ver detalles'}
              </button>
              <button class="dropdown-item" onclick="BundlesPage.previewScript('${bundle.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ${t('apps.script')}
              </button>
              ${isDeployed ? `
                <button class="dropdown-item dropdown-item--warning" onclick="BundlesPage.disableDeploy('${bundle.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  ${t('apps.disable')}
                </button>
              ` : `
                <button class="dropdown-item dropdown-item--success" onclick="BundlesPage.deployBundle('${bundle.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  ${t('apps.deploy')}
                </button>
              `}
              <button class="dropdown-item" onclick="BundlesPage.editBundle('${bundle.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                ${t('apps.edit')}
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item dropdown-item--danger" onclick="BundlesPage.deleteBundle('${bundle.id}')">
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
    const dropdown = btn.nextElementSibling;
    const wasVisible = dropdown.classList.contains('visible');
    document.querySelectorAll('.app-card-dropdown.visible').forEach(d => d.classList.remove('visible'));
    if (!wasVisible) dropdown.classList.add('visible');
  },

  esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; },

  normalizeOUDNs(value) {
    const raw = Array.isArray(value)
      ? value
      : (typeof value === 'string' && value.trim() ? [value.trim()] : []);
    return [...new Set(raw.filter(Boolean))];
  },

  getBundleOUs(bundle) {
    return this.normalizeOUDNs(bundle?.ouDNs || bundle?.ouDN);
  },

  getOUName(dn) {
    const match = (this._wizOus || []).find(ou => ou.dn === dn);
    return match?.name || dn;
  },

  renderOUChips(ouDNs) {
    if (!ouDNs || ouDNs.length === 0) {
      return `<span style="font-size:12px;color:var(--text-muted);">${t('apps.selectOuRecommended') || '-'}</span>`;
    }

    return ouDNs.map(dn => `
      <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(30,144,255,0.15);color:var(--primary-color);padding:2px 10px;border-radius:4px;font-size:12px;margin:2px 6px 2px 0;">
        📁 ${this.esc(this.getOUName(dn))}
        <button type="button" class="btn btn-ghost btn-sm btn-remove-bundle-ou" data-dn="${this.esc(dn)}" style="font-size:11px;padding:0 4px;min-height:auto;">✕</button>
      </span>
    `).join('');
  },

  // ─── Bulk Logic ────────────────────────────────────
  toggleSelect(id, checked) {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    this.updateBulkBar();
  },

  clearSelection() {
    this.selectedIds.clear();
    document.querySelectorAll('.checkbox-select').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('select-all-bundles');
    if (selectAll) selectAll.checked = false;
    this.updateBulkBar();
  },

  toggleSelectAll(checked) {
    const cards = document.querySelectorAll('#bundles-grid .bundle-card');
    cards.forEach(card => {
      if (card.style.display !== 'none') {
        const id = card.dataset.id;
        const checkbox = card.querySelector('.checkbox-select.bundle-card-cb');
        if (checked) {
          this.selectedIds.add(id);
          if (checkbox) checkbox.checked = true;
        } else {
          this.selectedIds.delete(id);
          if (checkbox) checkbox.checked = false;
        }
      }
    });
    this.updateBulkBar();
  },

  updateBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    const count = this.selectedIds.size;
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.textContent = count;
    if (bar) bar.classList.toggle('visible', count > 0);

    const selectAll = document.getElementById('select-all-bundles');
    if (selectAll) {
      const visibleCards = Array.from(document.querySelectorAll('#bundles-grid .bundle-card')).filter(c => c.style.display !== 'none');
      const allSelected = visibleCards.length > 0 && visibleCards.every(c => this.selectedIds.has(c.dataset.id));
      selectAll.checked = count > 0 && allSelected;
      selectAll.indeterminate = count > 0 && !allSelected;
    }
  },

  async bulkDisable() {
    if (this.selectedIds.size === 0) return;
    try {
      const ids = Array.from(this.selectedIds);
      for (const id of ids) {
        const bundle = await window.api.bundles.get(id);
        if (bundle && bundle.deployed) {
          bundle.deployed = false;
          await window.api.bundles.update(id, bundle);
        }
      }
      App.toast(t('apps.bulkDisableSuccess') || `Deshabilitados ${ids.length} bundles correctamente`, 'success');
      this.clearSelection();
      App.navigate('bundles');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  async bulkDelete() {
    if (this.selectedIds.size === 0) return;
    const ids = Array.from(this.selectedIds);

    // Gather bundle names for display
    const bundleNames = ids.map(id => {
      const b = this.bundles.find(x => x.id === id);
      return b ? this.esc(b.name) : id;
    });

    const { confirmed, adCleanup } = await new Promise(resolve => {
      const body = `
        <p style="margin-bottom:12px;color:var(--text-secondary);">${t('apps.bulkDeleteWarning').replace('{count}', ids.length)}</p>
        <div style="max-height:140px;overflow-y:auto;background:var(--bg-input);border-radius:6px;padding:8px 12px;margin-bottom:14px;">
          ${bundleNames.map(n => `<div style="padding:3px 0;font-size:13px;color:var(--text-primary);">📦 ${n}</div>`).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
            <input type="checkbox" id="bdel-chk-gpo" checked style="width:auto;">
            <span>${t('apps.bulkDeleteCleanGpo') || 'Eliminar GPOs asociadas de AD (si existen)'}</span>
          </label>
        </div>`;
      const footer = `
        <button class="btn btn-secondary" onclick="App.closeModal(); window._bulkDeleteResolve({confirmed:false, adCleanup:false})">${t('common.cancel')}</button>
        <div style="flex:1"></div>
        <button class="btn btn-danger" id="bdel-confirm-btn">${t('apps.bulkDeleteConfirm') || 'Eliminar ' + ids.length + ' bundles'}</button>`;
      window._bulkDeleteResolve = resolve;
      App.openModal(t('apps.bulkDeleteTitle') || 'Eliminar bundles', body, footer);
      document.getElementById('bdel-confirm-btn')?.addEventListener('click', () => {
        const adCleanup = document.getElementById('bdel-chk-gpo')?.checked ?? false;
        App.closeModal();
        resolve({ confirmed: true, adCleanup });
      });
    });

    if (!confirmed) return;

    App.toast(t('apps.bulkDeleting') || `Eliminando ${ids.length} bundles...`, 'info');
    try {
      let successCount = 0;
      for (const id of ids) {
        const bundle = await window.api.bundles.get(id);
        if (!bundle) continue;
        if (adCleanup && bundle.gpoName) {
          try { await window.api.ad.deleteGPO(bundle.gpoName); } catch (e) { console.warn('GPO cleanup failed for', bundle.gpoName); }
        }
        await window.api.bundles.delete(id);
        successCount++;
      }
      App.toast(t('apps.bulkDeleteSuccess').replace('{count}', successCount) || `Se eliminaron ${successCount} bundles.`, 'success');
      this.clearSelection();
      App.navigate('bundles');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  async bulkDeploy() {
    // Only bundles can be deployed from the UI normally by hitting "Deploy" because their target is inside the bundle.
    // Apps bulk assign targets a custom GPO on the spot. Here we just trigger their individual deployments.
    if (this.selectedIds.size === 0) return;
    const ids = Array.from(this.selectedIds);
    
    App.toast(t('bundles.bulkDeploying') || `Encolando despliegue de ${ids.length} bundles...`, 'info');
    
    try {
      let successCount = 0;
      for (const id of ids) {
        // Sequentially deploy to avoid conflicting script files if they share operations (best practice)
        await this.deployBundle(id);
        successCount++;
      }
      App.toast(t('bundles.bulkDeploySuccess') || `Se desplegaron ${successCount} bundles correctamente.`, 'success');
      this.clearSelection();
    } catch (err) {
      App.toast('Error deploy: ' + err.message, 'error');
    }
  },

  // ─── Detail Modal ──────────────────────────────────
  async showBundleDetail(id) {
    const bundle = await window.api.bundles.get(id);
    if (!bundle) return;

    const isDeployed = bundle.deployed && bundle.deployedPath;
    
    const row = (label, value) => value ? `
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
        <span style="color:var(--text-muted); font-size:13px;">${label}</span>
        <span style="color:var(--text-primary); font-size:13px; font-weight:500; text-align:right; max-width:60%; word-break:break-all;">${value}</span>
      </div>` : '';

    const appsHtml = bundle.apps && bundle.apps.length > 0
      ? bundle.apps.map(a => `<span class="app-chip" style="display:inline-block; margin:2px;">${this.esc(a.name)}</span>`).join('')
      : `<span style="color:var(--text-muted); font-size:13px;">${t('bundles.emptyApps') || 'Sin apps incluidas'}</span>`;

    const body = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Header -->
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:48px; height:48px; border-radius:12px; background:var(--accent-info-dim); display:flex; align-items:center; justify-content:center; font-size:26px; border: 1px solid rgba(59, 130, 246, 0.15);">
            📦
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--text-primary);">${this.esc(bundle.name)}</div>
            <div style="font-size:13px; color:var(--text-muted);">${this.esc(bundle.description || '')}</div>
          </div>
        </div>

        <!-- Status badges -->
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="badge badge-info">v${this.esc(bundle.version || '1.0.0')}</span>
          ${isDeployed ? `<span class="badge badge-success">${t('apps.deployedBadge')}</span>` : `<span class="badge badge-neutral">${t('apps.detailNotDeployed')}</span>`}
          ${bundle.gpoName ? `<span class="badge badge-info">${this.esc(bundle.gpoName)}</span>` : `<span class="badge badge-neutral">${t('bundles.autoGpo') || 'GPO'}</span>`}
          ${bundle.notifyUser ? `<span class="badge badge-warning">${t('apps.detailNotifyEnabled')}</span>` : ''}
        </div>

        <!-- Apps Included -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${t('bundles.appsIncluded') || 'Apps incluidas'} (${bundle.apps.length})</div>
          <div>${appsHtml}</div>
        </div>

        <!-- General Info -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionGeneral')}</div>
          ${row(t('apps.detailVersion'), this.esc(bundle.version || '1.0.0'))}
          ${row(t('apps.detailNotifyUser'), bundle.notifyUser ? '&#10003;' : '&#10007;')}
          ${row(t('bundles.createGpo') || 'Crear GPO automáticamente', bundle.createGPO ? '&#10003;' : '&#10007;')}
        </div>

        <!-- Paths -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionPaths') || 'Rutas de Archivo'}</div>
          ${row(t('apps.detailDeployPath'), bundle.deployedPath ? '<span style="font-family:monospace; font-size:12px;">' + this.esc(bundle.deployedPath) + '</span>' : '-')}
        </div>

        <!-- Targeting -->
        <div class="card" style="padding:12px 16px; margin:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-secondary); margin-bottom:4px;">${t('apps.detailSectionTargeting')}</div>
          ${row(t('apps.detailGpo'), bundle.gpoName ? this.esc(bundle.gpoName) : '-')}
          ${row(
            t('apps.detailAssignedOUs') || 'OU Asignada',
            this.getBundleOUs(bundle).length > 0
              ? this.getBundleOUs(bundle).map(dn => '<div style="word-break:break-all;margin:2px 0;">' + this.esc(this.getOUName(dn)) + '</div>').join('')
              : '-'
          )}
        </div>
      </div>
    `;

    App.openModal(t('common.details') || 'Detalles del Bundle', body, `<button class="btn btn-primary" onclick="App.closeModal()">${t('common.close') || 'Cerrar'}</button>`);
  },

  // ─── Flatten OU tree for select dropdowns ──────────
  _flattenOUs(roots, depth = 0, flat = []) {
    for (const ou of roots) {
      flat.push({ name: ou.name, dn: ou.dn, depth });
      if (ou.children && ou.children.length) {
        this._flattenOUs(ou.children, depth + 1, flat);
      }
    }
    return flat;
  },

  // ─── Wizard ────────────────────────────────────────
  async openWizard(existingBundle = null) {
    // Guard: only one wizard can open at a time
    if (this._wizardOpening) return;
    this._wizardOpening = true;

    const isEdit = !!existingBundle;

    // Show immediate feedback while AD loads (prevents impatient double-clicks)
    App.openModalLocked(
      t('bundles.loadingWizard'),
      `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:120px;">
        <span class="spinner" style="width:24px;height:24px;border-width:3px;flex-shrink:0;"></span>
        <span style="color:var(--text-secondary);font-size:14px;">${t('bundles.loadingOUs')}</span>
      </div>`,
      ''
    );

    let flatOUs = [];
    try {
      const ouResult = await window.api.ad.getOUs();
      if (ouResult.success && ouResult.data) {
        flatOUs = this._flattenOUs(ouResult.data);
      }
    } catch (e) {
      // If AD fails we still open the wizard (OUs will just be empty)
    }

    // If something catastrophic happens before renderWizard(), release the guard
    try {

    const state = {
      step: 1,
      name: existingBundle?.name || '',
      description: existingBundle?.description || '',
      selectedApps: existingBundle?.apps || [],
      notifyUser: existingBundle?.notifyUser || false,
      gpoName: existingBundle?.gpoName || '',
      selectedOUs: this.getBundleOUs(existingBundle),
      ouDN: existingBundle?.ouDN || (this.getBundleOUs(existingBundle)[0] || ''),
      createGPO: existingBundle?.createGPO || false,
      version: existingBundle?.version || '1.0.0'
    };

    const renderWizard = () => {
      let body = `
        <div class="wizard-steps">
          <div class="wizard-step ${state.step >= 1 ? (state.step > 1 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">1</span><span>${t('bundles.step1')}</span>
          </div>
          <div class="wizard-step ${state.step >= 2 ? (state.step > 2 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">2</span><span>${t('bundles.step2')}</span>
          </div>
          <div class="wizard-step ${state.step >= 3 ? (state.step > 3 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">3</span><span>${t('apps.step3')}</span>
          </div>
        </div>
      `;

      if (state.step === 1) {
        body += `
          <div class="form-group">
            <label class="form-label">${t('bundles.bundleName')} *</label>
            <input class="form-input" id="wiz-bundle-name" value="${this.esc(state.name)}" placeholder="Ej: Pack Oficina">
          </div>
          <div class="form-group">
            <label class="form-label">${t('bundles.desc')}</label>
            <input class="form-input" id="wiz-bundle-desc" value="${this.esc(state.description)}" placeholder="Ej: Chrome + Office + FortiClient">
          </div>
          <div class="form-group">
            <label class="form-label">${t('apps.version')}</label>
            <input class="form-input" id="wiz-bundle-version" value="${state.version}" placeholder="1.0.0" style="max-width:150px">
          </div>
        `;
      } else if (state.step === 2) {
        body += `
          <p style="color:var(--text-secondary);margin-bottom:16px">${t('bundles.selectApps')}:</p>
          <div style="max-height:300px;overflow-y:auto">
            ${this.apps.map((app, i) => {
              const isSelected = state.selectedApps.some(s => s.appId === app.id);
              return `
                <label class="checkbox-wrapper" style="padding:8px;border-radius:var(--radius-sm);${isSelected ? 'background:var(--accent-primary-dim)' : ''}">
                  <input type="checkbox" data-app-id="${app.id}" data-app-name="${this.esc(app.name)}"
                    ${isSelected ? 'checked' : ''} onchange="BundlesPage._toggleApp(this)">
                  <span>${this.esc(app.name)}</span>
                  <span class="badge badge-primary" style="margin-left:auto">${this.esc(app.template)}</span>
                  <span class="badge badge-info">v${this.esc(app.version || '1.0.0')}</span>
                </label>
              `;
            }).join('')}
          </div>
          ${this.apps.length === 0 ? `<p style="color:var(--accent-warning);margin-top:8px">⚠ ${t('bundles.emptyApps')}</p>` : ''}
        `;
      } else if (state.step === 3) {
        body += `
          <div class="form-group">
            <label class="checkbox-wrapper">
              <input type="checkbox" id="wiz-bundle-notify" ${state.notifyUser ? 'checked' : ''}>
              <span>🔔 ${t('bundles.notifyUserLabel')}</span>
            </label>
            <div class="form-hint">${t('bundles.notifyUserHint')}</div>
          </div>
          <hr style="border-color:var(--border-color);margin:16px 0">

          <div class="form-group mb-md">
            <label class="flex items-center gap-sm" style="cursor:pointer; padding: 12px; background: rgba(30,144,255,0.1); border-radius: 6px; border: 1px solid rgba(30,144,255,0.2);">
              <input type="checkbox" id="wiz-bundle-create-gpo" ${state.createGPO ? 'checked' : ''} style="width:16px;height:16px;">
              <span style="font-weight:600;color:var(--primary-color)">✨ ${t('bundles.createGpo')}</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">${t('apps.selectGpo')}</label>
            <input class="form-input" id="wiz-bundle-gpo" value="${this.esc(state.gpoName)}" placeholder="Deploy_Bundle_Pack">
          </div>

          ${flatOUs.length > 0 ? `
            <div class="form-group">
              <label class="form-label">${t('apps.selectOus')}</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <select class="form-select" id="wiz-bundle-ou-option" style="flex:1;">
                  <option value="">${t('bundles.cancelOption')}</option>
                  ${flatOUs.map(ou => `<option value="${this.esc(ou.dn)}">${'  '.repeat(ou.depth)}${ou.depth > 0 ? '↳ ' : ''}${this.esc(ou.name)}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-bundle-ou-add">
                  + ${t('common.add') || 'Agregar'}
                </button>
              </div>
              <div id="wiz-bundle-ou-selected" style="margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
                ${this.renderOUChips(state.selectedOUs || [])}
              </div>
              <input type="hidden" id="wiz-bundle-ou" value="${this.esc(JSON.stringify(state.selectedOUs || []))}">
            </div>
          ` : ''}

          <div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:var(--radius-sm)">
            <div style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:8px">${t('apps.reviewSummary')}:</div>
            <div style="font-weight:600;color:var(--text-primary)">${this.esc(state.name)} v${state.version}</div>
            <div style="color:var(--text-secondary);font-size:var(--font-sm)">${state.selectedApps.length} ${t('apps.selected')}: ${state.selectedApps.map(a => a.name).join(', ') || ''}</div>
            <div style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:6px;">UOs: ${(state.selectedOUs || []).map(dn => this.esc(this.getOUName(dn))).join(', ') || '-'}</div>
          </div>
        `;
      }

      App.openModal(isEdit ? t('apps.edit') : t('bundles.newBundle'), body, `
        ${state.step > 1 ? `<button class="btn btn-secondary" onclick="BundlesPage._wizBack()">${t('apps.back')}</button>` : ''}
        <div style="flex:1"></div>
        ${state.step < 3
          ? `<button class="btn btn-primary" onclick="BundlesPage._wizNext()">${t('apps.next')}</button>`
          : `<button class="btn btn-success" onclick="BundlesPage._wizFinish(${isEdit ? `'${existingBundle.id}'` : 'null'})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${isEdit ? t('apps.saveAndDeploy') : t('apps.createAndDeploy')}
             </button>`
        }
      `);

      if (state.step === 3) {
        this.bindBundleOUSelector(state);
      }
    };

    this._wizState = state;
    this._wizRender = renderWizard;
    this._wizOus = flatOUs;
    App._modalLocked = false;  // unlock before rendering the interactive wizard
    renderWizard();
    // Release guard — wizard modal is now open and controls itself
    this._wizardOpening = false;

    } catch (err) {
      this._wizardOpening = false;
      App.toast(t('common.error') + ': ' + err.message, 'error');
      App.closeModal();
    }
  },

  _saveStepData() {
    const s = this._wizState;
    if (s.step === 1) {
      const name = document.getElementById('wiz-bundle-name');
      const desc = document.getElementById('wiz-bundle-desc');
      const ver = document.getElementById('wiz-bundle-version');
      if (name) s.name = name.value;
      if (desc) s.description = desc.value;
      if (ver) s.version = ver.value;
    } else if (s.step === 3) {
      const notify = document.getElementById('wiz-bundle-notify');
      const gpo = document.getElementById('wiz-bundle-gpo');
      const createGPO = document.getElementById('wiz-bundle-create-gpo');
      if (notify) s.notifyUser = notify.checked;
      if (gpo) s.gpoName = gpo.value;
      if (createGPO) s.createGPO = createGPO.checked;
      try {
        const parsed = JSON.parse(document.getElementById('wiz-bundle-ou')?.value || '[]');
        s.selectedOUs = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        s.selectedOUs = [];
      }
      s.ouDN = s.selectedOUs[0] || '';
    }
  },

  bindBundleOUSelector(state) {
    const selectEl = document.getElementById('wiz-bundle-ou-option');
    const hiddenEl = document.getElementById('wiz-bundle-ou');
    const selectedEl = document.getElementById('wiz-bundle-ou-selected');
    const addBtn = document.getElementById('btn-bundle-ou-add');
    if (!selectEl || !hiddenEl || !selectedEl || !addBtn) return;

    const sync = () => {
      hiddenEl.value = JSON.stringify(state.selectedOUs || []);
      selectedEl.innerHTML = this.renderOUChips(state.selectedOUs || []);
      selectedEl.querySelectorAll('.btn-remove-bundle-ou').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const dn = btn.dataset.dn;
          state.selectedOUs = this.normalizeOUDNs((state.selectedOUs || []).filter(item => item !== dn));
          state.ouDN = state.selectedOUs[0] || '';
          sync();
        });
      });
    };

    addBtn.addEventListener('click', () => {
      if (!selectEl.value) return;
      state.selectedOUs = this.normalizeOUDNs([...(state.selectedOUs || []), selectEl.value]);
      state.ouDN = state.selectedOUs[0] || '';
      sync();
    });

    selectEl.addEventListener('dblclick', () => addBtn.click());
    sync();
  },

  _toggleApp(checkbox) {
    const id = checkbox.dataset.appId;
    const name = checkbox.dataset.appName;
    const s = this._wizState;
    if (checkbox.checked) {
      if (!s.selectedApps.some(a => a.appId === id)) {
        s.selectedApps.push({ appId: id, name, order: s.selectedApps.length + 1 });
      }
    } else {
      s.selectedApps = s.selectedApps.filter(a => a.appId !== id);
      s.selectedApps.forEach((a, i) => a.order = i + 1);
    }
  },

  _wizBack() {
    this._saveStepData();
    this._wizState.step--;
    this._wizRender();
  },

  _wizNext() {
    this._saveStepData();
    if (this._wizState.step === 1 && !this._wizState.name.trim()) {
      App.toast(t('bundles.nameRequired'), 'warning');
      return;
    }
    if (this._wizState.step === 2 && this._wizState.selectedApps.length === 0) {
      App.toast(t('bundles.selectAtLeastOne'), 'warning');
      return;
    }
    this._wizState.step++;
    this._wizRender();
  },

  async _wizFinish(editId) {
    this._saveStepData();
    const s = this._wizState;

    // Auto-generate GPO name if createGPO is checked but no name provided
    if (s.createGPO && !s.gpoName.trim()) {
      s.gpoName = `Deploy_Bundle_${s.name.replace(/\s/g, '_')}`;
    }

    const data = {
      name: s.name,
      description: s.description,
      apps: s.selectedApps,
      notifyUser: s.notifyUser,
      gpoName: s.gpoName,
      createGPO: s.createGPO,
      ouDN: s.selectedOUs?.[0] || '',
      ouDNs: s.selectedOUs || [],
      version: s.version
    };

    try {
      if (editId) {
        await window.api.bundles.update(editId, data);
        await window.api.activity.add('bundle_update', { bundleName: s.name });
        App.toast(`${t('bundles.bundleUpdated')} "${s.name}"`, 'success');
      } else {
        await window.api.bundles.create(data);
        await window.api.activity.add('bundle_create', { bundleName: s.name, appCount: s.selectedApps.length });
        App.toast(`${t('bundles.bundleCreated')} "${s.name}" (${s.selectedApps.length} apps)`, 'success');
      }
      App.closeModal();
      App.navigate('bundles');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  // ─── Actions ───────────────────────────────────────
  async editBundle(id) {
    const bundle = await window.api.bundles.get(id);
    if (bundle) this.openWizard(bundle);
  },

  async deleteBundle(id) {
    const bundle = this.bundles.find(b => b.id === id);
    if (!bundle) return;

    const hasGPO = !!bundle.gpoName;

    App.openModal(t('apps.deleteConfirm'), `
      <p>${t('bundles.deleteBundleMsg').replace('{bundle}', `<strong>${this.esc(bundle.name)}</strong>`)}</p>
      <p style="color:var(--text-muted);font-size:var(--font-sm);margin-top:8px">${t('bundles.individualAppsNotDeleted')}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--danger-color); font-weight:600;">🗑️ GPO: "${this.esc(bundle.gpoName)}"</p>
          ${this.getBundleOUs(bundle).length > 0 ? `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <input type="checkbox" id="chk-bdel-unlink" checked style="width:auto; cursor:pointer;">
              <label for="chk-bdel-unlink" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanGpoOption')}</label>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <input type="checkbox" id="chk-bdel-clean" checked style="width:auto; cursor:pointer;">
            <label for="chk-bdel-clean" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanSysvolOption')}</label>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk-bdel-gpo" checked style="width:auto; cursor:pointer;">
            <label for="chk-bdel-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.deleteGpoOption')}</label>
          </div>
        </div>
      ` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-danger" id="btn-bundle-confirm-delete">${t('common.delete')}</button>
    `);

    document.getElementById('btn-bundle-confirm-delete').addEventListener('click', async () => {
      const btn = document.getElementById('btn-bundle-confirm-delete');
      btn.style.width = btn.offsetWidth + 'px';
      btn.style.height = btn.offsetHeight + 'px';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>';

      try {
        if (hasGPO) {
          const unlinkGPO = document.getElementById('chk-bdel-unlink')?.checked ?? false;
          const cleanScript = document.getElementById('chk-bdel-clean')?.checked ?? false;
          const deleteGPO = document.getElementById('chk-bdel-gpo')?.checked ?? false;

          if (unlinkGPO && this.getBundleOUs(bundle).length > 0) {
            for (const ouDN of this.getBundleOUs(bundle)) {
              await window.api.ad.unlinkGPOfromOU(bundle.gpoName, ouDN);
            }
          }
          if (cleanScript) {
            await window.api.ad.removeGPOStartupScript(bundle.gpoName);
          }
          if (deleteGPO) {
            await window.api.ad.deleteGPO(bundle.gpoName);
          }
        }

        await window.api.bundles.delete(id);
        await window.api.activity.add('bundle_delete', { bundleId: id });
        App.toast(t('bundles.bundleDeleted'), 'success');
        App.closeModal();
        App.navigate('bundles');
      } catch (err) {
        App.toast(t('common.error') + ': ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('common.delete');
      }
    });
  },

  async deployBundle(id) {
    // Guard: prevent concurrent deploy of the same bundle
    if (this._deployingIds.has(id)) {
      App.toast(t('bundles.alreadyDeploying'), 'warning');
      return;
    }
    this._deployingIds.add(id);

    // Disable the deploy button for this bundle while running
    const deployBtn = document.querySelector(`button[onclick*="deployBundle('${id}')"]`);
    if (deployBtn) {
      deployBtn.disabled = true;
      deployBtn.innerHTML = `<span class="spinner" style="width:12px;height:12px;display:inline-block;border-width:2px;"></span>`;
    }

    // Re-read from DB to get the latest data (including createGPO flag)
    const bundle = await window.api.bundles.get(id);
    if (!bundle) {
      this._deployingIds.delete(id);
      if (deployBtn) { deployBtn.disabled = false; deployBtn.textContent = t('apps.deploy'); }
      return;
    }

    App.toast(`${t('bundles.deploying')} "${bundle.name}"...`, 'info');
    try {
      const result = await window.api.bundles.deploy(id);
      if (result.success) {
        // Create GPO if the bundle has it configured
        if (bundle.createGPO && (bundle.gpoName || bundle.name)) {
          const gpoName = bundle.gpoName || `Deploy_Bundle_${bundle.name.replace(/\s/g, '_')}`;
          const scriptPath = result.path;
          const ouDNs = this.getBundleOUs(bundle);

          App.toast(`${t('bundles.creatingGpo')} ${gpoName}...`, 'info');
          try {
            const gpoResult = await window.api.ad.createGPO(gpoName, scriptPath, ouDNs);
            if (gpoResult.success) {
              // Save the GPO name back to the bundle
              await window.api.bundles.update(id, { gpoName: gpoName });
              App.toast(`${t('bundles.gpoCreatedBound')}`, 'success');
            } else {
              App.toast(`${t('bundles.bundleDeployedWaitMsg')} ${gpoResult.error}`, 'warning');
            }
          } catch (gpoErr) {
            App.toast(`${t('bundles.bundleDeployedWaitMsg')} ${gpoErr.message}`, 'warning');
          }
        } else if (bundle.gpoName && !bundle.createGPO) {
          // GPO already exists, just link it if we have an OU
          if (this.getBundleOUs(bundle).length > 0) {
            try {
              await window.api.ad.bulkLinkGPO(bundle.gpoName, this.getBundleOUs(bundle));
              App.toast(`${t('bundles.gpoCreatedBound')}`, 'success');
            } catch (e) {}
          }
        }
        App.toast(t('apps.deploySuccess'), 'success');
        App.navigate('bundles');
      } else {
        App.toast(t('common.error') + ': ' + result.error, 'error');
      }
    } catch (err) {
      App.toast(t('common.error') + ': ' + err.message, 'error');
    } finally {
      // Always release the guard and restore the button
      this._deployingIds.delete(id);
      const btn = document.querySelector(`button[onclick*="deployBundle('${id}')"]`);
      if (btn) { btn.disabled = false; btn.textContent = t('apps.deploy'); }
    }
  },

  async disableDeploy(id) {
    const bundle = await window.api.bundles.get(id);
    if (!bundle) return;

    const hasGPO = !!bundle.gpoName;

    App.openModal(t('apps.disableConfirm'), `
      <p>${t('bundles.disableBundleMsg').replace('{bundle}', `<strong>${this.esc(bundle.name)}</strong>`)}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--warning-color); font-weight:600;">⚠️ GPO: "${this.esc(bundle.gpoName)}"</p>
          ${this.getBundleOUs(bundle).length > 0 ? `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <input type="checkbox" id="chk-bdis-unlink" checked style="width:auto; cursor:pointer;">
              <label for="chk-bdis-unlink" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanGpoOption')}</label>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <input type="checkbox" id="chk-bdis-clean" checked style="width:auto; cursor:pointer;">
            <label for="chk-bdis-clean" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanSysvolOption')}</label>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk-bdis-delete-gpo" style="width:auto; cursor:pointer;">
            <label for="chk-bdis-delete-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-muted);">${t('apps.deleteGpoOption')}</label>
          </div>
        </div>
      ` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-warning" id="btn-bundle-confirm-disable">${t('apps.disable')}</button>
    `);

    document.getElementById('btn-bundle-confirm-disable').addEventListener('click', async () => {
      const btn = document.getElementById('btn-bundle-confirm-disable');
      btn.style.width = btn.offsetWidth + 'px';
      btn.style.height = btn.offsetHeight + 'px';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>';

      try {
        if (hasGPO) {
          const unlinkGPO = document.getElementById('chk-bdis-unlink')?.checked ?? false;
          const cleanScript = document.getElementById('chk-bdis-clean')?.checked ?? false;
          const deleteGPO = document.getElementById('chk-bdis-delete-gpo')?.checked ?? false;

          if (unlinkGPO && this.getBundleOUs(bundle).length > 0) {
            for (const ouDN of this.getBundleOUs(bundle)) {
              const r = await window.api.ad.unlinkGPOfromOU(bundle.gpoName, ouDN);
              if (r.success) App.toast(t('bundles.gpoUnlinkedOu'), 'success');
            }
          }
          if (cleanScript) {
            const r = await window.api.ad.removeGPOStartupScript(bundle.gpoName);
            if (r.success) App.toast(t('bundles.startupScriptCleaned'), 'success');
          }
          if (deleteGPO) {
            const r = await window.api.ad.deleteGPO(bundle.gpoName);
            if (r.success) App.toast(t('bundles.gpoDeletedSuccess').replace('{gpo}', bundle.gpoName), 'success');
            await window.api.bundles.update(id, { deployed: false, deployedPath: '', gpoName: '' });
          } else {
            await window.api.bundles.update(id, { deployed: false, deployedPath: '' });
          }
        } else {
          await window.api.bundles.update(id, { deployed: false, deployedPath: '' });
        }

        await window.api.activity.add('bundle_disable', { bundleId: id, bundleName: bundle.name });
        App.toast(t('bundles.bundleDisabled').replace('{bundle}', bundle.name), 'success');
        App.closeModal();
        App.navigate('bundles');
      } catch (err) {
        App.toast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('apps.disable');
      }
    });
  },

  async previewScript(id) {
    const script = await window.api.bundles.generateScript(id);
    App.openModal(t('bundles.bundleScriptTitle'), `
      <div class="code-header">
        <span>bundle_install.ps1</span>
      </div>
      <pre class="code-preview">${this.esc(script)}</pre>
    `, `<button class="btn btn-secondary" onclick="App.closeModal()">${t('deployments.close')}</button>`);
  }
};
