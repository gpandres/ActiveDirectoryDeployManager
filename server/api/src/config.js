const fs = require('fs');

function readSecretFile(envVar) {
  const path = process.env[envVar];
  if (!path) return null;
  try {
    const value = fs.readFileSync(path, 'utf8').trim();
    if (!value) throw new Error(`secret file ${path} is empty`);
    return value;
  } catch (err) {
    // Hard fail: a misconfigured secret is a boot-time error, not
    // something we silently paper over with an empty password.
    console.error(`[config] failed to read secret from ${path}: ${err.code || err.message}`);
    throw err;
  }
}

const dbPassword = process.env.DB_PASS_FILE
  ? readSecretFile('DB_PASS_FILE')
  : (process.env.DB_PASS || '');

module.exports = {
  port: Number(process.env.PORT || 8080),
  logLevel: process.env.LOG_LEVEL || 'info',
  trustProxy: process.env.TRUST_PROXY === 'true',
  db: {
    host: process.env.DB_HOST || 'mariadb',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'addeploy',
    password: dbPassword,
    database: process.env.DB_NAME || 'addeploy_logs',
    connectionLimit: Number(process.env.DB_POOL || 20)
  },
  batch: {
    maxSize:  Number(process.env.BATCH_MAX_SIZE  || 500),
    maxBytes: Number(process.env.BATCH_MAX_BYTES || 1024 * 1024)
  },
  adminAllowedIps: (process.env.ADMIN_ALLOWED_IPS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
};
