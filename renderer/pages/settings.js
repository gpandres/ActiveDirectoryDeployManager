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
        <div id="gpo-list-container" class="mt-lg" style="display:none;">
          <div id="gpo-list" class="mt-sm"></div>
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
    if (App.rsatAvailable) this.loadGPOs(config);
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
      const result = await window.api.ad.getGPOs();
      if (result.success && result.data.length > 0) {
        const select = document.getElementById('cfg-default-gpo');
        result.data.forEach(gpo => {
          const opt = document.createElement('option');
          opt.value = gpo.DisplayName;
          opt.textContent = gpo.DisplayName;
          opt.selected = gpo.DisplayName === config.defaultGPO;
          select.appendChild(opt);
        });

        // Show GPO list
        const listContainer = document.getElementById('gpo-list-container');
        listContainer.style.display = 'block';

        const listEl = document.getElementById('gpo-list');
        listEl.innerHTML = `
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Nombre</th><th>Estado</th><th>Modificada</th></tr></thead>
              <tbody>
                ${result.data.map(gpo => `
                  <tr>
                    <td style="color:var(--text-primary)">${this.esc(gpo.DisplayName)}</td>
                    <td><span class="badge ${gpo.GpoStatus === 'AllSettingsEnabled' ? 'badge-success' : 'badge-warning'}">${gpo.GpoStatus || 'N/A'}</span></td>
                    <td class="text-muted">${App.formatDate(gpo.ModificationTime)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
      }
    } catch (e) {}
  },

  async save() {
    const data = {
      networkSharePath: document.getElementById('cfg-share-path').value.trim(),
      logDirectory: document.getElementById('cfg-log-dir').value.trim(),
      defaultGPO: document.getElementById('cfg-default-gpo').value,
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
  }
};
