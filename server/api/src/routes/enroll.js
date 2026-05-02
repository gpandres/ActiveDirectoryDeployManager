const { getPool } = require('../lib/db');
const { sha256Hex, randomToken } = require('../lib/hash');

const enrollSchema = {
  body: {
    type: 'object',
    required: ['hostname', 'shareId', 'enrollmentToken'],
    additionalProperties: false,
    properties: {
      hostname:        { type: 'string', minLength: 1, maxLength: 128 },
      shareId:         { type: 'string', minLength: 1, maxLength: 32 },
      enrollmentToken: { type: 'string', minLength: 16, maxLength: 256 }
    }
  }
};

module.exports = async function enrollRoutes(fastify) {

  // ────────── POST /api/enroll ──────────
  // Swaps a share enrollment token for a per-client ingest API key.
  // Token is validated, then decremented. Each equipo gets its
  // own key so revocation is surgical.
  fastify.post('/api/enroll', {
    schema: enrollSchema,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    const { hostname, shareId, enrollmentToken } = req.body;
    const tokenHash = sha256Hex(enrollmentToken);

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Atomically consume one use if the token is valid.
      const [result] = await conn.execute(
        `UPDATE enrollment_tokens
            SET uses_left = uses_left - 1
          WHERE token_hash = ?
            AND share_id   = ?
            AND expires_at > NOW()
            AND uses_left  > 0`,
        [tokenHash, shareId]
      );
      if (result.affectedRows === 0) {
        await conn.rollback();
        return reply.code(401).send({ error: 'invalid_or_expired_token' });
      }

      // Upsert equipo
      await conn.execute(
        `INSERT INTO equipos (hostname, share_id)
              VALUES (?, ?)
         ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP(3)`,
        [hostname, shareId]
      );
      const [eRows] = await conn.execute(
        'SELECT id FROM equipos WHERE hostname = ? AND share_id = ?',
        [hostname, shareId]
      );
      const equipoId = eRows[0].id;

      // Revoke any existing ingest keys for this equipo (re-enrollment).
      await conn.execute(
        `UPDATE api_keys SET revoked_at = NOW()
          WHERE equipo_id = ? AND scope = 'ingest' AND revoked_at IS NULL`,
        [equipoId]
      );

      // Issue a new API key. The raw value is shown exactly once.
      const raw = randomToken(32);
      const hash = sha256Hex(raw);
      await conn.execute(
        `INSERT INTO api_keys (key_hash, name, scope, equipo_id)
              VALUES (?, ?, 'ingest', ?)`,
        [hash, `equipo:${hostname}`, equipoId]
      );

      await conn.commit();
      reply.code(201).send({ apiKey: raw, equipoId });
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  });
};
