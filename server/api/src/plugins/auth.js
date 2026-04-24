const { getPool } = require('../lib/db');
const { sha256Hex } = require('../lib/hash');

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // hash -> { row, expires }

async function lookupKey(hash) {
  const cached = cache.get(hash);
  if (cached && cached.expires > Date.now()) return cached.row;

  const [rows] = await getPool().execute(
    `SELECT id, name, scope, equipo_id, revoked_at
       FROM api_keys WHERE key_hash = ? LIMIT 1`,
    [hash]
  );
  const row = rows[0] || null;
  cache.set(hash, { row, expires: Date.now() + CACHE_TTL_MS });
  return row;
}

function touchLastUsed(id) {
  getPool().execute('UPDATE api_keys SET last_used = NOW() WHERE id = ?', [id])
    .catch(() => { /* informational, ignore */ });
}

// Hook factory. Usage: { preHandler: requireScope('ingest') }
function requireScope(...allowed) {
  return async function (req, reply) {
    const raw = req.headers['x-api-key'];
    if (typeof raw !== 'string' || raw.length < 16) {
      return reply.code(401).send({ error: 'missing_api_key' });
    }
    const row = await lookupKey(sha256Hex(raw));
    if (!row || row.revoked_at) {
      return reply.code(401).send({ error: 'invalid_api_key' });
    }
    if (!allowed.includes(row.scope)) {
      return reply.code(403).send({ error: 'insufficient_scope' });
    }
    req.apiKey = row;
    touchLastUsed(row.id);
  };
}

function invalidateCache() { cache.clear(); }

module.exports = { requireScope, invalidateCache };
