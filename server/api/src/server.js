const Fastify = require('fastify');
const config = require('./config');
const { getPool, closePool } = require('./lib/db');

async function build() {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: config.trustProxy,
    bodyLimit: config.batch.maxBytes,
    disableRequestLogging: false,
    ajv: { customOptions: { allErrors: false, removeAdditional: 'failing' } }
  });

  await app.register(require('@fastify/sensible'));
  await app.register(require('@fastify/rate-limit'), {
    global: false,
    max: 600,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const raw = req.headers['x-api-key'];
      return raw ? `k:${raw.slice(0, 16)}` : req.ip;
    }
  });

  // Health probe — no auth, used by docker-compose healthcheck.
  app.get('/health', async () => {
    try {
      const [rows] = await getPool().query('SELECT 1 AS ok');
      return { status: 'ok', db: rows[0].ok === 1 };
    } catch (err) {
      return { status: 'degraded', error: err.code || 'db_error' };
    }
  });

  await app.register(require('./routes/ingest'));
  await app.register(require('./routes/read'));
  await app.register(require('./routes/enroll'));
  await app.register(require('./routes/admin'));

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request_failed');
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(status).send({
      error: err.code || err.message || 'internal_error',
      statusCode: status
    });
  });

  return app;
}

async function start() {
  const app = await build();

  const shutdown = async (signal) => {
    app.log.info({ signal }, 'shutting_down');
    try {
      await app.close();
      await closePool();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'shutdown_error');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error({ err }, 'listen_failed');
    process.exit(1);
  }
}

if (require.main === module) start();
module.exports = { build };
