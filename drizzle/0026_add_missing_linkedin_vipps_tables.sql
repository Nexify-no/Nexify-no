CREATE TABLE `linkedin_app_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` varchar(255) NOT NULL,
	`client_secret` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `linkedin_app_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `linkedin_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`access_token` text NOT NULL,
	`person_urn` varchar(255) NOT NULL,
	`profile_name` varchar(255),
	`profile_email` varchar(320),
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `linkedin_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `linkedin_connections_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `vipps_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` varchar(255) NOT NULL,
	`client_secret` varchar(500) NOT NULL,
	`subscription_key` varchar(255) NOT NULL,
	`merchant_serial_number` varchar(50) NOT NULL,
	`test_mode` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vipps_credentials_id` PRIMARY KEY(`id`)
);
