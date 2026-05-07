// ═══════════════════════════════════════════════════════════
// Thin HTTPS client. Self-signed certs are accepted unconditionally
// for the dedicated logging server: the cert may rotate daily and
// pinning would break enrollment + log queries every rotation. The
// shared config still ships a tlsFingerprint field, but it is no
// longer enforced — we trust whatever cert the server presents.
//
// We don't bring in axios/node-fetch to keep the portable .exe
// small. Node's built-in http/https is enough for our needs.
// ═══════════════════════════════════════════════════════════

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 10_000;

function makeAgent() {
  // Always accept self-signed / rotating certs. No fingerprint check.
  return new https.Agent({
    keepAlive: true,
    rejectUnauthorized: false
  });
}

function request({ baseUrl, method = 'GET', path, headers = {}, body, apiKey, pinnedFingerprint: _ignored, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const payload = body != null ? Buffer.from(JSON.stringify(body)) : null;

    const hdrs = { ...headers };
    if (apiKey) hdrs['X-API-Key'] = apiKey;
    if (payload) {
      hdrs['Content-Type'] = 'application/json';
      hdrs['Content-Length'] = payload.length;
    }

    const agent = isHttps ? makeAgent() : undefined;

    const req = mod.request({
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: hdrs,
      agent,
      rejectUnauthorized: isHttps ? false : undefined,
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let parsed;
        try { parsed = text ? JSON.parse(text) : null; }
        catch { parsed = text; }
        const result = { status: res.statusCode, headers: res.headers, body: parsed };
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(result);
        else reject(Object.assign(new Error(`http_${res.statusCode}`), result));
      });
    });

    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { request };
