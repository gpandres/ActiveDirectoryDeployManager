// ═══════════════════════════════════════════════════════
// Organizational Units Page — Assignment-centric redesign
// ═══════════════════════════════════════════════════════
//
// Design principles:
//  - The page is about MANAGING ASSIGNMENTS, not browsing OUs.
//  - Ctrl+Click on the tree selects multiple OUs for bulk assignment.
//  - Changes are staged (pending) and only applied on "Apply".
//  - Sync check detects drift between local config and real AD state.
//  - Toggle between Tree view (fast) and Matrix view (global overview).

const OUsPage = {
  // ─── State ───────────────────────────────────────────
  state: {
    view: 'tree',                 // 'tree' | 'matrix'
    treeData: [],                 // Hierarchical OUs
    flatOUs: [],                  // Flat list for matrix view
    apps: [],                     // All apps
    selectedOUs: [],              // DNs (order preserved)
    ouSearch: '',
    appSearch: '',
    // Pending: key = `${appId}::${ouDN}`, value = 'assign' | 'unassign'
    pending: new Map(),
    // Sync drift: ouDN -> [{ gpoName, reason }]
    syncWarnings: new Map(),
    loading: false,
    lastExpandedOUs: new Set()    // persists expanded state across re-renders
  },

  // ─── Entry point ─────────────────────────────────────
  async render(container) {
    this.container = container;
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>
            <span class="header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            ${t('ous.title')}
          </h1>
          <p class="page-subtitle">${t('ous.subtitle')}</p>
        </div>
        <div class="flex gap-sm">
          <div class="view-toggle" id="ous-view-toggle">
            <button class="view-toggle-btn ${this.state.view === 'tree' ? 'active' : ''}" data-view="tree">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
              ${t('ous.treeView')}
            </button>
            <button class="view-toggle-btn ${this.state.view === 'matrix' ? 'active' : ''}" data-view="matrix">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              ${t('ous.matrixView')}
            </button>
          </div>
          <button class="btn btn-secondary" id="btn-refresh-ous">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            ${t('ous.refresh')}
          </button>
        </div>
      </div>

      ${App.rsatWarningHTML()}

      <div id="ous-stats-bar" class="ous-stats-bar"></div>
      <div id="ous-main-area"></div>
      <div id="ous-pending-bar" class="ous-pending-bar hidden"></div>
    `;

    document.getElementById('btn-refresh-ous').addEventListener('click', () => this.loadData());
    document.getElementById('ous-view-toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.view-toggle-btn');
      if (!btn) return;
      this.switchView(btn.dataset.view);
    });

    if (App.rsatAvailable) {
      await this.loadData();
    } else {
      document.getElementById('ous-main-area').innerHTML = `
        <div class="empty-state"><p class="empty-state-text">${t('ous.emptyOusRsat')}</p></div>`;
    }
  },

  // ─── Data loading ────────────────────────────────────
  async loadData() {
    this.state.loading = true;
    const mainArea = document.getElementById('ous-main-area');
    mainArea.innerHTML = `<div class="spinner"></div><p class="loading-text">${t('ous.loadingOus')}</p>`;

    try {
      const [ouResult, apps] = await Promise.all([
        window.api.ad.getOUs(),
        window.api.apps.getAll()
      ]);

      if (!ouResult.success) {
        mainArea.innerHTML = `<div class="empty-state"><p class="empty-state-text">${this.esc(ouResult.error || t('ous.noOusFound'))}</p></div>`;
        return;
      }

      this.state.treeData = ouResult.data || [];
      this.state.flatOUs = this.flattenOUs(this.state.treeData);
      this.state.apps = apps || [];

      // Drop selection entries whose OU no longer exists
      const validDNs = new Set(this.state.flatOUs.map(o => o.dn));
      this.state.selectedOUs = this.state.selectedOUs.filter(dn => validDNs.has(dn));

      // Preserve pending changes across navigation, but drop orphans
      // (pending entries that reference apps or OUs that no longer exist)
      const validAppIds = new Set(this.state.apps.map(a => a.id));
      const orphanKeys = [];
      this.state.pending.forEach((_, key) => {
        const [appId, ouDN] = key.split('::');
        if (!validAppIds.has(appId) || !validDNs.has(ouDN)) orphanKeys.push(key);
      });
      orphanKeys.forEach(k => this.state.pending.delete(k));

      // Sync warnings are always re-computed on demand
      this.state.syncWarnings.clear();

      this.renderMain();
      this.renderStatsBar();
      this.renderPendingBar();
    } catch (err) {
      mainArea.innerHTML = `<div class="empty-state"><p class="empty-state-text">${t('ous.errorConnecting')} ${this.esc(err.message)}</p></div>`;
    } finally {
      this.state.loading = false;
    }
  },

  flattenOUs(nodes, depth = 0, parentDN = '', acc = []) {
    for (const node of nodes) {
      acc.push({ dn: node.dn, name: node.name, description: node.description, depth, parentDN });
      if (node.children && node.children.length) {
        this.flattenOUs(node.children, depth + 1, node.dn, acc);
      }
    }
    return acc;
  },

  // ─── Computed helpers ────────────────────────────────
  assignmentCountByOU(ouDN) {
    return this.state.apps.filter(a => (a.assignedOUs || []).includes(ouDN)).length;
  },

  // Get effective state for (app, ou) taking pending changes into account
  effectiveAssigned(appId, ouDN) {
    const key = `${appId}::${ouDN}`;
    const pending = this.state.pending.get(key);
    if (pending === 'assign') return true;
    if (pending === 'unassign') return false;
    const app = this.state.apps.find(a => a.id === appId);
    if (!app) return false;
    return (app.assignedOUs || []).includes(ouDN);
  },

  // For the selected OUs, what is the aggregate checkbox state of an app?
  // Returns 'all' | 'none' | 'some'
  aggregateState(appId, ouDNs) {
    if (ouDNs.length === 0) return 'none';
    let assignedCount = 0;
    for (const dn of ouDNs) {
      if (this.effectiveAssigned(appId, dn)) assignedCount++;
    }
    if (assignedCount === 0) return 'none';
    if (assignedCount === ouDNs.length) return 'all';
    return 'some';
  },

  hasPending(appId, ouDN) {
    return this.state.pending.has(`${appId}::${ouDN}`);
  },

  // ─── Main render dispatch ────────────────────────────
  renderMain() {
    if (this.state.view === 'matrix') {
      this.renderMatrix();
    } else {
      this.renderTreeView();
    }
  },

  switchView(view) {
    if (view === this.state.view) return;
    this.state.view = view;
    document.querySelectorAll('#ous-view-toggle .view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    this.renderMain();
  },

  // ─── Stats bar (global counters) ─────────────────────
  renderStatsBar() {
    const bar = document.getElementById('ous-stats-bar');
    if (!bar) return;
    const totalApps = this.state.apps.length;
    const totalOUs = this.state.flatOUs.length;
    let totalAssignments = 0;
    const ousWithApps = new Set();
    for (const app of this.state.apps) {
      const ous = app.assignedOUs || [];
      totalAssignments += ous.length;
      ous.forEach(dn => ousWithApps.add(dn));
    }
    bar.innerHTML = `
      <div class="stat-pill"><span class="stat-pill-value">${totalApps}</span><span class="stat-pill-label">${t('ous.statsApps')}</span></div>
      <div class="stat-pill"><span class="stat-pill-value">${totalOUs}</span><span class="stat-pill-label">${t('ous.statsOUs')}</span></div>
      <div class="stat-pill"><span class="stat-pill-value">${totalAssignments}</span><span class="stat-pill-label">${t('ous.statsAssignments')}</span></div>
      <div class="stat-pill"><span class="stat-pill-value">${ousWithApps.size}</span><span class="stat-pill-label">${t('ous.statsActiveOUs')}</span></div>
    `;
  },

  // ─── Tree view ───────────────────────────────────────
  renderTreeView() {
    const mainArea = document.getElementById('ous-main-area');
    mainArea.innerHTML = `
      <div class="ous-layout">
        <div class="card ous-tree-card">
          <div class="card-title">${t('ous.treeTitle')}</div>
          <div class="ous-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="ous-search-ou" placeholder="${t('ous.searchOUs')}" value="${this.esc(this.state.ouSearch)}">
          </div>
          <p class="text-muted text-sm mt-xs" style="padding: 0 4px;">${t('ous.ctrlClickHint')}</p>
          <div id="ou-tree-container" class="mt-md"></div>
        </div>

        <div class="card ous-panel-card" id="ous-assignment-panel">
          ${this.renderAssignmentPanelHTML()}
        </div>
      </div>
    `;

    this.renderTree();
    this.bindTreeEvents();

    document.getElementById('ous-search-ou').addEventListener('input', (e) => {
      this.state.ouSearch = e.target.value;
      this.renderTree();
      this.bindTreeEvents();
      // No focus loss here since we only re-render the tree, not the input
    });

    this.bindAssignmentPanelEvents();
  },

  renderTree() {
    const container = document.getElementById('ou-tree-container');
    if (!container) return;
    if (!this.state.treeData.length) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${t('ous.noOusFound')}</p></div>`;
      return;
    }
    const matchingDNs = this.computeSearchMatches();
    container.innerHTML = this.treeHTML(this.state.treeData, matchingDNs);
  },

  // Search: returns null if no search query, otherwise Set<dn> including
  // matches AND their ancestors (so the tree path stays visible)
  computeSearchMatches() {
    const q = this.state.ouSearch.trim().toLowerCase();
    if (!q) return null;
    const matches = new Set();
    for (const ou of this.state.flatOUs) {
      if (ou.name.toLowerCase().includes(q)) {
        // Include this OU and walk ancestors
        matches.add(ou.dn);
        let parent = ou.parentDN;
        while (parent) {
          matches.add(parent);
          const parentOU = this.state.flatOUs.find(o => o.dn === parent);
          parent = parentOU ? parentOU.parentDN : '';
        }
      }
    }
    return matches;
  },

  treeHTML(nodes, matchingDNs) {
    if (!nodes || nodes.length === 0) return '';
    let html = '<ul class="tree">';
    for (const node of nodes) {
      if (matchingDNs && !matchingDNs.has(node.dn)) continue;
      const hasChildren = node.children && node.children.length > 0;
      const count = this.assignmentCountByOU(node.dn);
      const isSelected = this.state.selectedOUs.includes(node.dn);
      const hasAssignments = count > 0;
      // Auto-expand if searching, or if previously expanded, or if selected ancestor path
      const shouldExpand = matchingDNs !== null || this.state.lastExpandedOUs.has(node.dn);

      html += `
        <li class="tree-item">
          <div class="tree-node ${isSelected ? 'selected' : ''} ${hasAssignments ? 'has-assignments' : ''}" data-dn="${this.escAttr(node.dn)}">
            <button class="tree-toggle ${hasChildren ? (shouldExpand ? 'expanded' : '') : 'empty'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <span class="tree-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span class="tree-label">${this.esc(node.name)}</span>
            ${hasAssignments ? `<span class="tree-badge">${count}</span>` : ''}
          </div>
          ${hasChildren ? `<div class="tree-children ${shouldExpand ? '' : 'collapsed'}">${this.treeHTML(node.children, matchingDNs)}</div>` : ''}
        </li>`;
    }
    html += '</ul>';
    return html;
  },

  bindTreeEvents() {
    document.querySelectorAll('#ou-tree-container .tree-toggle:not(.empty)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const li = btn.closest('.tree-item');
        const children = li.querySelector('.tree-children');
        if (children) {
          children.classList.toggle('collapsed');
          btn.classList.toggle('expanded');
          const dn = li.querySelector('.tree-node').dataset.dn;
          if (children.classList.contains('collapsed')) {
            this.state.lastExpandedOUs.delete(dn);
          } else {
            this.state.lastExpandedOUs.add(dn);
          }
        }
      });
    });

    document.querySelectorAll('#ou-tree-container .tree-node').forEach(nodeEl => {
      nodeEl.addEventListener('click', (e) => {
        const dn = nodeEl.dataset.dn;
        if (e.ctrlKey || e.metaKey) {
          // Toggle in multi-selection
          const idx = this.state.selectedOUs.indexOf(dn);
          if (idx >= 0) {
            this.state.selectedOUs.splice(idx, 1);
          } else {
            this.state.selectedOUs.push(dn);
          }
        } else {
          // Replace selection
          this.state.selectedOUs = [dn];
        }
        this.refreshTreeSelection();
        this.refreshAssignmentPanel();
      });

      nodeEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const dn = nodeEl.dataset.dn;
        this.showOUContextMenu(e.pageX, e.pageY, dn);
      });
    });
  },

  refreshTreeSelection() {
    document.querySelectorAll('#ou-tree-container .tree-node').forEach(nodeEl => {
      nodeEl.classList.toggle('selected', this.state.selectedOUs.includes(nodeEl.dataset.dn));
    });
  },

  // ─── Assignment panel (right side of tree view) ──────
  renderAssignmentPanelHTML() {
    const selected = this.state.selectedOUs;

    if (selected.length === 0) {
      return `
        <div class="card-title">${t('ous.detailsTitle')}</div>
        <div class="empty-state mt-md">
          <p class="empty-state-text">${t('ous.selectOuPanel')}</p>
        </div>`;
    }

    const header = selected.length === 1
      ? this.esc(selected[0].split(',')[0].replace(/^OU=/i, ''))
      : `${selected.length} ${t('ous.selectedOUs')}`;

    const selectedDNs = selected.map(dn => `<span class="chip" title="${this.escAttr(dn)}">${this.esc(dn.split(',')[0].replace(/^OU=/i, ''))}</span>`).join('');

    // Sync warnings (if any) for single-OU selection
    let syncBanner = '';
    if (selected.length === 1 && this.state.syncWarnings.has(selected[0])) {
      const warnings = this.state.syncWarnings.get(selected[0]);
      if (warnings.length > 0) {
        syncBanner = `
          <div class="alert alert-warning mt-sm">
            <strong>${t('ous.syncDriftTitle')}</strong>
            <p class="text-sm mt-xs">${t('ous.syncDriftDesc')}</p>
            <ul class="mt-xs" style="margin-left:18px;">
              ${warnings.map(w => `<li>${this.esc(w.gpoName)} — ${this.esc(w.reason)}</li>`).join('')}
            </ul>
          </div>`;
      }
    }

    // App list
    const q = this.state.appSearch.trim().toLowerCase();
    const filteredApps = this.state.apps.filter(a => !q || a.name.toLowerCase().includes(q));

    if (filteredApps.length === 0) {
      return `
        <div class="card-title">${t('ous.detailsTitle')}</div>
        <div class="panel-header-sub">${header}</div>
        <div class="flex flex-wrap gap-xs mt-sm">${selectedDNs}</div>
        ${syncBanner}
        ${this.renderAppSearchHTML()}
        <div class="empty-state mt-md"><p class="empty-state-text">${q ? t('ous.noAppsMatch') : t('ous.noAppsYet')}</p></div>`;
    }

    const appRows = filteredApps.map(app => this.renderAppRowHTML(app, selected)).join('');

    return `
      <div class="card-title">${t('ous.detailsTitle')}</div>
      <div class="panel-header-sub">${header}</div>
      <div class="flex flex-wrap gap-xs mt-sm">${selectedDNs}</div>
      ${syncBanner}
      ${this.renderAppSearchHTML()}
      <div class="bulk-actions-bar mt-sm">
        <button class="btn btn-sm btn-secondary" data-bulk="assign-all">${t('ous.bulkAssignAll')}</button>
        <button class="btn btn-sm btn-secondary" data-bulk="unassign-all">${t('ous.bulkUnassignAll')}</button>
        <button class="btn btn-sm btn-secondary" data-bulk="invert">${t('ous.bulkInvert')}</button>
        <button class="btn btn-sm btn-secondary" data-bulk="sync-check">${t('ous.syncCheckBtn')}</button>
      </div>
      <div class="assignment-list mt-sm">${appRows}</div>
    `;
  },

  renderAppSearchHTML() {
    return `
      <div class="ous-search-box mt-md">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="form-input" id="ous-search-app" placeholder="${t('ous.searchApps')}" value="${this.esc(this.state.appSearch)}">
      </div>`;
  },

  renderAppRowHTML(app, selected) {
    const state = this.aggregateState(app.id, selected);
    const hasPendingForRow = selected.some(dn => this.hasPending(app.id, dn));
    const hasGPO = !!app.gpoName;
    const disabled = !hasGPO;

    const checkboxClass = `assignment-checkbox state-${state} ${hasPendingForRow ? 'pending' : ''} ${disabled ? 'disabled' : ''}`;

    return `
      <div class="assignment-row ${disabled ? 'is-disabled' : ''}" data-app-id="${this.escAttr(app.id)}">
        <div class="${checkboxClass}">
          ${state === 'all' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          ${state === 'some' ? '<div class="checkbox-dash"></div>' : ''}
        </div>
        <div class="assignment-app-info">
          <div class="assignment-app-name">${this.esc(app.name)}</div>
          <div class="assignment-app-meta">
            ${hasGPO ? `<span class="badge badge-info">${this.esc(app.gpoName)}</span>` : `<span class="badge badge-warning">${t('ous.noGpoBadge')}</span>`}
            ${app.installerType ? `<span class="badge badge-neutral">${this.esc(app.installerType.toUpperCase())}</span>` : ''}
            ${hasPendingForRow ? `<span class="badge badge-pending">${t('ous.pendingBadge')}</span>` : ''}
          </div>
        </div>
      </div>`;
  },

  bindAssignmentPanelEvents() {
    const panel = document.getElementById('ous-assignment-panel');
    if (!panel) return;

    const searchInput = panel.querySelector('#ous-search-app');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.appSearch = e.target.value;
        const pos = e.target.selectionStart;
        this.refreshAssignmentPanel();
        const newInput = document.getElementById('ous-search-app');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(pos, pos);
        }
      });
    }

    panel.querySelectorAll('[data-bulk]').forEach(btn => {
      btn.addEventListener('click', () => this.handleBulkAction(btn.dataset.bulk));
    });

    panel.querySelectorAll('.assignment-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (row.classList.contains('is-disabled')) {
          App.toast(t('ous.cannotAssignNoGpo'), 'warning');
          return;
        }
        const appId = row.dataset.appId;
        this.toggleAppForSelection(appId);
      });
    });
  },

  refreshAssignmentPanel() {
    const panel = document.getElementById('ous-assignment-panel');
    if (!panel) return;
    panel.innerHTML = this.renderAssignmentPanelHTML();
    this.bindAssignmentPanelEvents();
    this.renderPendingBar();
  },

  // ─── Toggle logic (the core of the UX) ───────────────
  toggleAppForSelection(appId) {
    const selected = this.state.selectedOUs;
    if (selected.length === 0) return;
    const state = this.aggregateState(appId, selected);
    // Rules:
    //  - all   → unassign from all
    //  - none  → assign to all
    //  - some  → assign to the missing ones (normalise up)
    for (const dn of selected) {
      const currentlyAssigned = this.effectiveAssigned(appId, dn);
      if (state === 'all') {
        if (currentlyAssigned) this.setPending(appId, dn, 'unassign');
      } else {
        // 'none' or 'some' → ensure every selected OU ends up assigned
        if (!currentlyAssigned) this.setPending(appId, dn, 'assign');
      }
    }
    this.refreshAssignmentPanel();
    this.renderStatsBar();
  },

  // Put a change in the pending map, cancelling noop entries
  setPending(appId, ouDN, action) {
    const key = `${appId}::${ouDN}`;
    const app = this.state.apps.find(a => a.id === appId);
    if (!app) return;
    const alreadyAssigned = (app.assignedOUs || []).includes(ouDN);

    // If the pending action would revert to the real state, remove the entry
    if (action === 'assign' && alreadyAssigned) {
      this.state.pending.delete(key);
      return;
    }
    if (action === 'unassign' && !alreadyAssigned) {
      this.state.pending.delete(key);
      return;
    }
    this.state.pending.set(key, action);
  },

  // ─── Bulk actions (header buttons) ───────────────────
  async handleBulkAction(action) {
    const selected = this.state.selectedOUs;
    if (selected.length === 0) return;

    const q = this.state.appSearch.trim().toLowerCase();
    const apps = this.state.apps.filter(a => a.gpoName && (!q || a.name.toLowerCase().includes(q)));

    if (action === 'assign-all') {
      for (const app of apps) {
        for (const dn of selected) {
          if (!this.effectiveAssigned(app.id, dn)) this.setPending(app.id, dn, 'assign');
        }
      }
    } else if (action === 'unassign-all') {
      for (const app of apps) {
        for (const dn of selected) {
          if (this.effectiveAssigned(app.id, dn)) this.setPending(app.id, dn, 'unassign');
        }
      }
    } else if (action === 'invert') {
      for (const app of apps) {
        for (const dn of selected) {
          const cur = this.effectiveAssigned(app.id, dn);
          this.setPending(app.id, dn, cur ? 'unassign' : 'assign');
        }
      }
    } else if (action === 'sync-check') {
      if (selected.length !== 1) {
        App.toast(t('ous.syncCheckSingleOnly'), 'warning');
        return;
      }
      await this.runSyncCheck(selected[0]);
      this.refreshAssignmentPanel();
      return;
    }

    this.refreshAssignmentPanel();
    this.renderStatsBar();
  },

  // ─── Sync check (local config vs real AD state) ──────
  async runSyncCheck(ouDN) {
    try {
      const result = await window.api.ad.checkGPOConflicts(ouDN);
      if (!result.success) {
        App.toast(t('ous.syncCheckFailed') + ': ' + result.error, 'error');
        return;
      }
      const realLinks = (result.data || []).map(l => l.DisplayName).filter(Boolean);
      const localAssigned = this.state.apps
        .filter(a => a.gpoName && (a.assignedOUs || []).includes(ouDN))
        .map(a => a.gpoName);

      const warnings = [];
      // GPOs in AD but not in local config
      for (const gpo of realLinks) {
        if (!localAssigned.includes(gpo)) {
          warnings.push({ gpoName: gpo, reason: t('ous.driftInAdNotLocal') });
        }
      }
      // GPOs in local config but not actually in AD
      for (const gpo of localAssigned) {
        if (!realLinks.includes(gpo)) {
          warnings.push({ gpoName: gpo, reason: t('ous.driftInLocalNotAd') });
        }
      }

      if (warnings.length === 0) {
        App.toast(t('ous.syncCheckClean'), 'success');
        this.state.syncWarnings.delete(ouDN);
      } else {
        this.state.syncWarnings.set(ouDN, warnings);
        App.toast(t('ous.syncCheckDrift').replace('{n}', warnings.length), 'warning');
      }
    } catch (err) {
      App.toast(t('ous.syncCheckFailed') + ': ' + err.message, 'error');
    }
  },

  // ─── Context menu (right-click on OU) ────────────────
  showOUContextMenu(x, y, ouDN) {
    // Remove existing
    const existing = document.querySelector('.ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.innerHTML = `
      <div class="ctx-item" data-action="copy-from">${t('ous.ctxCopyFrom')}</div>
      <div class="ctx-item" data-action="clear-all">${t('ous.ctxClearAll')}</div>
      <div class="ctx-item" data-action="sync-check">${t('ous.ctxSyncCheck')}</div>
    `;
    document.body.appendChild(menu);

    const close = () => menu.remove();
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);

    menu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        close();
        if (action === 'copy-from') this.copyAssignmentsFrom(ouDN);
        if (action === 'clear-all') this.clearAllForOU(ouDN);
        if (action === 'sync-check') {
          this.state.selectedOUs = [ouDN];
          this.refreshTreeSelection();
          this.runSyncCheck(ouDN).then(() => this.refreshAssignmentPanel());
        }
      });
    });
  },

  copyAssignmentsFrom(targetOuDN) {
    const otherOUs = this.state.flatOUs.filter(o => o.dn !== targetOuDN);
    const options = otherOUs.map(o => `<option value="${this.escAttr(o.dn)}">${this.esc(o.name)}</option>`).join('');
    const body = `
      <p>${t('ous.copyFromDesc').replace('{ou}', '<strong>' + this.esc(targetOuDN.split(',')[0].replace(/^OU=/i, '')) + '</strong>')}</p>
      <select class="form-select mt-md" id="copy-source-select">
        <option value="">${t('ous.selectSourceOu')}</option>
        ${options}
      </select>
    `;
    const footer = `
      <button class="btn btn-secondary" id="copy-cancel">${t('common.cancel')}</button>
      <button class="btn btn-primary" id="copy-confirm">${t('ous.copyConfirmBtn')}</button>
    `;
    App.openModal(t('ous.copyFromTitle'), body, footer);

    document.getElementById('copy-cancel').addEventListener('click', () => App.closeModal());
    document.getElementById('copy-confirm').addEventListener('click', () => {
      const sourceDN = document.getElementById('copy-source-select').value;
      if (!sourceDN) {
        App.toast(t('ous.selectSourceOu'), 'warning');
        return;
      }
      const sourceAssigned = this.state.apps.filter(a => a.gpoName && (a.assignedOUs || []).includes(sourceDN));
      for (const app of sourceAssigned) {
        if (!this.effectiveAssigned(app.id, targetOuDN)) {
          this.setPending(app.id, targetOuDN, 'assign');
        }
      }
      App.closeModal();
      App.toast(t('ous.copyStaged').replace('{n}', sourceAssigned.length), 'success');
      this.renderPendingBar();
      if (this.state.selectedOUs.includes(targetOuDN)) this.refreshAssignmentPanel();
    });
  },

  clearAllForOU(ouDN) {
    const assigned = this.state.apps.filter(a => a.gpoName && (a.assignedOUs || []).includes(ouDN));
    if (assigned.length === 0) {
      App.toast(t('ous.alreadyEmpty'), 'info');
      return;
    }
    for (const app of assigned) {
      this.setPending(app.id, ouDN, 'unassign');
    }
    App.toast(t('ous.clearStaged').replace('{n}', assigned.length), 'success');
    this.renderPendingBar();
    if (this.state.selectedOUs.includes(ouDN)) this.refreshAssignmentPanel();
  },

  // ─── Pending changes bar (apply / discard) ───────────
  renderPendingBar() {
    const bar = document.getElementById('ous-pending-bar');
    if (!bar) return;
    const count = this.state.pending.size;
    if (count === 0) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }
    let assignCount = 0, unassignCount = 0;
    this.state.pending.forEach(v => { if (v === 'assign') assignCount++; else unassignCount++; });
    bar.classList.remove('hidden');
    bar.innerHTML = `
      <div class="pending-bar-info">
        <strong>${t('ous.pendingChanges').replace('{n}', count)}</strong>
        <span class="text-muted text-sm">${t('ous.pendingSummary').replace('{a}', assignCount).replace('{u}', unassignCount)}</span>
      </div>
      <div class="pending-bar-actions">
        <button class="btn btn-secondary" id="btn-discard-changes">${t('ous.discardBtn')}</button>
        <button class="btn btn-primary" id="btn-apply-changes">${t('ous.applyBtn')}</button>
      </div>
    `;
    document.getElementById('btn-discard-changes').addEventListener('click', () => this.discardChanges());
    document.getElementById('btn-apply-changes').addEventListener('click', () => this.applyChanges());
  },

  discardChanges() {
    this.state.pending.clear();
    this.refreshAssignmentPanel();
    this.renderPendingBar();
    this.renderStatsBar();
    if (this.state.view === 'matrix') this.renderMatrix();
    App.toast(t('ous.changesDiscarded'), 'info');
  },

  async applyChanges() {
    if (this.state.pending.size === 0) return;

    const toAssign = [];
    const toUnassign = [];
    this.state.pending.forEach((action, key) => {
      const [appId, ouDN] = key.split('::');
      if (action === 'assign') toAssign.push({ appId, ouDN });
      else toUnassign.push({ appId, ouDN });
    });

    const applyBtn = document.getElementById('btn-apply-changes');
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = t('ous.applying');
    }

    try {
      const result = await window.api.apps.applyAssignmentPlan({ toAssign, toUnassign });

      // Update local state.apps with the returned server state
      this.state.apps = await window.api.apps.getAll();

      // Keep only entries that failed (so user can retry or investigate)
      const succeededKeys = new Set([
        ...result.assigned.map(r => `${r.appId}::${r.ouDN}`),
        ...result.unassigned.map(r => `${r.appId}::${r.ouDN}`)
      ]);
      const remainingPending = new Map();
      this.state.pending.forEach((v, k) => {
        if (!succeededKeys.has(k)) remainingPending.set(k, v);
      });
      this.state.pending = remainingPending;

      if (result.failures.length > 0) {
        const errorList = result.failures.slice(0, 5).map(f =>
          `<li><strong>${this.esc(f.appName || f.appId)}</strong> → ${this.esc(f.ouDN.split(',')[0].replace(/^OU=/i, ''))}: ${this.esc(f.error)}</li>`
        ).join('');
        const body = `
          <p>${t('ous.applyPartial').replace('{ok}', succeededKeys.size).replace('{fail}', result.failures.length)}</p>
          <ul class="mt-sm" style="margin-left:18px; font-size:13px;">${errorList}</ul>
          ${result.failures.length > 5 ? `<p class="text-muted text-sm mt-xs">… +${result.failures.length - 5}</p>` : ''}
        `;
        App.openModal(t('ous.applyErrorsTitle'), body, `<button class="btn btn-primary" onclick="App.closeModal()">${t('common.close')}</button>`);
      } else {
        App.toast(t('ous.applySuccess').replace('{n}', succeededKeys.size), 'success');
      }

      // Log activity
      try {
        await window.api.activity.add('ou_assignments_applied', {
          assigned: result.assigned.length,
          unassigned: result.unassigned.length,
          failed: result.failures.length
        });
      } catch (e) {}

      this.renderStatsBar();
      this.renderMain();
      this.renderPendingBar();
    } catch (err) {
      App.toast(t('common.error') + ': ' + err.message, 'error');
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = t('ous.applyBtn');
      }
    }
  },

  // ─── Matrix view ─────────────────────────────────────
  renderMatrix() {
    const mainArea = document.getElementById('ous-main-area');
    if (!mainArea) return;

    if (this.state.apps.length === 0 || this.state.flatOUs.length === 0) {
      mainArea.innerHTML = `<div class="empty-state"><p class="empty-state-text">${t('ous.matrixEmpty')}</p></div>`;
      return;
    }

    const q = this.state.appSearch.trim().toLowerCase();
    const apps = this.state.apps.filter(a => !q || a.name.toLowerCase().includes(q));
    const ouQ = this.state.ouSearch.trim().toLowerCase();
    const ous = this.state.flatOUs.filter(o => !ouQ || o.name.toLowerCase().includes(ouQ));

    const headerCells = ous.map(o =>
      `<th class="matrix-col-head" title="${this.escAttr(o.dn)}"><div class="matrix-col-head-inner">${this.esc(o.name)}</div></th>`
    ).join('');

    const rows = apps.map(app => {
      const cells = ous.map(o => {
        const assigned = this.effectiveAssigned(app.id, o.dn);
        const pending = this.hasPending(app.id, o.dn);
        const disabled = !app.gpoName;
        return `
          <td class="matrix-cell ${disabled ? 'is-disabled' : ''}" data-app-id="${this.escAttr(app.id)}" data-ou-dn="${this.escAttr(o.dn)}">
            <div class="assignment-checkbox state-${assigned ? 'all' : 'none'} ${pending ? 'pending' : ''} ${disabled ? 'disabled' : ''}">
              ${assigned ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
          </td>`;
      }).join('');
      return `
        <tr>
          <td class="matrix-row-head">
            <div class="matrix-app-name">${this.esc(app.name)}</div>
            ${app.gpoName ? `<div class="matrix-app-gpo">${this.esc(app.gpoName)}</div>` : `<div class="matrix-app-gpo text-muted">${t('ous.noGpoBadge')}</div>`}
          </td>
          ${cells}
        </tr>`;
    }).join('');

    mainArea.innerHTML = `
      <div class="matrix-search-bar">
        <div class="ous-search-box">
          <input type="text" class="form-input" id="matrix-search-ou" placeholder="${t('ous.searchOUs')}" value="${this.esc(this.state.ouSearch)}">
        </div>
        <div class="ous-search-box">
          <input type="text" class="form-input" id="matrix-search-app" placeholder="${t('ous.searchApps')}" value="${this.esc(this.state.appSearch)}">
        </div>
      </div>
      <div class="matrix-wrapper">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="matrix-row-head-spacer">${t('ous.matrixAppsHeader')}</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    const restoreFocus = (id, pos) => {
      const el = document.getElementById(id);
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    };
    document.getElementById('matrix-search-ou').addEventListener('input', (e) => {
      this.state.ouSearch = e.target.value;
      const pos = e.target.selectionStart;
      this.renderMatrix();
      restoreFocus('matrix-search-ou', pos);
    });
    document.getElementById('matrix-search-app').addEventListener('input', (e) => {
      this.state.appSearch = e.target.value;
      const pos = e.target.selectionStart;
      this.renderMatrix();
      restoreFocus('matrix-search-app', pos);
    });

    mainArea.querySelectorAll('.matrix-cell:not(.is-disabled)').forEach(cell => {
      cell.addEventListener('click', () => {
        const appId = cell.dataset.appId;
        const ouDN = cell.dataset.ouDn;
        const assigned = this.effectiveAssigned(appId, ouDN);
        this.setPending(appId, ouDN, assigned ? 'unassign' : 'assign');
        this.renderMatrix();
        this.renderPendingBar();
      });
    });
  },

  // ─── Utilities ───────────────────────────────────────
  esc(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  },

  escAttr(str) {
    return (str == null ? '' : String(str))
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
