// ═══════════════════════════════════════════════════════════
// Thin HTTPS client with optional certificate pinning.
//
// We don't bring in axios/node-fetch to keep the portable .exe
// small. Node's built-in http/https is enough for our needs.
// ═══════════════════════════════════════════════════════════

const http  = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 10_000;

function makeAgent({ pinnedFingerprint }) {
  // When pinning, do the certificate comparison ourselves on the
  // tls socket. We keep the default certificate verification on
  // so self-signed / expired certs still fail unless explicitly
  // trusted via NODE_EXTRA_CA_CERTS.
  const agent = new https.Agent({ keepAlive: true });
  if (pinnedFingerprint) {
    agent.createConnection = ((orig) => function (opts, cb) {
      const socket = orig.call(this, opts, cb);
      socket.once('secureConnect', () => {
        const cert = socket.getPeerCertificate(false);
        if (!cert || !cert.raw) {
          socket.destroy(new Error('tls_no_cert'));
          return;
        }
        const fp = 'sha256//' + crypto.createHash('sha256')
          .update(cert.raw).digest('base64');
        if (fp !== pinnedFingerprint) {
          socket.destroy(new Error('tls_pin_mismatch:' + fp));
        }
      });
      return socket;
    })(agent.createConnection);
  }
  return agent;
}

function request({ baseUrl, method = 'GET', path, headers = {}, body, apiKey, pinnedFingerprint, timeoutMs = DEFAULT_TIMEOUT_MS }) {
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

    const agent = isHttps ? makeAgent({ pinnedFingerprint }) : undefined;

    const req = mod.request({
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: hdrs,
      agent,
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
