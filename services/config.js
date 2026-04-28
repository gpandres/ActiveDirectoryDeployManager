const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

let configFilePath = null;

function getConfigPath() {
  if (!configFilePath) {
    try {
      const { app } = require('electron');
      const userData = app?.getPath ? app.getPath('userData') : os.tmpdir();
      configFilePath = path.join(userData, 'config.json');
    } catch {
      configFilePath = path.join(os.tmpdir(), 'ad-deploy-manager-config.json');
    }
  }
  return configFilePath;
}

const DEFAULT_CONFIG = {
  networkSharePath: '',
  logDirectory: '',         // local logs target (only used when logMode='local'; empty = use app userData)
  defaultGPO: '',
  baseOU: '',
  baseOUs: [],
  preferredDC: '',   // leave empty to auto-use PDC emulator; set to a DC hostname for multi-DC environments
  language: 'es',
  uiMode: 'simple',
  firstRun: true,
  shareId: '',
  dismissedAppUpdateVersion: '',

  // ── Logging backend selection ──
  // 'local'     → writes to the per-user activity-log file (default)
  // 'dedicated' → ships logs to the API defined in remoteLogging
  logMode: 'local',

  // Populated when a signed logging-config.json is detected on
  // the share or set manually from Settings. The apiKey and
  // readApiKey are NOT stored here — they live in the encrypted
  // secret store. This object keeps non-sensitive metadata.
  remoteLogging: {
    apiBaseUrl: '',
    tlsFingerprint: null,  // sha256//... for certificate pinning
    readonly: false,       // true when the setup came from the share
    enrolledAt: null,
    equipoId: null
  }
};

const DANGEROUS_KEYS = /^(__proto__|constructor|prototype)$/;

function sanitizeConfigData(data) {
  if (!data || typeof data !== 'object') return {};
  const sanitized = {};
  for (const key of Object.keys(data)) {
    if (DANGEROUS_KEYS.test(key)) continue;
    sanitized[key] = data[key];
  }
  return sanitized;
}

function normalizeDNArray(value) {
  const raw = Array.isArray(value)
    ? value
    : (typeof value === 'string' && value.trim() ? [value.trim()] : []);

  const seen = new Set();
  return raw
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function normalizeConfigShape(config) {
  const baseOUs = normalizeDNArray(config.baseOUs ?? config.baseOU);
  const uiMode = String(config.uiMode || '').trim().toLowerCase() === 'advanced'
    ? 'advanced'
    : 'simple';
  return {
    ...config,
    uiMode,
    baseOUs,
    baseOU: baseOUs[0] || ''
  };
}

const configService = {
  getConfig() {
    try {
      const cfgPath = getConfigPath();
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return normalizeConfigShape({ ...DEFAULT_CONFIG, ...sanitizeConfigData(parsed) });
      }
    } catch (err) {
      console.error('Error reading config:', err);
    }
    return normalizeConfigShape({ ...DEFAULT_CONFIG });
  },

  setConfig(data) {
    try {
      const current = this.getConfig();
      const safeData = sanitizeConfigData(data);
      const merged = normalizeConfigShape({ ...current, ...safeData, firstRun: false });
      if (!merged.shareId) {
        merged.shareId = crypto.randomUUID().split('-')[0].toUpperCase();
      }
      fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
      return { success: true, data: merged };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

module.exports = configService;
