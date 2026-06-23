CREATE TABLE `drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`page_type` enum('generate','repurpose','series','ab_test','engagement') NOT NULL,
	`form_data` text NOT NULL,
	`title` varchar(200),
	`last_saved_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`)
);
