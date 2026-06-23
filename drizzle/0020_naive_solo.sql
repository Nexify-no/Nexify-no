CREATE TABLE `hashtag_performance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`hashtag` varchar(100) NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`engagement` int NOT NULL DEFAULT 0,
	`usage_count` int NOT NULL DEFAULT 1,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hashtag_performance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hashtag_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`post_id` int,
	`content_title` varchar(500) NOT NULL,
	`content_excerpt` text NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`hashtags` text NOT NULL,
	`trending_hashtags` text,
	`niche` varchar(100),
	`relevance_score` int NOT NULL DEFAULT 0,
	`usage_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hashtag_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trending_hashtags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hashtag` varchar(100) NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`category` varchar(100),
	`trend_score` int NOT NULL DEFAULT 50,
	`region` varchar(10) NOT NULL DEFAULT 'NO',
	`volume` int NOT NULL DEFAULT 0,
	`momentum` varchar(20) NOT NULL DEFAULT 'stable',
	`expires_at` timestamp,
	`active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trending_hashtags_id` PRIMARY KEY(`id`),
	CONSTRAINT `trending_hashtags_hashtag_unique` UNIQUE(`hashtag`)
);
