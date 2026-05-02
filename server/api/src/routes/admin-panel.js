const { getPool }     = require('../lib/db');
const { sha256Hex, randomToken } = require('../lib/hash');
const { invalidateCache }        = require('../plugins/auth');
const {
  hashPassword, verifyPassword,
  createSession, getSession, revokeSession,
  parseCookie, COOKIE_NAME, COOKIE_OPTS
} = require('../lib/admin-auth');
const tls    = require('tls');
const crypto = require('crypto');

async function sessionGate(req, reply) {
  const token   = parseCookie(req.headers.cookie, COOKIE_NAME);
  const session = await getSession(token);
  if (!session) return reply.code(401).send({ error: 'session_required' });
  req.adminSession = session;
  req.adminToken   = token;
}

module.exports = async function adminPanelPlugin(fastify) {

  // ── POST /admin/auth/login ─────────────────────────────────────────────
  fastify.post('/admin/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        additionalProperties: false,
        properties: {
          username: { type: 'string', maxLength: 64 },
          password: { type: 'string', maxLength: 1024 }
        }
      }
    }
  }, async (req, reply) => {
    const { username, password } = req.body;
    const [rows] = await getPool().execute(
      'SELECT id, password_hash, must_change FROM admin_users WHERE username = ? LIMIT 1',
      [username]
    );
    const user  = rows[0];
    // Always run verifyPassword to prevent timing-based username enumeration.
    const valid = user ? verifyPassword(password, user.password_hash) : false;
    if (!valid) return reply.code(401).send({ error: 'invalid_credentials' });
    const token = await createSession(user.id);
    reply.header('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${COOKIE_OPTS}`);
    return { ok: true, mustChange: !!user.must_change };
  });

  // ── POST /admin/auth/logout ────────────────────────────────────────────
  fastify.post('/admin/auth/logout', async (req, reply) => {
    const token = parseCookie(req.headers.cookie, COOKIE_NAME);
    await revokeSession(token).catch(() => {});
    reply.header('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
    return { ok: true };
  });

  // ── Protected /admin-api/* ─────────────────────────────────────────────
  // Inner plugin scope: sessionGate hook is scoped here and does not apply
  // to the login/logout routes above.
  fastify.register(async function protectedScope(f) {
    f.addHook('preHandler', sessionGate);

    // GET /admin-api/me
    f.get('/admin-api/me', async (req) => ({
      username:   req.adminSession.username,
      mustChange: !!req.adminSession.must_change
    }));

    // GET /admin-api/stats
    f.get('/admin-api/stats', async () => {
      const pool = getPool();
      const [[{ events24h   }]] = await pool.execute(
        `SELECT COUNT(*) AS events24h FROM logs WHERE ts >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
      );
      const [[{ activeEquipos }]] = await pool.execute(
        `SELECT COUNT(DISTINCT equipo_id) AS activeEquipos FROM logs WHERE ts >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
      );
      const [[{ errors24h }]] = await pool.execute(
        `SELECT COUNT(*) AS errors24h FROM logs WHERE ts >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND level = 'error'`
      );
      const [[{ totalEquipos }]] = await pool.execute(
        `SELECT COUNT(*) AS totalEquipos FROM equipos`
      );
      const [[{ totalKeys }]] = await pool.execute(
        `SELECT COUNT(*) AS totalKeys FROM api_keys WHERE revoked_at IS NULL`
      );
      return { events24h, activeEquipos, errors24h, totalEquipos, totalKeys };
    });

    // GET /admin-api/tls-fingerprint
    // Connects to addeploy-caddy:443 from inside the Docker network so the
    // browser never needs direct access. Returns the sha256// fingerprint.
    f.get('/admin-api/tls-fingerprint', async (_req, reply) => {
      const hostname = process.env.LOG_HOSTNAME || 'localhost';
      return new Promise((resolve) => {
        const socket = tls.connect(
          { host: 'addeploy-caddy', port: 443, servername: hostname, rejectUnauthorized: false },
          () => {
            const cert = socket.getPeerCertificate();
            socket.destroy();
            if (!cert || !cert.raw) {
              return resolve(reply.code(502).send({ error: 'no_cert' }));
            }
            const fp = 'sha256//' + crypto.createHash('sha256').update(cert.raw).digest('base64');
            resolve({ fingerprint: fp, hostname });
          }
        );
        socket.setTimeout(5000, () => {
          socket.destroy();
          resolve(reply.code(504).send({ error: 'tls_timeout' }));
        });
        socket.on('error', (err) => {
          resolve(reply.code(502).send({ error: 'tls_connect_failed', detail: err.code }));
        });
      });
    });

    // GET /admin-api/api-keys
    f.get('/admin-api/api-keys', async () => {
      const [rows] = await getPool().execute(
        `SELECT id, name, scope, created_at, last_used, revoked_at
           FROM api_keys ORDER BY created_at DESC`
      );
      return rows.map(r => ({
        id:        r.id,
        name:      r.name,
        scope:     r.scope,
        createdAt: r.created_at?.toISOString?.() ?? null,
        lastUsed:  r.last_used?.toISOString?.() ?? null,
        revokedAt: r.revoked_at?.toISOString?.() ?? null
      }));
    });

    // POST /admin-api/api-keys
    f.post('/admin-api/api-keys', {
      schema: {
        body: {
          type: 'object', required: ['name', 'scope'], additionalProperties: false,
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

    // POST /admin-api/api-keys/:id/revoke
    f.post('/admin-api/api-keys/:id/revoke', async (req, reply) => {
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'bad_id' });
      await getPool().execute(
        'UPDATE api_keys SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [id]
      );
      invalidateCache();
      return { ok: true };
    });

    // POST /admin-api/change-password
    f.post('/admin-api/change-password', {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        body: {
          type: 'object', required: ['currentPassword', 'newPassword'], additionalProperties: false,
          properties: {
            currentPassword: { type: 'string', maxLength: 1024 },
            newPassword:     { type: 'string', minLength: 8, maxLength: 1024 }
          }
        }
      }
    }, async (req, reply) => {
      const { currentPassword, newPassword } = req.body;
      const [rows] = await getPool().execute(
        'SELECT password_hash FROM admin_users WHERE id = ? LIMIT 1',
        [req.adminSession.user_id]
      );
      if (!rows[0] || !verifyPassword(currentPassword, rows[0].password_hash)) {
        return reply.code(401).send({ error: 'wrong_password' });
      }
      await getPool().execute(
        'UPDATE admin_users SET password_hash = ?, must_change = 0 WHERE id = ?',
        [hashPassword(newPassword), req.adminSession.user_id]
      );
      // Revoke all sessions for this user so existing tabs re-authenticate.
      await getPool().execute(
        'UPDATE admin_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [req.adminSession.user_id]
      );
      reply.header('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
      return { ok: true };
    });
  });
};
