CREATE TABLE `brand_social_connections` (
  `id` int AUTO_INCREMENT NOT NULL,
  `account_id` int NOT NULL,
  `brand_id` int,
  `platform` enum('linkedin','facebook','instagram','twitter') NOT NULL,
  `provider_connection_id` int,
  `destination_id` varchar(255),
  `destination_name` varchar(255),
  `destination_type` enum('person','page','organization','account') NOT NULL DEFAULT 'person',
  `status` enum('active','needs_brand_assignment','expired','revoked') NOT NULL DEFAULT 'active',
  `token_expires_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `brand_social_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_bsc_account` ON `brand_social_connections` (`account_id`);
--> statement-breakpoint
CREATE INDEX `idx_bsc_brand_platform` ON `brand_social_connections` (`brand_id`,`platform`);
--> statement-breakpoint
CREATE TABLE `publications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `account_id` int NOT NULL,
  `brand_id` int,
  `post_id` int NOT NULL,
  `connection_id` int,
  `platform` enum('linkedin','facebook','instagram','twitter') NOT NULL,
  `destination_id` varchar(255),
  `destination_name` varchar(255),
  `idempotency_key` varchar(64) NOT NULL,
  `status` enum('pending','published','failed') NOT NULL DEFAULT 'pending',
  `provider_post_id` varchar(255),
  `provider_response` text,
  `error_message` varchar(500),
  `published_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `publications_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_publications_idem` UNIQUE(`account_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_publications_post` ON `publications` (`post_id`);
--> statement-breakpoint
CREATE INDEX `idx_publications_brand` ON `publications` (`brand_id`);
