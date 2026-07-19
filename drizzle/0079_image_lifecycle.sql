ALTER TABLE `posts` ADD `image_status` enum('none','pending','generating','verifying','completed','failed') DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `posts` ADD `image_generation_id` varchar(64);
