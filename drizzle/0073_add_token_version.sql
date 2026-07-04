-- 0073_add_token_version: session-revocation counter on users.
-- Every issued session JWT carries this value (claim `tv`); bumping it
-- (logout / password reset) invalidates all of a user's existing sessions.
ALTER TABLE `users` ADD COLUMN `token_version` int NOT NULL DEFAULT 0;
