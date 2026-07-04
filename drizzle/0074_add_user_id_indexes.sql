-- 0074: indexes for hot user-scoped query paths (one index per statement).
CREATE INDEX `idx_posts_user_id` ON `posts` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_posts_status_scheduled_for` ON `posts` (`status`, `scheduled_for`);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_posts_user_id` ON `scheduled_posts` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_posts_status_scheduled_for` ON `scheduled_posts` (`status`, `scheduled_for`);
--> statement-breakpoint
CREATE INDEX `idx_drafts_user_id` ON `drafts` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_ideas_user_id` ON `ideas` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_competitors_user_id` ON `competitors` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_post_analytics_user_id` ON `post_analytics` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_content_series_user_id` ON `content_series` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_ab_experiments_user_id` ON `ab_experiments` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_activity_log_user_id` ON `activity_log` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_posting_times_analytics_user_id` ON `posting_times_analytics` (`user_id`);
