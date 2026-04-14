// ═══════════════════════════════════════════════════════
// Catalog Page — App marketplace, search & version checker
// ═══════════════════════════════════════════════════════

const CatalogPage = {
  _searchTimer: null,
  _results: [],
  _selectedItems: [],
  _catalogData: null,
  _activeCategory: 'Todo',
  _showUpdates: false,
  _versionCheckResults: [],
  _checkingUpdates: false,
  _wingetSearching: false,

  async render(container) {
    // Load curated catalog for categories + ODT data
    try {
      this._catalogData = await window.api.catalog.getCatalog();
    } catch {
      this._catalogData = { catalog: [], odtProducts: [], odtApps: [], odtLanguages: [], odtChannels: [] };
    }

    // Start with the curated catalog as initial results
    this._results = (this._catalogData.catalog || []).map(item => ({ ...item, source: 'curated' }));
    this._selectedItems = [];
    this._showUpdates = false;
    this._activeCategory = 'Todo';

    this._renderPage(container);
  },

  _renderPage(container) {
    const categories = ['Todo', ...new Set((this._catalogData?.catalog || []).map(c => c.category))];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>
            <span class="header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            ${t('catalog.title')}
          </h1>
          <p class="page-subtitle">${t('catalog.subtitle')}</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" id="catalog-btn-updates" title="${t('catalog.checkUpdates')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
            ${t('catalog.checkUpdates')}
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="catalog-search-bar">
        <div class="catalog-search-input-wrapper">
          <svg class="catalog-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input catalog-search-input" id="catalog-search" placeholder="${t('catalog.searchPlaceholder')}" autocomplete="off">
          <div class="catalog-search-hint" id="catalog-search-hint" style="display:none;">
            <span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>
            ${t('catalog.searching')}
          </div>
        </div>
      </div>

      <!-- Category Filter Pills -->
      <div class="catalog-filters" id="catalog-filters">
        ${categories.map(cat => `
          <button class="catalog-filter-pill ${this._activeCategory === cat ? 'active' : ''}" data-cat="${this.esc(cat)}">
            ${this.esc(this._translateCategory(cat))}
          </button>
        `).join('')}
        <button class="catalog-filter-pill ${this._activeCategory === 'Winget' ? 'active' : ''}" data-cat="Winget">
          📦 Winget
        </button>
      </div>

      <!-- Results -->
      <div id="catalog-results-container">
        ${this._showUpdates ? this._renderUpdatesPanel() : this._renderResults()}
      </div>

      <!-- Bottom Action Bar -->
      <div class="catalog-bottom-bar ${this._selectedItems.length > 0 ? 'visible' : ''}" id="catalog-bottom-bar">
        <div class="catalog-bottom-info">
          <span class="badge badge-primary" id="catalog-selected-count">${this._selectedItems.length}</span>
          ${t('catalog.selected')}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="catalog-btn-add-app" title="${t('catalog.addToNewApp')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${t('catalog.addToNewApp')}
          </button>
          <button class="btn btn-secondary btn-sm" id="catalog-btn-clear">
            ${t('common.cancel')}
          </button>
        </div>
      </div>
    `;

    this._bindEvents(container);
  },

  _renderResults() {
    const results = this._getFilteredResults();

    let statusHtml = '';
    if (this._wingetSearching) {
      statusHtml = `
        <div class="catalog-search-status">
          <span class="spinner" style="width:14px;height:14px;border-width:2px;flex-shrink:0;"></span>
          <span>${t('catalog.searchingWinget')}</span>
        </div>
      `;
    }

    if (results.length === 0) {
      return statusHtml + `
        <div class="empty-state" style="padding:48px 0;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted);margin-bottom:12px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <p style="color:var(--text-muted);font-size:var(--font-sm);">${t('catalog.noResults')}</p>
        </div>
      `;
    }

    // Group by category
    const grouped = {};
    results.forEach(item => {
      const cat = (item.source === 'winget-api' || item.source === 'winget-cli') ? 'Winget' : item.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    let html = statusHtml + '<div class="catalog-grid-wrapper">';
    for (const [cat, items] of Object.entries(grouped)) {
      html += `
        <div class="catalog-category-section">
          <h5 class="catalog-category-title">${this.esc(this._translateCategory(cat))}</h5>
          <div class="catalog-grid">
            ${items.map(item => this._renderCard(item)).join('')}
          </div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  },

  _renderCard(item) {
    const isSelected = this._selectedItems.some(s =>
      (s.wingetId && s.wingetId === item.wingetId) || (s.id && s.id === item.id)
    );
    const version = item.version || item.defaultVersion || '';
    const isApi = item.source === 'winget-api' || item.source === 'winget-cli';

    return `
      <div class="catalog-card ${isSelected ? 'selected' : ''}"
           data-item-id="${this.esc(item.id || item.wingetId)}"
           data-winget-id="${this.esc(item.wingetId || '')}"
           data-name="${this.esc(item.name)}"
           data-version="${this.esc(version)}"
           data-source="${this.esc(item.source || 'curated')}">
        <div class="catalog-card-icon">${item.icon || '📦'}</div>
        <div class="catalog-card-info">
          <div class="catalog-card-name">${this.esc(item.name)}</div>
          ${isApi && item.publisher ? `<div class="catalog-card-publisher">${this.esc(item.publisher)}</div>` : ''}
          <div class="catalog-card-meta">
            ${version ? `<span class="badge badge-info" style="font-size:9px;padding:1px 6px;">v${this.esc(version)}</span>` : ''}
            ${item.wingetId ? `<span class="badge badge-primary" style="font-size:9px;padding:1px 6px;">winget</span>` : ''}
          </div>
        </div>
        ${isSelected ? '<div class="catalog-card-check">✓</div>' : ''}
      </div>
    `;
  },

  _renderUpdatesPanel() {
    if (this._checkingUpdates) {
      return `
        <div class="card" style="padding:40px;text-align:center;">
          <span class="spinner" style="width:24px;height:24px;border-width:3px;display:inline-block;margin-bottom:12px;"></span>
          <p style="color:var(--text-secondary);font-size:var(--font-sm);">${t('catalog.checkingVersions')}</p>
        </div>
      `;
    }

    if (this._versionCheckResults.length === 0) {
      return `
        <div class="card" style="padding:40px;text-align:center;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" stroke-width="1.5" style="margin-bottom:12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p style="color:var(--text-secondary);">${t('catalog.noUpdatesNeeded')}</p>
        </div>
      `;
    }

    return `
      <div class="card" style="margin-bottom:var(--space-md);">
        <div class="card-title" style="display:flex;align-items:center;gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.55"/><polyline points="21 4 21 10 15 10"/></svg>
          ${t('catalog.updateResults')}
          <span class="badge badge-warning" style="margin-left:auto;">${this._versionCheckResults.length}</span>
        </div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
          ${this._versionCheckResults.map(r => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--bg-input);border-radius:var(--radius-sm);">
              <span style="font-size:22px;">${r.icon || '📦'}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;color:var(--text-primary);font-size:var(--font-sm);">${this.esc(r.name || r.wingetId)}</div>
                <div style="font-size:var(--font-xs);color:var(--text-muted);">${this.esc(r.wingetId)}</div>
              </div>
              <div style="text-align:right;font-size:var(--font-sm);">
                <span style="color:var(--text-muted);">${this.esc(r.catalogVersion || '?')}</span>
                <span style="color:var(--accent-primary);margin:0 6px;">→</span>
                <span style="color:var(--accent-secondary);font-weight:600;">${this.esc(r.latestVersion || '?')}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <button class="btn btn-secondary" id="catalog-back-to-results">
        ← ${t('catalog.backToResults')}
      </button>
    `;
  },

  _getFilteredResults() {
    const cat = this._activeCategory;
    if (cat === 'Todo') return this._results;
    if (cat === 'Winget') return this._results.filter(r => r.source === 'winget-api' || r.source === 'winget-cli');
    return this._results.filter(r => r.category === cat && r.source !== 'winget-api' && r.source !== 'winget-cli');
  },

  _bindEvents(container) {
    // Search with debounce
    const searchInput = document.getElementById('catalog-search');
    searchInput?.addEventListener('input', () => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this._doSearch(), 400);
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this._wingetSearching) return;
        clearTimeout(this._searchTimer);
        this._doSearch();
      }
    });

    // Category filter pills
    document.getElementById('catalog-filters')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.catalog-filter-pill');
      if (!pill) return;
      this._activeCategory = pill.dataset.cat;
      // Update pill states
      document.querySelectorAll('.catalog-filter-pill').forEach(p =>
        p.classList.toggle('active', p.dataset.cat === this._activeCategory)
      );
      this._updateResults();
    });

    // Card clicks (select/deselect)
    document.getElementById('catalog-results-container')?.addEventListener('click', (e) => {
      const card = e.target.closest('.catalog-card');
      if (!card) {
        // Check for "back to results" button
        if (e.target.closest('#catalog-back-to-results')) {
          this._showUpdates = false;
          this._updateResults();
        }
        return;
      }
      this._toggleSelection(card);
    });

    // Check updates button
    document.getElementById('catalog-btn-updates')?.addEventListener('click', () => this._checkUpdates());

    // Add to new app
    document.getElementById('catalog-btn-add-app')?.addEventListener('click', () => this._addToNewApp());

    // Clear selection
    document.getElementById('catalog-btn-clear')?.addEventListener('click', () => {
      this._selectedItems = [];
      this._updateBottomBar();
      this._updateResults();
    });
  },

  async _doSearch() {
    const query = document.getElementById('catalog-search')?.value?.trim() || '';

    this._showUpdates = false;

    if (query.length < 2) {
      // Reset to curated catalog
      this._wingetSearching = false;
      this._results = (this._catalogData?.catalog || []).map(item => ({ ...item, source: 'curated' }));
      this._updateResults();
      return;
    }

    // Fase 1: mostrar curated filtrado inmediatamente
    const q = query.toLowerCase();
    const curatedFiltered = (this._catalogData?.catalog || [])
      .map(item => ({ ...item, source: 'curated' }))
      .filter(item =>
        item.name?.toLowerCase().includes(q) ||
        item.wingetId?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );

    this._results = curatedFiltered;
    this._wingetSearching = true;
    this._updateResults();

    // Fase 2: búsqueda CLI en paralelo (puede tardar 10-20s)
    const curatedIds = new Set(curatedFiltered.map(r => r.wingetId).filter(Boolean));
    try {
      const wingetResults = await window.api.catalog.searchCLI(query);
      // Abort if the user has already typed something different
      if ((document.getElementById('catalog-search')?.value?.trim() || '') !== query) return;
      const newOnly = wingetResults.filter(r => r.wingetId && !curatedIds.has(r.wingetId));
      this._results = [...curatedFiltered, ...newOnly];
    } catch {
      // mantener solo curated
    }

    this._wingetSearching = false;
    this._updateResults();
  },

  _updateResults() {
    const container = document.getElementById('catalog-results-container');
    if (!container) return;
    container.innerHTML = this._showUpdates ? this._renderUpdatesPanel() : this._renderResults();
    // Re-bind back button if in updates view
    if (this._showUpdates) {
      document.getElementById('catalog-back-to-results')?.addEventListener('click', () => {
        this._showUpdates = false;
        this._updateResults();
      });
    }
  },

  _toggleSelection(card) {
    const itemId = card.dataset.itemId;
    const wingetId = card.dataset.wingetId;
    const name = card.dataset.name;
    const version = card.dataset.version;
    const source = card.dataset.source;

    const existingIdx = this._selectedItems.findIndex(s =>
      (wingetId && s.wingetId === wingetId) || s.id === itemId
    );

    if (existingIdx >= 0) {
      this._selectedItems.splice(existingIdx, 1);
      card.classList.remove('selected');
      card.querySelector('.catalog-card-check')?.remove();
    } else {
      this._selectedItems.push({ id: itemId, wingetId, name, version, source });
      card.classList.add('selected');
      const checkDiv = document.createElement('div');
      checkDiv.className = 'catalog-card-check';
      checkDiv.textContent = '✓';
      card.appendChild(checkDiv);
    }

    this._updateBottomBar();
  },

  _updateBottomBar() {
    const bar = document.getElementById('catalog-bottom-bar');
    const count = document.getElementById('catalog-selected-count');
    if (bar) bar.classList.toggle('visible', this._selectedItems.length > 0);
    if (count) count.textContent = this._selectedItems.length;
  },

  async _checkUpdates() {
    this._showUpdates = true;
    this._checkingUpdates = true;
    this._updateResults();

    try {
      const allIds = (this._catalogData?.catalog || []).map(c => c.id);
      const results = await window.api.catalog.checkVersions(allIds);

      // Filter where latest > catalog version
      this._versionCheckResults = results.filter(r => {
        if (!r.latestVersion || !r.catalogVersion) return false;
        return r.latestVersion !== r.catalogVersion;
      });
    } catch {
      this._versionCheckResults = [];
    }

    this._checkingUpdates = false;
    this._refreshResultsContainer();
  },

  _refreshResultsContainer() {
    const container = document.getElementById('catalog-results-container');
    if (!container) return;
    container.innerHTML = this._renderUpdatesPanel();
    document.getElementById('catalog-back-to-results')?.addEventListener('click', () => {
      this._showUpdates = false;
      const c2 = document.getElementById('catalog-results-container');
      if (c2) c2.innerHTML = this._renderResults();
    });
  },

  _addToNewApp() {
    if (this._selectedItems.length === 0) return;
    const first = this._selectedItems[0];
    
    // Navigate to apps page and trigger wizard with pre-filled winget data
    App.navigate('apps');
    // Small delay to let the page render, then open wizard
    setTimeout(() => {
      if (typeof AppsPage !== 'undefined') {
        const prefilledApp = {
          template: 'winget',
          wingetId: first.wingetId || '',
          name: first.name || '',
          version: first.version || '1.0.0'
        };
        AppsPage.openWizard(prefilledApp);
      }
    }, 200);
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  _translateCategory(cat) {
    const map = {
      'Todo':          t('catalog.filterAll'),
      'Browsers':      t('catalog.cat_browsers'),
      'Tools':         t('catalog.cat_tools'),
      'Connectivity':  t('catalog.cat_connectivity'),
      'Communication': t('catalog.cat_communication'),
      'Development':   t('catalog.cat_development')
    };
    return map[cat] || cat;
  }
};
