-- Account suspension (PR #86).
--
-- Until now the ONLY way an admin could stop an account was `DELETE FROM users`,
-- which is irreversible and — because 51 tables carry `user_id` with no foreign
-- key — silently orphaned every one of them. There was no column to set, so
-- "suspend" could not exist even as a stub; the Suspend button in the admin UI
-- was a toast that printed success and did nothing.
--
-- `active` is the default so every existing row keeps working untouched.
--
--   active     — normal
--   suspended  — reversible; the user cannot authenticate, their data is intact
--   deleted    — reserved, NOT YET WRITTEN BY ANYTHING. admin.deleteUser is a hard
--                delete. The value exists so a future soft-delete does not need
--                another ALTER on this table; sdk.authenticateRequest already
--                refuses it. Do not read a row's absence as "we soft-delete".
--
-- `suspended_at` / `suspended_reason` exist so the admin who suspends an account
-- has to say why, and so support can answer "when and why was I locked out?"
-- without reading application logs.

ALTER TABLE `users`
  ADD COLUMN `status` enum('active','suspended','deleted') NOT NULL DEFAULT 'active',
  ADD COLUMN `suspended_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `suspended_reason` varchar(500) NULL DEFAULT NULL;

-- Admin lists filter and count on status; without this every /admin/users page
-- load scans the whole table.
CREATE INDEX `users_status_idx` ON `users` (`status`);
