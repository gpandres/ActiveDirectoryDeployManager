// ═══════════════════════════════════════════════════════
// Bundles Page — Group apps into deployment packs
// ═══════════════════════════════════════════════════════

const BundlesPage = {
  bundles: [],
  apps: [],

  async render(container) {
    this.apps = await window.api.apps.getAll();
    this.bundles = await window.api.bundles.getAll();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>
            <span class="header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </span>
            ${t('bundles.title')}
          </h1>
          <p class="page-subtitle">${t('bundles.subtitle')}</p>
        </div>
        <button class="btn btn-primary" onclick="BundlesPage.openWizard()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('bundles.newBundle')}
        </button>
      </div>

      ${App.rsatWarningHTML()}

      <div id="bundles-list">
        ${this.bundles.length === 0 ? `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted);margin-bottom:16px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <p>${t('bundles.noBundles')}</p>
            <p style="font-size:var(--font-sm);margin-top:8px">${t('bundles.createBundleHint')}</p>
          </div>
        ` : `
          <div class="cards-grid">
            ${this.bundles.map(b => this.renderBundleCard(b)).join('')}
          </div>
        `}
      </div>
    `;
  },

  renderBundleCard(bundle) {
    const isDeployed = bundle.deployed && bundle.deployedPath;
    return `
      <div class="card bundle-card" style="position:relative">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
          <div>
            <div class="card-title" style="margin-bottom:4px">${this.esc(bundle.name)}</div>
            <div style="font-size:var(--font-sm);color:var(--text-muted)">${this.esc(bundle.description || '')}</div>
          </div>
          <span class="badge ${isDeployed ? 'badge-success' : 'badge-neutral'}">
            ${isDeployed ? t('deployments.ready') : ''}
          </span>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          <span class="badge badge-info">v${this.esc(bundle.version)}</span>
          <span class="badge badge-primary">${bundle.apps.length} ${t('bundles.appsIncluded')}</span>
          ${bundle.gpoName ? `<span class="badge badge-info">${this.esc(bundle.gpoName)}</span>` : ''}
          ${bundle.createGPO ? `<span class="badge badge-success">${t('bundles.autoGpo')}</span>` : ''}
        </div>

        <div style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:12px">
          ${bundle.apps.map(a => `<span style="display:inline-block;background:var(--bg-input);padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0">${this.esc(a.name)}</span>`).join('')}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" onclick="BundlesPage.previewScript('${bundle.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${t('apps.script')}
          </button>
          ${isDeployed ? `
            <button class="btn btn-sm btn-warning" onclick="BundlesPage.disableDeploy('${bundle.id}')">${t('apps.disable')}</button>
          ` : `
            <button class="btn btn-sm btn-success" onclick="BundlesPage.deployBundle('${bundle.id}')">${t('apps.deploy')}</button>
          `}
          <button class="btn btn-sm btn-secondary" onclick="BundlesPage.editBundle('${bundle.id}')">${t('apps.edit')}</button>
          <button class="btn btn-sm btn-danger" onclick="BundlesPage.deleteBundle('${bundle.id}')" title="${t('common.delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; },

  // ─── Flatten OU tree for select dropdowns ──────────
  _flattenOUs(roots, depth = 0, flat = []) {
    for (const ou of roots) {
      flat.push({ name: ou.name, dn: ou.dn, depth });
      if (ou.children && ou.children.length) {
        this._flattenOUs(ou.children, depth + 1, flat);
      }
    }
    return flat;
  },

  // ─── Wizard ────────────────────────────────────────
  async openWizard(existingBundle = null) {
    const isEdit = !!existingBundle;
    let flatOUs = [];
    try {
      const ouResult = await window.api.ad.getOUs();
      if (ouResult.success && ouResult.data) {
        flatOUs = this._flattenOUs(ouResult.data);
      }
    } catch (e) {}

    const state = {
      step: 1,
      name: existingBundle?.name || '',
      description: existingBundle?.description || '',
      selectedApps: existingBundle?.apps || [],
      notifyUser: existingBundle?.notifyUser || false,
      gpoName: existingBundle?.gpoName || '',
      ouDN: existingBundle?.ouDN || '',
      createGPO: existingBundle?.createGPO || false,
      version: existingBundle?.version || '1.0.0'
    };

    const renderWizard = () => {
      let body = `
        <div class="wizard-steps">
          <div class="wizard-step ${state.step >= 1 ? (state.step > 1 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">1</span><span>${t('bundles.step1')}</span>
          </div>
          <div class="wizard-step ${state.step >= 2 ? (state.step > 2 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">2</span><span>${t('bundles.step2')}</span>
          </div>
          <div class="wizard-step ${state.step >= 3 ? (state.step > 3 ? 'done' : 'active') : ''}">
            <span class="wizard-step-number">3</span><span>${t('apps.step3')}</span>
          </div>
        </div>
      `;

      if (state.step === 1) {
        body += `
          <div class="form-group">
            <label class="form-label">${t('bundles.bundleName')} *</label>
            <input class="form-input" id="wiz-bundle-name" value="${this.esc(state.name)}" placeholder="Ej: Pack Oficina">
          </div>
          <div class="form-group">
            <label class="form-label">${t('bundles.desc')}</label>
            <input class="form-input" id="wiz-bundle-desc" value="${this.esc(state.description)}" placeholder="Ej: Chrome + Office + FortiClient">
          </div>
          <div class="form-group">
            <label class="form-label">${t('apps.version')}</label>
            <input class="form-input" id="wiz-bundle-version" value="${state.version}" placeholder="1.0.0" style="max-width:150px">
          </div>
        `;
      } else if (state.step === 2) {
        body += `
          <p style="color:var(--text-secondary);margin-bottom:16px">${t('bundles.selectApps')}:</p>
          <div style="max-height:300px;overflow-y:auto">
            ${this.apps.map((app, i) => {
              const isSelected = state.selectedApps.some(s => s.appId === app.id);
              return `
                <label class="checkbox-wrapper" style="padding:8px;border-radius:var(--radius-sm);${isSelected ? 'background:var(--accent-primary-dim)' : ''}">
                  <input type="checkbox" data-app-id="${app.id}" data-app-name="${this.esc(app.name)}"
                    ${isSelected ? 'checked' : ''} onchange="BundlesPage._toggleApp(this)">
                  <span>${this.esc(app.name)}</span>
                  <span class="badge badge-primary" style="margin-left:auto">${this.esc(app.template)}</span>
                  <span class="badge badge-info">v${this.esc(app.version || '1.0.0')}</span>
                </label>
              `;
            }).join('')}
          </div>
          ${this.apps.length === 0 ? `<p style="color:var(--accent-warning);margin-top:8px">⚠ ${t('bundles.emptyApps')}</p>` : ''}
        `;
      } else if (state.step === 3) {
        body += `
          <div class="form-group">
            <label class="checkbox-wrapper">
              <input type="checkbox" id="wiz-bundle-notify" ${state.notifyUser ? 'checked' : ''}>
              <span>🔔 ${t('bundles.notifyUserLabel')}</span>
            </label>
            <div class="form-hint">${t('bundles.notifyUserHint')}</div>
          </div>
          <hr style="border-color:var(--border-color);margin:16px 0">

          <div class="form-group mb-md">
            <label class="flex items-center gap-sm" style="cursor:pointer; padding: 12px; background: rgba(30,144,255,0.1); border-radius: 6px; border: 1px solid rgba(30,144,255,0.2);">
              <input type="checkbox" id="wiz-bundle-create-gpo" ${state.createGPO ? 'checked' : ''} style="width:16px;height:16px;">
              <span style="font-weight:600;color:var(--primary-color)">✨ ${t('bundles.createGpo')}</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">${t('apps.selectGpo')}</label>
            <input class="form-input" id="wiz-bundle-gpo" value="${this.esc(state.gpoName)}" placeholder="Deploy_Bundle_Pack">
          </div>

          ${flatOUs.length > 0 ? `
            <div class="form-group">
              <label class="form-label">${t('apps.selectOus')}</label>
              <select class="form-select" id="wiz-bundle-ou">
              <option value="">${t('bundles.cancelOption')}</option>
                ${flatOUs.map(ou => `<option value="${this.esc(ou.dn)}" ${state.ouDN === ou.dn ? 'selected' : ''}>${'  '.repeat(ou.depth)}${ou.depth > 0 ? '↳ ' : ''}${this.esc(ou.name)}</option>`).join('')}
              </select>
            </div>
          ` : ''}

          <div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:var(--radius-sm)">
            <div style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:8px">${t('apps.reviewSummary')}:</div>
            <div style="font-weight:600;color:var(--text-primary)">${this.esc(state.name)} v${state.version}</div>
            <div style="color:var(--text-secondary);font-size:var(--font-sm)">${state.selectedApps.length} ${t('apps.selected')}: ${state.selectedApps.map(a => a.name).join(', ') || ''}</div>
          </div>
        `;
      }

      App.openModal(isEdit ? t('apps.edit') : t('bundles.newBundle'), body, `
        ${state.step > 1 ? `<button class="btn btn-secondary" onclick="BundlesPage._wizBack()">${t('apps.back')}</button>` : ''}
        <div style="flex:1"></div>
        ${state.step < 3
          ? `<button class="btn btn-primary" onclick="BundlesPage._wizNext()">${t('apps.next')}</button>`
          : `<button class="btn btn-success" onclick="BundlesPage._wizFinish(${isEdit ? `'${existingBundle.id}'` : 'null'})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${isEdit ? t('apps.saveAndDeploy') : t('apps.createAndDeploy')}
             </button>`
        }
      `);
    };

    this._wizState = state;
    this._wizRender = renderWizard;
    this._wizOus = flatOUs;
    renderWizard();
  },

  _saveStepData() {
    const s = this._wizState;
    if (s.step === 1) {
      const name = document.getElementById('wiz-bundle-name');
      const desc = document.getElementById('wiz-bundle-desc');
      const ver = document.getElementById('wiz-bundle-version');
      if (name) s.name = name.value;
      if (desc) s.description = desc.value;
      if (ver) s.version = ver.value;
    } else if (s.step === 3) {
      const notify = document.getElementById('wiz-bundle-notify');
      const gpo = document.getElementById('wiz-bundle-gpo');
      const createGPO = document.getElementById('wiz-bundle-create-gpo');
      const ou = document.getElementById('wiz-bundle-ou');
      if (notify) s.notifyUser = notify.checked;
      if (gpo) s.gpoName = gpo.value;
      if (createGPO) s.createGPO = createGPO.checked;
      if (ou) s.ouDN = ou.value;
    }
  },

  _toggleApp(checkbox) {
    const id = checkbox.dataset.appId;
    const name = checkbox.dataset.appName;
    const s = this._wizState;
    if (checkbox.checked) {
      if (!s.selectedApps.some(a => a.appId === id)) {
        s.selectedApps.push({ appId: id, name, order: s.selectedApps.length + 1 });
      }
    } else {
      s.selectedApps = s.selectedApps.filter(a => a.appId !== id);
      s.selectedApps.forEach((a, i) => a.order = i + 1);
    }
  },

  _wizBack() {
    this._saveStepData();
    this._wizState.step--;
    this._wizRender();
  },

  _wizNext() {
    this._saveStepData();
    if (this._wizState.step === 1 && !this._wizState.name.trim()) {
      App.toast(t('bundles.nameRequired'), 'warning');
      return;
    }
    if (this._wizState.step === 2 && this._wizState.selectedApps.length === 0) {
      App.toast(t('bundles.selectAtLeastOne'), 'warning');
      return;
    }
    this._wizState.step++;
    this._wizRender();
  },

  async _wizFinish(editId) {
    this._saveStepData();
    const s = this._wizState;

    // Auto-generate GPO name if createGPO is checked but no name provided
    if (s.createGPO && !s.gpoName.trim()) {
      s.gpoName = `Deploy_Bundle_${s.name.replace(/\s/g, '_')}`;
    }

    const data = {
      name: s.name,
      description: s.description,
      apps: s.selectedApps,
      notifyUser: s.notifyUser,
      gpoName: s.gpoName,
      createGPO: s.createGPO,
      ouDN: s.ouDN,
      version: s.version
    };

    try {
      if (editId) {
        await window.api.bundles.update(editId, data);
        await window.api.activity.add('bundle_update', { bundleName: s.name });
        App.toast(`${t('bundles.bundleUpdated')} "${s.name}"`, 'success');
      } else {
        await window.api.bundles.create(data);
        await window.api.activity.add('bundle_create', { bundleName: s.name, appCount: s.selectedApps.length });
        App.toast(`${t('bundles.bundleCreated')} "${s.name}" (${s.selectedApps.length} apps)`, 'success');
      }
      App.closeModal();
      App.navigate('bundles');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  // ─── Actions ───────────────────────────────────────
  async editBundle(id) {
    const bundle = await window.api.bundles.get(id);
    if (bundle) this.openWizard(bundle);
  },

  async deleteBundle(id) {
    const bundle = this.bundles.find(b => b.id === id);
    if (!bundle) return;

    const hasGPO = !!bundle.gpoName;

    App.openModal(t('apps.deleteConfirm'), `
      <p>${t('bundles.deleteBundleMsg').replace('{bundle}', `<strong>${this.esc(bundle.name)}</strong>`)}</p>
      <p style="color:var(--text-muted);font-size:var(--font-sm);margin-top:8px">${t('bundles.individualAppsNotDeleted')}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--danger-color); font-weight:600;">🗑️ GPO: "${this.esc(bundle.gpoName)}"</p>
          ${bundle.ouDN ? `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <input type="checkbox" id="chk-bdel-unlink" checked style="width:auto; cursor:pointer;">
              <label for="chk-bdel-unlink" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanGpoOption')}</label>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <input type="checkbox" id="chk-bdel-clean" checked style="width:auto; cursor:pointer;">
            <label for="chk-bdel-clean" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanSysvolOption')}</label>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk-bdel-gpo" checked style="width:auto; cursor:pointer;">
            <label for="chk-bdel-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.deleteGpoOption')}</label>
          </div>
        </div>
      ` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-danger" id="btn-bundle-confirm-delete">${t('common.delete')}</button>
    `);

    document.getElementById('btn-bundle-confirm-delete').addEventListener('click', async () => {
      const btn = document.getElementById('btn-bundle-confirm-delete');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;margin-right:6px;"></span> ${t('bundles.deleteBtn')}`;

      try {
        if (hasGPO) {
          const unlinkGPO = document.getElementById('chk-bdel-unlink')?.checked ?? false;
          const cleanScript = document.getElementById('chk-bdel-clean')?.checked ?? false;
          const deleteGPO = document.getElementById('chk-bdel-gpo')?.checked ?? false;

          if (unlinkGPO && bundle.ouDN) {
            await window.api.ad.unlinkGPOfromOU(bundle.gpoName, bundle.ouDN);
          }
          if (cleanScript) {
            await window.api.ad.removeGPOStartupScript(bundle.gpoName);
          }
          if (deleteGPO) {
            await window.api.ad.deleteGPO(bundle.gpoName);
          }
        }

        await window.api.bundles.delete(id);
        await window.api.activity.add('bundle_delete', { bundleId: id });
        App.toast(t('bundles.bundleDeleted'), 'success');
        App.closeModal();
        App.navigate('bundles');
      } catch (err) {
        App.toast(t('common.error') + ': ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('common.delete');
      }
    });
  },

  async deployBundle(id) {
    // Re-read from DB to get the latest data (including createGPO flag)
    const bundle = await window.api.bundles.get(id);
    if (!bundle) return;

    App.toast(`${t('bundles.deploying')} "${bundle.name}"...`, 'info');
    try {
      const result = await window.api.bundles.deploy(id);
      if (result.success) {
        // Create GPO if the bundle has it configured
        if (bundle.createGPO && (bundle.gpoName || bundle.name)) {
          const gpoName = bundle.gpoName || `Deploy_Bundle_${bundle.name.replace(/\s/g, '_')}`;
          const scriptPath = result.path;
          const ouDN = bundle.ouDN || '';

          App.toast(`${t('bundles.creatingGpo')} ${gpoName}...`, 'info');
          try {
            const gpoResult = await window.api.ad.createGPO(gpoName, scriptPath, ouDN);
            if (gpoResult.success) {
              // Save the GPO name back to the bundle
              await window.api.bundles.update(id, { gpoName: gpoName });
              App.toast(`${t('bundles.gpoCreatedBound')}`, 'success');
            } else {
              App.toast(`${t('bundles.bundleDeployedWaitMsg')} ${gpoResult.error}`, 'warning');
            }
          } catch (gpoErr) {
            App.toast(`${t('bundles.bundleDeployedWaitMsg')} ${gpoErr.message}`, 'warning');
          }
        } else if (bundle.gpoName && !bundle.createGPO) {
          // GPO already exists, just link it if we have an OU
          if (bundle.ouDN) {
            try {
              await window.api.ad.linkGPOtoOU(bundle.gpoName, bundle.ouDN);
              App.toast(`${t('bundles.gpoCreatedBound')}`, 'success');
            } catch (e) {}
          }
        }
        App.toast(t('apps.deploySuccess'), 'success');
        App.navigate('bundles');
      } else {
        App.toast(t('common.error') + ': ' + result.error, 'error');
      }
    } catch (err) {
      App.toast(t('common.error') + ': ' + err.message, 'error');
    }
  },

  async disableDeploy(id) {
    const bundle = await window.api.bundles.get(id);
    if (!bundle) return;

    const hasGPO = !!bundle.gpoName;

    App.openModal(t('apps.disableConfirm'), `
      <p>${t('bundles.disableBundleMsg').replace('{bundle}', `<strong>${this.esc(bundle.name)}</strong>`)}</p>
      ${hasGPO ? `
        <div class="form-group mt-md" style="background: rgba(255,165,0,0.08); border: 1px solid rgba(255,165,0,0.25); border-radius:8px; padding:12px;">
          <p style="margin:0 0 8px 0; color:var(--warning-color); font-weight:600;">⚠️ GPO: "${this.esc(bundle.gpoName)}"</p>
          ${bundle.ouDN ? `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <input type="checkbox" id="chk-bdis-unlink" checked style="width:auto; cursor:pointer;">
              <label for="chk-bdis-unlink" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanGpoOption')}</label>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <input type="checkbox" id="chk-bdis-clean" checked style="width:auto; cursor:pointer;">
            <label for="chk-bdis-clean" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-secondary);">${t('apps.cleanSysvolOption')}</label>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk-bdis-delete-gpo" style="width:auto; cursor:pointer;">
            <label for="chk-bdis-delete-gpo" style="margin:0; cursor:pointer; font-size:14px; color:var(--text-muted);">${t('apps.deleteGpoOption')}</label>
          </div>
        </div>
      ` : ''}
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-warning" id="btn-bundle-confirm-disable">${t('apps.disable')}</button>
    `);

    document.getElementById('btn-bundle-confirm-disable').addEventListener('click', async () => {
      const btn = document.getElementById('btn-bundle-confirm-disable');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;margin-right:6px;"></span> ' + t('apps.processingLoader');

      try {
        if (hasGPO) {
          const unlinkGPO = document.getElementById('chk-bdis-unlink')?.checked ?? false;
          const cleanScript = document.getElementById('chk-bdis-clean')?.checked ?? false;
          const deleteGPO = document.getElementById('chk-bdis-delete-gpo')?.checked ?? false;

          if (unlinkGPO && bundle.ouDN) {
            const r = await window.api.ad.unlinkGPOfromOU(bundle.gpoName, bundle.ouDN);
            if (r.success) App.toast(t('bundles.gpoUnlinkedOu'), 'success');
          }
          if (cleanScript) {
            const r = await window.api.ad.removeGPOStartupScript(bundle.gpoName);
            if (r.success) App.toast(t('bundles.startupScriptCleaned'), 'success');
          }
          if (deleteGPO) {
            const r = await window.api.ad.deleteGPO(bundle.gpoName);
            if (r.success) App.toast(t('bundles.gpoDeletedSuccess').replace('{gpo}', bundle.gpoName), 'success');
            await window.api.bundles.update(id, { deployed: false, deployedPath: '', gpoName: '' });
          } else {
            await window.api.bundles.update(id, { deployed: false, deployedPath: '' });
          }
        } else {
          await window.api.bundles.update(id, { deployed: false, deployedPath: '' });
        }

        await window.api.activity.add('bundle_disable', { bundleId: id, bundleName: bundle.name });
        App.toast(t('bundles.bundleDisabled').replace('{bundle}', bundle.name), 'success');
        App.closeModal();
        App.navigate('bundles');
      } catch (err) {
        App.toast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('apps.disable');
      }
    });
  },

  async previewScript(id) {
    const script = await window.api.bundles.generateScript(id);
    App.openModal(t('bundles.bundleScriptTitle'), `
      <div class="code-header">
        <span>bundle_install.ps1</span>
      </div>
      <pre class="code-preview">${this.esc(script)}</pre>
    `, `<button class="btn btn-secondary" onclick="App.closeModal()">${t('deployments.close')}</button>`);
  }
};
