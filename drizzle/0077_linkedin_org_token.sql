-- 0077_linkedin_org_token: separate OAuth token for the Company-Page app.
ALTER TABLE `linkedin_connections` ADD COLUMN `org_access_token` text;
--> statement-breakpoint
ALTER TABLE `linkedin_connections` ADD COLUMN `org_token_expires_at` timestamp NULL;
