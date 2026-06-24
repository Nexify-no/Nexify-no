ALTER TABLE `post_analytics` ADD `platform_post_id` varchar(255);
ALTER TABLE `post_analytics` ADD `metrics_fetched_at` timestamp null default null;
