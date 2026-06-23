CREATE TABLE `admin_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setting_key` varchar(100) NOT NULL,
	`setting_value` text NOT NULL,
	`description` text,
	`category` varchar(50) NOT NULL,
	`is_encrypted` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_updated_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_settings_setting_key_unique` UNIQUE(`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `backup_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`enable_auto_backup` boolean NOT NULL DEFAULT true,
	`backup_frequency` enum('daily','weekly','monthly') NOT NULL DEFAULT 'daily',
	`retention_days` int NOT NULL DEFAULT 90,
	`max_backups_per_post` int NOT NULL DEFAULT 10,
	`last_backup_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backup_schedule_id` PRIMARY KEY(`id`),
	CONSTRAINT `backup_schedule_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `deleted_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`user_id` int NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`generated_content` text NOT NULL,
	`deletion_reason` text,
	`permanently_deleted` boolean NOT NULL DEFAULT false,
	`deleted_at` timestamp NOT NULL DEFAULT (now()),
	`permanently_deleted_at` timestamp,
	`can_restore_until` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deleted_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`email_notifications` boolean NOT NULL DEFAULT true,
	`email_frequency` varchar(20) NOT NULL DEFAULT 'daily',
	`push_notifications` boolean NOT NULL DEFAULT true,
	`push_frequency` varchar(20) NOT NULL DEFAULT 'immediate',
	`notify_on_new_trends` boolean NOT NULL DEFAULT true,
	`notify_on_scheduled_posts` boolean NOT NULL DEFAULT true,
	`notify_on_published_posts` boolean NOT NULL DEFAULT true,
	`notify_on_engagement_milestones` boolean NOT NULL DEFAULT true,
	`notify_on_failed_posts` boolean NOT NULL DEFAULT true,
	`notify_on_analytics_updates` boolean NOT NULL DEFAULT true,
	`weekly_report_enabled` boolean NOT NULL DEFAULT true,
	`monthly_report_enabled` boolean NOT NULL DEFAULT true,
	`quiet_hours_enabled` boolean NOT NULL DEFAULT false,
	`quiet_hours_start` varchar(5) NOT NULL DEFAULT '22:00',
	`quiet_hours_end` varchar(5) NOT NULL DEFAULT '08:00',
	`engagement_threshold` int NOT NULL DEFAULT 10,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_settings_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `platform_integration_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`platform` varchar(50) NOT NULL,
	`is_connected` boolean NOT NULL DEFAULT false,
	`access_token` text,
	`refresh_token` text,
	`expires_at` timestamp,
	`account_name` varchar(255),
	`account_id` varchar(255),
	`account_email` varchar(320),
	`auto_post` boolean NOT NULL DEFAULT false,
	`auto_schedule` boolean NOT NULL DEFAULT false,
	`posting_hours` text,
	`last_synced_at` timestamp,
	`last_error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_integration_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` timestamp,
	`scope` text,
	`account_id` varchar(255),
	`account_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`user_id` int NOT NULL,
	`action` enum('created','edited','deleted','published','scheduled','restored','backed_up') NOT NULL,
	`action_details` json,
	`old_value` text,
	`new_value` text,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`user_id` int NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`tone` varchar(50) NOT NULL,
	`raw_input` text NOT NULL,
	`generated_content` text NOT NULL,
	`tags` json,
	`status` enum('draft','scheduled','published','failed') NOT NULL,
	`scheduled_for` timestamp,
	`published_at` timestamp,
	`backup_reason` enum('pre_deletion','pre_edit','scheduled','manual') NOT NULL DEFAULT 'manual',
	`is_restorable` boolean NOT NULL DEFAULT true,
	`backed_up_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`user_id` int NOT NULL,
	`generated_content` text NOT NULL,
	`tone` varchar(50) NOT NULL,
	`tags` json,
	`version_number` int NOT NULL,
	`change_description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posting_times_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`day_of_week` int NOT NULL,
	`hour_of_day` int NOT NULL,
	`total_posts` int NOT NULL DEFAULT 0,
	`avg_engagement` decimal(10,2) NOT NULL DEFAULT '0',
	`avg_reach` int NOT NULL DEFAULT 0,
	`avg_impressions` int NOT NULL DEFAULT 0,
	`avg_engagement_rate` decimal(5,2) NOT NULL DEFAULT '0',
	`performance_rank` int NOT NULL DEFAULT 5,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posting_times_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`user_id` int NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`scheduled_for` timestamp NOT NULL,
	`timezone` varchar(50) NOT NULL DEFAULT 'UTC',
	`status` enum('scheduled','publishing','published','failed','cancelled') NOT NULL DEFAULT 'scheduled',
	`published_at` timestamp,
	`failure_reason` text,
	`engagement_score` decimal(5,2) DEFAULT '0',
	`optimality_score` decimal(5,2) DEFAULT '0',
	`notification_sent` boolean NOT NULL DEFAULT false,
	`notification_sent_at` timestamp,
	`retry_count` int NOT NULL DEFAULT 0,
	`last_retry_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduling_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`timezone` varchar(50) NOT NULL DEFAULT 'UTC',
	`linkedin_best_days` json DEFAULT ('[1,2,3,4,5]'),
	`linkedin_best_hours` json DEFAULT ('[8,9,12,17,18]'),
	`twitter_best_days` json DEFAULT ('[1,2,3,4,5]'),
	`twitter_best_hours` json DEFAULT ('[9,12,17,20]'),
	`instagram_best_days` json DEFAULT ('[0,1,2,3,4,5,6]'),
	`instagram_best_hours` json DEFAULT ('[8,12,18,20,21]'),
	`facebook_best_days` json DEFAULT ('[1,2,3,4,5]'),
	`facebook_best_hours` json DEFAULT ('[12,13,19,20]'),
	`enable_auto_scheduling` boolean NOT NULL DEFAULT true,
	`enable_notifications` boolean NOT NULL DEFAULT true,
	`notification_minutes_before` int NOT NULL DEFAULT 15,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduling_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduling_preferences_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `scheduling_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduled_post_id` int NOT NULL,
	`user_id` int NOT NULL,
	`post_id` int NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`scheduled_for` timestamp NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`processed_at` timestamp,
	`processing_started_at` timestamp,
	`error_message` text,
	`attempt_count` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 3,
	`next_retry_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduling_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_account_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`display_name` varchar(255),
	`bio` text,
	`profile_image` varchar(500),
	`language` varchar(10) NOT NULL DEFAULT 'no',
	`timezone` varchar(50) NOT NULL DEFAULT 'Europe/Oslo',
	`theme` varchar(20) NOT NULL DEFAULT 'light',
	`two_factor_enabled` boolean NOT NULL DEFAULT false,
	`last_password_change` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_account_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_account_settings_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_content_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`default_tone` varchar(50) NOT NULL DEFAULT 'professional',
	`default_platform` varchar(50) NOT NULL DEFAULT 'linkedin',
	`content_length` varchar(20) NOT NULL DEFAULT 'medium',
	`hashtag_style` varchar(20) NOT NULL DEFAULT 'moderate',
	`cta_style` varchar(20) NOT NULL DEFAULT 'professional',
	`emoji_usage` varchar(20) NOT NULL DEFAULT 'moderate',
	`auto_save_drafts` boolean NOT NULL DEFAULT true,
	`analytics_view` varchar(20) NOT NULL DEFAULT 'overview',
	`show_onboarding` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_content_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_content_preferences_user_id_unique` UNIQUE(`user_id`)
);
