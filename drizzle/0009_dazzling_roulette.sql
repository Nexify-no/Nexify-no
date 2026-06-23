CREATE TABLE `ab_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`variant_a` text NOT NULL,
	`variant_b` text NOT NULL,
	`engagement_a` int NOT NULL DEFAULT 0,
	`engagement_b` int NOT NULL DEFAULT 0,
	`winner` enum('a','b','tie','pending') DEFAULT 'pending',
	`status` enum('active','completed') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `ab_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`event_date` date NOT NULL,
	`category` enum('norwegian','global','business','tech','seasonal') NOT NULL,
	`is_recurring` tinyint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitor_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitor_id` int NOT NULL,
	`content` text NOT NULL,
	`engagement` int NOT NULL DEFAULT 0,
	`published_at` timestamp NOT NULL,
	`post_url` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`profile_url` varchar(500) NOT NULL,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`last_checked` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`post_id` int,
	`scheduled_date` timestamp NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`status` enum('planned','published','cancelled') NOT NULL DEFAULT 'planned',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_series` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`total_parts` int NOT NULL,
	`status` enum('planning','in_progress','completed') NOT NULL DEFAULT 'planning',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_series_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`post_id` int NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`published_at` timestamp NOT NULL,
	`day_of_week` int NOT NULL,
	`hour_of_day` int NOT NULL,
	`engagement` int NOT NULL DEFAULT 0,
	`impressions` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repurposed_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`original_post_id` int NOT NULL,
	`new_post_id` int NOT NULL,
	`repurpose_type` enum('platform_adapt','format_change','audience_shift','update') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repurposed_content_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `series_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`series_id` int NOT NULL,
	`post_id` int,
	`part_number` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `series_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`week_start_date` date NOT NULL,
	`week_end_date` date NOT NULL,
	`total_posts` int NOT NULL DEFAULT 0,
	`total_engagement` int NOT NULL DEFAULT 0,
	`top_performing_post_id` int,
	`insights` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weekly_reports_id` PRIMARY KEY(`id`)
);
