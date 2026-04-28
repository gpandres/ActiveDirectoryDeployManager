// ═══════════════════════════════════════════════════════════
// Self-signed cert helper.
//
// Fetches the leaf certificate served by a given baseUrl,
// returns metadata (subject, issuer, fingerprint, PEM), and
// optionally installs it into the current user's "Trusted
// Root Certification Authorities" store on Windows.
//
// User-store install does not require admin (UAC) — it only
// affects the current Windows user. Machine-wide install is
// intentionally NOT supported here.
// ═══════════════════════════════════════════════════════════

const tls = require('tls');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { URL } = require('url');

function fetchPeerCert(baseUrl, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(baseUrl); }
    catch { return reject(new Error('invalid_url')); }
    if (url.protocol !== 'https:') return reject(new Error('not_https'));

    const socket = tls.connect({
      host: url.hostname,
      port: Number(url.port) || 443,
      servername: url.hostname,
      rejectUnauthorized: false,   // we WANT to inspect untrusted certs
      timeout: timeoutMs
    }, () => {
      const cert = socket.getPeerCertificate(false);
      socket.end();
      if (!cert || !cert.raw) return reject(new Error('no_peer_cert'));

      const der = cert.raw;
      const fpHex = crypto.createHash('sha256').update(der).digest('hex');
      const fpB64 = crypto.createHash('sha256').update(der).digest('base64');
      const pem =
        '-----BEGIN CERTIFICATE-----\n' +
        Buffer.from(der).toString('base64').replace(/(.{64})/g, '$1\n').replace(/\n$/, '') +
        '\n-----END CERTIFICATE-----\n';

      resolve({
        subject:  cert.subject ? Object.values(cert.subject).join(', ') : '',
        issuer:   cert.issuer  ? Object.values(cert.issuer).join(', ')  : '',
        validFrom: cert.valid_from || null,
        validTo:   cert.valid_to   || null,
        sha256Hex: fpHex,
        fingerprint: 'sha256//' + fpB64,
        pem,
        der
      });
    });

    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy(new Error('tls_timeout'));
    });
  });
}

function installPemUserStore(pem) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `addeploy-cert-${Date.now()}.cer`);
    fs.writeFileSync(tmp, pem, 'utf8');

    // Use PowerShell — Import-Certificate to CurrentUser\Root.
    // No admin required; only affects this Windows user account.
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      `Import-Certificate -FilePath "${tmp.replace(/"/g, '\\"')}" -CertStoreLocation Cert:\\CurrentUser\\Root | Out-Null`
    ]);

    let stderr = '';
    ps.stderr.on('data', d => stderr += d);
    ps.on('close', code => {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      if (code === 0) resolve({ success: true });
      else reject(new Error(stderr.trim() || `powershell_exit_${code}`));
    });
    ps.on('error', err => reject(err));
  });
}

async function inspect(baseUrl) {
  const cert = await fetchPeerCert(baseUrl);
  return {
    subject: cert.subject,
    issuer: cert.issuer,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    sha256Hex: cert.sha256Hex,
    fingerprint: cert.fingerprint
  };
}

async function trust(baseUrl) {
  if (process.platform !== 'win32') {
    throw new Error('trust_only_supported_on_windows');
  }
  const cert = await fetchPeerCert(baseUrl);
  await installPemUserStore(cert.pem);
  return {
    success: true,
    subject: cert.subject,
    fingerprint: cert.fingerprint,
    sha256Hex: cert.sha256Hex
  };
}

module.exports = { inspect, trust };
