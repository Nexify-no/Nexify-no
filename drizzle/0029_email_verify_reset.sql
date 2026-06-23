ALTER TABLE `users` ADD `emailVerified` timestamp;--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(32) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_tokens_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_auth_tokens_hash` ON `auth_tokens` (`tokenHash`);