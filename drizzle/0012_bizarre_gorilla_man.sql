CREATE TABLE `ideas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`idea_text` text NOT NULL,
	`source` enum('manual','voice','trend','competitor') NOT NULL DEFAULT 'manual',
	`tags` text,
	`status` enum('new','in_progress','used','archived') NOT NULL DEFAULT 'new',
	`platform` enum('linkedin','twitter','instagram','facebook'),
	`converted_post_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideas_id` PRIMARY KEY(`id`)
);
