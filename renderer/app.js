// ═══════════════════════════════════════════════════════
// AD App Deploy Manager – Main Renderer (SPA Router)
// ═══════════════════════════════════════════════════════

window.langDict = {};

window.t = function(key) {
  const parts = key.split('.');
  let val = window.langDict;
  for (const part of parts) {
    if (val === undefined || val === null) break;
    val = val[part];
  }
  return val || key;
};

window.initI18n = async function() {
  const config = await window.api.config.get();
  const lang = config.language || 'en';
  window.langDict = await window.api.i18n.getTranslations(lang);
};

const App = {
  currentPage: 'dashboard',
  rsatAvailable: false,
  rsatMissingGPMC: false,
  shareAvailable: true,

  async init() {
    await window.initI18n();

    this.bindWindowControls();
    this.bindNavigation();
    this.bindModal();
    await this.checkRSAT();

    const config = await window.api.config.get();
    if (config.firstRun || !config.networkSharePath) {
      document.querySelector('.sidebar').style.display = 'none';
      this.navigate('setup');
    } else {
      // Check share health before first navigation
      await this.checkShareHealth();
      this.updateSidebarLanguage();
      this.navigate('dashboard');
    }
  },

  updateSidebarLanguage() {
    document.querySelector('.nav-item[data-page="dashboard"] span').textContent = t('nav.dashboard');
    document.querySelector('.nav-item[data-page="ous"] span').textContent = t('nav.ous');
    document.querySelector('.nav-item[data-page="gpos"] span').textContent = t('nav.gpos');
    document.querySelector('.nav-item[data-page="apps"] span').textContent = t('nav.apps');
    document.querySelector('.nav-item[data-page="catalog"] span').textContent = t('nav.catalog');
    document.querySelector('.nav-item[data-page="bundles"] span').textContent = t('nav.bundles');
    document.querySelector('.nav-item[data-page="deployments"] span').textContent = t('nav.deployments');
    document.querySelector('.nav-item[data-page="settings"] span').textContent = t('nav.settings');
  },

  // ─── Window Controls ───────────────────────────────
  bindWindowControls() {
    document.getElementById('btn-minimize')?.addEventListener('click', () => {
      window.api.window.minimize();
    });
    document.getElementById('btn-maximize')?.addEventListener('click', () => {
      window.api.window.maximize();
    });
    document.getElementById('btn-close')?.addEventListener('click', () => {
      window.api.window.close();
    });
  },

  // ─── Navigation ────────────────────────────────────
  bindNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(item.dataset.page);
      });
    });
  },

  navigate(page) {
    this.currentPage = page;
    // Update active nav
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    // Render page
    const container = document.getElementById('main-content');
    container.innerHTML = '<div class="spinner"></div><p class="loading-text">' + t('common.loading') + '</p>';

    setTimeout(async () => {
      switch (page) {
        case 'setup': await SetupPage.render(container); break;
        case 'dashboard': await DashboardPage.render(container); break;
        case 'ous': await OUsPage.render(container); break;
        case 'gpos': await GposPage.render(container); break;
        case 'apps': await AppsPage.render(container); break;
        case 'catalog': await CatalogPage.render(container); break;
        case 'bundles': await BundlesPage.render(container); break;
        case 'deployments': await DeploymentsPage.render(container); break;
        case 'settings': await SettingsPage.render(container); break;
        default: container.innerHTML = '<p>' + t('common.pageNotFound') + '</p>';
      }
    }, 80);
  },

  // ─── RSAT Check ────────────────────────────────────
  async checkRSAT() {
    const statusEl = document.getElementById('rsat-status');
    statusEl.className = 'rsat-status checking';
    statusEl.querySelector('.rsat-text').textContent = t('common.checkingRsat');

    try {
      const result = await window.api.ad.checkRSAT();
      this.rsatAvailable = result.available;
      this.rsatMissingGPMC = result.missingGPMC || false;
      
      if (this.rsatMissingGPMC) {
        statusEl.className = 'rsat-status warning';
        statusEl.querySelector('.rsat-text').textContent = t('common.rsatMissingGpmc');
      } else {
        statusEl.className = `rsat-status ${result.available ? 'ok' : 'error'}`;
        statusEl.querySelector('.rsat-text').textContent = result.available ? 'RSAT OK' : t('common.rsatNotAvailable');
      }
    } catch (err) {
      this.rsatAvailable = false;
      this.rsatMissingGPMC = false;
      statusEl.className = 'rsat-status error';
      statusEl.querySelector('.rsat-text').textContent = t('common.rsatError');
    }
  },

  // ─── Modal ─────────────────────────────────────────
  _modalLocked: false,

  bindModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', () => { if (!this._modalLocked) this.closeModal(); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !this._modalLocked) this.closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this._modalLocked) this.closeModal();
    });
  },

  applyModalOptions(options = {}) {
    const modal = document.getElementById('modal');
    if (!modal) return;

    modal.classList.remove('modal-wide', 'modal-full');
    if (options.size === 'wide') modal.classList.add('modal-wide');
    if (options.size === 'full') modal.classList.add('modal-full');
  },

  openModal(title, bodyHTML, footerHTML = '', options = {}) {
    this._modalLocked = false;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    this.applyModalOptions(options);
    document.getElementById('modal-overlay').classList.add('visible');
  },

  openModalLocked(title, bodyHTML, footerHTML = '', options = {}) {
    this._modalLocked = true;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    this.applyModalOptions(options);
    document.getElementById('modal-overlay').classList.add('visible');
  },

  closeModal() {
    this._modalLocked = false;
    document.getElementById('modal-overlay').classList.remove('visible');
    this.applyModalOptions();
  },

  // ─── Share error helper ────────────────────────────
  isShareError(errorStr) {
    return typeof errorStr === 'string' && errorStr.includes('SHARE_UNAVAILABLE');
  },

  handleShareError() {
    this.shareAvailable = false;
    this.updateShareBanner();
    this.toast('El share de red no esta disponible. Comprueba la conexion y pulsa Reintentar.', 'error');
  },

  // ─── Toast ─────────────────────────────────────────
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.innerHTML = icons[type] || icons.info;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message; // textContent prevents XSS
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // ─── RSAT Warning Banner HTML ──────────────────────
  rsatWarningHTML() {
    if (this.rsatAvailable && !this.rsatMissingGPMC) return '';
    
    if (this.rsatMissingGPMC) {
      return `
        <div class="rsat-warning" style="background-color: var(--secondary-color); border-left-color: #f39c12;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f39c12" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <strong style="color:#f39c12">${t('common.rsatWarningTitle')}</strong> — ${t('common.rsatWarningMsg')}
            <code>Add-WindowsCapability -Online -Name Rsat.GroupPolicy.Management.Tools~~~~0.0.1.0</code>
          </div>
        </div>`;
    }
    
    return `
      <div class="rsat-warning">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div>
          <strong>${t('common.rsatNotInstalledTitle')}</strong> — ${t('common.rsatNotInstalledMsg')}
          Ejecuta como Administrador en PowerShell:
          <code>Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0</code>
        </div>
      </div>`;
  },

  // ─── Share Health Check ────────────────────────────
  async checkShareHealth() {
    try {
      const status = await window.api.share.checkHealth();
      this.shareAvailable = !!status?.available;
    } catch {
      this.shareAvailable = false;
    }
    this.updateShareBanner();
    return this.shareAvailable;
  },

  updateShareBanner() {
    let banner = document.getElementById('share-offline-banner');
    if (this.shareAvailable) {
      if (banner) banner.remove();
      return;
    }
    if (banner) return; // already showing
    banner = document.createElement('div');
    banner.id = 'share-offline-banner';
    banner.style.cssText = 'position:fixed;top:32px;left:0;right:0;z-index:9999;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 20px;background:rgba(239,68,68,0.95);color:#fff;font-size:13px;font-weight:600;backdrop-filter:blur(6px);';
    banner.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>No se puede acceder al share de red. La aplicacion funciona en modo local hasta que se restablezca la conexion.</span>
      <button id="btn-retry-share" style="margin-left:auto;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:6px;padding:4px 14px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;">Reintentar</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('btn-retry-share').addEventListener('click', async () => {
      const btn = document.getElementById('btn-retry-share');
      if (btn) { btn.disabled = true; btn.textContent = 'Comprobando...'; }
      const ok = await this.checkShareHealth();
      if (ok) {
        this.toast('Conexion al share restablecida', 'success');
        // Re-render current page to refresh data
        this.navigate(this.currentPage);
      } else {
        this.toast('El share sigue sin estar disponible', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Reintentar'; }
      }
    });
  },

  shareWarningHTML() {
    if (this.shareAvailable) return '';
    return `
      <div class="rsat-warning" style="border-left-color:#ef4444;background:rgba(239,68,68,0.08);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <strong style="color:#ef4444;">Share no disponible</strong> — Los datos mostrados pueden estar desactualizados. Las operaciones de despliegue no funcionaran hasta que se restablezca la conexion.
        </div>
      </div>`;
  },

  // ─── Utils ─────────────────────────────────────────
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    let ts = dateStr;
    // Handle PowerShell /Date(timestamp)/ format
    if (typeof dateStr === 'string' && dateStr.includes('/Date(')) {
      const match = dateStr.match(/\/Date\((\d+)\)\//);
      ts = match ? parseInt(match[1]) : dateStr;
    }
    // Handle PowerShell Date(timestamp) format without slashes
    if (typeof dateStr === 'string' && dateStr.includes('Date(')) {
      const match = dateStr.match(/\d+/);
      ts = match ? parseInt(match[0]) : dateStr;
    }
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  },

  // ─── Shared OU Picker Component HTML ──────────────────
  ouPickerTreeHTML(nodes, query, selectedDN) {
    if (!nodes || !nodes.length) return '';
    const q = (query || '').trim().toLowerCase();
    const selectedDNs = Array.isArray(selectedDN)
      ? selectedDN.filter(Boolean)
      : (selectedDN ? [selectedDN] : []);
    let html = '<ul class="tree" style="margin:0;padding-left:0;">';
    for (const node of nodes) {
      if (q && !this.ouNodeMatchesSearch(node, q)) continue;
      const hasChildren = node.children && node.children.length > 0;
      const isSelected = selectedDNs.includes(node.dn);
      // Auto-expand: when searching, when selected, or when selected is a descendant
      const selectedIsDescendant = selectedDNs.some(dn => dn !== node.dn && dn.includes(node.dn));
      const shouldExpand = q ? true : (isSelected || !!selectedIsDescendant);
      
      const escName = this._esc(node.name);
      
      html += `
        <li class="tree-item">
          <div class="tree-node ${isSelected ? 'selected' : ''}" data-dn="${this._esc(node.dn)}" data-name="${escName}">
            <button class="tree-toggle ${hasChildren ? (shouldExpand ? 'expanded' : '') : 'empty'}" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <span class="tree-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span class="tree-label">${escName}</span>
          </div>
          ${hasChildren ? `<div class="tree-children ${shouldExpand ? '' : 'collapsed'}">${this.ouPickerTreeHTML(node.children, query, selectedDN)}</div>` : ''}
        </li>`;
    }
    html += '</ul>';
    return html;
  },

  ouNodeMatchesSearch(node, q) {
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.children) {
      for (const child of node.children) {
        if (this.ouNodeMatchesSearch(child, q)) return true;
      }
    }
    return false;
  },
  
  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
