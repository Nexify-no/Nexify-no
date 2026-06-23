CREATE TABLE `payment_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` varchar(255) NOT NULL,
	`user_id` int NOT NULL,
	`plan_id` int,
	`expected_amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`status` enum('pending','captured','failed','cancelled') NOT NULL DEFAULT 'pending',
	`provider` varchar(16) NOT NULL DEFAULT 'vipps',
	`transaction_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_orders_order_id_unique` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `processed_webhook_events` (
	`event_id` varchar(255) NOT NULL,
	`source` varchar(32) NOT NULL,
	`processed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processed_webhook_events_event_id` PRIMARY KEY(`event_id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `plan_id` int;