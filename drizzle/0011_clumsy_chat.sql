CREATE TABLE `onboarding_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`completed` tinyint NOT NULL DEFAULT 0,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `onboarding_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `onboarding_status_user_id_unique` UNIQUE(`user_id`)
);
