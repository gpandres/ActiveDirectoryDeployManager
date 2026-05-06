-- ═══════════════════════════════════════════════════════════
-- AD Deploy Manager — Logging schema
-- ═══════════════════════════════════════════════════════════
-- Runs once, on first container boot (docker-entrypoint-initdb.d)

CREATE DATABASE IF NOT EXISTS addeploy_logs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE addeploy_logs;

-- ─────────────────────────────────────────────────────────────
-- Equipos: normalized per (hostname, share_id) so repeated
-- strings don't bloat the logs table.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipos (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  hostname    VARCHAR(128) NOT NULL,
  share_id    VARCHAR(32)  NOT NULL,
  first_seen  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_host_share (hostname, share_id),
  KEY idx_last_seen (last_seen)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- Logs: partitioned monthly so retention is a DROP PARTITION
-- (O(1)) instead of a slow DELETE scan. The PK includes ts
-- because MariaDB requires partition columns in every unique key.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ts         DATETIME(3) NOT NULL,
  equipo_id  INT UNSIGNED NOT NULL,
  level      TINYINT UNSIGNED NOT NULL,
  source     VARCHAR(64)  NOT NULL DEFAULT '',
  message    VARCHAR(500) NOT NULL,
  context    JSON NULL,
  PRIMARY KEY (id, ts),
  KEY idx_ts (ts),
  KEY idx_equipo_ts (equipo_id, ts),
  KEY idx_level_ts (level, ts)
) ENGINE=InnoDB
  ROW_FORMAT=COMPRESSED
  PARTITION BY RANGE (TO_DAYS(ts)) (
    PARTITION p_init    VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p2026_01  VALUES LESS THAN (TO_DAYS('2026-02-01')),
    PARTITION p2026_02  VALUES LESS THAN (TO_DAYS('2026-03-01')),
    PARTITION p2026_03  VALUES LESS THAN (TO_DAYS('2026-04-01')),
    PARTITION p2026_04  VALUES LESS THAN (TO_DAYS('2026-05-01')),
    PARTITION p2026_05  VALUES LESS THAN (TO_DAYS('2026-06-01')),
    PARTITION p2026_06  VALUES LESS THAN (TO_DAYS('2026-07-01')),
    PARTITION p2026_07  VALUES LESS THAN (TO_DAYS('2026-08-01')),
    PARTITION p2026_08  VALUES LESS THAN (TO_DAYS('2026-09-01')),
    PARTITION p2026_09  VALUES LESS THAN (TO_DAYS('2026-10-01')),
    PARTITION p2026_10  VALUES LESS THAN (TO_DAYS('2026-11-01')),
    PARTITION p2026_11  VALUES LESS THAN (TO_DAYS('2026-12-01')),
    PARTITION p2026_12  VALUES LESS THAN (TO_DAYS('2027-01-01')),
    PARTITION p_future  VALUES LESS THAN MAXVALUE
  );

-- ─────────────────────────────────────────────────────────────
-- Pre-aggregated hourly stats. Dashboards query this table,
-- never the logs table — keeps summary queries under 10ms even
-- with billions of raw rows.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_hourly (
  bucket     DATETIME NOT NULL,
  equipo_id  INT UNSIGNED NOT NULL,
  level      TINYINT UNSIGNED NOT NULL,
  count      INT UNSIGNED NOT NULL,
  PRIMARY KEY (bucket, equipo_id, level),
  KEY idx_bucket (bucket)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- Custom stats pushed by clients (deployments, scans, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ts         DATETIME(3)  NOT NULL,
  equipo_id  INT UNSIGNED NOT NULL,
  metric     VARCHAR(64)  NOT NULL,
  value      DOUBLE       NOT NULL,
  tags       JSON NULL,
  PRIMARY KEY (id, ts),
  KEY idx_metric_ts (metric, ts),
  KEY idx_equipo_metric_ts (equipo_id, metric, ts)
) ENGINE=InnoDB
  PARTITION BY RANGE (TO_DAYS(ts)) (
    PARTITION p_init   VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
  );

-- ─────────────────────────────────────────────────────────────
-- API keys: only hashes stored, never the raw value.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  key_hash    CHAR(64) NOT NULL,
  name        VARCHAR(128) NOT NULL,
  scope       ENUM('ingest','read','admin') NOT NULL DEFAULT 'ingest',
  equipo_id   INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used   DATETIME NULL,
  revoked_at  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_hash (key_hash),
  KEY idx_scope (scope),
  KEY idx_equipo (equipo_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- Share secrets: HMAC keys used to sign the config file placed
-- on the network share. One row per share_id.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_secrets (
  share_id    VARCHAR(32) NOT NULL,
  secret_hex  CHAR(64)    NOT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (share_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- Enrollment tokens: short-lived, single-use (or N-use) tokens
-- embedded in the share config. Used to swap for a per-client
-- API key via POST /api/enroll.
-- ─────────────────────────────────────────────────────────────
-- expires_at NULL = no expiration; uses_left NULL = unlimited uses.
CREATE TABLE IF NOT EXISTS enrollment_tokens (
  token_hash  CHAR(64) NOT NULL,
  share_id    VARCHAR(32) NOT NULL,
  expires_at  DATETIME NULL DEFAULT NULL,
  uses_left   INT UNSIGNED NULL DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB;
