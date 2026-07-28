-- One row per (user, platform).
--
-- `savePlatformToken` upserts on this pair, but the table only ever had `id` as a
-- key, so the "update on conflict" had no conflict to detect: every reconnect
-- INSERTed another row. `getPlatformToken` then reads with LIMIT 1 and no ORDER
-- BY, so it would keep handing back whichever row MySQL returned first — in
-- practice the oldest, i.e. the stale token — and a user who reconnected to fix a
-- broken connection would see no change at all.
--
-- Duplicates are collapsed first, keeping the NEWEST row per pair, because that
-- is the one holding the token the user most recently authorised.
--
-- Written idempotently: `drizzle-kit migrate` records a migration as applied only
-- after it succeeds, so a partial failure re-runs the whole file. The
-- information_schema guard is the portable way to say "add this index only if it
-- is absent" — `CREATE INDEX IF NOT EXISTS` is a MariaDB/TiDB extension that
-- MySQL 8 (which CI runs) rejects outright.

DELETE p FROM `platform_integrations` p
JOIN (
  SELECT `user_id`, `platform`, MAX(`id`) AS keep_id
  FROM `platform_integrations`
  GROUP BY `user_id`, `platform`
  HAVING COUNT(*) > 1
) d ON p.`user_id` = d.`user_id` AND p.`platform` = d.`platform` AND p.`id` <> d.keep_id;
--> statement-breakpoint
SET @exists_uq := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'platform_integrations'
    AND INDEX_NAME = 'uq_platform_integrations_user_platform'
);
--> statement-breakpoint
SET @sql_uq := IF(@exists_uq > 0, 'SELECT 1', 'ALTER TABLE `platform_integrations` ADD UNIQUE KEY `uq_platform_integrations_user_platform` (`user_id`, `platform`)');
--> statement-breakpoint
PREPARE s_uq FROM @sql_uq;
--> statement-breakpoint
EXECUTE s_uq;
--> statement-breakpoint
DEALLOCATE PREPARE s_uq;
