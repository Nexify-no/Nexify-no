-- PR #79 — Brand ownership hardening (P0).
--
-- Problem: content-bearing rows either had no owner at all (`ideas`, `drafts`)
-- or were read back with `OR brand_id IS NULL`, which made every unowned legacy
-- row visible inside EVERY brand. Selecting Penna showed Ballong's words.
--
-- This migration does two things and nothing else:
--   1. Gives `ideas` and `drafts` a `brand_id`, like every other content table.
--   2. Adopts legacy NULL rows ONLY for accounts that own exactly one active
--      brand — there the answer is unambiguous. Accounts with several brands
--      keep NULL on purpose: those rows surface under "Uklassifisert" so the
--      user assigns them. We never guess an owner.
--
-- `brand_profiles` is deliberately NOT backfilled here. It carries
-- UNIQUE(user_id, brand_id) since 0089, so adoption must pick exactly one row
-- per user into a free slot — that logic already lives, guarded, in
-- server/services/brands.ts (ensureDefaultBrand).

ALTER TABLE `ideas` ADD COLUMN `brand_id` int;
--> statement-breakpoint
ALTER TABLE `drafts` ADD COLUMN `brand_id` int;
--> statement-breakpoint
CREATE INDEX `idx_ideas_brand` ON `ideas` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `idx_drafts_brand` ON `drafts` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `idx_planned_posts_brand` ON `planned_posts` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `idx_content_schedule_brand` ON `content_schedule` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `idx_linkedin_connections_brand` ON `linkedin_connections` (`brand_id`);
--> statement-breakpoint
-- Single-brand accounts only: HAVING COUNT(*) = 1 is the whole safety argument.
-- An account with two brands matches no row here, so its NULLs stay NULL.
UPDATE `ideas` t
JOIN (
  SELECT `account_id`, MIN(`id`) AS `brand_id`
  FROM `brands`
  WHERE `brand_status` = 'active'
  GROUP BY `account_id`
  HAVING COUNT(*) = 1
) b ON b.`account_id` = t.`user_id`
SET t.`brand_id` = b.`brand_id`
WHERE t.`brand_id` IS NULL;
--> statement-breakpoint
UPDATE `drafts` t
JOIN (
  SELECT `account_id`, MIN(`id`) AS `brand_id`
  FROM `brands`
  WHERE `brand_status` = 'active'
  GROUP BY `account_id`
  HAVING COUNT(*) = 1
) b ON b.`account_id` = t.`user_id`
SET t.`brand_id` = b.`brand_id`
WHERE t.`brand_id` IS NULL;
--> statement-breakpoint
UPDATE `posts` t
JOIN (
  SELECT `account_id`, MIN(`id`) AS `brand_id`
  FROM `brands`
  WHERE `brand_status` = 'active'
  GROUP BY `account_id`
  HAVING COUNT(*) = 1
) b ON b.`account_id` = t.`user_id`
SET t.`brand_id` = b.`brand_id`
WHERE t.`brand_id` IS NULL;
--> statement-breakpoint
UPDATE `scheduled_posts` t
JOIN (
  SELECT `account_id`, MIN(`id`) AS `brand_id`
  FROM `brands`
  WHERE `brand_status` = 'active'
  GROUP BY `account_id`
  HAVING COUNT(*) = 1
) b ON b.`account_id` = t.`user_id`
SET t.`brand_id` = b.`brand_id`
WHERE t.`brand_id` IS NULL;
--> statement-breakpoint
UPDATE `content_plans` t
JOIN (
  SELECT `account_id`, MIN(`id`) AS `brand_id`
  FROM `brands`
  WHERE `brand_status` = 'active'
  GROUP BY `account_id`
  HAVING COUNT(*) = 1
) b ON b.`account_id` = t.`user_id`
SET t.`brand_id` = b.`brand_id`
WHERE t.`brand_id` IS NULL;
--> statement-breakpoint
UPDATE `planned_posts` t
JOIN (
  SELECT `account_id`, MIN(`id`) AS `brand_id`
  FROM `brands`
  WHERE `brand_status` = 'active'
  GROUP BY `account_id`
  HAVING COUNT(*) = 1
) b ON b.`account_id` = t.`user_id`
SET t.`brand_id` = b.`brand_id`
WHERE t.`brand_id` IS NULL;
--> statement-breakpoint
UPDATE `content_schedule` t
JOIN (
  SELECT `account_id`, MIN(`id`) AS `brand_id`
  FROM `brands`
  WHERE `brand_status` = 'active'
  GROUP BY `account_id`
  HAVING COUNT(*) = 1
) b ON b.`account_id` = t.`user_id`
SET t.`brand_id` = b.`brand_id`
WHERE t.`brand_id` IS NULL;
