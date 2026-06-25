ALTER TABLE `users` ADD `two_factor_secret` varchar(255);
--> statement-breakpoint
ALTER TABLE `users` ADD `two_factor_enabled` tinyint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD `two_factor_backup_codes` text;
