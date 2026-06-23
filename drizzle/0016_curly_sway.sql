ALTER TABLE `posts` ADD `status` enum('draft','scheduled','published','failed') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `scheduled_for` timestamp;--> statement-breakpoint
ALTER TABLE `posts` ADD `published_at` timestamp;