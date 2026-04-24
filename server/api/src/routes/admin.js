const { getPool } = require('../lib/db');
const { sha256Hex, randomToken } = require('../lib/hash');
const { invalidateCache } = require('../plugins/auth');
const config = require('../config');

// IP allowlist gate — admin endpoints are explicitly scoped to
// localhost/trusted hosts via docker network.
// IMPORTANT: must be async. Sync Fastify hooks require calling
// done() explicitly; returning undefined without done() hangs.
async function ipGate(req, reply) {
  if (config.adminAllowedIps.length === 0) {
    return reply.code(403).send({ error: 'admin_disabled' });
  }
  const ip = req.ip;
  if (!config.adminAllowedIps.includes(ip)) {
    return reply.code(403).send({ error: 'forbidden_ip', ip });
  }
}

module.exports = async function adminRoutes(fastify) {

  fastify.addHook('preHandler', ipGate);

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

  // ────────── POST /api/admin/share-secrets ──────────
  // Issues the HMAC secret for a given shareId. Shown once; the
  // client uses it to sign the config file placed on the share.
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
    // Hex format: the column is CHAR(64) (32 bytes × 2 chars) and
    // the client signs via crypto.createHmac using Buffer.from(hex, 'hex').
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

  // ────────── POST /api/admin/enrollment-tokens ──────────
  fastify.post('/api/admin/enrollment-tokens', {
    schema: {
      body: {
        type: 'object',
        required: ['shareId'],
        additionalProperties: false,
        properties: {
          shareId:   { type: 'string', maxLength: 32 },
          ttlHours:  { type: 'integer', minimum: 1, maximum: 720, default: 24 },
          usesLeft:  { type: 'integer', minimum: 1, maximum: 10000, default: 1000 }
        }
      }
    }
  }, async (req, reply) => {
    const { shareId, ttlHours, usesLeft } = req.body;
    const raw = randomToken(32);
    await getPool().execute(
      `INSERT INTO enrollment_tokens (token_hash, share_id, expires_at, uses_left)
            VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?)`,
      [sha256Hex(raw), shareId, ttlHours, usesLeft]
    );
    reply.code(201).send({
      enrollmentToken: raw,
      shareId,
      expiresInHours: ttlHours,
      usesLeft
    });
  });
};
