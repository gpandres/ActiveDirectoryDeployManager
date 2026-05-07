// ═══════════════════════════════════════════════════════
// ou-gpo-modal.js — OUsPage extension: assignments matrix
// view — OU picker (step 1) and assignment grid (step 2).
//
// Loaded after ou-assignments.js. Extends OUsPage via
// Object.assign.
// ═══════════════════════════════════════════════════════

Object.assign(OUsPage, {

  // ─── Assignments view (formerly "matrix") ────────────
  // Step 1 — OU picker, Step 2 — the actual grid
  renderAssignmentsView() {
    if (this.state.assignmentOUs.length === 0 || this.state.pickerOpen) {
      this.renderOUPicker();
    } else {
      this.renderAssignmentGrid();
    }
  },

  // ── Step 1: OU picker ─────────────────────────────────
  renderOUPicker() {
    const mainArea = document.getElementById('ous-main-area');
    if (!mainArea) return;

    const q = this.state.assignmentOUSearch.trim().toLowerCase();
    const filtered = this.state.flatOUs.filter(o => !q || o.name.toLowerCase().includes(q));
    const selectedSet = new Set(this.state.assignmentOUs);

    const rows = filtered.map(o => {
      const checked = selectedSet.has(o.dn);
      const indent = 'padding-left:' + (16 + o.depth * 18) + 'px';
      const count = this.assignmentCountByOU(o.dn);
      const hasSiblings = filtered.some(other => other.dn !== o.dn
        && other.parentDN === o.parentDN
        && other.depth === o.depth);
      return `
        <label class="ou-picker-row ${checked ? 'checked' : ''}" style="${indent}" data-dn="${this.escAttr(o.dn)}">
          <div class="assignment-checkbox state-${checked ? 'all' : 'none'} small">
            ${checked ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
          <input type="checkbox" class="sr-only" value="${this.escAttr(o.dn)}" ${checked ? 'checked' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; color:var(--text-muted)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span class="ou-picker-name">${App._esc(o.name)}</span>
          ${count > 0 ? `<span class="tree-badge">${count}</span>` : ''}
          ${hasSiblings ? `
            <button type="button" class="ou-picker-siblings-btn" data-dn="${this.escAttr(o.dn)}" title="${this.escAttr(t('ous.pickerSelectSiblings'))}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="4" cy="6" r="1.5"/>
                <circle cx="4" cy="12" r="1.5"/>
                <circle cx="4" cy="18" r="1.5"/>
              </svg>
            </button>` : ''}
        </label>`;
    }).join('');

    const selectedCount = selectedSet.size;

    mainArea.innerHTML = `
      <div class="ou-picker-card card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div class="card-title">${t('ous.pickerTitle')}</div>
            <p class="text-muted text-sm mt-xs">${t('ous.pickerSubtitle')}</p>
          </div>
          ${selectedCount > 0 ? `
            <button class="btn btn-primary" id="btn-picker-confirm">
              ${t('ous.pickerConfirm').replace('{n}', selectedCount)}
            </button>` : ''}
        </div>

        <div class="ou-picker-toolbar">
          <div class="ous-search-box" style="flex:1; margin-top:0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="ou-picker-search" placeholder="${t('ous.pickerSearch')}" value="${App._esc(this.state.assignmentOUSearch)}">
          </div>
          <button class="btn btn-sm btn-secondary" id="btn-picker-select-all">${t('ous.pickerSelectAll')}</button>
          <button class="btn btn-sm btn-secondary" id="btn-picker-clear">${t('ous.pickerClear')}</button>
        </div>

        <div class="ou-picker-list mt-sm">
          ${rows.length ? rows : `<p class="text-muted text-sm" style="padding:12px;">${t('ous.noOusFound')}</p>`}
        </div>

        ${selectedCount > 0 ? `
          <div class="ou-picker-footer">
            <span class="text-muted text-sm">${t('ous.pickerSelected').replace('{n}', selectedCount)}</span>
            <button class="btn btn-primary" id="btn-picker-confirm-bottom">
              ${t('ous.pickerConfirm').replace('{n}', selectedCount)}
            </button>
          </div>` : ''}
      </div>
    `;

    // Search
    const searchInput = document.getElementById('ou-picker-search');
    searchInput.addEventListener('input', (e) => {
      this.state.assignmentOUSearch = e.target.value;
      const pos = e.target.selectionStart;
      this.renderOUPicker();
      const el = document.getElementById('ou-picker-search');
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });

    // Sibling-select buttons (must be bound before row clicks so we can stopPropagation)
    mainArea.querySelectorAll('.ou-picker-siblings-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectSiblingsOf(btn.dataset.dn);
      });
    });

    // Checkboxes
    mainArea.querySelectorAll('.ou-picker-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return; // handled separately
        if (e.target.closest('.ou-picker-siblings-btn')) return; // handled separately
        const cb = row.querySelector('input[type="checkbox"]');
        cb.checked = !cb.checked;
        const dn = cb.value;
        if (cb.checked) {
          if (!this.state.assignmentOUs.includes(dn)) {
            // Insert in flat order
            const flatIndex = this.state.flatOUs.findIndex(o => o.dn === dn);
            let inserted = false;
            for (let i = 0; i < this.state.assignmentOUs.length; i++) {
              const fi = this.state.flatOUs.findIndex(o => o.dn === this.state.assignmentOUs[i]);
              if (fi > flatIndex) {
                this.state.assignmentOUs.splice(i, 0, dn);
                inserted = true;
                break;
              }
            }
            if (!inserted) this.state.assignmentOUs.push(dn);
          }
        } else {
          this.state.assignmentOUs = this.state.assignmentOUs.filter(d => d !== dn);
        }
        row.classList.toggle('checked', cb.checked);
        const checkEl = row.querySelector('.assignment-checkbox');
        if (checkEl) {
          checkEl.className = `assignment-checkbox state-${cb.checked ? 'all' : 'none'} small`;
          checkEl.innerHTML = cb.checked ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
        }
        // Re-render to update footer count — keep search box focused
        const scrollTop = mainArea.querySelector('.ou-picker-list')?.scrollTop || 0;
        this.renderOUPicker();
        mainArea.querySelector('.ou-picker-list').scrollTop = scrollTop;
      });
    });

    // Select all / clear
    document.getElementById('btn-picker-select-all')?.addEventListener('click', () => {
      const qFiltered = this.state.flatOUs.filter(o => {
        const q2 = this.state.assignmentOUSearch.trim().toLowerCase();
        return !q2 || o.name.toLowerCase().includes(q2);
      });
      qFiltered.forEach(o => {
        if (!this.state.assignmentOUs.includes(o.dn)) this.state.assignmentOUs.push(o.dn);
      });
      this.renderOUPicker();
    });
    document.getElementById('btn-picker-clear')?.addEventListener('click', () => {
      const qFiltered = new Set(this.state.flatOUs.filter(o => {
        const q2 = this.state.assignmentOUSearch.trim().toLowerCase();
        return !q2 || o.name.toLowerCase().includes(q2);
      }).map(o => o.dn));
      this.state.assignmentOUs = this.state.assignmentOUs.filter(d => !qFiltered.has(d));
      this.renderOUPicker();
    });

    // Confirm
    const confirm = () => {
      if (this.state.assignmentOUs.length === 0) {
        App.toast(t('ous.pickerSelectAtLeastOne'), 'warning');
        return;
      }
      this.state.pickerOpen = false;
      this.renderAssignmentGrid();
    };
    document.getElementById('btn-picker-confirm')?.addEventListener('click', confirm);
    document.getElementById('btn-picker-confirm-bottom')?.addEventListener('click', confirm);
  },

  // Toggle selection of all siblings (same parentDN + depth) matching the
  // current search filter. If every visible sibling — including the source —
  // is already selected, the whole group is deselected. Otherwise the whole
  // group is selected (preserving flat-tree order).
  selectSiblingsOf(dn) {
    const target = this.state.flatOUs.find(o => o.dn === dn);
    if (!target) return;

    const q = this.state.assignmentOUSearch.trim().toLowerCase();
    const siblings = this.state.flatOUs.filter(o =>
      o.parentDN === target.parentDN &&
      o.depth === target.depth &&
      (!q || o.name.toLowerCase().includes(q))
    );
    if (siblings.length === 0) return;

    const selected = new Set(this.state.assignmentOUs);
    const allSelected = siblings.every(o => selected.has(o.dn));

    if (allSelected) {
      const remove = new Set(siblings.map(o => o.dn));
      this.state.assignmentOUs = this.state.assignmentOUs.filter(d => !remove.has(d));
    } else {
      for (const o of siblings) selected.add(o.dn);
      // Preserve flat-tree order
      this.state.assignmentOUs = this.state.flatOUs
        .filter(o => selected.has(o.dn))
        .map(o => o.dn);
    }

    const mainArea = document.getElementById('ous-main-area');
    const scrollTop = mainArea?.querySelector('.ou-picker-list')?.scrollTop || 0;
    this.renderOUPicker();
    const list = mainArea?.querySelector('.ou-picker-list');
    if (list) list.scrollTop = scrollTop;
  },

  // ── Step 2: Assignment grid ────────────────────────────
  renderAssignmentGrid() {
    const mainArea = document.getElementById('ous-main-area');
    if (!mainArea) return;

    const ous = this.state.assignmentOUs
      .map(dn => this.state.flatOUs.find(o => o.dn === dn))
      .filter(Boolean);

    const q = this.state.appSearch.trim().toLowerCase();
    const apps = this.state.apps.filter(a => !q || a.name.toLowerCase().includes(q));

    if (apps.length === 0) {
      mainArea.innerHTML = `
        <div class="assignments-toolbar">
          ${this.renderAssignmentsToolbarHTML(ous.length)}
        </div>
        <div class="empty-state mt-md"><p class="empty-state-text">${t('ous.noAppsYet')}</p></div>`;
      this.bindAssignmentsToolbar();
      return;
    }

    // Build header cells (horizontal names, truncated)
    const colWidth = 120;
    const headerCells = ous.map(o =>
      `<div class="ag-col-head" style="width:${colWidth}px; min-width:${colWidth}px;" title="${this.escAttr(o.dn)}">
        <span class="ag-col-name">${App._esc(o.name)}</span>
        <span class="ag-col-count">${this.assignmentCountByOU(o.dn)}</span>
      </div>`
    ).join('');

    // Build rows
    const rowsHTML = apps.map(app => {
      const disabled = !app.gpoName;
      const cells = ous.map(o => {
        const assigned = this.effectiveAssigned(app.id, o.dn);
        const pending = this.hasPending(app.id, o.dn);
        return `
          <div class="ag-cell ${disabled ? 'is-disabled' : ''} ${assigned ? 'is-assigned' : ''} ${pending ? 'is-pending' : ''}"
               style="width:${colWidth}px; min-width:${colWidth}px;"
               data-app-id="${this.escAttr(app.id)}"
               data-ou-dn="${this.escAttr(o.dn)}">
            <div class="assignment-checkbox state-${assigned ? 'all' : 'none'} ${pending ? 'pending' : ''} ${disabled ? 'disabled' : ''}">
              ${assigned ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
          </div>`;
      }).join('');

      return `
        <div class="ag-row">
          <div class="ag-row-head">
            <div class="ag-app-name">${App._esc(app.name)}</div>
            ${app.gpoName
              ? `<span class="badge badge-info" style="font-size:10px;">${App._esc(app.gpoName)}</span>`
              : `<span class="badge badge-warning" style="font-size:10px;">${t('ous.noGpoBadge')}</span>`}
          </div>
          <div class="ag-cells">${cells}</div>
        </div>`;
    }).join('');

    mainArea.innerHTML = `
      <div class="assignments-toolbar">
        ${this.renderAssignmentsToolbarHTML(ous.length)}
      </div>
      <div class="ag-container">
        <!-- Sticky header row -->
        <div class="ag-header">
          <div class="ag-row-head-spacer">${t('ous.matrixAppsHeader')}</div>
          <div class="ag-col-heads">${headerCells}</div>
        </div>
        <!-- Scrollable body -->
        <div class="ag-body">${rowsHTML}</div>
      </div>
    `;

    this.bindAssignmentsToolbar();

    // Cell clicks
    mainArea.querySelectorAll('.ag-cell:not(.is-disabled)').forEach(cell => {
      cell.addEventListener('click', () => {
        const appId = cell.dataset.appId;
        const ouDN = cell.dataset.ouDn;
        this.setPending(appId, ouDN, this.effectiveAssigned(appId, ouDN) ? 'unassign' : 'assign');
        // Update this cell in-place (no full re-render — keeps scroll position)
        const assigned = this.effectiveAssigned(appId, ouDN);
        const pending = this.hasPending(appId, ouDN);
        cell.classList.toggle('is-assigned', assigned);
        cell.classList.toggle('is-pending', pending);
        const cb = cell.querySelector('.assignment-checkbox');
        cb.className = `assignment-checkbox state-${assigned ? 'all' : 'none'} ${pending ? 'pending' : ''}`;
        cb.innerHTML = assigned ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
        this.renderPendingBar();
      });
    });
  },

  renderAssignmentsToolbarHTML(ouCount) {
    const q = this.state.appSearch;
    return `
      <div class="ous-search-box" style="flex:1; margin-top:0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="form-input" id="ag-search-app" placeholder="${t('ous.searchApps')}" value="${App._esc(q)}">
      </div>
      <span class="text-muted text-sm" style="white-space:nowrap;">${ouCount} ${t('ous.assignmentsOUCount')}</span>
      <button class="btn btn-sm btn-secondary" id="btn-change-ous">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        ${t('ous.changeOUs')}
      </button>
    `;
  },

  bindAssignmentsToolbar() {
    const searchInput = document.getElementById('ag-search-app');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.appSearch = e.target.value;
        const pos = e.target.selectionStart;
        this.renderAssignmentGrid();
        const el = document.getElementById('ag-search-app');
        if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      });
    }
    document.getElementById('btn-change-ous')?.addEventListener('click', () => {
      this.state.pickerOpen = true;
      this.renderOUPicker();
    });
  }

});
