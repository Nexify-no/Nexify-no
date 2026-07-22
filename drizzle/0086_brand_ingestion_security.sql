ALTER TABLE `brand_profiles` ADD COLUMN `analysis_id` varchar(36);
--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD COLUMN `content_hash` varchar(64);
--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD COLUMN `source_manifest` json;
--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD COLUMN `injection_warnings` json;
--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD COLUMN `scan_version` int NOT NULL DEFAULT 2;

