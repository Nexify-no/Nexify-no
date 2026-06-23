ALTER TABLE `subscriptions` ADD `stripe_customer_id` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripe_subscription_id` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripe_price_id` varchar(255);