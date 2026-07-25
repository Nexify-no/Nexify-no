CREATE TABLE `brands` (
  `id` int AUTO_INCREMENT NOT NULL,
  `account_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `website_url` varchar(1000),
  `industry` varchar(255),
  `description` text,
  `brand_status` enum('active','archived') NOT NULL DEFAULT 'active',
  `brand_profile_version` int NOT NULL DEFAULT 0,
  `visual_identity_version` int NOT NULL DEFAULT 0,
  `time_zone` varchar(64) NOT NULL DEFAULT 'Europe/Oslo',
  `language` varchar(8) NOT NULL DEFAULT 'no',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` timestamp NULL,
  CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_brands_account` ON `brands` (`account_id`);
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `active_brand_id` int;
--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD COLUMN `brand_id` int;
--> statement-breakpoint
ALTER TABLE `posts` ADD COLUMN `brand_id` int;
--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD COLUMN `brand_id` int;
--> statement-breakpoint
ALTER TABLE `content_plans` ADD COLUMN `brand_id` int;
--> statement-breakpoint
ALTER TABLE `planned_posts` ADD COLUMN `brand_id` int;
--> statement-breakpoint
ALTER TABLE `content_schedule` ADD COLUMN `brand_id` int;
--> statement-breakpoint
ALTER TABLE `linkedin_connections` ADD COLUMN `brand_id` int;
--> statement-breakpoint
CREATE INDEX `idx_posts_brand` ON `posts` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_posts_brand` ON `scheduled_posts` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `idx_content_plans_brand` ON `content_plans` (`brand_id`);
--> statement-breakpoint
ALTER TABLE `brand_profiles` DROP INDEX `brand_profiles_user_id_unique`;
--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD CONSTRAINT `uq_brand_profiles_user_brand` UNIQUE(`user_id`,`brand_id`);
