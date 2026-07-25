ALTER TABLE `posts` ADD COLUMN `image_alt_text` varchar(300);
--> statement-breakpoint
ALTER TABLE `posts` ADD COLUMN `image_brand_id` int;
--> statement-breakpoint
ALTER TABLE `posts` ADD COLUMN `image_visual_identity_version` int;
--> statement-breakpoint
ALTER TABLE `planned_posts` ADD COLUMN `image_alt_text` varchar(300);
--> statement-breakpoint
ALTER TABLE `planned_posts` ADD COLUMN `image_brand_id` int;
--> statement-breakpoint
ALTER TABLE `planned_posts` ADD COLUMN `image_visual_identity_version` int;
