const { getPool } = require('./lib/db');
const { hashPassword } = require('./lib/admin-auth');

const MAX_ATTEMPTS  = 20;
const RETRY_DELAY   = 3000;

const RETRYABLE_CODES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST', 'ER_NO_SUCH_TABLE', 'ER_BAD_DB_ERROR'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function seed() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      const pool = getPool();
      const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM admin_users');
      if (Number(cnt) > 0) {
        console.log('[seed] admin_users not empty — skipping');
        process.exit(0);
      }
      const hash = hashPassword('admin');
      await pool.execute(
        'INSERT INTO admin_users (username, password_hash, must_change) VALUES (?, ?, 1)',
        ['admin', hash]
      );
      console.log('[seed] created default admin user (admin/admin) — change password on first login');
      process.exit(0);
    } catch (err) {
      if (RETRYABLE_CODES.has(err.code) && i < MAX_ATTEMPTS) {
        console.log(`[seed] not ready (${err.code}), attempt ${i}/${MAX_ATTEMPTS} — retrying in ${RETRY_DELAY}ms`);
        await wait(RETRY_DELAY);
        continue;
      }
      // ER_NO_SUCH_TABLE after all retries = schema not migrated yet, let server start
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[seed] admin_users missing after all retries — skipping seed (run DB migrations)');
        process.exit(0);
      }
      console.error('[seed] fatal:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

seed();
