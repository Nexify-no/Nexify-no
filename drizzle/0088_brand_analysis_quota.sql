ALTER TABLE `subscription_plans` ADD COLUMN `analyses_per_month` int;
--> statement-breakpoint
ALTER TABLE `user_usage_tracking` ADD COLUMN `analyses_used` int NOT NULL DEFAULT 0;
