ALTER TABLE `competitors` ADD `website` varchar(500);
--> statement-breakpoint
CREATE TABLE `competitor_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitor_id` int NOT NULL,
	`type` varchar(20) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`last_fetch` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_competitor_sources_competitor_id` ON `competitor_sources` (`competitor_id`);
--> statement-breakpoint
CREATE TABLE `competitor_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitor_id` int NOT NULL,
	`source_id` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`url` varchar(1000),
	`published_at` timestamp NULL,
	`summary` text,
	`content_hash` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_content_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cc` UNIQUE(`content_hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_competitor_content_competitor_id` ON `competitor_content` (`competitor_id`);
--> statement-breakpoint
CREATE TABLE `competitor_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitor_id` int NOT NULL,
	`topic` varchar(120) NOT NULL,
	`score` double NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_competitor_topics_competitor_id` ON `competitor_topics` (`competitor_id`);
--> statement-breakpoint
CREATE TABLE `competitor_gaps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitor_id` int NOT NULL,
	`topic` varchar(120) NOT NULL,
	`opportunity_score` double NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_gaps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_competitor_gaps_competitor_id` ON `competitor_gaps` (`competitor_id`);
