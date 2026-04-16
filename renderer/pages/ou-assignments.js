// ═══════════════════════════════════════════════════════
// ou-assignments.js — OUsPage extension: assignment panel
// (right side of tree view), toggle logic, pending bar,
// apply/discard, sync check.
//
// Loaded after ou-tree.js. Extends OUsPage via Object.assign.
// ═══════════════════════════════════════════════════════

Object.assign(OUsPage, {

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
      row.addEventListener('click', () => {
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
    if (this.state.view === 'assignments') this.renderAssignmentsView();
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
  }

});
