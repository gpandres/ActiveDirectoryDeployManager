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
      this.updateSidebarLanguage();
      this.navigate('dashboard');
    }
  },

  updateSidebarLanguage() {
    document.querySelector('.nav-item[data-page="dashboard"] span').textContent = t('nav.dashboard');
    document.querySelector('.nav-item[data-page="ous"] span').textContent = t('nav.ous');
    document.querySelector('.nav-item[data-page="gpos"] span').textContent = t('nav.gpos');
    document.querySelector('.nav-item[data-page="apps"] span').textContent = t('nav.apps');
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
    container.innerHTML = '<div class="spinner"></div><p class="loading-text">Cargando...</p>';

    setTimeout(async () => {
      switch (page) {
        case 'setup': await SetupPage.render(container); break;
        case 'dashboard': await DashboardPage.render(container); break;
        case 'ous': await OUsPage.render(container); break;
        case 'gpos': await GposPage.render(container); break;
        case 'apps': await AppsPage.render(container); break;
        case 'bundles': await BundlesPage.render(container); break;
        case 'deployments': await DeploymentsPage.render(container); break;
        case 'settings': await SettingsPage.render(container); break;
        default: container.innerHTML = '<p>Página no encontrada</p>';
      }
    }, 80);
  },

  // ─── RSAT Check ────────────────────────────────────
  async checkRSAT() {
    const statusEl = document.getElementById('rsat-status');
    statusEl.className = 'rsat-status checking';
    statusEl.querySelector('.rsat-text').textContent = 'Comprobando RSAT...';

    try {
      const result = await window.api.ad.checkRSAT();
      this.rsatAvailable = result.available;
      this.rsatMissingGPMC = result.missingGPMC || false;
      
      if (this.rsatMissingGPMC) {
        statusEl.className = 'rsat-status warning';
        statusEl.querySelector('.rsat-text').textContent = 'Faltan módulos GPMC';
      } else {
        statusEl.className = `rsat-status ${result.available ? 'ok' : 'error'}`;
        statusEl.querySelector('.rsat-text').textContent = result.available ? 'RSAT OK' : 'RSAT no disponible';
      }
    } catch (err) {
      this.rsatAvailable = false;
      this.rsatMissingGPMC = false;
      statusEl.className = 'rsat-status error';
      statusEl.querySelector('.rsat-text').textContent = 'Error RSAT';
    }
  },

  // ─── Modal ─────────────────────────────────────────
  bindModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  openModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal-overlay').classList.add('visible');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('visible');
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
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
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
            <strong style="color:#f39c12">Instala el Módulo GroupPolicy</strong> — Aunque AD está activo, las GPOs están deshabilitadas sin este módulo. Ejecuta como Administrador en PowerShell:
            <code>Add-WindowsCapability -Online -Name Rsat.GroupPolicy.Management.Tools~~~~0.0.1.0</code>
          </div>
        </div>`;
    }
    
    return `
      <div class="rsat-warning">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div>
          <strong>RSAT no está instalado</strong> — Las funciones de Active Directory están deshabilitadas.
          Ejecuta como Administrador en PowerShell:
          <code>Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0</code>
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
  }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
