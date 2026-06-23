CREATE TABLE `saved_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`post_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`platform` enum('linkedin','twitter','instagram','facebook') NOT NULL,
	`tone` varchar(50) NOT NULL,
	`raw_input` text NOT NULL,
	`generated_content` text NOT NULL,
	`usage_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_examples_id` PRIMARY KEY(`id`)
);
