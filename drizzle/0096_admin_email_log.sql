-- Admin email sending (PR #86).
--
-- Before this there was NO way to send an email from the admin UI at all. The
-- one control that looked like it could — "Send Notification" in the bulk member
-- actions — was a `// TODO` followed by `toast.success("Notification sent to N
-- members")`. An admin selected 200 people, wrote a message, pressed Confirm and
-- was told it had been delivered. Nothing was sent.
--
-- The log is not optional bookkeeping. Bulk mail is the one admin action whose
-- effect is irreversible and invisible from inside the product: once it leaves
-- SendGrid there is nothing to inspect. One row per RECIPIENT (not per batch), so
-- "did this customer get it, and did it bounce?" is answerable.
--
-- The indexes are declared INSIDE the CREATE TABLE rather than as separate
-- statements, so `IF NOT EXISTS` covers them too. `CREATE INDEX IF NOT EXISTS`
-- is a MariaDB/TiDB extension that mysql:8.0 — which CI runs — rejects.
-- This table was also created by hand in production during the outage, so the
-- migration has to be safe to re-run.

CREATE TABLE IF NOT EXISTS `admin_email_sends` (
  `id` int AUTO_INCREMENT NOT NULL,
  -- Groups the recipients of one send together.
  `batch_id` varchar(36) NOT NULL,
  -- Who sent it. Never NULL: an unattributable bulk email is not acceptable.
  `sent_by_user_id` int NOT NULL,
  -- The recipient's user row, if they still exist. Nullable so the log survives
  -- the account being deleted — the point of an audit trail is that it outlives
  -- the thing it describes.
  `recipient_user_id` int NULL,
  `recipient_email` varchar(320) NOT NULL,
  `subject` varchar(300) NOT NULL,
  -- The exact body that was sent, so "what did we actually say?" has an answer.
  `body_html` text NOT NULL,
  `status` enum('sent','failed','skipped') NOT NULL,
  -- Why a recipient was skipped (opted out) or why the send failed.
  `detail` varchar(500) NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `admin_email_sends_id` PRIMARY KEY(`id`),
  INDEX `admin_email_sends_batch_idx` (`batch_id`),
  INDEX `admin_email_sends_recipient_idx` (`recipient_user_id`),
  INDEX `admin_email_sends_created_idx` (`created_at`)
);
