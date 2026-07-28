-- Account status (PR #86).
--
-- Before this, the only way to stop an account was a hard `DELETE FROM users`,
-- which orphaned rows in 51 tables that carry `user_id` with no foreign key.
-- `suspended` blocks authentication and is reversible, and the user is told why.
--
-- `deleted` is RESERVED — nothing writes it yet. `authenticateRequest` already
-- refuses the value so a future soft-delete needs no further migration.
--
-- WHY THIS IS WRITTEN THE HARD WAY
--
-- These three columns were applied BY HAND to production during the outage this
-- migration caused (it was never registered in meta/_journal.json, so
-- `drizzle-kit migrate` never opened it). A plain `ADD COLUMN` would now fail
-- the deploy with "Duplicate column name" — but `ADD COLUMN IF NOT EXISTS` is a
-- MariaDB/TiDB extension, and CI runs mysql:8.0, which rejects it as a syntax
-- error. The SET/PREPARE/EXECUTE dance below is the portable way to say
-- "only if it is missing": it is valid on MySQL 8, MariaDB and TiDB alike.
--
-- Also: never write the breakpoint marker inside a comment. Drizzle splits the
-- file on that literal string wherever it appears, comment or not — an earlier
-- version of this header mentioned it and split the migration mid-sentence,
-- which is what CI caught.

SET @exists_status := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status');
--> statement-breakpoint
SET @sql_status := IF(@exists_status > 0, 'SELECT 1', 'ALTER TABLE `users` ADD COLUMN `status` enum(''active'',''suspended'',''deleted'') NOT NULL DEFAULT ''active''');
--> statement-breakpoint
PREPARE s_status FROM @sql_status;
--> statement-breakpoint
EXECUTE s_status;
--> statement-breakpoint
DEALLOCATE PREPARE s_status;
--> statement-breakpoint
SET @exists_susp_at := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'suspended_at');
--> statement-breakpoint
SET @sql_susp_at := IF(@exists_susp_at > 0, 'SELECT 1', 'ALTER TABLE `users` ADD COLUMN `suspended_at` timestamp NULL DEFAULT NULL');
--> statement-breakpoint
PREPARE s_susp_at FROM @sql_susp_at;
--> statement-breakpoint
EXECUTE s_susp_at;
--> statement-breakpoint
DEALLOCATE PREPARE s_susp_at;
--> statement-breakpoint
SET @exists_susp_reason := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'suspended_reason');
--> statement-breakpoint
SET @sql_susp_reason := IF(@exists_susp_reason > 0, 'SELECT 1', 'ALTER TABLE `users` ADD COLUMN `suspended_reason` varchar(500) NULL DEFAULT NULL');
--> statement-breakpoint
PREPARE s_susp_reason FROM @sql_susp_reason;
--> statement-breakpoint
EXECUTE s_susp_reason;
--> statement-breakpoint
DEALLOCATE PREPARE s_susp_reason;
--> statement-breakpoint
SET @exists_status_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_status_idx');
--> statement-breakpoint
SET @sql_status_idx := IF(@exists_status_idx > 0, 'SELECT 1', 'CREATE INDEX `users_status_idx` ON `users` (`status`)');
--> statement-breakpoint
PREPARE s_status_idx FROM @sql_status_idx;
--> statement-breakpoint
EXECUTE s_status_idx;
--> statement-breakpoint
DEALLOCATE PREPARE s_status_idx;
