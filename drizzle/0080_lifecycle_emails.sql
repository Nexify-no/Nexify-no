CREATE TABLE `lifecycle_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`email_key` varchar(64) NOT NULL,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lifecycle_emails_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_lifecycle_user_key` UNIQUE(`user_id`,`email_key`)
);
