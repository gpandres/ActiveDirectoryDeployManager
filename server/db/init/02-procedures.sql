-- ═══════════════════════════════════════════════════════════
-- Partition rotation + scheduled maintenance
-- ═══════════════════════════════════════════════════════════

USE addeploy_logs;

DELIMITER $$

-- ─────────────────────────────────────────────────────────────
-- Ensure a partition exists for the given year/month.
-- Idempotent: does nothing if the partition is already there.
-- ─────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_ensure_partition$$
CREATE PROCEDURE sp_ensure_partition(IN p_table VARCHAR(64), IN p_year INT, IN p_month INT)
BEGIN
  DECLARE v_name VARCHAR(16);
  DECLARE v_next DATE;
  DECLARE v_exists INT DEFAULT 0;

  SET v_name = CONCAT('p', LPAD(p_year, 4, '0'), '_', LPAD(p_month, 2, '0'));
  SET v_next = DATE_ADD(MAKEDATE(p_year, 1), INTERVAL p_month MONTH);

  SELECT COUNT(*) INTO v_exists
    FROM information_schema.PARTITIONS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = p_table
     AND PARTITION_NAME = v_name;

  IF v_exists = 0 THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table, '` REORGANIZE PARTITION p_future INTO (',
      'PARTITION ', v_name, ' VALUES LESS THAN (TO_DAYS(''',
      DATE_FORMAT(v_next, '%Y-%m-%d'), ''')), ',
      'PARTITION p_future VALUES LESS THAN MAXVALUE)'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

-- ─────────────────────────────────────────────────────────────
-- Drop partitions older than N days. Safe on empty tables.
-- ─────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_drop_old_partitions$$
CREATE PROCEDURE sp_drop_old_partitions(IN p_table VARCHAR(64), IN p_retain_days INT)
BEGIN
  DECLARE v_cutoff BIGINT;
  DECLARE v_name VARCHAR(64);
  DECLARE v_desc VARCHAR(64);
  DECLARE done INT DEFAULT 0;
  DECLARE cur CURSOR FOR
    SELECT PARTITION_NAME, PARTITION_DESCRIPTION
      FROM information_schema.PARTITIONS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = p_table
       AND PARTITION_NAME NOT IN ('p_future', 'p_init')
       AND PARTITION_DESCRIPTION <> 'MAXVALUE';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  SET v_cutoff = TO_DAYS(DATE_SUB(CURDATE(), INTERVAL p_retain_days DAY));

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_name, v_desc;
    IF done = 1 THEN LEAVE read_loop; END IF;
    IF CAST(v_desc AS UNSIGNED) <= v_cutoff THEN
      SET @sql = CONCAT('ALTER TABLE `', p_table, '` DROP PARTITION ', v_name);
      PREPARE stmt FROM @sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;
  END LOOP;
  CLOSE cur;
END$$

-- ─────────────────────────────────────────────────────────────
-- Master rotation: ensure next 2 months exist, drop old ones.
-- ─────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_rotate_log_partitions$$
CREATE PROCEDURE sp_rotate_log_partitions(IN p_retain_days INT)
BEGIN
  DECLARE v_y INT;
  DECLARE v_m INT;
  DECLARE v_next1 DATE;
  DECLARE v_next2 DATE;

  SET v_next1 = DATE_ADD(CURDATE(), INTERVAL 1 MONTH);
  SET v_next2 = DATE_ADD(CURDATE(), INTERVAL 2 MONTH);

  CALL sp_ensure_partition('logs', YEAR(v_next1), MONTH(v_next1));
  CALL sp_ensure_partition('logs', YEAR(v_next2), MONTH(v_next2));
  CALL sp_drop_old_partitions('logs', p_retain_days);

  -- Hourly stats: compact retention (365 days default)
  DELETE FROM stats_hourly WHERE bucket < DATE_SUB(NOW(), INTERVAL 365 DAY);
END$$

-- ─────────────────────────────────────────────────────────────
-- Expired enrollment tokens cleanup
-- ─────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_purge_expired_tokens$$
CREATE PROCEDURE sp_purge_expired_tokens()
BEGIN
  -- NULL on either column means "no limit" — never purge those.
  DELETE FROM enrollment_tokens
   WHERE (expires_at IS NOT NULL AND expires_at < NOW())
      OR (uses_left  IS NOT NULL AND uses_left  = 0);
END$$

-- ─────────────────────────────────────────────────────────────
-- Register daily maintenance event.
-- event_scheduler = ON is set in my.cnf (perf.cnf); no need
-- to SET GLOBAL here — that fails in Docker's bootstrap mode.
-- ─────────────────────────────────────────────────────────────
DROP EVENT IF EXISTS ev_daily_maintenance$$
CREATE EVENT ev_daily_maintenance
  ON SCHEDULE EVERY 1 DAY STARTS (CURRENT_DATE + INTERVAL 1 DAY + INTERVAL 3 HOUR)
  DO
  BEGIN
    CALL sp_rotate_log_partitions(90);
    CALL sp_purge_expired_tokens();
  END$$

DELIMITER ;
