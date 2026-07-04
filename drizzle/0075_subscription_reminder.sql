-- 0075_subscription_reminder: track the last periodic "subscription is active"
-- reminder so the scheduler can email each active subscription at least every
-- 6 months (digitalytelsesloven / Forbrukertilsynet). Hand-authored to match the
-- repo's convention (drizzle meta snapshots are stale past 0027).
ALTER TABLE `subscriptions` ADD COLUMN `last_active_reminder_at` timestamp NULL;
