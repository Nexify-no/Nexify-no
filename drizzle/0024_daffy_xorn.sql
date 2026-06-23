CREATE TABLE `usage_overages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`subscription_id` int NOT NULL,
	`usage_type` varchar(50) NOT NULL,
	`overage_amount` int NOT NULL,
	`charge_per_unit` int NOT NULL,
	`total_charge` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`occurred_at` timestamp NOT NULL,
	`billed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_overages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_usage_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`subscription_id` int NOT NULL,
	`posts_used` int NOT NULL DEFAULT 0,
	`images_used` int NOT NULL DEFAULT 0,
	`period_start_date` timestamp NOT NULL,
	`period_end_date` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_usage_tracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `usage_overages` ADD CONSTRAINT `usage_overages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_overages` ADD CONSTRAINT `usage_overages_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_usage_tracking` ADD CONSTRAINT `user_usage_tracking_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_usage_tracking` ADD CONSTRAINT `user_usage_tracking_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_overage_user_id` ON `usage_overages` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_overage_status` ON `usage_overages` (`status`);--> statement-breakpoint
CREATE INDEX `idx_user_usage_user_id` ON `user_usage_tracking` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_usage_subscription_id` ON `user_usage_tracking` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_user_usage_period` ON `user_usage_tracking` (`period_start_date`,`period_end_date`);