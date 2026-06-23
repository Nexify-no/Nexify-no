CREATE TABLE `trending_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL,
	`source` varchar(100),
	`source_url` varchar(500),
	`trend_score` int NOT NULL DEFAULT 50,
	`region` varchar(10) NOT NULL DEFAULT 'NO',
	`suggested_platforms` text,
	`expires_at` timestamp,
	`active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trending_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_interests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`industry` varchar(100),
	`topics` text,
	`platforms` text,
	`content_types` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_interests_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_interests_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `voice_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`tone_profile` text,
	`vocabulary_level` varchar(50),
	`sentence_style` varchar(50),
	`favorite_words` text,
	`avoid_words` text,
	`signature_phrases` text,
	`uses_emojis` int NOT NULL DEFAULT 0,
	`uses_hashtags` int NOT NULL DEFAULT 0,
	`uses_questions` int NOT NULL DEFAULT 0,
	`uses_bullet_points` int NOT NULL DEFAULT 0,
	`samples_count` int NOT NULL DEFAULT 0,
	`training_status` enum('not_started','in_progress','trained','needs_update') NOT NULL DEFAULT 'not_started',
	`last_trained_at` timestamp,
	`profile_summary` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voice_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `voice_profiles_user_id_unique` UNIQUE(`user_id`)
);
