// ═══════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════

const SettingsPage = {
  async render(container) {
    const config = await window.api.config.get();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>
            <span class="header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </span>
            ${t('settings.title')}
          </h1>
          <p class="page-subtitle">${t('settings.subtitle')}</p>
        </div>
      </div>

      <!-- Network Share -->
      <div class="settings-section">
        <div class="settings-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          ${t('settings.general')}
        </div>
        
        <div class="form-group" style="margin-top:16px;">
          <label class="form-label">${t('settings.language')}</label>
          <select class="form-select" id="cfg-language">
            <!-- Rendered in JS logic -->
          </select>
          <p class="form-hint">${t('settings.languageHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('settings.netShare')}</label>
          <div class="input-with-btn">
            <input class="form-input" id="cfg-share-path" value="${this.esc(config.networkSharePath)}" placeholder="\\\\servidor\\share\\apps">
            <button class="btn btn-secondary" id="btn-browse-share">${t('settings.browse')}</button>
          </div>
          <p class="form-hint">${t('settings.netShareHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('settings.logs')}</label>
          <div class="input-with-btn">
            <input class="form-input" id="cfg-log-dir" value="${this.esc(config.logDirectory)}" placeholder="C:\\ProgramData\\AppDeploy_Logs">
            <button class="btn btn-secondary" id="btn-browse-log">${t('settings.browse')}</button>
          </div>
          <p class="form-hint">${t('settings.logsHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('settings.defaultGpo')}</label>
          <select class="form-select" id="cfg-default-gpo">
            <option value="">${t('common.cancel')} / Ninguna</option>
          </select>
          <p class="form-hint">${t('settings.defaultGpoHint')}</p>
        </div>

        <div class="form-group">
          <label class="form-label">${t('settings.preferredDC')}</label>
          <input class="form-input" id="cfg-preferred-dc" value="${this.esc(config.preferredDC || '')}" placeholder="dc1.empresa.local">
          <p class="form-hint">${t('settings.preferredDCHint')}</p>
        </div>

        <div class="form-group mb-md">
          <label class="form-label">${t('settings.baseOu')}</label>
          <div style="position:relative;margin-bottom:8px;">
            <svg style="position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:.4" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="cfg-baseou-search" placeholder="${t('ous.searchOUs')}" autocomplete="off" style="padding-left:32px;">
          </div>
          <div id="cfg-baseou-tree" style="max-height:190px;overflow-y:auto;border:1px solid var(--border-color);border-radius:6px;padding:4px 6px;background:var(--bg-secondary);">
            <div class="spinner"></div>
          </div>
          <div id="cfg-baseou-selected" style="margin-top:6px;min-height:22px;display:flex;align-items:center;gap:8px;"></div>
          <p class="form-hint" style="margin-top:6px;">${t('settings.baseOuHint')}</p>
          <input type="hidden" id="cfg-base-ou" value="${JSON.stringify(config.baseOUs || (config.baseOU ? [config.baseOU] : [])).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">
        </div>
      </div>

      <!-- RSAT Status -->
      <div class="settings-section">
        <div class="settings-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Estado de RSAT / Active Directory
        </div>
        <div class="flex items-center gap-md mb-md">
          <div class="rsat-dot" style="width:12px;height:12px;border-radius:50%;background:${App.rsatAvailable ? 'var(--accent-secondary)' : 'var(--accent-danger)'}"></div>
          <div>
            <strong style="color:${App.rsatAvailable ? 'var(--accent-secondary)' : 'var(--accent-danger)'}">
              ${App.rsatAvailable ? 'RSAT Disponible' : 'RSAT No Disponible'}
            </strong>
            <p class="text-muted text-sm">${App.rsatAvailable ? 'El módulo ActiveDirectory de PowerShell está operativo.' : 'Las funciones de AD están deshabilitadas.'}</p>
          </div>
        </div>
        ${!App.rsatAvailable ? `
          <div class="rsat-warning">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              Para habilitar las funciones de Active Directory, instala RSAT ejecutando como Administrador:
              <code>Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0</code>
              <p class="mt-sm">Para GPO management, instala también:</p>
              <code>Add-WindowsCapability -Online -Name Rsat.GroupPolicy.Management.Tools~~~~0.0.1.0</code>
            </div>
          </div>
        ` : ''}
        <div class="flex gap-sm">
          <button class="btn btn-secondary" id="btn-check-rsat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Comprobar RSAT
          </button>
          <button class="btn btn-secondary" id="btn-test-ad">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Test Conexión AD
          </button>
        </div>
      </div>

      <!-- Export / Import -->
      <div class="settings-section">
        <div class="settings-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          ${t('settings.exportImport')}
        </div>
        <div class="flex gap-sm" style="margin-top:12px;">
          <button class="btn btn-secondary" id="btn-export-config">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            ${t('settings.exportBtn')}
          </button>
          <button class="btn btn-secondary" id="btn-import-config">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${t('settings.importBtn')}
          </button>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-between mt-lg">
        <div></div>
        <button class="btn btn-primary btn-lg" id="btn-save-config">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          ${t('settings.save')}
        </button>
      </div>
    `;

    // Load available languages into the selector dynamically
    const langSelect = document.getElementById('cfg-language');
    const langs = await window.api.i18n.getAvailable();
    langs.forEach(lang => {
      const el = document.createElement('option');
      el.value = lang.code;
      el.textContent = lang.name;
      if (config.language === lang.code) el.selected = true;
      langSelect.appendChild(el);
    });

    this.bindEvents(config);
    this.loadGPOs(config);
    if (App.rsatAvailable) {
      this.loadOUs(config.baseOUs || (config.baseOU ? [config.baseOU] : []));
    } else {
      document.getElementById('cfg-baseou-tree').innerHTML = `<p style="padding:8px;font-size:13px;color:var(--text-muted);">RSAT requerido para listar OUs</p>`;
    }
  },

  bindEvents(config) {
    document.getElementById('btn-browse-share').addEventListener('click', async () => {
      const path = await window.api.config.selectFolder();
      if (path) document.getElementById('cfg-share-path').value = path;
    });

    document.getElementById('btn-browse-log').addEventListener('click', async () => {
      const path = await window.api.config.selectFolder();
      if (path) document.getElementById('cfg-log-dir').value = path;
    });

    document.getElementById('btn-save-config').addEventListener('click', () => this.save());

    document.getElementById('btn-check-rsat').addEventListener('click', async () => {
      await App.checkRSAT();
      App.navigate('settings');
    });

    document.getElementById('btn-test-ad').addEventListener('click', async () => {
      if (!App.rsatAvailable) {
        App.toast('RSAT no está disponible. Instálalo primero.', 'warning');
        return;
      }
      try {
        const result = await window.api.ad.getOUs();
        if (result.success) {
          App.toast(`Conexión AD exitosa — ${result.data.length} UOs encontradas`, 'success');
        } else {
          App.toast('Error AD: ' + result.error, 'error');
        }
      } catch (err) {
        App.toast('Error: ' + err.message, 'error');
      }
    });

    document.getElementById('btn-export-config').addEventListener('click', async () => {
      try {
        const data = await window.api.exportAll();
        const json = JSON.stringify(data, null, 2);
        const result = await window.api.saveFile(json, `deploy_manager_backup_${new Date().toISOString().slice(0,10)}.json`);
        if (result.success) {
          await window.api.activity.add('config_export', {});
          App.toast('Configuración exportada correctamente', 'success');
        }
      } catch (err) {
        App.toast('Error al exportar: ' + err.message, 'error');
      }
    });

    document.getElementById('btn-import-config').addEventListener('click', async () => {
      try {
        const result = await window.api.loadFile();
        if (result.success && result.data) {
          const importResult = await window.api.importAll(result.data);
          if (importResult.success) {
            await window.api.activity.add('config_import', {});
            App.toast('Configuración importada correctamente. Recargando...', 'success');
            setTimeout(() => App.navigate('settings'), 500);
          } else {
            App.toast('Error al importar: ' + importResult.error, 'error');
          }
        }
      } catch (err) {
        App.toast('Error al importar: ' + err.message, 'error');
      }
    });
  },

  async loadGPOs(config) {
    try {
      const apps = await window.api.apps.getAll().catch(() => []);
      const programGPOs = [...new Set([
        ...apps.filter(a => a.gpoName).map(a => a.gpoName),
        config.defaultGPO || null
      ].filter(Boolean))];

      const select = document.getElementById('cfg-default-gpo');
      if (select) {
        programGPOs.forEach(gpoName => {
          const opt = document.createElement('option');
          opt.value = gpoName;
          opt.textContent = gpoName;
          opt.selected = gpoName === config.defaultGPO;
          select.appendChild(opt);
        });
      }
    } catch (e) {}
  },

  async save() {
    const data = {
      networkSharePath: document.getElementById('cfg-share-path').value.trim(),
      logDirectory: document.getElementById('cfg-log-dir').value.trim(),
      defaultGPO: document.getElementById('cfg-default-gpo').value,
      preferredDC: document.getElementById('cfg-preferred-dc').value.trim(),
      baseOUs: this.getSelectedDNs(),
      language: document.getElementById('cfg-language').value
    };

    if (!data.networkSharePath) {
      App.toast(t('common.error'), 'warning');
      return;
    }

    const currentConfig = await window.api.config.get();
    const isLangChanged = data.language !== currentConfig.language;

    const result = await window.api.config.set(data);
    if (result.success) {
      if (isLangChanged) {
        await window.initI18n(); // Reload the dictionary immediately 
        App.updateSidebarLanguage();
        App.toast(t('settings.restartRequired'), 'warning');
        App.navigate('settings'); // Reload the page to reflect translations
      } else {
        App.toast(t('settings.saved'), 'success');
      }
    } else {
      App.toast(t('common.error') + ': ' + result.error, 'error');
    }
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  getSelectedDNs() {
    try {
      const raw = document.getElementById('cfg-base-ou')?.value || '[]';
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

        const searchInput = document.getElementById('cfg-baseou-search');
        if (searchInput) {
          searchInput.oninput = () => {
            this.renderOUTree(this.getSelectedDNs(), searchInput.value);
          };
        }
      }
    } catch(err) {}
  },

  renderOUTree(selectedDNs, query = '') {
    const treeContainer = document.getElementById('cfg-baseou-tree');
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

    const dnInput = document.getElementById('cfg-base-ou');
    treeContainer.querySelectorAll('.tree-node').forEach(node => {
      node.onclick = (e) => {
        if (e.target.closest('.tree-toggle')) return;
        const dn = node.dataset.dn;
        const current = this.getSelectedDNs();
        const nextDNs = current.includes(dn)
          ? current.filter(item => item !== dn)
          : [...current, dn];
        if (dnInput) dnInput.value = JSON.stringify(nextDNs);
        this.renderOUTree(nextDNs, document.getElementById('cfg-baseou-search')?.value || '');
      };
    });
  },

  updateSelectedDisplay(selectedDNs) {
    const selectedEl = document.getElementById('cfg-baseou-selected');
    const dnInput = document.getElementById('cfg-base-ou');
    if (!selectedEl) return;

    if (!selectedDNs || selectedDNs.length === 0) {
      selectedEl.innerHTML = `<span style="font-size:12px;color:var(--text-muted);">${t('apps.selectOuRecommended')}</span>`;
      return;
    }

    selectedEl.innerHTML = selectedDNs.map(dn => {
      const selectedName = this.findOUName(this.ousTreeCache, dn) || dn;
      return `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(30,144,255,0.15);color:var(--primary-color);padding:2px 10px;border-radius:4px;font-size:12px;">
        📁 ${this.esc(selectedName)}
        <button type="button" class="btn btn-ghost btn-sm cfg-baseou-remove" data-dn="${this.esc(dn)}" style="font-size:11px;padding:0 4px;min-height:auto;">✕</button>
      </span>`;
    }).join('') + `<button type="button" class="btn btn-ghost btn-sm" id="cfg-baseou-clear" style="font-size:11px;margin-left:4px;opacity:.7;">${t('common.clear') || 'Borrar selección'}</button>`;

    selectedEl.querySelectorAll('.cfg-baseou-remove').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dn = btn.dataset.dn;
        const nextDNs = this.getSelectedDNs().filter(item => item !== dn);
        if (dnInput) dnInput.value = JSON.stringify(nextDNs);
        this.renderOUTree(nextDNs, document.getElementById('cfg-baseou-search')?.value || '');
      };
    });

    const clearBtn = document.getElementById('cfg-baseou-clear');
    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dnInput) dnInput.value = '[]';
        this.renderOUTree([], document.getElementById('cfg-baseou-search')?.value || '');
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
