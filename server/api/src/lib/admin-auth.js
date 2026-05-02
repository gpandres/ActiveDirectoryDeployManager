const crypto = require('crypto');
const { getPool } = require('./db');
const { sha256Hex, randomToken } = require('./hash');

const SCRYPT_N      = 32768;
const SCRYPT_R      = 8;
const SCRYPT_P      = 1;
const KEY_LEN       = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const SESSION_TTL_H = 8;

const COOKIE_NAME = 'addeploy_session';
const COOKIE_OPTS = 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  try {
    const colon = storedHash.indexOf(':');
    if (colon < 1) return false;
    const salt     = storedHash.slice(0, colon);
    const expected = Buffer.from(storedHash.slice(colon + 1), 'hex');
    const actual   = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function createSession(userId) {
  const token = randomToken(32);
  await getPool().execute(
    `INSERT INTO admin_sessions (token_hash, user_id, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [sha256Hex(token), userId, SESSION_TTL_H]
  );
  return token;
}

async function getSession(token) {
  if (!token) return null;
  const [rows] = await getPool().execute(
    `SELECT s.user_id, u.username, u.must_change
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.expires_at > NOW()
        AND s.revoked_at IS NULL
      LIMIT 1`,
    [sha256Hex(token)]
  );
  return rows[0] || null;
}

async function revokeSession(token) {
  if (!token) return;
  await getPool().execute(
    `UPDATE admin_sessions SET revoked_at = NOW()
      WHERE token_hash = ? AND revoked_at IS NULL`,
    [sha256Hex(token)]
  );
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

module.exports = {
  hashPassword, verifyPassword,
  createSession, getSession, revokeSession,
  parseCookie, COOKIE_NAME, COOKIE_OPTS
};
