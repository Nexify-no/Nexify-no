-- 0076_linkedin_org_publish: allow publishing to a LinkedIn Company Page.
-- One column per statement (TiDB rejects multi-statement migrations).
ALTER TABLE `linkedin_connections` ADD COLUMN `publish_target` varchar(16) DEFAULT 'person';
--> statement-breakpoint
ALTER TABLE `linkedin_connections` ADD COLUMN `organization_urn` varchar(255);
--> statement-breakpoint
ALTER TABLE `linkedin_connections` ADD COLUMN `organization_name` varchar(255);
