ALTER TABLE `user_preferences` ADD `openai_consent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `consent_date` timestamp;