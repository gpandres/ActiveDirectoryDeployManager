// =================================================================
// renderer/utils/app-utils.js — Funciones utilitarias puras de apps
// Sin efectos secundarios DOM ni llamadas IPC.
// Disponible como window.AppUtils
// =================================================================

const AppUtils = {

  // ─── Iconos de template ──────────────────────────────────────
  templateIcon(template) {
    const key = String(template || '').trim().toLowerCase();
    if (key.startsWith('user-')) return '&#129513;';
    const icons = {
      generic:           '&#128230;',
      office:            '&#128203;',
      custom:            '&#9881;&#65039;',
      winget:            '&#128230;',
      odt:               '&#128203;',
      wazuh:             '&#128737;&#65039;',
      sentinelone:       '&#128274;',
      cortexxdr:         '&#128737;&#65039;',
      bitdefender:       '&#128308;',
      crowdstrike:       '&#129413;',
      zscaler:           '&#9729;&#65039;',
      globalprotect:     '&#127760;',
      ciscosecureclient: '&#128274;',
      forticlient:       '&#128737;&#65039;',
      lansweeper:        '&#128225;',
      ninjaone:          '&#129302;',
      freshservice:      '&#128295;',
      teamviewer:        '&#8596;&#65039;',
      anydesk:           '&#128187;',
      veeam:             '&#128190;',
      crashplan:         '&#9729;&#65039;',
      chrome:            '&#127760;',
      'sap-gui':         '&#128188;'
    };
    return icons[key] || '&#128230;';
  },

  // ─── Tipo de instalador ──────────────────────────────────────

  isSupportedInstallerExtension(extension) {
    return ['.exe', '.msi', '.ps1'].includes(String(extension || '').toLowerCase());
  },

  isInstallerTemplateFile(fileField) {
    return fileField?.storageKind === 'installer';
  },

  getInstallerTypeFromPath(installerPath, template = '') {
    if (template === 'winget') return 'winget';
    if (template === 'odt') return 'odt';
    const normalized = String(installerPath || '').toLowerCase();
    if (normalized.endsWith('.msi')) return 'msi';
    if (normalized.endsWith('.ps1')) return 'ps1';
    return 'exe';
  },

  // ─── Desinstalación ─────────────────────────────────────────

  getDefaultUninstallMode(template = '', installerPath = '', installerType = '') {
    const resolvedType = String(installerType || this.getInstallerTypeFromPath(installerPath, template)).toLowerCase();
    if (template === 'winget') return 'winget';
    if (resolvedType === 'msi') return 'auto-msi';
    if (template === 'custom' || template === 'odt') return 'none';
    return 'auto-registry';
  },

  normalizeUninstallState(source = {}, fallback = {}) {
    const raw = source?.uninstall && typeof source.uninstall === 'object'
      ? source.uninstall
      : (fallback?.uninstall && typeof fallback.uninstall === 'object' ? fallback.uninstall : {});
    const template      = source?.template      ?? fallback?.template      ?? '';
    const installerPath = source?.installerPath ?? fallback?.installerPath ?? '';
    const installerType = source?.installerType ?? fallback?.installerType ?? '';
    const mode = String(
      raw.mode
      || source.uninstallMode
      || fallback.uninstallMode
      || this.getDefaultUninstallMode(template, installerPath, installerType)
    ).trim().toLowerCase();
    return {
      mode,
      command:                String(raw.command                ?? source.uninstallCommand          ?? '').trim(),
      args:                   String(raw.args                   ?? source.uninstallArgs              ?? '').trim(),
      registryMatchName:      String(raw.registryMatchName      ?? source.name ?? fallback.name     ?? '').trim(),
      registryMatchPublisher: String(raw.registryMatchPublisher ?? '').trim(),
      productCode:            String(raw.productCode            ?? '').trim()
    };
  },

  getUninstallModeLabel(mode) {
    const labels = {
      none:            t('apps.uninstallModeNone',     'Sin desinstalacion'),
      'auto-msi':      t('apps.uninstallModeMsi',      'MSI automatico'),
      'auto-registry': t('apps.uninstallModeRegistry', 'Auto por registro'),
      manual:          t('apps.uninstallModeManual',   'Comando manual'),
      winget:          t('apps.uninstallModeWinget',   'Winget')
    };
    return labels[mode] || mode || t('apps.uninstallModeNone', 'Sin desinstalacion');
  },

  canGenerateUninstall(appLike) {
    const uninstall = this.normalizeUninstallState(appLike, appLike);
    switch (uninstall.mode) {
      case 'winget':        return !!String(appLike?.wingetId || '').trim();
      case 'manual':        return !!uninstall.command;
      case 'auto-msi':      return this.getInstallerTypeFromPath(appLike?.installerPath, appLike?.template) === 'msi' || !!uninstall.productCode;
      case 'auto-registry': return !!(uninstall.productCode || uninstall.registryMatchName || uninstall.registryMatchPublisher || appLike?.name);
      default:              return false;
    }
  },

  getUninstallSummary(appLike) {
    const uninstall = this.normalizeUninstallState(appLike, appLike);
    switch (uninstall.mode) {
      case 'manual':
        return uninstall.command
          ? `${this.getUninstallModeLabel(uninstall.mode)} · ${uninstall.command}${uninstall.args ? ` ${uninstall.args}` : ''}`
          : this.getUninstallModeLabel(uninstall.mode);
      case 'auto-registry':
        return uninstall.registryMatchPublisher
          ? `${this.getUninstallModeLabel(uninstall.mode)} · ${uninstall.registryMatchName} / ${uninstall.registryMatchPublisher}`
          : `${this.getUninstallModeLabel(uninstall.mode)} · ${uninstall.registryMatchName || appLike?.name || '-'}`;
      case 'winget':
        return `${this.getUninstallModeLabel(uninstall.mode)} · ${appLike?.wingetId || '-'}`;
      case 'auto-msi':
        return uninstall.productCode
          ? `${this.getUninstallModeLabel(uninstall.mode)} · ${uninstall.productCode}`
          : this.getUninstallModeLabel(uninstall.mode);
      default:
        return this.getUninstallModeLabel(uninstall.mode);
    }
  },

  // ─── Estado de despliegue ────────────────────────────────────

  getPublishedAction(appLike) {
    const normalized = String(appLike?.publishedAction || '').trim().toLowerCase();
    if (normalized === 'install' || normalized === 'uninstall') return normalized;
    return (appLike?.deployed !== false && appLike?.deployedPath) ? 'install' : 'pending';
  },

  getDeploymentVisualState(appLike) {
    const isDeployed = appLike?.deployed !== false && !!appLike?.deployedPath;
    if (!isDeployed) return 'pending';
    return this.getPublishedAction(appLike) === 'uninstall' ? 'uninstalling' : 'deployed';
  },

  getDeploymentStatusLabel(appLike) {
    const state = this.getDeploymentVisualState(appLike);
    if (state === 'uninstalling') return t('apps.uninstallPublished', 'Desinstalacion');
    if (state === 'deployed')     return t('apps.installPublished',   'Instalacion');
    return t('apps.detailNotDeployed');
  },

  getInstallActionLabel(appLike) {
    return this.getPublishedAction(appLike) === 'uninstall'
      ? t('apps.reinstallAction', 'Volver a instalar')
      : t('apps.deploy');
  },

  // ─── Versiones ───────────────────────────────────────────────

  compareVersions(a, b) {
    const pa = (a || '0').split('.').map(n => parseInt(n) || 0);
    const pb = (b || '0').split('.').map(n => parseInt(n) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return  1;
      if (na < nb) return -1;
    }
    return 0;
  },

  // ─── Helpers de modal de confirmación de borrado ─────────────

  renderDeleteTargetCard({ icon, title, subtitle = '' }) {
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-tertiary);border-radius:6px;">
        <span style="font-size:18px;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${App._esc(title)}</div>
          ${subtitle ? `<div style="font-size:11px;color:var(--text-muted);">${subtitle}</div>` : ''}
        </div>
      </div>`;
  },

  renderDeleteOptionCard({ id, checked = false, title, hint = '' }) {
    return `
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;border:1px solid var(--border-color);">
        <input type="checkbox" id="${id}" style="margin-top:2px;flex-shrink:0;" ${checked ? 'checked' : ''}>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${title}</div>
          ${hint ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${hint}</div>` : ''}
        </div>
      </label>`;
  },

  renderDeleteFooter(confirmId, confirmLabel) {
    return `
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secondary" id="${confirmId}-cancel">${t('common.cancel')}</button>
        <button class="btn btn-danger" id="${confirmId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          ${confirmLabel}
        </button>
      </div>`;
  }

};

window.AppUtils = AppUtils;
