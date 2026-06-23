CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`description` text,
	`vipps_order_id` varchar(255),
	`invoice_date` timestamp NOT NULL DEFAULT (now()),
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `usage_preferences` text;