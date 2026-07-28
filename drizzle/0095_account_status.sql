-- Account status (PR #86).
--
-- Before this, the only way to stop an account was a hard `DELETE FROM users`,
-- which orphaned rows in 51 tables that carry `user_id` with no foreign key.
-- `suspended` blocks authentication and is reversible, and the user is told why.
--
-- `deleted` is RESERVED — nothing writes it yet. `authenticateRequest` already
-- refuses the value so a future soft-delete needs no further migration.
--
-- ONE STATEMENT PER `--> statement-breakpoint`. The mysql2 connection is created
-- without `multipleStatements`, so a chunk containing two statements fails with a
-- syntax error. `IF NOT EXISTS` (a TiDB extension) makes each step idempotent —
-- these columns were applied by hand during the outage this migration caused, so
-- a plain `ADD COLUMN` would now fail the deploy with "Duplicate column name".

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `status` enum('active','suspended','deleted') NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `suspended_at` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `suspended_reason` varchar(500) NULL DEFAULT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_status_idx` ON `users` (`status`);
