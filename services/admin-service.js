// ═══════════════════════════════════════════════════════════
// Admin API client.
//
// Talks to /api/admin/* on the dedicated logging server. The
// admin key is stored encrypted via safeStorage (DPAPI on
// Windows). The renderer never sees the raw key — it just
// calls window.api.admin.* and the main process attaches the
// header internally.
// ═══════════════════════════════════════════════════════════

const { request } = require('./log-sink/http-client');
const secretStore = require('./secret-store');
const configService = require('./config');

const SECRET_NAME = 'admin_api_key';
const SETTINGS_KEY = 'adminApi';   // stored under config: { baseUrl, tlsFingerprint }

function getSettings() {
  const cfg = configService.getConfig();
  const a = cfg[SETTINGS_KEY] || {};
  // Fall back to remoteLogging settings if admin-specific not configured.
  const remote = cfg.remoteLogging || {};
  return {
    baseUrl: a.baseUrl || remote.apiBaseUrl || '',
    tlsFingerprint: a.tlsFingerprint ?? remote.tlsFingerprint ?? null
  };
}

async function setSettings({ baseUrl, tlsFingerprint }) {
  configService.setConfig({
    [SETTINGS_KEY]: {
      baseUrl: baseUrl || '',
      tlsFingerprint: tlsFingerprint || null
    }
  });
}

function getKey() {
  if (!secretStore.available()) return null;
  return secretStore.get(SECRET_NAME);
}

async function call(method, path, body) {
  const { baseUrl, tlsFingerprint } = getSettings();
  if (!baseUrl) throw new Error('admin_baseurl_not_configured');
  const apiKey = getKey();
  if (!apiKey) throw new Error('admin_not_logged_in');
  return request({
    baseUrl, method, path,
    apiKey, pinnedFingerprint: tlsFingerprint,
    body, timeoutMs: 12_000
  });
}

const adminService = {
  // ── Session ────────────────────────────────────────────
  async login({ baseUrl, apiKey, tlsFingerprint }) {
    if (!baseUrl) return { success: false, error: 'baseurl_required' };
    if (!apiKey || apiKey.length < 16) return { success: false, error: 'apikey_too_short' };
    if (!secretStore.available()) return { success: false, error: 'safe_storage_unavailable' };

    // Validate against the server using the candidate key directly.
    try {
      const res = await request({
        baseUrl,
        method: 'GET',
        path: '/api/admin/whoami',
        apiKey,
        pinnedFingerprint: tlsFingerprint || null,
        timeoutMs: 8_000
      });
      if (res.body?.auth !== 'apiKey' || res.body?.scope !== 'admin') {
        return { success: false, error: 'invalid_response' };
      }
    } catch (err) {
      return { success: false, error: err.message || 'request_failed' };
    }

    secretStore.set(SECRET_NAME, apiKey);
    await setSettings({ baseUrl, tlsFingerprint });
    return { success: true };
  },

  logout() {
    secretStore.delete(SECRET_NAME);
    return { success: true };
  },

  status() {
    const { baseUrl } = getSettings();
    return {
      loggedIn: !!getKey(),
      baseUrl: baseUrl || null
    };
  },

  // ── API Keys ──────────────────────────────────────────
  async listKeys() {
    const r = await call('GET', '/api/admin/api-keys');
    return r.body;
  },
  async createKey({ name, scope }) {
    const r = await call('POST', '/api/admin/api-keys', { name, scope });
    return r.body;
  },
  async revokeKey(id) {
    const r = await call('POST', `/api/admin/api-keys/${Number(id)}/revoke`);
    return r.body;
  },

  // ── Share secrets ─────────────────────────────────────
  async listShareSecrets() {
    const r = await call('GET', '/api/admin/share-secrets');
    return r.body;
  },
  async createShareSecret(shareId) {
    const r = await call('POST', '/api/admin/share-secrets', { shareId });
    return r.body;
  },

  // ── Enrollment tokens ─────────────────────────────────
  async listEnrollmentTokens() {
    const r = await call('GET', '/api/admin/enrollment-tokens');
    return r.body;
  },
  async createEnrollmentToken({ shareId, ttlHours, usesLeft, unlimited } = {}) {
    // Server defaults to unlimited; only forward fields that were explicitly set.
    const body = { shareId };
    if (ttlHours != null) body.ttlHours = ttlHours;
    if (usesLeft != null) body.usesLeft = usesLeft;
    if (typeof unlimited === 'boolean') body.unlimited = unlimited;
    const r = await call('POST', '/api/admin/enrollment-tokens', body);
    return r.body;
  },

  // Convenience: provision an ingest key for this workstation using
  // the admin session, store it locally, and return success.
  async provisionIngestKey(name) {
    const r = await call('POST', '/api/admin/api-keys', {
      name: name || `desktop-${require('os').hostname()}`,
      scope: 'ingest'
    });
    if (!r.body?.apiKey) throw new Error('no_apikey_returned');
    secretStore.set('ingest_api_key', r.body.apiKey);
    return { success: true, name: r.body.name };
  }
};

module.exports = adminService;
