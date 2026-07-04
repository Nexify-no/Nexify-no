-- 0074_add_user_id_indexes: indexes for hot user-scoped query paths.
-- NOTE ON TOOLING: this repo's drizzle meta snapshots stop at 0027 while
-- migrations continue to 0073 (all hand-authored). Running `drizzle-kit generate`
-- here would diff schema.ts against the stale 0027 snapshot and emit a huge,
-- incorrect migration — so, per the established repo convention, this migration
-- is hand-authored (schema.ts updated to match). MySQL has no "IF NOT EXISTS" for
-- CREATE INDEX; if any already exist, drop-then-create or guard as needed.
CREATE INDEX `idx_posts_user_id` ON `posts` (`user_id`);
CREATE INDEX `idx_posts_status_scheduled_for` ON `posts` (`status`, `scheduled_for`);
CREATE INDEX `idx_scheduled_posts_user_id` ON `scheduled_posts` (`user_id`);
CREATE INDEX `idx_scheduled_posts_status_scheduled_for` ON `scheduled_posts` (`status`, `scheduled_for`);
CREATE INDEX `idx_drafts_user_id` ON `drafts` (`user_id`);
CREATE INDEX `idx_ideas_user_id` ON `ideas` (`user_id`);
CREATE INDEX `idx_competitors_user_id` ON `competitors` (`user_id`);
CREATE INDEX `idx_post_analytics_user_id` ON `post_analytics` (`user_id`);
CREATE INDEX `idx_content_series_user_id` ON `content_series` (`user_id`);
CREATE INDEX `idx_ab_experiments_user_id` ON `ab_experiments` (`user_id`);
CREATE INDEX `idx_activity_log_user_id` ON `activity_log` (`user_id`);
CREATE INDEX `idx_posting_times_analytics_user_id` ON `posting_times_analytics` (`user_id`);
