CREATE TABLE `content_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`workspace_id` int NOT NULL,
	`idempotency_key` varchar(120) NOT NULL,
	`goal` enum('customers','trust','showcase','engagement','offer','mixed') NOT NULL,
	`plan_platform` enum('linkedin','facebook','instagram') NOT NULL,
	`weeks_count` int NOT NULL DEFAULT 4,
	`posts_per_week` int NOT NULL,
	`time_zone` varchar(64) NOT NULL DEFAULT 'Europe/Oslo',
	`brand_snapshot` json,
	`company_profile_version` int NOT NULL DEFAULT 0,
	`visual_identity_version` int NOT NULL DEFAULT 0,
	`total_content_quota` int NOT NULL DEFAULT 0,
	`total_image_quota` int NOT NULL DEFAULT 0,
	`status` enum('queued','processing','ready','partial','failed','cancelled') NOT NULL DEFAULT 'queued',
	`cancel_requested` boolean NOT NULL DEFAULT false,
	`deleted_at` timestamp NULL,
	`lease_token` varchar(36),
	`locked_by` varchar(64),
	`locked_at` timestamp NULL,
	`lock_expires_at` timestamp NULL,
	`attempt_count` int NOT NULL DEFAULT 0,
	`next_attempt_at` timestamp NULL,
	`last_error` varchar(300),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_content_plans_ws_idem` UNIQUE(`workspace_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_content_plans_ws` ON `content_plans` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_content_plans_claim` ON `content_plans` (`status`,`next_attempt_at`,`lock_expires_at`);
--> statement-breakpoint
CREATE TABLE `planned_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content_plan_id` int NOT NULL,
	`user_id` int NOT NULL,
	`workspace_id` int NOT NULL,
	`post_generation_id` varchar(36) NOT NULL,
	`week_number` int NOT NULL,
	`suggested_date` date NOT NULL,
	`planned_platform` enum('linkedin','facebook','instagram') NOT NULL,
	`content_type` varchar(32) NOT NULL,
	`topic` varchar(300),
	`content` text,
	`reason` varchar(300),
	`image_url` text,
	`planned_image_status` enum('none','pending','generating','verifying','completed','failed') NOT NULL DEFAULT 'none',
	`image_generation_id` varchar(64),
	`image_idempotency_key` varchar(80),
	`verification_status` enum('verified','needs_review','unsupported','high_risk') NOT NULL DEFAULT 'needs_review',
	`approval_status` enum('draft','approved','needs_edit') NOT NULL DEFAULT 'draft',
	`generation_status` enum('pending','generating','done','failed') NOT NULL DEFAULT 'pending',
	`content_quota_charged` boolean NOT NULL DEFAULT false,
	`post_lease_token` varchar(36),
	`post_locked_by` varchar(64),
	`post_lock_expires_at` timestamp NULL,
	`post_attempt_count` int NOT NULL DEFAULT 0,
	`post_next_attempt_at` timestamp NULL,
	`post_last_error` varchar(300),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planned_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `planned_posts_post_generation_id_unique` UNIQUE(`post_generation_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_planned_posts_plan` ON `planned_posts` (`content_plan_id`);
--> statement-breakpoint
CREATE INDEX `idx_planned_posts_ws` ON `planned_posts` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_planned_posts_claim` ON `planned_posts` (`content_plan_id`,`generation_status`,`post_next_attempt_at`,`post_lock_expires_at`);
