ALTER TABLE `content_series` ADD `platform` varchar(20) NOT NULL DEFAULT 'linkedin';
--> statement-breakpoint
ALTER TABLE `content_series` ADD `tone` varchar(30) NOT NULL DEFAULT 'professional';
--> statement-breakpoint
ALTER TABLE `content_series` ADD `language` varchar(5) NOT NULL DEFAULT 'no';
--> statement-breakpoint
ALTER TABLE `content_series` ADD `generate_image` tinyint NOT NULL DEFAULT 0;
