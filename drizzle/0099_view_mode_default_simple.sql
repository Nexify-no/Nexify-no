-- Default new accounts into the simple navigation.
--
-- Why: a first-time user landed in "advanced" and was met with a 24-item
-- sidebar (Telegram Bot, A/B Testing, Konkurrent-Radar, Innholds-Serier ...)
-- before they had generated a single post. The landing page promises "Ingen
-- læringskurve. Bare resultater." — the product's own "Bytt til enkel" button
-- is an admission that the default is too heavy for onboarding.
--
-- Safety: this only changes the DEFAULT applied to rows inserted from now on.
-- No UPDATE is issued, so every existing account keeps exactly the mode it has.
ALTER TABLE `user_preferences` ALTER COLUMN `view_mode` SET DEFAULT 'simple';
--> statement-breakpoint
-- Records that the user picked a mode themselves, as opposed to inheriting the
-- column default. Without this we cannot tell "chose advanced" from "was never
-- asked", which makes any future default change unsafe to reason about.
-- TiDB: extra timestamps must be NULL with no default (only one auto-init
-- CURRENT_TIMESTAMP column is allowed per table).
ALTER TABLE `user_preferences` ADD COLUMN `view_mode_chosen_at` timestamp NULL;
