CREATE TABLE `stripe_payment_intents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`stripe_payment_intent_id` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`status` enum('requires_payment_method','requires_confirmation','requires_action','processing','requires_capture','canceled','succeeded') NOT NULL,
	`plan_id` int,
	`subscription_id` int,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_payment_intents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_payment_intents_stripe_payment_intent_id_unique` UNIQUE(`stripe_payment_intent_id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`subscription_id` int,
	`plan_id` int NOT NULL,
	`action` enum('created','upgraded','downgraded','renewed','cancelled','resumed') NOT NULL,
	`previous_plan_id` int,
	`reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`price_monthly` int,
	`price_yearly` int,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`posts_per_month` int,
	`images_per_month` int,
	`can_use_dalle` int NOT NULL DEFAULT 0,
	`can_use_voice_training` int NOT NULL DEFAULT 0,
	`can_use_content_calendar` int NOT NULL DEFAULT 0,
	`can_use_competitor_radar` int NOT NULL DEFAULT 0,
	`can_use_weekly_reports` int NOT NULL DEFAULT 0,
	`stripe_price_id_monthly` varchar(255),
	`stripe_price_id_yearly` varchar(255),
	`stripe_product_id` varchar(255),
	`vipps_price_id_monthly` varchar(255),
	`vipps_price_id_yearly` varchar(255),
	`is_active` int NOT NULL DEFAULT 1,
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
