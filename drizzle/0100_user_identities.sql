-- One account per email, across every sign-in method.
--
-- `users.openId` is unique but `users.email` is not, and the OAuth callbacks
-- upserted on openId alone. Signing up with a password and then clicking
-- "Logg inn med Google" therefore created a SECOND account on the same address
-- (seen in production: three rows on nexifyhub.no@gmail.com). The person lands
-- in an empty account — no posts, no Merkehjerne, and no subscription, while
-- billing continues against the orphaned row.
--
-- This table records which provider identities belong to which account, so a
-- returning user is routed by identity first and by (verified) email second.
-- `users.openId` stays the session key; nothing about session handling changes.
CREATE TABLE IF NOT EXISTS `user_identities` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `provider` varchar(32) NOT NULL,
  -- Stable id from the provider (Google/LinkedIn/Vipps `sub`).
  `subject` varchar(255) NOT NULL,
  -- Address as the provider reported it at link time. Diagnostics only —
  -- never used for authorization; `users.email` remains the source of truth.
  `email_at_link` varchar(320),
  -- Did the provider assert the address was verified when we linked?
  `email_verified_at_link` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `user_identities_id` PRIMARY KEY(`id`),
  -- One provider identity can belong to exactly one account. This is the
  -- constraint that makes duplicate creation impossible rather than merely
  -- unlikely: a race between two concurrent callbacks loses on insert.
  CONSTRAINT `uq_user_identities_provider_subject` UNIQUE(`provider`,`subject`)
);
--> statement-breakpoint
CREATE INDEX `idx_user_identities_user_id` ON `user_identities` (`user_id`);
--> statement-breakpoint
-- Email lookups now happen on every OAuth callback, so index the column.
-- NOT unique yet: production still holds the three duplicate rows described
-- above, and a UNIQUE index would fail this migration and block the deploy.
-- Add the unique constraint in a follow-up migration once those rows are gone
-- (they own posts and subscriptions, so removing them is a human decision).
CREATE INDEX `idx_users_email` ON `users` (`email`);
