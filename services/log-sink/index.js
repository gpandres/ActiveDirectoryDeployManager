// ═══════════════════════════════════════════════════════════
// Log sink fachada — unified surface used by the rest of the
// app. Picks the active backend from config.logMode and hides
// whether logs end up in a local file or the dedicated server.
//
//   logSink.add('gpo_create', { target: 'Apps-OU', level: 'info' })
//   logSink.query({ equipo, level, q, beforeTs, beforeId, limit })
//   logSink.statsSummary('24h')
//
// Existing call sites using activity-log.add(...) keep working;
// the local-sink delegates to activity-log under the hood.
// ═══════════════════════════════════════════════════════════

const configService = require('../config');
const secretStore = require('../secret-store');

let current = null;
let currentMode = null;

function _loadConfigForSink() {
  const cfg = configService.getConfig();
  const remote = cfg.remoteLogging || {};
  // API keys live in the encrypted secret store, NOT in config.json.
  let apiKey = '', readApiKey = '';
  try {
    if (secretStore.available()) {
      apiKey     = secretStore.get('ingest_api_key') || '';
      readApiKey = secretStore.get('read_api_key')   || apiKey;
    }
  } catch { /* no electron context (e.g. tests) */ }
  return {
    logMode: cfg.logMode || 'local',
    apiBaseUrl: remote.apiBaseUrl || '',
    apiKey,
    readApiKey,
    tlsFingerprint: remote.tlsFingerprint || null,
    shareId: cfg.shareId || '',
    readonly: !!remote.readonly
  };
}

async function _ensure() {
  const cfg = _loadConfigForSink();
  if (current && currentMode === cfg.logMode) {
    if (cfg.logMode === 'dedicated') current.reconfigure?.(cfg);
    return current;
  }

  if (current && current.close) {
    try { await current.close(); } catch { /* ignore */ }
  }

  if (cfg.logMode === 'dedicated' && cfg.apiBaseUrl && cfg.apiKey) {
    current = require('./remote-sink');
    await current.init(cfg);
  } else {
    current = require('./local-sink');
    await current.init();
  }
  currentMode = cfg.logMode;
  return current;
}

const logSink = {
  async add(action, details) {
    const sink = await _ensure();
    return sink.add(action, details);
  },

  async getRecent(count) {
    const sink = await _ensure();
    return sink.getRecent(count);
  },

  async query(filters) {
    const sink = await _ensure();
    return sink.query(filters);
  },

  async statsSummary(window) {
    const sink = await _ensure();
    return sink.statsSummary(window);
  },

  async equipos(search) {
    const sink = await _ensure();
    return sink.equipos(search);
  },

  async status() {
    const sink = await _ensure();
    return sink.status();
  },

  // Called by the setup wizard / config changes to force a reload.
  async reload() {
    if (current && current.close) {
      try { await current.close(); } catch { /* ignore */ }
    }
    current = null;
    currentMode = null;
    return _ensure();
  },

  // Sync-compat helpers so existing call sites using the old
  // activity-log synchronous API don't have to become async.
  addSync(action, details) {
    // Fire-and-forget; the local activity-log is always written
    // synchronously from inside both sinks, so this is safe.
    this.add(action, details).catch(() => {});
  }
};

module.exports = logSink;
