const { getPool } = require('../lib/db');
const { requireScope } = require('../plugins/auth');
const config = require('../config');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };

function normalizeLevel(v) {
  if (typeof v === 'number' && v >= 0 && v <= 4) return v | 0;
  if (typeof v === 'string' && LEVELS[v.toLowerCase()] !== undefined) {
    return LEVELS[v.toLowerCase()];
  }
  return 1; // default: info
}

function bucketHour(ts) {
  const d = new Date(ts);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ─────────────────────────────────────────────────────────────
// Resolve / upsert equipo_id for the api key's bound equipo
// (for scope=ingest keys) or allow override from body.
// ─────────────────────────────────────────────────────────────
async function resolveEquipoId(conn, apiKey, overrideHost, overrideShareId) {
  if (apiKey.equipo_id) return apiKey.equipo_id;
  if (!overrideHost || !overrideShareId) {
    const err = new Error('equipo_not_resolvable');
    err.statusCode = 400;
    throw err;
  }
  await conn.execute(
    `INSERT INTO equipos (hostname, share_id)
          VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP(3)`,
    [overrideHost, overrideShareId]
  );
  const [rows] = await conn.execute(
    'SELECT id FROM equipos WHERE hostname = ? AND share_id = ?',
    [overrideHost, overrideShareId]
  );
  return rows[0].id;
}

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────
const logEntrySchema = {
  type: 'object',
  required: ['ts', 'message'],
  additionalProperties: false,
  properties: {
    ts:      { type: 'string', format: 'date-time' },
    level:   { anyOf: [{ type: 'integer', minimum: 0, maximum: 4 }, { type: 'string' }] },
    source:  { type: 'string', maxLength: 64 },
    message: { type: 'string', maxLength: 500 },
    context: { type: ['object', 'null'] }
  }
};

const batchLogsSchema = {
  body: {
    type: 'object',
    required: ['entries'],
    additionalProperties: false,
    properties: {
      hostname: { type: 'string', maxLength: 128 },
      shareId:  { type: 'string', maxLength: 32 },
      entries: {
        type: 'array',
        minItems: 1,
        maxItems: 500,
        items: logEntrySchema
      }
    }
  }
};

const statsSchema = {
  body: {
    type: 'object',
    required: ['events'],
    additionalProperties: false,
    properties: {
      hostname: { type: 'string', maxLength: 128 },
      shareId:  { type: 'string', maxLength: 32 },
      events: {
        type: 'array',
        minItems: 1,
        maxItems: 200,
        items: {
          type: 'object',
          required: ['ts', 'metric', 'value'],
          additionalProperties: false,
          properties: {
            ts:     { type: 'string', format: 'date-time' },
            metric: { type: 'string', maxLength: 64 },
            value:  { type: 'number' },
            tags:   { type: ['object', 'null'] }
          }
        }
      }
    }
  }
};

module.exports = async function ingestRoutes(fastify) {
  // ────────── POST /api/logs/batch ──────────
  fastify.post('/api/logs/batch', {
    schema: batchLogsSchema,
    preHandler: requireScope('ingest', 'admin'),
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    const { hostname, shareId, entries } = req.body;
    if (entries.length > config.batch.maxSize) {
      return reply.code(413).send({ error: 'batch_too_large' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const equipoId = await resolveEquipoId(conn, req.apiKey, hostname, shareId);

      // Build bulk insert for logs
      const rows = entries.map(e => ([
        new Date(e.ts),
        equipoId,
        normalizeLevel(e.level),
        (e.source || '').slice(0, 64),
        String(e.message).slice(0, 500),
        e.context != null ? JSON.stringify(e.context) : null
      ]));
      await conn.query(
        'INSERT INTO logs (ts, equipo_id, level, source, message, context) VALUES ?',
        [rows]
      );

      // Aggregate stats_hourly in-process: one row per (hour, level)
      const agg = new Map(); // key -> count
      for (const e of entries) {
        const key = `${bucketHour(e.ts)}|${normalizeLevel(e.level)}`;
        agg.set(key, (agg.get(key) || 0) + 1);
      }
      for (const [key, count] of agg) {
        const [bucket, level] = key.split('|');
        await conn.execute(
          `INSERT INTO stats_hourly (bucket, equipo_id, level, count)
                VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE count = count + VALUES(count)`,
          [bucket, equipoId, Number(level), count]
        );
      }

      // Touch equipo last_seen (the ON DUPLICATE KEY already did it
      // if we inserted, but for bound keys we need an explicit update).
      await conn.execute(
        'UPDATE equipos SET last_seen = CURRENT_TIMESTAMP(3) WHERE id = ?',
        [equipoId]
      );

      await conn.commit();
      reply.code(202).send({ accepted: entries.length, equipoId });
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  });

  // ────────── POST /api/stats ──────────
  fastify.post('/api/stats', {
    schema: statsSchema,
    preHandler: requireScope('ingest', 'admin'),
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    const { hostname, shareId, events } = req.body;
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const equipoId = await resolveEquipoId(conn, req.apiKey, hostname, shareId);
      const rows = events.map(ev => ([
        new Date(ev.ts),
        equipoId,
        ev.metric,
        ev.value,
        ev.tags != null ? JSON.stringify(ev.tags) : null
      ]));
      await conn.query(
        'INSERT INTO stats_events (ts, equipo_id, metric, value, tags) VALUES ?',
        [rows]
      );
      await conn.commit();
      reply.code(202).send({ accepted: events.length });
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  });
};
