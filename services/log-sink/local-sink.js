// ═══════════════════════════════════════════════════════════
// Local sink — thin wrapper around the pre-existing
// services/activity-log.js so the fachada surface matches
// the remote sink. Reads/queries stay purely local.
// ═══════════════════════════════════════════════════════════

const activityLog = require('../activity-log');

const LEVEL_NUM  = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const LEVEL_NAME = ['debug', 'info', 'warn', 'error', 'fatal'];

function normalizeLevel(v) {
  if (typeof v === 'number' && v >= 0 && v <= 4) return v | 0;
  if (typeof v === 'string' && LEVEL_NUM[v.toLowerCase()] !== undefined) {
    return LEVEL_NUM[v.toLowerCase()];
  }
  return 1;
}

const localSink = {
  mode: 'local',

  async init() { /* nothing to warm up */ },

  async add(action, details = {}) {
    const level = normalizeLevel(details.level ?? details.severity ?? 'info');
    return activityLog.add(action, {
      ...details,
      level,
      levelName: LEVEL_NAME[level]
    });
  },

  async getRecent(count = 10) {
    return activityLog.getRecent(count).map(e => ({
      id: e.id,
      ts: e.timestamp,
      hostname: null,
      level: typeof e.level === 'number' ? e.level : 1,
      source: e.source || e.action || '',
      message: e.message || e.action
    }));
  },

  async query(filters = {}) {
    const all = activityLog.getAll();
    const { equipo, level, q, limit = 50 } = filters;
    let items = all;
    if (equipo)  items = items.filter(e => e.hostname === equipo);
    if (q) {
      const needle = String(q).toLowerCase();
      items = items.filter(e => {
        const haystack = [
          e.message || e.action || '',
          e.source || '',
          e.hostname || '',
          e.appName || '',
          e.bundleName || '',
          e.gpoName || ''
        ].join(' ').toLowerCase();
        return haystack.includes(needle);
      });
    }
    if (level) {
      const allowed = new Set(String(level).split(',')
        .map(s => LEVEL_NUM[s.trim().toLowerCase()])
        .filter(n => n !== undefined));
      items = items.filter(e => allowed.has(e.level ?? 1));
    }
    items = items.slice(-limit).reverse();
    return {
      items: items.map(e => ({
        id: e.id,
        ts: e.timestamp,
        hostname: e.hostname || null,
        level: e.level ?? 1,
        source: e.source || e.action || '',
        message: e.message || e.action,
        context: e.context ?? null
      })),
      nextCursor: null
    };
  },

  async statsSummary(window = '24h') {
    const map = { '1h': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
    const hours = map[window] || 24;
    const cutoff = Date.now() - hours * 3600 * 1000;
    const all = activityLog.getAll();
    const counts = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 };
    let total = 0;
    for (const e of all) {
      if (new Date(e.timestamp).getTime() < cutoff) continue;
      const level = normalizeLevel(e.level ?? 1);
      counts[LEVEL_NAME[level]]++;
      total++;
    }
    return {
      window, counts,
      activeEquipos: 1,
      totalEvents: total,
      topErrorEquipos: []
    };
  },

  async equipos() {
    return []; // local mode has no equipo registry
  },

  async flush() { /* no-op */ },

  status() {
    return {
      mode: 'local',
      queueSize: 0,
      online: true,
      path: activityLog.getPath?.() || null
    };
  }
};

module.exports = localSink;
