// ═══════════════════════════════════════════════════════
// Apps Page – CRUD, Wizard, Bulk GPO Assignment
// ═══════════════════════════════════════════════════════

const AppsPage = {
  selectedIds: new Set(),
  gposCache: null,

  async render(container) {
    const apps = await window.api.apps.getAll();
    const templates = await window.api.scripts.getTemplates();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>
            <span class="header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </span>
            ${t('apps.title')}
          </h1>
          <p class="page-subtitle">${t('apps.subtitle')}</p>
        </div>
        <button class="btn btn-primary" id="btn-new-app">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('apps.newApp')}
        </button>
      </div>

      <!-- Bulk Action Bar -->
      <div class="action-bar" id="bulk-action-bar">
        <span class="action-bar-text"><span id="selected-count">0</span> ${t('apps.selected')}</span>
        <div class="action-bar-buttons">
          <select class="form-select" id="bulk-gpo-select" style="width:200px; padding:6px 10px;">
            <option value="">${t('apps.selectGpo')}</option>
          </select>
          <button class="btn btn-primary btn-sm" id="btn-bulk-gpo">${t('apps.deploy')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-clear-selection">${t('apps.cancel')}</button>
        </div>
      </div>

      <!-- Apps Grid -->
      <div class="app-grid" id="apps-grid">
        ${apps.length === 0 ? `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <p class="empty-state-title">${t('apps.noAppsConfigured')}</p>
            <p class="empty-state-text">${t('apps.clickNewApp')}</p>
            <button class="btn btn-primary" onclick="AppsPage.openWizard()">${t('apps.newApp')}</button>
          </div>
        ` : apps.map(app => this.renderAppCard(app, templates)).join('')}
      </div>
    `;

    this.selectedIds.clear();

    document.getElementById('btn-new-app').addEventListener('click', () => this.openWizard());
    document.getElementById('btn-bulk-gpo').addEventListener('click', () => this.bulkAssignGPO());
    document.getElementById('btn-clear-selection').addEventListener('click', () => this.clearSelection());

    // Load GPOs for bulk select
    this.loadGPOsForBulk();
  },

  renderAppCard(app, templates) {
    const templateInfo = templates.find(t => t.id === app.template) || { name: app.template };
    const isDeployed = app.deployed !== false && app.deployedPath;
    return `
      <div class="app-card" data-id="${app.id}">
        <input type="checkbox" class="checkbox-select" data-id="${app.id}" onchange="AppsPage.toggleSelect('${app.id}', this.checked)">
        <div class="app-card-header">
          <div>
            <div class="app-card-name">${this.esc(app.name)}</div>
            <div class="app-card-template">${this.esc(templateInfo.name)}</div>
          </div>
        </div>
        <div class="app-card-badges">
          <span class="badge badge-primary">${this.esc(app.installerType?.toUpperCase() || 'EXE')}</span>
          ${app.gpoName ? `<span class="badge badge-info">${this.esc(app.gpoName)}</span>` : `<span class="badge badge-neutral">${t('apps.noGpoBadge')}</span>`}
          ${app.assignedOUs && app.assignedOUs.length > 0 ? `<span class="badge badge-success">${app.assignedOUs.length} UO(s)</span>` : ''}
          ${isDeployed ? `<span class="badge badge-success">${t('apps.deployedBadge')}</span>` : ''}
          <span class="badge badge-info">v${this.esc(app.version || '1.0.0')}</span>
          ${app.notifyUser ? '<span class="badge badge-warning">🔔</span>' : ''}
        </div>
        <div class="app-card-actions">
          <button class="btn btn-sm btn-secondary" onclick="AppsPage.previewScript('${app.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${t('apps.script')}
          </button>
          ${isDeployed ? `
            <button class="btn btn-sm btn-warning" onclick="AppsPage.disableDeploy('${app.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              ${t('apps.disable')}
            </button>
          ` : `
            <button class="btn btn-sm btn-success" onclick="AppsPage.deployApp('${app.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${t('apps.deploy')}
            </button>
          `}
          <button class="btn btn-sm btn-secondary" onclick="AppsPage.editApp('${app.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            ${t('apps.edit')}
          </button>
          <button class="btn btn-sm btn-danger" style="padding: 4px 6px;" onclick="AppsPage.deleteApp('${app.id}')" title="${t('common.delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  // ─── Selection ─────────────────────────────────────
  toggleSelect(id, checked) {
    if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id);
    this.updateBulkBar();
  },

  clearSelection() {
    this.selectedIds.clear();
    document.querySelectorAll('.checkbox-select').forEach(cb => cb.checked = false);
    this.updateBulkBar();
  },

  updateBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    const count = this.selectedIds.size;
    document.getElementById('selected-count').textContent = count;
    bar.classList.toggle('visible', count > 0);
  },

  async loadGPOsForBulk() {
    if (!App.rsatAvailable || App.rsatMissingGPMC) return;
    try {
      if (!this.gposCache) {
        const result = await window.api.ad.getGPOs();
        if (result.success) this.gposCache = result.data;
      }
      if (this.gposCache) {
        const select = document.getElementById('bulk-gpo-select');
        select.innerHTML = `<option value="">${t('apps.selectGpo')}</option>`;
        this.gposCache.forEach(gpo => {
          const opt = document.createElement('option');
          opt.value = gpo.DisplayName;
          opt.textContent = gpo.DisplayName;
          select.appendChild(opt);
        });
      }
    } catch (e) {}
  },

  async bulkAssignGPO() {
    const gpoName = document.getElementById('bulk-gpo-select').value;
    if (!gpoName) { App.toast(t('apps.selectGpoFirst'), 'warning'); return; }
    if (this.selectedIds.size === 0) return;

    try {
      const ids = Array.from(this.selectedIds);
      await window.api.apps.bulkAssignGPO(ids, gpoName);
      App.toast(t('apps.gpoAssignedBulk').replace('{gpo}', gpoName).replace('{count}', ids.length), 'success');
      this.clearSelection();
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  // ─── Wizard ────────────────────────────────────────
  async openWizard(existingApp = null) {
    const templates = await window.api.scripts.getTemplates();
    const isEdit = !!existingApp;

    // State
    const state = {
      step: 1,
      template: existingApp?.template || '',
      name: existingApp?.name || '',
      silentArgs: existingApp?.silentArgs || '/S',
      installerPath: existingApp?.installerPath || '',
      configXmlPath: existingApp?.configXmlPath || '',
      customParams: existingApp?.customParams || {},
      ouDN: existingApp?.ouDN || (existingApp?.assignedOUs && existingApp.assignedOUs[0]) || '',
      gpoName: existingApp?.gpoName || '',
      createGPO: false,
      version: existingApp?.version || '1.0.0',
      notifyUser: existingApp?.notifyUser || false
    };

    const renderWizard = () => {
      let body = `
        <div class="wizard-steps">
          <div class="wizard-step ${state.step >= 1 ? (state.step > 1 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">1</span><span>${t('apps.step1')}</span>
          </div>
          <div class="wizard-step ${state.step >= 2 ? (state.step > 2 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">2</span><span>${t('apps.step2')}</span>
          </div>
          <div class="wizard-step ${state.step >= 3 ? (state.step > 3 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">3</span><span>${t('apps.step3')}</span>
          </div>
          <div class="wizard-step ${state.step >= 4 ? 'active' : ''}">
            <span class="wizard-step-number">4</span><span>${t('apps.step4')}</span>
          </div>
        </div>
        <div class="wizard-content" style="min-height: 480px; display: flex; flex-direction: column;">`;

      if (state.step === 1) {
        body += `
          <h4 style="font-size: var(--font-md); margin-bottom: var(--space-md); color: var(--text-secondary);">📦 ${t('apps.catalogTitle')}</h4>
          <div class="template-categories" style="display: flex; flex-direction: column; gap: var(--space-lg); margin-bottom: var(--space-xl)">
        `;
        
        // Group templates by category
        const grouped = {};
        templates.forEach(t => {
          const cat = t.category || 'Otros';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(t);
        });

        // Specific render order
        const catOrder = ['General', 'Seguridad', 'Conectividad', 'RMM', 'Backups', 'Corporativo'];
        
        catOrder.forEach(cat => {
          if (grouped[cat]) {
            body += `
              <div class="template-category-group">
                <h5 style="margin-bottom: var(--space-sm); color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${cat}</h5>
                <div class="template-grid">
                  ${grouped[cat].map(t => `
                    <div class="template-card ${state.template === t.id ? 'selected' : ''}" data-template="${t.id}">
                      <div class="template-card-icon">${this.templateIcon(t.id)}</div>
                      <div class="template-card-name">${this.esc(t.name)}</div>
                      <div class="template-card-desc">${this.esc(t.description)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }
        });
        
        body += `</div>`;
      } else if (state.step === 2) {
        const tmpl = templates.find(t => t.id === state.template);
        body += `
          <div class="form-group">
            <label class="form-label">${t('apps.appName')}</label>
            <input class="form-input" id="wiz-name" value="${this.esc(state.name)}" placeholder="Ej: Google Chrome">
            <p class="form-hint">${t('apps.nameHint')}</p>
          </div>
          
          ${state.template !== 'custom' ? `
            <div class="form-group">
              <label class="form-label">${t('apps.installer')}</label>
              <div class="flex gap-sm">
                <input class="form-input" id="wiz-installer" value="${this.esc(state.installerPath)}" placeholder="C:\\Descargas\\app.exe" readonly style="flex:1">
                <button class="btn btn-secondary" id="btn-pick-installer">${t('apps.browse')}</button>
              </div>
              <p class="form-hint">${t('apps.installerHint')}</p>
            </div>
          ` : ''}

          ${['sap-gui', 'office'].includes(state.template) ? `
            <div class="form-group">
              <label class="form-label">${t('apps.xmlConfig')}</label>
              <div class="flex gap-sm">
                <input class="form-input" id="wiz-xml" value="${this.esc(state.configXmlPath)}" placeholder="${t('apps.xmlHint')}" readonly style="flex:1">
                <button class="btn btn-secondary" id="btn-pick-xml">${t('apps.browse')}</button>
              </div>
            </div>
          ` : ''}

          ${state.template === 'generic' ? `
            <div id="wiz-silent-args-container">
              <div class="form-group">
                <label class="form-label">${t('apps.silentArgs')}</label>
                <div style="display:flex;gap:8px;">
                  <input class="form-input" id="wiz-silentArgs" value="${this.esc(state.silentArgs)}" placeholder="/S, /qn, /norestart" style="flex:1;">
                  <button class="btn btn-secondary btn-sm" type="button" id="btn-show-args-help" style="white-space:nowrap;align-self:center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    ${t('apps.commonArgs')}
                  </button>
                </div>
              </div>
            </div>
          ` : ''}

          <div style="display:flex;gap:12px">
            <div class="form-group" style="flex:0 0 150px">
              <label class="form-label">${t('apps.version')}</label>
              <input class="form-input" id="wiz-version" value="${state.version}" placeholder="1.0.0">
            </div>
            <div class="form-group" style="flex:1;display:flex;align-items:end;padding-bottom:16px">
              <label class="checkbox-wrapper">
                <input type="checkbox" id="wiz-notify" ${state.notifyUser ? 'checked' : ''}>
                <span>🔔 ${t('apps.notifyUser')}</span>
              </label>
            </div>
          </div>

          ${(tmpl?.fields || []).map(f => {
            let inputHtml = '';
            if (f.type === 'select') {
              inputHtml = '<select class="form-select" id="wiz-param-' + f.key + '">\\n' +
                (f.options || []).map(opt => '<option value="' + opt.value + '" ' + (state.customParams[f.key] === opt.value || (!state.customParams[f.key] && f.default === opt.value) ? 'selected' : '') + '>' + opt.label + '</option>').join('') +
              '\\n</select>';
            } else if (f.type === 'textarea') {
              inputHtml = '<textarea class="form-input" id="wiz-param-' + f.key + '" rows="8" style="font-family: monospace;">' + this.esc(state.customParams[f.key] || f.default) + '</textarea>';
            } else if (f.type === 'checkbox') {
              return `
                <div class="form-group">
                  <label class="checkbox-wrapper">
                    <input type="checkbox" id="wiz-param-${f.key}" ${state.customParams[f.key] === true || (state.customParams[f.key] === undefined && f.default) ? 'checked' : ''}>
                    <span class="form-label mb-0" style="margin: 0; display: inline;">${this.esc(f.label)}</span>
                  </label>
                  ${f.hint ? '<p class="form-hint" style="margin-left: 26px;">' + this.esc(f.hint) + '</p>' : ''}
                </div>
              `;
            } else {
              let val = state.customParams[f.key];
              if (val === undefined) val = f.default;
              inputHtml = '<input class="form-input" id="wiz-param-' + f.key + '" value="' + this.esc(val) + '" placeholder="' + this.esc(f.hint || '') + '">';
            }
            return `
              <div class="form-group">
                <label class="form-label">${this.esc(f.label)}</label>
                ${inputHtml}
                ${f.hint ? '<p class="form-hint">' + this.esc(f.hint) + '</p>' : ''}
              </div>
            `;
          }).join('')}
        `;
      } else if (state.step === 3) {
        body += `
          <div class="form-group mb-md">
            <label class="form-label">${t('apps.selectOus')}</label>
            <select class="form-select" id="wiz-ou">
              <option value="">${t('apps.selectOuRecommended')}</option>
            </select>
          </div>

          <div class="form-group mb-md">
            <label class="flex items-center gap-sm" style="cursor:pointer; padding: 12px; background: rgba(30,144,255,0.1); border-radius: 6px; border: 1px solid rgba(30,144,255,0.2);">
              <input type="checkbox" id="wiz-create-gpo" ${state.createGPO ? 'checked' : ''} style="width:16px;height:16px;">
              <span style="font-weight:600;color:var(--primary-color)">✨ ${t('apps.createGpoCheckbox')}</span>
            </label>
          </div>

          <div class="form-group" style="opacity: ${state.createGPO ? '0.5' : '1'}; pointer-events: ${state.createGPO ? 'none' : 'auto'};">
            <label class="form-label">${t('apps.selectGpo')}</label>
            <select class="form-select" id="wiz-gpo">
              <option value="">${t('apps.noGpoOption')}</option>
            </select>
          </div>`;
      } else if (state.step === 4) {
        body += `
          <div class="mb-md">
            <div class="flex items-center gap-md mb-md">
              <span class="badge badge-primary">${this.esc(state.template)}</span>
              <span style="font-weight:600; font-size:1.1rem">${this.esc(state.name)}</span>
              ${state.gpoName ? `<span class="badge badge-info">${this.esc(state.gpoName)}</span>` : ''}
            </div>
          </div>
          <div class="code-header">
            <span>📄 install.ps1</span>
            <button class="btn btn-ghost btn-sm" onclick="AppsPage.copyScript()">${t('apps.copyBtn')}</button>
          </div>
          <pre class="code-preview" id="script-preview">${t('apps.generatingScript')}</pre>`;
      }

      body += `</div>`;

      const footer = `
        ${state.step > 1 ? `<button class="btn btn-secondary" id="wiz-prev">${t('apps.back')}</button>` : ''}
        <div style="flex:1"></div>
        ${state.step < 4 ?
          `<button class="btn btn-primary" id="wiz-next" ${state.step === 1 && !state.template ? 'disabled' : ''}>${t('apps.next')}</button>` :
          `<button class="btn btn-success" id="wiz-deploy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${isEdit ? t('apps.saveAndDeploy') : t('apps.createAndDeploy')}
          </button>`
        }`;

      App.openModal(isEdit ? t('apps.edit') : t('apps.newApp'), body, footer);
      this.bindWizardEvents(state, templates, renderWizard, isEdit, existingApp);
    };

    renderWizard();
  },

  bindWizardEvents(state, templates, renderWizard, isEdit, existingApp) {
    // Template selection
    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        state.template = card.dataset.template;
        renderWizard();
      });
    });

    // Navigation
    const nextBtn = document.getElementById('wiz-next');
    const prevBtn = document.getElementById('wiz-prev');
    const deployBtn = document.getElementById('wiz-deploy');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.saveStepData(state, templates);
        state.step++;
        renderWizard();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        state.step--;
        renderWizard();
      });
    }

    if (deployBtn) {
      deployBtn.addEventListener('click', () => this.finishWizard(state, isEdit, existingApp));
    }

    // Step 2 events
    const btnPickInstaller = document.getElementById('btn-pick-installer');
    if (btnPickInstaller) {
      btnPickInstaller.addEventListener('click', async () => {
        this.saveStepData(state, templates);
        const file = await window.api.config.selectFile([{ name: 'Instaladores', extensions: ['exe', 'msi', 'ps1'] }]);
        if (file) {
          state.installerPath = file;
          
          if (file.toLowerCase().endsWith('.msi')) {
             if (!state.silentArgs || state.silentArgs === '/S') {
                 state.silentArgs = '/qn /norestart'; 
             }
          } else if (file.toLowerCase().endsWith('.exe')) {
             if (!state.silentArgs || state.silentArgs === '/qn /norestart' || state.silentArgs === '/qn') {
                 state.silentArgs = '/S';
             }
          }
          renderWizard();
        }
      });
    }

    const btnPickXml = document.getElementById('btn-pick-xml');
    if (btnPickXml) {
      btnPickXml.addEventListener('click', async () => {
        this.saveStepData(state, templates);
        const file = await window.api.config.selectFile([{ name: 'Archivos XML', extensions: ['xml'] }]);
        if (file) {
          state.configXmlPath = file;
          renderWizard();
        }
      });
    }

    // Silent args helper button
    const btnArgsHelp = document.getElementById('btn-show-args-help');
    if (btnArgsHelp) {
      btnArgsHelp.addEventListener('click', () => {
        this.saveStepData(state, templates);
        this.showSilentArgsHelper(state, renderWizard);
      });
    }

    const checkCreateGpo = document.getElementById('wiz-create-gpo');
    if (checkCreateGpo) {
      checkCreateGpo.addEventListener('change', () => {
        this.saveStepData(state, templates);
        state.createGPO = checkCreateGpo.checked;
        if (state.createGPO) state.gpoName = '';
        renderWizard();
      });
    }

    // Load GPOs and OUs for step 3
    if (state.step === 3 && App.rsatAvailable) {
      this.loadGPOsForWizard(state);
      this.loadOUsForWizard(state);
    }

    // Generate preview for step 4
    if (state.step === 4) {
      this.generatePreview(state);
    }
  },

  saveStepData(state, templates) {
    // Always try to save all visible inputs regardless of step
    const nameInput = document.getElementById('wiz-name');
    if (nameInput) state.name = nameInput.value;

    const silentInput = document.getElementById('wiz-silentArgs');
    if (silentInput) state.silentArgs = silentInput.value;

    if (state.step === 2) {
      const tmpl = templates.find(t => t.id === state.template);
      (tmpl?.fields || []).forEach(f => {
        const input = document.getElementById(`wiz-param-${f.key}`);
        if (input) {
          if (f.type === 'checkbox') {
            state.customParams[f.key] = input.checked;
          } else {
            state.customParams[f.key] = input.value;
          }
        }
      });
    }

    const gpoSelect = document.getElementById('wiz-gpo');
    if (gpoSelect) state.gpoName = gpoSelect.value;
    const ouSelect = document.getElementById('wiz-ou');
    if (ouSelect) state.ouDN = ouSelect.value;

    const versionInput = document.getElementById('wiz-version');
    if (versionInput) state.version = versionInput.value;
    const notifyCheck = document.getElementById('wiz-notify');
    if (notifyCheck) state.notifyUser = notifyCheck.checked;
  },

  async loadGPOsForWizard(state) {
    if (!App.rsatAvailable || App.rsatMissingGPMC) return;
    try {
      if (!this.gposCache) {
        const result = await window.api.ad.getGPOs();
        if (result.success) this.gposCache = result.data;
      }
      if (this.gposCache) {
        const select = document.getElementById('wiz-gpo');
        if (select) {
          this.gposCache.forEach(gpo => {
            const opt = document.createElement('option');
            opt.value = gpo.DisplayName;
            opt.textContent = gpo.DisplayName;
            opt.selected = gpo.DisplayName === state.gpoName;
            select.appendChild(opt);
          });
        }
      }
    } catch (e) {}
  },

  async loadOUsForWizard(state) {
    if (!App.rsatAvailable || App.rsatMissingGPMC) return;
    try {
      if (!this.ousCache) {
        const result = await window.api.ad.getOUs();
        if (result.success) this.ousCache = this.flattenOUs(result.data);
      }
      if (this.ousCache) {
        const select = document.getElementById('wiz-ou');
        if (select) {
          this.ousCache.forEach(ou => {
            const opt = document.createElement('option');
            opt.value = ou.dn;
            opt.textContent = '  '.repeat(ou.depth) + (ou.depth > 0 ? '↳ ' : '') + ou.name;
            if (ou.dn === state.ouDN) opt.selected = true;
            select.appendChild(opt);
          });
        }
      }
    } catch (e) {}
  },

  flattenOUs(roots, depth = 0, flat = []) {
    for (const root of roots) {
      flat.push({ ...root, depth });
      if (root.children && root.children.length) {
        this.flattenOUs(root.children, depth + 1, flat);
      }
    }
    return flat;
  },

  async generatePreview(state) {
    const preview = document.getElementById('script-preview');
    try {
      const script = await window.api.scripts.generate({
        name: state.name,
        template: state.template,
        silentArgs: state.silentArgs,
        customParams: state.customParams
      });
      preview.textContent = script;
    } catch (err) {
      preview.textContent = '# ' + t('apps.errorGeneratingScript') + ' ' + err.message;
    }
  },

  async finishWizard(state, isEdit, existingApp) {
    if (!state.name.trim()) {
      App.toast(t('apps.nameRequired'), 'warning');
      return;
    }

    try {
      const deployBtn = document.getElementById('wiz-deploy');
      if (deployBtn) {
        deployBtn.style.width = deployBtn.offsetWidth + 'px';
        deployBtn.disabled = true;
        deployBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;margin-right:6px;"></span> ' + t('apps.deployingLoader');
      }

      const appData = {
        name: state.name.trim(),
        template: state.template,
        installerType: (state.installerPath && state.installerPath.toLowerCase().endsWith('.msi')) ? 'msi' : 'exe',
        silentArgs: state.silentArgs,
        installerPath: state.installerPath,
        configXmlPath: state.configXmlPath,
        customParams: state.customParams,
        gpoName: state.gpoName,
        ouDN: state.ouDN,
        assignedOUs: state.ouDN ? [state.ouDN] : [],
        version: state.version || '1.0.0',
        notifyUser: state.notifyUser || false
      };

      let app;
      if (isEdit && existingApp) {
        app = await window.api.apps.update(existingApp.id, appData);
      } else {
        app = await window.api.apps.create(appData);
      }

      // Deploy script (Copies files to network share too)
      const deployResult = await window.api.scripts.deploy({
        ...appData,
        id: app.id
      });

      if (deployResult.success) {
        // Mark as deployed with hash for version tracking
        await window.api.apps.update(app.id, {
          deployed: true,
          deployedPath: deployResult.path,
          lastDeployHash: deployResult.hash || ''
        });
        // Log activity
        await window.api.activity.add(isEdit ? 'app_update' : 'app_create', {
          appName: state.name, version: state.version, template: state.template
        });
        App.toast(t('apps.appCreated'), 'success');
        App.toast(t('apps.deploySuccess'), 'success');

        // Create GPO automatically if chosen
        if (state.createGPO) {
          const newGpoName = `Deploy_${state.name.replace(/\\s/g, "_")}`;
          App.toast(`${t('apps.generatingGpo')} ${newGpoName}...`, 'info');
          const gpoResult = await window.api.ad.createGPO(newGpoName, deployResult.path, state.ouDN);
          
          if (gpoResult.success) {
            await window.api.apps.update(app.id, { gpoName: newGpoName });
            App.toast(t('apps.gpoCreatedSuccess').replace('{gpo}', newGpoName), 'success');
            this.gposCache = null; // Invalidate cache
          } else {
            App.toast(`${t('apps.gpoWarningOnlyServer')} ${gpoResult.error}`, 'warning');
          }
        }
      } else {
        App.toast(`${t('apps.appSavedDeployError')} ${deployResult.error}`, 'error');
      }

      App.closeModal();
      App.navigate('apps');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  copyScript() {
    const preview = document.getElementById('script-preview');
    if (preview) {
      navigator.clipboard.writeText(preview.textContent);
      App.toast(t('apps.scriptCopied'), 'success');
    }
  },

  // ─── Actions ───────────────────────────────────────
  async previewScript(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const script = await window.api.scripts.generate(app);

    App.openModal(`Script: ${app.name}`, `
      <div class="code-header">
        <span>📄 install.ps1</span>
        <button class="btn btn-ghost btn-sm" onclick="AppsPage.copyScript()">${t('apps.copyBtn')}</button>
      </div>
      <pre class="code-preview" id="script-preview">${this.esc(script)}</pre>
    `);
  },

  async deployApp(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    try {
      const result = await window.api.scripts.deploy(app);
      if (result.success) {
        await window.api.apps.update(id, { deployed: true, deployedPath: result.path });
        App.toast(t('apps.deployedToPath').replace('{app}', app.name).replace('{path}', result.path), 'success');
        App.navigate('apps');
      } else {
        App.toast(`Error: ${result.error}`, 'error');
      }
    } catch (err) {
      App.toast(t('apps.deployError') + ' ' + err.message, 'error');
    }
  },

  async disableDeploy(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const hasGPO = !!app.gpoName;
    const hasOUs = app.assignedOUs && app.assignedOUs.length > 0;

    App.openModal(t('apps.disableConfirm'), `
      <p>${t('apps.disableMsg').replace('{app}', `<strong>${this.esc(app.name)}</strong>`)}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--warning-color); font-weight:600;">⚠️ Esta app tiene la GPO "${this.esc(app.gpoName)}" asignada</p>
          ${hasOUs ? `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <input type="checkbox" id="chk-unlink-gpo" checked style="width:auto; cursor:pointer;">
              <label for="chk-unlink-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanGpoOption')}</label>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <input type="checkbox" id="chk-clean-script" checked style="width:auto; cursor:pointer;">
            <label for="chk-clean-script" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanSysvolOption')}</label>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk-delete-gpo" style="width:auto; cursor:pointer;">
            <label for="chk-delete-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-muted);">${t('apps.deleteGpoOption')}</label>
          </div>
        </div>
      ` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-warning" id="btn-confirm-disable">${t('apps.disable')}</button>
    `);

    document.getElementById('btn-confirm-disable').addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-disable');
      btn.style.width = btn.offsetWidth + 'px';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;margin-right:6px;"></span> ' + t('apps.processingLoader');

      try {
        const deleteFiles = document.getElementById('chk-delete-deploy-files').checked;
        const unlinkGPO = document.getElementById('chk-unlink-gpo')?.checked ?? false;
        const cleanScript = document.getElementById('chk-clean-script')?.checked ?? false;
        const deleteGPO = document.getElementById('chk-delete-gpo')?.checked ?? false;

        // 1. Unlink GPO from all assigned OUs
        if (hasGPO && unlinkGPO && hasOUs) {
          for (const ouDN of app.assignedOUs) {
            const result = await window.api.ad.unlinkGPOfromOU(app.gpoName, ouDN);
            if (result.success) {
              App.toast(t('apps.gpoUnlinkedOu').replace('{ou}', ouDN.split(',')[0]), 'success');
            } else {
              App.toast(t('apps.gpoUnlinkFailed').replace('{ou}', ouDN.split(',')[0]) + ' ' + result.error, 'warning');
            }
          }
        }

        // 2. Clean startup script from SYSVOL
        if (hasGPO && cleanScript) {
          const cleanResult = await window.api.ad.removeGPOStartupScript(app.gpoName);
          if (cleanResult.success) {
            App.toast(t('apps.sysvolCleaned'), 'success');
          } else {
            App.toast(`${t('apps.sysvolCleanWarn')} ${cleanResult.error}`, 'warning');
          }
        }

        // 3. Delete GPO entirely if requested
        if (hasGPO && deleteGPO) {
          const delResult = await window.api.ad.deleteGPO(app.gpoName);
          if (delResult.success) {
            App.toast(t('apps.gpoDeletedMsg').replace('{gpo}', app.gpoName), 'success');
          } else {
            App.toast(`${t('apps.gpoDeleteFailed')} ${delResult.error}`, 'warning');
          }
        }

        // 4. Delete files from network share if requested
        if (deleteFiles) {
          await window.api.apps.delete(id, true);
          // Re-create the app record without files
          const freshApp = { ...app };
          delete freshApp.id;
          freshApp.deployed = false;
          freshApp.deployedPath = '';
          freshApp.gpoName = deleteGPO ? '' : app.gpoName;
          freshApp.assignedOUs = (unlinkGPO || deleteGPO) ? [] : app.assignedOUs;
          const recreated = await window.api.apps.create(freshApp);
          await window.api.activity.add('app_disable', { appName: app.name, deletedFiles: true, deletedGPO: deleteGPO });
        } else {
          // Just update the app status
          const updateData = { deployed: false, deployedPath: '' };
          if (deleteGPO) updateData.gpoName = '';
          if (unlinkGPO || deleteGPO) updateData.assignedOUs = [];
          await window.api.apps.update(id, updateData);
          await window.api.activity.add('app_disable', { appName: app.name, deletedFiles: false, deletedGPO: deleteGPO });
        }

        App.toast(t('apps.disableSuccess').replace('{app}', app.name), 'success');
        App.closeModal();
        App.navigate('apps');
      } catch (err) {
        App.toast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('apps.disable');
      }
    });
  },

  async editApp(id) {
    const app = await window.api.apps.get(id);
    if (app) this.openWizard(app);
  },

  async deleteApp(id) {
    const app = await window.api.apps.get(id);
    if (!app) return;

    const hasGPO = !!app.gpoName;
    const hasOUs = app.assignedOUs && app.assignedOUs.length > 0;

    App.openModal(t('apps.deleteConfirm'), `
      <p>${t('apps.deleteMsg').replace('{app}', `<strong>${this.esc(app.name)}</strong>`)}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--danger-color); font-weight:600;">🗑️ Limpieza de GPO: "${this.esc(app.gpoName)}"</p>
          ${hasOUs ? `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <input type="checkbox" id="chk-del-unlink-gpo" checked style="width:auto; cursor:pointer;">
              <label for="chk-del-unlink-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanGpoOption')}</label>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <input type="checkbox" id="chk-del-clean-script" checked style="width:auto; cursor:pointer;">
            <label for="chk-del-clean-script" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanSysvolOption')}</label>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk-del-delete-gpo" checked style="width:auto; cursor:pointer;">
            <label for="chk-del-delete-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.deleteGpoOption')}</label>
          </div>
        </div>
      ` : ''}
      <div class="form-group mt-md" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="chk-delete-files" style="width:auto; cursor:pointer;" checked>
        <label for="chk-delete-files" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-muted);">${t('apps.keepFilesOption')}</label>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-danger" id="btn-confirm-delete">${t('common.delete')}</button>
    `);

    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-delete');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;margin-right:6px;"></span> ' + t('apps.deletingLoader');

      try {
        const deleteFiles = document.getElementById('chk-delete-files').checked;
        const unlinkGPO = document.getElementById('chk-del-unlink-gpo')?.checked ?? false;
        const cleanScript = document.getElementById('chk-del-clean-script')?.checked ?? false;
        const deleteGPO = document.getElementById('chk-del-delete-gpo')?.checked ?? false;

        // GPO cleanup before deleting the app
        if (hasGPO && unlinkGPO && hasOUs) {
          for (const ouDN of app.assignedOUs) {
            await window.api.ad.unlinkGPOfromOU(app.gpoName, ouDN);
          }
        }
        if (hasGPO && cleanScript) {
          await window.api.ad.removeGPOStartupScript(app.gpoName);
        }
        if (hasGPO && deleteGPO) {
          await window.api.ad.deleteGPO(app.gpoName);
        }

        await window.api.apps.delete(id, deleteFiles);
        App.toast(t('apps.deleteSuccess').replace('{app}', app.name), 'success');
        App.closeModal();
        App.navigate('apps');
      } catch (err) {
        App.toast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('apps.deleteAllBtn');
      }
    });
  },

  templateIcon(id) {
    const icons = {
      generic: '📦',
      office: '📎',
      custom: '⚡',
      wazuh: '🛡️',
      sentinelone: '🟣',
      cortexxdr: '🛡️',
      bitdefender: '🔴',
      crowdstrike: '🦅',
      zscaler: '☁️',
      globalprotect: '🌍',
      ciscosecureclient: '🔒',
      forticlient: '🛡️',
      lansweeper: '📡',
      ninjaone: '🥷',
      freshservice: '🔧',
      teamviewer: '↔️',
      anydesk: '🟥',
      veeam: '🟩',
      crashplan: '☁️',
      chrome: '🌐',
      'sap-gui': '💼'
    };
    return icons[id] || '📦';
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  showSilentArgsHelper(state, renderWizard) {
    const args = [
      { category: t('apps.argsCatMsi'), items: [
        { arg: '/qn', desc: t('apps.argsMsiQn') },
        { arg: '/qb', desc: t('apps.argsMsiQb') },
        { arg: '/qr', desc: t('apps.argsMsiQr') },
        { arg: '/norestart', desc: t('apps.argsMsiNoRestart') },
        { arg: '/passive', desc: t('apps.argsMsiPassive') },
        { arg: '/l*v "C:\\install.log"', desc: t('apps.argsMsiLog') },
        { arg: 'ALLUSERS=1', desc: t('apps.argsMsiAllUsers') },
        { arg: 'INSTALLDIR="C:\\Program Files\\App"', desc: t('apps.argsMsiInstallDir') },
        { arg: '/qn /norestart', desc: t('apps.argsMsiCombo') },
      ]},
      { category: t('apps.argsCatExe'), items: [
        { arg: '/S', desc: t('apps.argsExeNsis') },
        { arg: '/s', desc: t('apps.argsExeLower') },
        { arg: '/silent', desc: t('apps.argsExeInnoSilent') },
        { arg: '/verysilent', desc: t('apps.argsExeInnoVery') },
        { arg: '/SILENT /NORESTART', desc: t('apps.argsExeInnoCombo') },
        { arg: '/quiet', desc: t('apps.argsExeQuiet') },
        { arg: '/quiet /norestart', desc: t('apps.argsExeQuietCombo') },
        { arg: '-ms', desc: t('apps.argsExeMs') },
        { arg: '--silent --accept-license', desc: t('apps.argsExeAcceptLicense') },
      ]},
      { category: t('apps.argsCatSpecial'), items: [
        { arg: 'TRANSFORMS="config.mst"', desc: t('apps.argsSpecialMst') },
        { arg: '/extract:"C:\\temp"', desc: t('apps.argsSpecialExtract') },
        { arg: '/configure config.xml', desc: t('apps.argsSpecialOffice') },
      ]},
    ];

    const body = `
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:var(--font-sm);">${t('apps.clickToCopyArgs')}</p>
      ${args.map(cat => `
        <div style="margin-bottom:20px;">
          <div style="font-weight:600;color:var(--text-primary);margin-bottom:8px;font-size:var(--font-sm);text-transform:uppercase;letter-spacing:0.5px;">${cat.category}</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${cat.items.map(item => `
              <div class="args-helper-row" onclick="document.getElementById('_args_selected').value = '${item.arg.replace(/'/g, "\\'").replace(/"/g, '&quot;')}'; document.querySelectorAll('.args-helper-row').forEach(r=>r.style.background=''); this.style.background='var(--accent-primary-dim)';" style="display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:var(--radius-sm);cursor:pointer;transition:background 0.15s;">
                <code style="background:var(--bg-input);padding:4px 10px;border-radius:4px;font-size:var(--font-sm);color:var(--accent-secondary);white-space:nowrap;border:1px solid var(--border-color);">${this.esc(item.arg)}</code>
                <span style="font-size:var(--font-sm);color:var(--text-muted);">${item.desc}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <input type="hidden" id="_args_selected" value="">
    `;

    App.openModal(t('apps.argsHelpTitle'), body, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-primary" id="btn-apply-arg">${t('apps.applyArg')}</button>
    `);

    document.getElementById('btn-apply-arg').addEventListener('click', () => {
      const selected = document.getElementById('_args_selected').value;
      if (selected) {
        state.silentArgs = selected;
        App.closeModal();
        renderWizard();
        App.toast(t('apps.argsCopied').replace('{arg}', selected), 'success');
      } else {
        App.toast(t('apps.selectArgWarning'), 'warning');
      }
    });
  }
};
