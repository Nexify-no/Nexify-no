CREATE TABLE `generation_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`tone` varchar(50) NOT NULL,
	`length` enum('short','medium','long') NOT NULL DEFAULT 'medium',
	`keywords` json,
	`target_audience` varchar(280),
	`goal` enum('awareness','engagement','sales','leads','traffic','community'),
	`cta` varchar(280),
	`angle` enum('personal_story','actionable_tips','contrarian_opinion','case_study','shocking_stat','how_to','listicle','question'),
	`emoji_usage` enum('none','minimal','moderate','heavy') NOT NULL DEFAULT 'minimal',
	`hashtag_count` int NOT NULL DEFAULT 3,
	`use_bullets` boolean NOT NULL DEFAULT false,
	`closing_question` boolean NOT NULL DEFAULT true,
	`language` enum('no','en','ar') NOT NULL DEFAULT 'no',
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generation_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `trial_posts_limit` int NOT NULL DEFAULT 2;--> statement-breakpoint
CREATE INDEX `idx_preset_user_id` ON `generation_presets` (`user_id`);