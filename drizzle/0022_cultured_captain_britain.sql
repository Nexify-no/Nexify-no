CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`activity_type` enum('login','logout','edit','delete','view','download','upload') NOT NULL,
	`description` text,
	`ip_address` varchar(45),
	`user_agent` text,
	`resource_type` varchar(50),
	`resource_id` int,
	`success` int NOT NULL DEFAULT 1,
	`error_message` text,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `failed_login_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`ip_address` varchar(45) NOT NULL,
	`user_agent` text,
	`reason` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `failed_login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`alert_type` enum('failed_login','multiple_failed_logins','suspicious_location','unusual_activity','permission_change','mass_deletion','unauthorized_access') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`description` text NOT NULL,
	`ip_address` varchar(45),
	`user_agent` text,
	`failed_attempts` int NOT NULL DEFAULT 1,
	`time_window` int,
	`resolved` int NOT NULL DEFAULT 0,
	`resolved_by` int,
	`resolved_at` timestamp,
	`resolution_notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_alerts_id` PRIMARY KEY(`id`)
);
