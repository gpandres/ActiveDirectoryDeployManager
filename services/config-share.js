// ═══════════════════════════════════════════════════════════
// Shared logging config stored on the network share.
//
// The file lives at:
//   <networkSharePath>/ADDeploy/logging-config.json
//
// Shape:
// {
//   "version": 1,
//   "mode": "dedicated",
//   "apiBaseUrl": "https://logs.empresa.local",
//   "tlsFingerprint": "sha256//...",           // optional pinning
//   "enrollmentUrl": "https://logs.empresa.local/api/enroll",
//   "enrollmentToken": "<short-lived token>",  // swapped for an apiKey
//   "shareId": "<8-char id>",
//   "readonly": true,
//   "issuedAt": "2026-04-24T12:00:00Z",
//   "signature": "<base64(HMAC-SHA256(canonicalJson, shareSecret))>"
// }
//
// Clients only need read access. Secrets (the share HMAC key
// and per-equipo apiKey) never live on the share.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { request } = require('./log-sink/http-client');

const FILE_DIR  = 'ADDeploy';
const FILE_NAME = 'logging-config.json';

function sharedConfigPath(networkSharePath) {
  if (!networkSharePath) return null;
  return path.join(networkSharePath, FILE_DIR, FILE_NAME);
}

// Canonical JSON: stable key order, no signature field.
function canonicalize(obj) {
  const { signature, ...rest } = obj;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

function sign(obj, secretHex) {
  const data = canonicalize(obj);
  return crypto.createHmac('sha256', Buffer.from(secretHex, 'hex'))
               .update(data).digest('base64');
}

function verify(obj, secretHex) {
  if (!obj.signature || !secretHex) return false;
  const expected = sign(obj, secretHex);
  const a = Buffer.from(obj.signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────
// Read + verify the file sitting on the share. Returns null
// when missing. Throws on tampering / bad signature.
// ─────────────────────────────────────────────────────────────
async function readSharedConfig(networkSharePath, shareSecretHex) {
  const file = sharedConfigPath(networkSharePath);
  if (!file || !fs.existsSync(file)) return null;
  const raw = await fs.promises.readFile(file, 'utf-8');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('shared_config_invalid_json'); }
  if (parsed.version !== 1) throw new Error('shared_config_bad_version');
  if (!verify(parsed, shareSecretHex)) {
    throw new Error('shared_config_bad_signature');
  }
  return parsed;
}

// Variant used when the client doesn't yet have the share
// secret — reads without verification, purely to detect that
// "a dedicated server is configured on this share".
async function peekSharedConfig(networkSharePath) {
  const file = sharedConfigPath(networkSharePath);
  if (!file || !fs.existsSync(file)) return null;
  const raw = await fs.promises.readFile(file, 'utf-8');
  try { return JSON.parse(raw); }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// Write + sign (admin flow only).
// ─────────────────────────────────────────────────────────────
async function writeSharedConfig(networkSharePath, payload, shareSecretHex) {
  const file = sharedConfigPath(networkSharePath);
  if (!file) throw new Error('no_share_path');
  await fs.promises.mkdir(path.dirname(file), { recursive: true });

  const base = {
    version: 1,
    mode: payload.mode || 'dedicated',
    apiBaseUrl: payload.apiBaseUrl,
    enrollmentUrl: payload.enrollmentUrl
      || new URL('/api/enroll', payload.apiBaseUrl).toString(),
    enrollmentToken: payload.enrollmentToken,
    shareId: payload.shareId,
    tlsFingerprint: payload.tlsFingerprint || null,
    readonly: true,
    issuedAt: new Date().toISOString()
  };
  base.signature = sign(base, shareSecretHex);

  const tmp = file + '.__writing__';
  await fs.promises.writeFile(tmp, JSON.stringify(base, null, 2), 'utf-8');
  await fs.promises.rename(tmp, file);
  return { success: true, path: file };
}

// ─────────────────────────────────────────────────────────────
// Enrollment: swap the enrollmentToken for an ingest API key.
// The returned apiKey is per-equipo and stored locally with
// safeStorage (see main.js wiring).
// ─────────────────────────────────────────────────────────────
async function enrollWithShare(sharedCfg, hostname) {
  if (!sharedCfg || !sharedCfg.enrollmentUrl || !sharedCfg.enrollmentToken) {
    throw new Error('shared_config_incomplete');
  }
  const url = new URL(sharedCfg.enrollmentUrl);
  const baseUrl = `${url.protocol}//${url.host}`;
  const path    = url.pathname;

  const res = await request({
    baseUrl,
    method: 'POST',
    path,
    pinnedFingerprint: sharedCfg.tlsFingerprint || null,
    body: {
      hostname,
      shareId: sharedCfg.shareId,
      enrollmentToken: sharedCfg.enrollmentToken
    },
    timeoutMs: 15_000
  });
  return res.body; // { apiKey, equipoId }
}

module.exports = {
  sharedConfigPath,
  readSharedConfig,
  peekSharedConfig,
  writeSharedConfig,
  enrollWithShare,
  sign, verify
};
