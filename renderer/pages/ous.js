// ═══════════════════════════════════════════════════════
// Organizational Units Page
// ═══════════════════════════════════════════════════════

const OUsPage = {
  selectedOU: null,

  async render(container) {
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
        <button class="btn btn-secondary" id="btn-refresh-ous">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          ${t('ous.refresh')}
        </button>
      </div>

      ${App.rsatWarningHTML()}

      <div class="flex gap-lg" style="align-items:flex-start;">
        <div class="card" style="flex:1; min-width:300px;">
          <div class="card-title">${t('ous.treeTitle')}</div>
          <div id="ou-tree-container" class="mt-md">
            ${App.rsatAvailable ?
              '<div class="spinner"></div><p class="loading-text">' + t('ous.loadingOus') + '</p>' :
              '<div class="empty-state"><p class="empty-state-text">' + t('ous.emptyOusRsat') + '</p></div>'
            }
          </div>
        </div>

        <div class="card" style="flex:1; min-width:300px;" id="ou-detail-panel">
          <div class="card-title">${t('ous.detailsTitle')}</div>
          <div class="empty-state mt-md">
            <p class="empty-state-text">${t('ous.selectOuPanel')}</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-refresh-ous').addEventListener('click', () => this.loadOUs());

    if (App.rsatAvailable) {
      this.loadOUs();
    }
  },

  async loadOUs() {
    const treeContainer = document.getElementById('ou-tree-container');
    treeContainer.innerHTML = '<div class="spinner"></div><p class="loading-text">' + t('ous.loadingOus') + '</p>';

    try {
      const result = await window.api.ad.getOUs();
      if (result.success && result.data.length > 0) {
        treeContainer.innerHTML = this.renderTree(result.data);
        this.bindTreeEvents();
      } else {
        treeContainer.innerHTML = `
          <div class="empty-state">
            <p class="empty-state-text">${result.error || t('ous.noOusFound')}</p>
          </div>`;
      }
    } catch (err) {
      treeContainer.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-text">${t('ous.errorConnecting')} ${err.message}</p>
        </div>`;
    }
  },

  renderTree(nodes) {
    if (!nodes || nodes.length === 0) return '';
    let html = '<ul class="tree">';
    for (const node of nodes) {
      const hasChildren = node.children && node.children.length > 0;
      html += `
        <li class="tree-item">
          <div class="tree-node" data-dn="${this.escapeAttr(node.dn)}">
            <button class="tree-toggle ${hasChildren ? '' : 'empty'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <span class="tree-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span>${this.escapeHTML(node.name)}</span>
          </div>
          ${hasChildren ? `<div class="tree-children collapsed">${this.renderTree(node.children)}</div>` : ''}
        </li>`;
    }
    html += '</ul>';
    return html;
  },

  bindTreeEvents() {
    document.querySelectorAll('.tree-toggle:not(.empty)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const li = btn.closest('.tree-item');
        const children = li.querySelector('.tree-children');
        if (children) {
          children.classList.toggle('collapsed');
          btn.classList.toggle('expanded');
        }
      });
    });

    document.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('click', () => {
        document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
        this.showOUDetail(node.dataset.dn);
      });
    });
  },

  async showOUDetail(dn) {
    this.selectedOU = dn;
    const panel = document.getElementById('ou-detail-panel');
    const ouName = dn.split(',')[0].replace('OU=', '');

    // Get apps to show which are assigned to this OU
    let apps = [];
    try {
      apps = await window.api.apps.getAll();
    } catch (e) {}

    const assignedApps = apps.filter(a => a.assignedOUs && a.assignedOUs.includes(dn));
    const unassignedApps = apps.filter(a => !a.assignedOUs || !a.assignedOUs.includes(dn));

    panel.innerHTML = `
      <div class="card-title">${this.escapeHTML(ouName)}</div>
      <p class="text-muted text-sm mt-sm mb-md" style="word-break:break-all;">${this.escapeHTML(dn)}</p>

      <div class="mb-md">
        <strong class="text-sm" style="color:var(--text-secondary)">${t('ous.assignedApps')} (${assignedApps.length})</strong>
        ${assignedApps.length > 0 ? `
          <div class="mt-sm">
            ${assignedApps.map(app => `
              <div class="flex items-center justify-between" style="padding:6px 0; border-bottom:1px solid var(--border-color);">
                <div>
                  <span style="color:var(--text-primary)">${this.escapeHTML(app.name)}</span>
                  ${app.gpoName ? `<span class="badge badge-info" style="margin-left:8px">${this.escapeHTML(app.gpoName)}</span>` : ''}
                </div>
                <button class="btn btn-danger btn-sm" onclick="OUsPage.unassignApp('${app.id}', '${this.escapeAttr(dn)}')">${t('ous.removeBtn')}</button>
              </div>
            `).join('')}
          </div>
        ` : `<p class="text-muted text-sm mt-sm">${t('ous.unassignedAppsEmpty')}</p>`}
      </div>

      ${unassignedApps.length > 0 ? `
        <div class="mt-lg">
          <strong class="text-sm" style="color:var(--text-secondary)">${t('ous.assignAppTitle')}</strong>
          <div class="flex gap-sm mt-sm">
            <select class="form-select" id="assign-app-select" style="flex:1;">
              <option value="">${t('ous.selectAppSelect')}</option>
              ${unassignedApps.map(app => `<option value="${app.id}">${this.escapeHTML(app.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" onclick="OUsPage.assignApp()">${t('ous.assignBtn')}</button>
          </div>
        </div>
      ` : ''}
    `;
  },

  async assignApp() {
    const select = document.getElementById('assign-app-select');
    const appId = select.value;
    if (!appId || !this.selectedOU) return;

    try {
      const app = await window.api.apps.get(appId);
      const ous = app.assignedOUs || [];
      ous.push(this.selectedOU);
      await window.api.apps.update(appId, { assignedOUs: ous });
      App.toast(t('ous.appAssignedSuccess'), 'success');
      this.showOUDetail(this.selectedOU);
    } catch (err) {
      App.toast(t('common.error') + ': ' + err.message, 'error');
    }
  },

  async unassignApp(appId, ouDN) {
    try {
      const app = await window.api.apps.get(appId);
      const ous = (app.assignedOUs || []).filter(ou => ou !== ouDN);
      await window.api.apps.update(appId, { assignedOUs: ous });
      App.toast(t('ous.appUnassignedSuccess'), 'success');
      this.showOUDetail(ouDN);
    } catch (err) {
      App.toast(t('common.error') + ': ' + err.message, 'error');
    }
  },

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  escapeAttr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }
};
