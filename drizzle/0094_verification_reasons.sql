-- PR #83 — say WHY, and remember when we last checked.
--
-- Verification already graded a post, but only the resulting status was stored.
-- The UI could therefore show "Høy risiko" and nothing else: the user could see
-- that something was wrong but not what, so the only way to clear the flag was to
-- guess which sentence upset it.
--
-- `verification_issues` keeps the actual findings (code + message + the offending
-- snippet) so the reason can be shown and acted on. `verified_at` records which
-- run produced them, so re-checking an old post on open is cheap and idempotent.
--
-- Both are also added to `posts`, because a plan post approved and saved as a
-- draft used to lose its verdict entirely on the way over — a high-risk claim
-- became publishable simply by changing table.

ALTER TABLE `planned_posts` ADD COLUMN `verification_issues` json;
--> statement-breakpoint
ALTER TABLE `planned_posts` ADD COLUMN `verified_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `posts` ADD COLUMN `verification_status` enum('verified','needs_review','unsupported','high_risk');
--> statement-breakpoint
ALTER TABLE `posts` ADD COLUMN `verification_issues` json;
--> statement-breakpoint
ALTER TABLE `posts` ADD COLUMN `verified_at` timestamp NULL;
--> statement-breakpoint
-- Existing rows are deliberately left NULL rather than backfilled to 'verified'.
-- Nothing has actually checked them, and claiming otherwise is how an
-- undocumented customer story from six months ago stays publishable. They are
-- re-checked the first time they are opened.
CREATE INDEX `idx_posts_verification` ON `posts` (`verification_status`);
