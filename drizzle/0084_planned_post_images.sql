ALTER TABLE `planned_posts` ADD `image_quota_charged` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `planned_posts` MODIFY COLUMN `planned_image_status` enum('none','pending','generating','verifying','completed','failed','skipped') NOT NULL DEFAULT 'none';
