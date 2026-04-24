const { getPool } = require('../lib/db');
const { requireScope } = require('../plugins/auth');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };

const listLogsSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      equipo:    { type: 'string', maxLength: 128 },
      equipoId:  { type: 'integer', minimum: 1 },
      level:     { type: 'string' },     // comma-separated "warn,error"
      source:    { type: 'string', maxLength: 64 },
      q:         { type: 'string', maxLength: 120 },  // message contains
      beforeTs:  { type: 'string', format: 'date-time' },
      beforeId:  { type: 'integer', minimum: 1 },
      limit:     { type: 'integer', minimum: 1, maximum: 200, default: 50 }
    }
  }
};

module.exports = async function readRoutes(fastify) {

  // ────────── GET /api/logs — keyset paginated ──────────
  fastify.get('/api/logs', {
    schema: listLogsSchema,
    preHandler: requireScope('read', 'admin'),
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, async (req) => {
    const q = req.query;
    const where = [];
    const params = [];

    if (q.equipoId) {
      where.push('l.equipo_id = ?'); params.push(q.equipoId);
    } else if (q.equipo) {
      where.push('e.hostname = ?'); params.push(q.equipo);
    }

    if (q.level) {
      const levels = q.level.split(',')
        .map(s => LEVELS[s.trim().toLowerCase()])
        .filter(n => n !== undefined);
      if (levels.length) {
        where.push(`l.level IN (${levels.map(() => '?').join(',')})`);
        params.push(...levels);
      }
    }
    if (q.source) { where.push('l.source = ?'); params.push(q.source); }
    if (q.q)      { where.push('l.message LIKE ?'); params.push(`%${q.q}%`); }

    // Keyset cursor: (ts, id) strictly less than
    if (q.beforeTs && q.beforeId) {
      where.push('(l.ts, l.id) < (?, ?)');
      params.push(new Date(q.beforeTs), q.beforeId);
    } else if (q.beforeTs) {
      where.push('l.ts < ?');
      params.push(new Date(q.beforeTs));
    }

    const sql = `
      SELECT l.id, l.ts, l.equipo_id, e.hostname, l.level, l.source, l.message, l.context
        FROM logs l
        JOIN equipos e ON e.id = l.equipo_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY l.ts DESC, l.id DESC
       LIMIT ?`;
    params.push(q.limit);

    const [rows] = await getPool().execute(sql, params);

    const nextCursor = rows.length === q.limit
      ? { beforeTs: rows[rows.length - 1].ts.toISOString(),
          beforeId: Number(rows[rows.length - 1].id) }
      : null;

    return {
      items: rows.map(r => ({
        id: Number(r.id),
        ts: r.ts.toISOString(),
        equipoId: r.equipo_id,
        hostname: r.hostname,
        level: r.level,
        source: r.source,
        message: r.message,
        context: r.context
      })),
      nextCursor
    };
  });

  // ────────── GET /api/logs/recent — dashboard widget ──────────
  fastify.get('/api/logs/recent', {
    schema: {
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }
      }
    },
    preHandler: requireScope('read', 'admin')
  }, async (req) => {
    const [rows] = await getPool().execute(
      `SELECT l.id, l.ts, l.level, l.source, l.message, e.hostname
         FROM logs l JOIN equipos e ON e.id = l.equipo_id
        ORDER BY l.ts DESC, l.id DESC
        LIMIT ?`,
      [req.query.limit]
    );
    return rows.map(r => ({
      id: Number(r.id),
      ts: r.ts.toISOString(),
      hostname: r.hostname,
      level: r.level,
      source: r.source,
      message: r.message
    }));
  });

  // ────────── GET /api/stats/summary ──────────
  fastify.get('/api/stats/summary', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          window: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' }
        }
      }
    },
    preHandler: requireScope('read', 'admin')
  }, async (req) => {
    const map = { '1h': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
    const hours = map[req.query.window];

    const pool = getPool();
    const [byLevel] = await pool.execute(
      `SELECT level, SUM(count) AS total
         FROM stats_hourly
        WHERE bucket >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        GROUP BY level`,
      [hours]
    );
    const [totals] = await pool.execute(
      `SELECT COUNT(DISTINCT equipo_id) AS active_equipos,
              SUM(count) AS total_events
         FROM stats_hourly
        WHERE bucket >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [hours]
    );
    const [top] = await pool.execute(
      `SELECT e.hostname, SUM(s.count) AS errs
         FROM stats_hourly s
         JOIN equipos e ON e.id = s.equipo_id
        WHERE s.bucket >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND s.level >= 3
        GROUP BY s.equipo_id
        ORDER BY errs DESC
        LIMIT 10`,
      [hours]
    );

    const counts = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 };
    const names = ['debug', 'info', 'warn', 'error', 'fatal'];
    for (const r of byLevel) counts[names[r.level] || 'info'] = Number(r.total);

    return {
      window: req.query.window,
      counts,
      activeEquipos: Number(totals[0]?.active_equipos || 0),
      totalEvents:   Number(totals[0]?.total_events  || 0),
      topErrorEquipos: top.map(r => ({ hostname: r.hostname, errors: Number(r.errs) }))
    };
  });

  // ────────── GET /api/equipos — autocomplete ──────────
  fastify.get('/api/equipos', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', maxLength: 128 },
          limit:  { type: 'integer', minimum: 1, maximum: 50, default: 20 }
        }
      }
    },
    preHandler: requireScope('read', 'admin')
  }, async (req) => {
    const { search, limit } = req.query;
    const [rows] = search
      ? await getPool().execute(
          `SELECT id, hostname, share_id, last_seen FROM equipos
            WHERE hostname LIKE ? ORDER BY last_seen DESC LIMIT ?`,
          [`%${search}%`, limit])
      : await getPool().execute(
          `SELECT id, hostname, share_id, last_seen FROM equipos
            ORDER BY last_seen DESC LIMIT ?`,
          [limit]);
    return rows.map(r => ({
      id: r.id, hostname: r.hostname, shareId: r.share_id,
      lastSeen: r.last_seen?.toISOString?.() ?? null
    }));
  });
};
