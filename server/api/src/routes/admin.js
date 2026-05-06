const { getPool } = require('../lib/db');
const { sha256Hex, randomToken } = require('../lib/hash');
const { invalidateCache } = require('../plugins/auth');
const config = require('../config');

function normalizeIp(ip) {
  if (typeof ip !== 'string') return '';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function getPeerIp(req) {
  return normalizeIp(req?.socket?.remoteAddress || req?.raw?.socket?.remoteAddress || '');
}

// Admin gate: pass if (a) the raw TCP peer is explicitly allowlisted, OR
// (b) X-API-Key matches an active key with scope='admin'. Do not use req.ip
// for the IP path: when trustProxy is enabled it can be derived from
// X-Forwarded-For and is therefore attacker-controlled on direct requests.
async function adminGate(req, reply) {
  const peerIp = getPeerIp(req);
  const ipOk = config.adminAllowedIps.length > 0
    && config.adminAllowedIps.map(normalizeIp).includes(peerIp);

  let keyOk = false;
  const raw = req.headers['x-api-key'];
  if (typeof raw === 'string' && raw.length >= 16) {
    const [rows] = await getPool().execute(
      `SELECT id, scope, revoked_at FROM api_keys WHERE key_hash = ? LIMIT 1`,
      [sha256Hex(raw)]
    );
    const row = rows[0];
    keyOk = !!(row && !row.revoked_at && row.scope === 'admin');
    if (keyOk) {
      req.apiKey = row;
      getPool().execute('UPDATE api_keys SET last_used = NOW() WHERE id = ?', [row.id])
        .catch(() => {});
    }
  }

  if (!ipOk && !keyOk) {
    return reply.code(401).send({ error: 'admin_auth_required' });
  }
}

module.exports = async function adminRoutes(fastify) {

  fastify.addHook('preHandler', adminGate);

  // ────────── GET /api/admin/api-keys ──────────
  fastify.get('/api/admin/api-keys', async () => {
    const [rows] = await getPool().execute(
      `SELECT id, name, scope, equipo_id, created_at, last_used, revoked_at
         FROM api_keys ORDER BY created_at DESC`
    );
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      scope: r.scope,
      equipoId: r.equipo_id,
      createdAt: r.created_at?.toISOString?.() ?? null,
      lastUsed:  r.last_used?.toISOString?.() ?? null,
      revokedAt: r.revoked_at?.toISOString?.() ?? null
    }));
  });

  // ────────── POST /api/admin/api-keys ──────────
  fastify.post('/api/admin/api-keys', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'scope'],
        additionalProperties: false,
        properties: {
          name:  { type: 'string', maxLength: 128 },
          scope: { type: 'string', enum: ['ingest', 'read', 'admin'] }
        }
      }
    }
  }, async (req, reply) => {
    const raw = randomToken(32);
    await getPool().execute(
      `INSERT INTO api_keys (key_hash, name, scope) VALUES (?, ?, ?)`,
      [sha256Hex(raw), req.body.name, req.body.scope]
    );
    invalidateCache();
    reply.code(201).send({ apiKey: raw, name: req.body.name, scope: req.body.scope });
  });

  // ────────── POST /api/admin/api-keys/:id/revoke ──────────
  fastify.post('/api/admin/api-keys/:id/revoke', async (req, reply) => {
    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'bad_id' });
    await getPool().execute(
      'UPDATE api_keys SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
      [id]
    );
    invalidateCache();
    reply.send({ ok: true });
  });

  // ────────── GET /api/admin/share-secrets ──────────
  fastify.get('/api/admin/share-secrets', async () => {
    const [rows] = await getPool().execute(
      `SELECT share_id, created_at FROM share_secrets ORDER BY created_at DESC`
    );
    return rows.map(r => ({
      shareId: r.share_id,
      createdAt: r.created_at?.toISOString?.() ?? null
    }));
  });

  // ────────── POST /api/admin/share-secrets ──────────
  fastify.post('/api/admin/share-secrets', {
    schema: {
      body: {
        type: 'object',
        required: ['shareId'],
        additionalProperties: false,
        properties: { shareId: { type: 'string', maxLength: 32 } }
      }
    }
  }, async (req, reply) => {
    const secret = require('crypto').randomBytes(32).toString('hex');
    await getPool().execute(
      `INSERT INTO share_secrets (share_id, secret_hex)
            VALUES (?, ?)
       ON DUPLICATE KEY UPDATE secret_hex = VALUES(secret_hex),
                               created_at = CURRENT_TIMESTAMP`,
      [req.body.shareId, secret]
    );
    reply.code(201).send({ shareId: req.body.shareId, secret });
  });

  // ────────── GET /api/admin/enrollment-tokens ──────────
  // Returns ALL tokens (including unlimited / NULL columns). Filtering
  // out expired/used-up rows is handled by sp_purge_expired_tokens.
  fastify.get('/api/admin/enrollment-tokens', async () => {
    const [rows] = await getPool().execute(
      `SELECT share_id, expires_at, uses_left, created_at
         FROM enrollment_tokens
        ORDER BY created_at DESC`
    );
    return rows.map(r => ({
      shareId: r.share_id,
      expiresAt: r.expires_at?.toISOString?.() ?? null,   // null = no expiration
      usesLeft: r.uses_left ?? null,                      // null = unlimited
      createdAt: r.created_at?.toISOString?.() ?? null
    }));
  });

  // ────────── POST /api/admin/enrollment-tokens ──────────
  // Defaults to unlimited token (no expiry, infinite uses) — that's the
  // common case for per-app ingest enrollment. Pass ttlHours/usesLeft to
  // restrict; pass unlimited:false to require explicit limits.
  fastify.post('/api/admin/enrollment-tokens', {
    schema: {
      body: {
        type: 'object',
        required: ['shareId'],
        additionalProperties: false,
        properties: {
          shareId:   { type: 'string', maxLength: 32 },
          ttlHours:  { type: ['integer', 'null'], minimum: 1, maximum: 87600 },
          usesLeft:  { type: ['integer', 'null'], minimum: 1, maximum: 1000000 },
          unlimited: { type: 'boolean', default: true }
        }
      }
    }
  }, async (req, reply) => {
    const { shareId, ttlHours, usesLeft, unlimited } = req.body;
    const raw = randomToken(32);

    // unlimited wins unless caller passed explicit ttlHours/usesLeft.
    const effTtl   = (unlimited && ttlHours  == null) ? null : (ttlHours  ?? null);
    const effUses  = (unlimited && usesLeft  == null) ? null : (usesLeft  ?? null);

    await getPool().execute(
      `INSERT INTO enrollment_tokens (token_hash, share_id, expires_at, uses_left)
            VALUES (?, ?,
                    CASE WHEN ? IS NULL THEN NULL ELSE DATE_ADD(NOW(), INTERVAL ? HOUR) END,
                    ?)`,
      [sha256Hex(raw), shareId, effTtl, effTtl, effUses]
    );
    reply.code(201).send({
      enrollmentToken: raw,
      shareId,
      expiresInHours: effTtl,   // null = never expires
      usesLeft: effUses          // null = unlimited
    });
  });

  // ────────── GET /api/admin/whoami ──────────
  // Used by the desktop UI to validate the stored admin key works.
  fastify.get('/api/admin/whoami', async (req) => {
    if (req.apiKey) {
      return { auth: 'apiKey', keyId: req.apiKey.id, scope: req.apiKey.scope };
    }
    return { auth: 'ip', ip: getPeerIp(req) };
  });
};
