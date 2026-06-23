CREATE TABLE `weekly_report_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`email` varchar(255) NOT NULL,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_report_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_report_settings_user_id_unique` UNIQUE(`user_id`)
);
