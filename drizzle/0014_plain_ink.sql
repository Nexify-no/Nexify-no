CREATE TABLE `telegram_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`telegram_user_id` varchar(64) NOT NULL,
	`telegram_username` varchar(64),
	`telegram_first_name` varchar(100),
	`link_code` varchar(32),
	`link_code_expiry` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`linked_at` timestamp NOT NULL DEFAULT (now()),
	`last_used_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_links_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `telegram_links_telegram_user_id_unique` UNIQUE(`telegram_user_id`),
	CONSTRAINT `telegram_links_link_code_unique` UNIQUE(`link_code`)
);
