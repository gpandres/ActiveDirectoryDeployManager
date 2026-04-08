const GposPage = {
  gposCache: null,
  filterAppOnly: true,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${t('gpos.title')}</h1>
          <p class="page-subtitle">${t('gpos.subtitle')}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <label class="gpo-filter-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
            <span style="font-size: 13px; color: var(--text-muted);" id="gpo-filter-label">${t('gpos.filterAll')}</span>
            <div class="gpo-switch" id="gpo-filter-switch">
              <input type="checkbox" id="gpo-filter-checkbox" ${this.filterAppOnly ? 'checked' : ''}>
              <span class="gpo-switch-slider"></span>
            </div>
          </label>
          <button class="btn btn-primary" id="btn-refresh-gpos">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 2.13-5.83L2 8"/></svg>
            ${t('gpos.refresh')}
          </button>
        </div>
      </div>

      ${App.rsatWarningHTML()}

      <div class="card mt-lg" style="padding: 0;">
        <div class="table-container">
          <table class="table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                <th style="padding: 16px;">${t('gpos.name')}</th>
                <th style="padding: 16px;">${t('gpos.id')}</th>
                <th style="padding: 16px;">${t('gpos.modified')}</th>
                <th style="padding: 16px; width: 100px; text-align: center;">${t('gpos.actions')}</th>
              </tr>
            </thead>
            <tbody id="gpos-tbody">
              <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">
                  <span class="spinner" style="display:inline-block; border-color:var(--primary-color) transparent transparent; margin-bottom:10px;"></span>
                  <br>${t('gpos.loading')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-refresh-gpos').addEventListener('click', () => {
      this.gposCache = null;
      this.loadGPOs();
    });

    document.getElementById('gpo-filter-checkbox').addEventListener('change', (e) => {
      this.filterAppOnly = e.target.checked;
      const label = document.getElementById('gpo-filter-label');
      label.textContent = this.filterAppOnly ? t('gpos.filterAppOnly') : t('gpos.filterAll');
      this.loadGPOs();
    });

    if (App.rsatAvailable && !App.rsatMissingGPMC) {
      await this.loadGPOs();
    } else {
      document.getElementById('gpos-tbody').innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 40px; color: var(--danger-color);">
            ${t('gpos.rsatMissing')}
          </td>
        </tr>
      `;
    }
  },

  async loadGPOs() {
    const tbody = document.getElementById('gpos-tbody');
    try {
      if (!this.gposCache) {
        const result = await window.api.ad.getGPOs();
        if (!result.success) throw new Error(result.error);
        this.gposCache = result.data.sort((a, b) => a.DisplayName.localeCompare(b.DisplayName));
      }

      const displayList = this.filterAppOnly
        ? this.gposCache.filter(g => g.DisplayName.startsWith('Deploy_'))
        : this.gposCache;

      if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px;">${this.filterAppOnly ? t('gpos.emptyFiltered') : t('gpos.empty')}</td></tr>`;
        return;
      }

      tbody.innerHTML = displayList.map(g => `
        <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
          <td style="padding: 16px;">
            <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              ${this.esc(g.DisplayName)}
            </div>
            ${g.DisplayName.startsWith('Deploy_') ? `<span class="badge badge-success mt-sm" style="font-size:10px;">${t('gpos.createdByApp')}</span>` : ''}
          </td>
          <td style="padding: 16px; font-family: monospace; font-size: 13px; color: var(--text-muted);">
            ${this.esc(g.Id)}
          </td>
          <td style="padding: 16px; font-size: 13px; color: var(--text-muted);">
            ${this.formatDate(g.ModificationTime)}
          </td>
          <td style="padding: 16px; text-align: center;">
            <button class="btn btn-sm btn-danger" onclick="GposPage.deleteGPO('${this.esc(g.DisplayName)}')">${t('common.delete')}</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--danger-color);">${t('gpos.errorConnecting')} ${err.message}</td></tr>`;
    }
  },

  async deleteGPO(gpoName) {
    App.openModal(t('apps.deleteConfirm'), `
      <p>${t('gpos.deleteWarning').replace('{gpo}', `<strong>${this.esc(gpoName)}</strong>`)}</p>
      <div class="rsat-warning" style="margin-top:16px;">
        ⚠️ ${t('gpos.deleteConsequence')}
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">${t('common.cancel')}</button>
      <button class="btn btn-danger" id="btn-confirm-gpo-delete">${t('gpos.confirmDelete')}</button>
    `);

    document.getElementById('btn-confirm-gpo-delete').addEventListener('click', async () => {
      App.closeModal();
      document.getElementById('gpos-tbody').innerHTML = `<tr><td colspan="4" style="text-align: center; padding:20px;"><span class="spinner"></span> ${t('gpos.deleting')}</td></tr>`;
      
      const res = await window.api.ad.deleteGPO(gpoName);
      if (res.success) {
        App.toast(`${t('gpos.deletedSuccess')} "${gpoName}"`, 'success');
        this.gposCache = null; // Invalidate
        this.loadGPOs();
      } else {
        App.toast(`${t('gpos.deleteFailed')}: ${res.error}`, 'error');
        this.loadGPOs();
      }
    });
  },

  esc(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.toString().replace(/[&<>"']/g, m => map[m]);
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    let ts = dateStr;
    if (typeof dateStr === 'string' && dateStr.includes('Date(')) {
      const match = dateStr.match(/\d+/);
      ts = match ? parseInt(match[0]) : dateStr;
    }
    const d = new Date(ts);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  }
};
