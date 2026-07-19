ALTER TABLE `posts` ADD `generation_id` varchar(36);
--> statement-breakpoint
ALTER TABLE `posts` ADD `profile_version` int;
--> statement-breakpoint
ALTER TABLE `voice_profiles` ADD `version` int DEFAULT 1 NOT NULL;
