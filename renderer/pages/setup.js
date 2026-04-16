// ═══════════════════════════════════════════════════════
// Setup Page – Initial Configuration Wizard
// ═══════════════════════════════════════════════════════

const SetupPage = {
  async render(container) {
    const config = await window.api.config.get();
    const langs = await window.api.i18n.getAvailable();

    container.innerHTML = `
      <div style="max-width: 600px; margin: 40px auto; background: var(--bg-card); padding: var(--space-xl); border-radius: var(--radius-lg); border: 1px solid var(--border-color); box-shadow: var(--shadow-card);">
        
        <div style="text-align:center; margin-bottom: var(--space-xl);">
          <div style="width: 64px; height: 64px; background: var(--accent-primary-dim); color: var(--accent-primary); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-md); font-size: 32px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <h1 style="font-size: var(--font-2xl); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-sm);">${t('setup.title')}</h1>
          <p style="color: var(--text-secondary); font-size: var(--font-base);">${t('setup.subtitle')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.language')}</label>
          <select class="form-select" id="setup-lang">
            ${langs.map(l => `<option value="${l.code}" ${config.language === l.code ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
          <p class="form-hint">${t('setup.languageHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.networkShare')}</label>
          <div class="flex gap-sm">
            <input class="form-input" id="setup-network" value="${this.esc(config.networkSharePath)}" placeholder="\\\\server\\share" style="flex:1;">
            <button class="btn btn-secondary" id="btn-browse-network">${t('setup.browse')}</button>
          </div>
          <p class="form-hint">${t('setup.networkShareHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.logsDir')}</label>
          <input class="form-input" id="setup-logs" value="${this.esc(config.logDirectory)}" placeholder="C:\\ProgramData\\Logs">
          <p class="form-hint">${t('setup.logsDirHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.defaultGpo')}</label>
          <input class="form-input" id="setup-gpo" value="${this.esc(config.defaultGPO || '')}" placeholder="SoftwareDeployment">
          <p class="form-hint">${t('setup.defaultGpoHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.preferredDC')}</label>
          <input class="form-input" id="setup-dc" value="${this.esc(config.preferredDC || '')}" placeholder="dc1.empresa.local">
          <p class="form-hint">${t('setup.preferredDCHint')}</p>
        </div>

        <div class="form-group mb-md">
          <label class="form-label">${t('setup.baseOu')}</label>
          <div style="position:relative;margin-bottom:8px;">
            <svg style="position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:.4" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="setup-baseou-search" placeholder="${t('ous.searchOUs')}" autocomplete="off" style="padding-left:32px;">
          </div>
          <div id="setup-baseou-tree" style="max-height:190px;overflow-y:auto;border:1px solid var(--border-color);border-radius:6px;padding:4px 6px;background:var(--bg-secondary);">
            <div class="spinner"></div>
          </div>
          <div id="setup-baseou-selected" style="margin-top:6px;min-height:22px;display:flex;align-items:center;gap:8px;"></div>
          <p class="form-hint" style="margin-top:6px;">${t('setup.baseOuHint')}</p>
          <input type="hidden" id="setup-baseou" value="${JSON.stringify(config.baseOUs || (config.baseOU ? [config.baseOU] : [])).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">
        </div>

        <div style="margin-top: var(--space-xl); display: flex; justify-content: flex-end;">
          <button class="btn btn-primary btn-lg" id="btn-save-setup">
            ${t('setup.saveAndContinue')}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 8px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    `;

    document.getElementById('setup-lang').addEventListener('change', async (e) => {
      // Re-fetch translations and re-render if user changes language during setup
      await window.api.config.set({ language: e.target.value, firstRun: true }); 
      await window.initI18n();
      this.render(container);
    });

    document.getElementById('btn-browse-network').addEventListener('click', async () => {
      const folder = await window.api.config.selectFolder();
      if (folder) document.getElementById('setup-network').value = folder;
    });

    if (App.rsatAvailable) {
      this.loadOUs(config.baseOUs || (config.baseOU ? [config.baseOU] : []));
    } else {
      document.getElementById('setup-baseou-tree').innerHTML = `<p style="padding:8px;font-size:13px;color:var(--text-muted);">RSAT requerido para listar OUs</p>`;
    }

    document.getElementById('btn-save-setup').addEventListener('click', async () => {
      const newConfig = {
        language: document.getElementById('setup-lang').value,
        networkSharePath: document.getElementById('setup-network').value.trim(),
        logDirectory: document.getElementById('setup-logs').value.trim(),
        defaultGPO: document.getElementById('setup-gpo').value.trim(),
        preferredDC: document.getElementById('setup-dc').value.trim(),
        baseOUs: this.getSelectedDNs(),
        // setting firstRun to false will let them enter the app
        firstRun: false
      };

      if (!newConfig.networkSharePath) {
        App.toast(t('common.error'), 'error');
        return;
      }

      await window.api.config.set(newConfig);
      await window.initI18n(); // Ensure i18n is updated
      
      // Restore the sidebar which we hid
      document.querySelector('.sidebar').style.display = 'flex';
      
      // Update sidebar texts as it might still be in old language
      App.updateSidebarLanguage();
      
      App.navigate('dashboard');
    });
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  getSelectedDNs() {
    try {
      const raw = document.getElementById('setup-baseou')?.value || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  },

  async loadOUs(selectedDNs) {
    try {
      const result = await window.api.ad.getOUs(true); // ignoreBaseOU = true!
      if (result.success && result.data) {
        this.ousTreeCache = result.data;
        this.renderOUTree(selectedDNs);

        const searchInput = document.getElementById('setup-baseou-search');
        if (searchInput) {
          searchInput.oninput = () => {
            this.renderOUTree(this.getSelectedDNs(), searchInput.value);
          };
        }
      }
    } catch(err) {}
  },

  renderOUTree(selectedDNs, query = '') {
    const treeContainer = document.getElementById('setup-baseou-tree');
    if (!treeContainer || !this.ousTreeCache) return;

    const normalized = Array.isArray(selectedDNs) ? selectedDNs.filter(Boolean) : [];
    treeContainer.innerHTML = App.ouPickerTreeHTML(this.ousTreeCache, query, normalized);
    this.updateSelectedDisplay(normalized);

    // Bind expand/collapse toggles (use onclick to prevent stacking)
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

    const dnInput = document.getElementById('setup-baseou');
    treeContainer.querySelectorAll('.tree-node').forEach(node => {
      node.onclick = (e) => {
        if (e.target.closest('.tree-toggle')) return;
        const dn = node.dataset.dn;
        const current = this.getSelectedDNs();
        const nextDNs = current.includes(dn)
          ? current.filter(item => item !== dn)
          : [...current, dn];
        if (dnInput) dnInput.value = JSON.stringify(nextDNs);
        this.renderOUTree(nextDNs, document.getElementById('setup-baseou-search')?.value || '');
      };
    });
  },

  updateSelectedDisplay(selectedDNs) {
    const selectedEl = document.getElementById('setup-baseou-selected');
    const dnInput = document.getElementById('setup-baseou');
    if (!selectedEl) return;

    if (!selectedDNs || selectedDNs.length === 0) {
      selectedEl.innerHTML = `<span style="font-size:12px;color:var(--text-muted);">${t('apps.selectOuRecommended')}</span>`;
      return;
    }

    selectedEl.innerHTML = selectedDNs.map(dn => {
      const selectedName = this.findOUName(this.ousTreeCache, dn) || dn;
      return `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(30,144,255,0.15);color:var(--primary-color);padding:2px 10px;border-radius:4px;font-size:12px;">
        📁 ${this.esc(selectedName)}
        <button type="button" class="btn btn-ghost btn-sm setup-baseou-remove" data-dn="${this.esc(dn)}" style="font-size:11px;padding:0 4px;min-height:auto;">✕</button>
      </span>`;
    }).join('') + `<button type="button" class="btn btn-ghost btn-sm" id="setup-baseou-clear" style="font-size:11px;margin-left:4px;opacity:.7;">${t('common.clear') || 'Borrar selección'}</button>`;

    selectedEl.querySelectorAll('.setup-baseou-remove').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dn = btn.dataset.dn;
        const nextDNs = this.getSelectedDNs().filter(item => item !== dn);
        if (dnInput) dnInput.value = JSON.stringify(nextDNs);
        this.renderOUTree(nextDNs, document.getElementById('setup-baseou-search')?.value || '');
      };
    });

    const clearBtn = document.getElementById('setup-baseou-clear');
    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dnInput) dnInput.value = '[]';
        this.renderOUTree([], document.getElementById('setup-baseou-search')?.value || '');
      };
    }
  },

  findOUName(nodes, dn) {
    if (!Array.isArray(nodes) || !dn) return '';
    for (const node of nodes) {
      if (node?.dn === dn) return node.name || dn;
      const childMatch = this.findOUName(node?.children, dn);
      if (childMatch) return childMatch;
    }
    return '';
  }
};
