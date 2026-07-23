-- Merkehjerne M2: user confirmation of the reviewed brand profile.
-- Nullable timestamp, no DEFAULT, no transaction wrapping (TiDB-safe).
ALTER TABLE `brand_profiles` ADD COLUMN `confirmed_at` timestamp NULL;
