// ═══════════════════════════════════════════════════════════
// Remote sink — batches logs asynchronously to the dedicated
// server. Never blocks callers; all I/O happens on a timer.
//
// Flow:
//   add() → queue.push() (fast, persistent)
//   scheduleFlush() → debounce → flush() sends up to 200 entries
//   on error → exponential backoff, entries remain in queue
//   on 3 consecutive failures → `online = false`, caller can
//     display a banner; we keep retrying in the background.
// ═══════════════════════════════════════════════════════════

const path = require('path');
const { RetryQueue } = require('./retry-queue');
const { request } = require('./http-client');
const activityLog = require('../activity-log');
const { sanitize } = require('./log-sanitizer');

const BATCH_MAX         = 200;
const FLUSH_DEBOUNCE_MS = 2_000;
const BACKOFF_MIN_MS    = 2_000;
const BACKOFF_MAX_MS    = 60_000;
const FAILURE_THRESHOLD = 3;

const LEVEL_NUM = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
function normalizeLevel(v) {
  if (typeof v === 'number' && v >= 0 && v <= 4) return v | 0;
  if (typeof v === 'string' && LEVEL_NUM[v.toLowerCase()] !== undefined) {
    return LEVEL_NUM[v.toLowerCase()];
  }
  return 1;
}

function getHostname() {
  try { return require('os').hostname(); } catch { return 'unknown'; }
}

class RemoteSink {
  constructor() {
    this.mode = 'dedicated';
    this.queue = null;
    this.timer = null;
    this.retryTimer = null;
    this.backoff = BACKOFF_MIN_MS;
    this.consecutiveFailures = 0;
    this.online = true;
    this.cfg = null;
    this.hostname = getHostname();
    this.flushing = false;
    this.lastError = null;
    this.lastFlushAt = null;
    this.lastSuccessAt = null;
    this.lastQueuedAt = null;
  }

  async init(cfg) {
    const { app } = require('electron');
    const queuePath = path.join(app.getPath('userData'), 'pending-logs.ndjson');
    this.queue = new RetryQueue(queuePath);
    await this.queue.init();
    this.cfg = cfg;
    // Try an immediate drain in case entries are pending from last run.
    this._scheduleFlush(0);
  }

  reconfigure(cfg) { this.cfg = cfg; }

  // ── Public API mirroring local-sink ──

  async add(action, details = {}) {
    const level = normalizeLevel(details.level ?? details.severity ?? 'info');
    const entry = {
      ts: details.ts || new Date().toISOString(),
      level,
      source: details.source || action,
      message: details.message || action,
      context: this._stripContext(details)
    };
    this.queue.push(entry);
    this.lastQueuedAt = new Date().toISOString();
    // Mirror into the local activity-log so the user's own
    // recent-activity widget still works when offline.
    activityLog.add(action, { ...details, level, mirrored: true });
    this._scheduleFlush();
    return entry;
  }

  _stripContext(details) {
    const { level, severity, ts, source, message, ...ctx } = details;
    const safe = sanitize(ctx);
    return Object.keys(safe).length ? safe : null;
  }

  async getRecent(count = 10) {
    if (!this._canRead()) return this._localFallbackRecent(count);
    try {
      const res = await request({
        baseUrl: this.cfg.apiBaseUrl,
        path: `/api/logs/recent?limit=${count}`,
        apiKey: this.cfg.readApiKey || this.cfg.apiKey,
        pinnedFingerprint: this.cfg.tlsFingerprint
      });
      return res.body;
    } catch {
      return this._localFallbackRecent(count);
    }
  }

  async query(filters = {}) {
    if (!this._canRead()) {
      const local = require('./local-sink');
      return local.query(filters);
    }
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '') params.set(k, String(v));
    }
    const res = await request({
      baseUrl: this.cfg.apiBaseUrl,
      path: `/api/logs?${params.toString()}`,
      apiKey: this.cfg.readApiKey || this.cfg.apiKey,
      pinnedFingerprint: this.cfg.tlsFingerprint
    });
    return res.body;
  }

  async statsSummary(window = '24h') {
    if (!this._canRead()) {
      const local = require('./local-sink');
      return local.statsSummary(window);
    }
    const res = await request({
      baseUrl: this.cfg.apiBaseUrl,
      path: `/api/stats/summary?window=${encodeURIComponent(window)}`,
      apiKey: this.cfg.readApiKey || this.cfg.apiKey,
      pinnedFingerprint: this.cfg.tlsFingerprint
    });
    return res.body;
  }

  async equipos(search) {
    if (!this._canRead()) return [];
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await request({
      baseUrl: this.cfg.apiBaseUrl,
      path: `/api/equipos${qs}`,
      apiKey: this.cfg.readApiKey || this.cfg.apiKey,
      pinnedFingerprint: this.cfg.tlsFingerprint
    });
    return res.body;
  }

  _canRead() {
    return !!(this.cfg && this.cfg.apiBaseUrl && (this.cfg.readApiKey || this.cfg.apiKey));
  }

  _localFallbackRecent(count) {
    return activityLog.getRecent(count).map(e => ({
      id: e.id,
      ts: e.timestamp,
      hostname: this.hostname,
      level: e.level ?? 1,
      source: e.source || e.action || '',
      message: e.message || e.action
    }));
  }

  // ── Flush pipeline ──

  _scheduleFlush(delayMs = FLUSH_DEBOUNCE_MS) {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch(() => {});
    }, delayMs);
  }

  async flush() {
    if (this.flushing) return;
    if (!this.cfg || !this.cfg.apiBaseUrl || !this.cfg.apiKey) return;
    const batch = this.queue.takeBatch(BATCH_MAX);
    if (!batch.length) return;

    this.flushing = true;
    const wasOnline = this.online;
    try {
      await request({
        baseUrl: this.cfg.apiBaseUrl,
        method: 'POST',
        path: '/api/logs/batch',
        apiKey: this.cfg.apiKey,
        pinnedFingerprint: this.cfg.tlsFingerprint,
        body: {
          hostname: this.hostname,
          shareId: this.cfg.shareId,
          entries: batch.map(b => b.entry)
        },
        timeoutMs: 10_000
      });
      await this.queue.ack(batch);
      this.backoff = BACKOFF_MIN_MS;
      this.consecutiveFailures = 0;
      this.lastError = null;
      this.lastFlushAt = new Date().toISOString();
      this.lastSuccessAt = this.lastFlushAt;

      if (!wasOnline) {
        this.online = true;
        activityLog.add('log_backend_reconnected', {
          source: 'logging',
          level: 'info',
          message: `Conexión con servidor de logs restaurada: ${this.cfg.apiBaseUrl}`
        });
      } else {
        this.online = true;
      }

      if (this.queue.size() > 0) this._scheduleFlush(0);
    } catch (err) {
      this.queue.nack(batch);
      this.consecutiveFailures++;
      this.lastError = err?.message || String(err);
      this.lastFlushAt = new Date().toISOString();

      if (this.consecutiveFailures >= FAILURE_THRESHOLD && wasOnline) {
        this.online = false;
        activityLog.add('log_backend_offline', {
          source: 'logging',
          level: 'warn',
          message: `Servidor de logs no disponible tras ${this.consecutiveFailures} intentos: ${this.lastError}`,
          host: this.cfg.apiBaseUrl
        });
      } else if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
        this.online = false;
      }

      const delay = this.backoff;
      this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
      this._scheduleRetry(delay);
    } finally {
      this.flushing = false;
    }
  }

  _scheduleRetry(delay) {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this._scheduleFlush(0);
    }, delay);
  }

  status() {
    const canRead = this._canRead();
    const canWrite = !!(this.cfg && this.cfg.apiBaseUrl && this.cfg.apiKey);
    return {
      mode: 'dedicated',
      online: this.online && (canRead || canWrite),
      queueSize: this.queue ? this.queue.size() : 0,
      failures: this.consecutiveFailures,
      host: this.cfg?.apiBaseUrl || null,
      canRead,
      canWrite,
      lastError: this.lastError,
      lastFlushAt: this.lastFlushAt,
      lastSuccessAt: this.lastSuccessAt,
      lastQueuedAt: this.lastQueuedAt
    };
  }

  async close() {
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    try { await this.flush(); } catch { /* ignore */ }
    if (this.queue) await this.queue.close();
  }
}

module.exports = new RemoteSink();
