CREATE TABLE `ab_experiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`post_id` int,
	`platform` varchar(20) NOT NULL,
	`goal` varchar(20) NOT NULL DEFAULT 'clicks',
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`destination_url` varchar(1000),
	`winner_variant_id` int,
	`started_at` timestamp NULL,
	`ends_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_experiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ab_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`experiment_id` int NOT NULL,
	`label` varchar(40),
	`body` text NOT NULL,
	`image_url` varchar(1000),
	`tracking_code` varchar(20) NOT NULL,
	`destination_url` varchar(1000),
	`allocation_percent` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq` UNIQUE(`tracking_code`)
);
--> statement-breakpoint
CREATE INDEX `idx_ab_variants_tracking_code` ON `ab_variants` (`tracking_code`);
--> statement-breakpoint
CREATE TABLE `ab_click_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variant_id` int NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`country` varchar(8),
	`device` varchar(20),
	`referer` varchar(500),
	`session_hash` varchar(64),
	CONSTRAINT `ab_click_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ab_click_events_variant_id` ON `ab_click_events` (`variant_id`);
--> statement-breakpoint
CREATE TABLE `ab_stats` (
	`variant_id` int NOT NULL,
	`clicks` int NOT NULL DEFAULT 0,
	`unique_clicks` int NOT NULL DEFAULT 0,
	`ctr` double NOT NULL DEFAULT 0,
	`confidence` double NOT NULL DEFAULT 0,
	`winner_probability` double NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_stats_variant_id` PRIMARY KEY(`variant_id`)
);
