-- Admin-editable e-mail templates.
--
-- Every e-mail Penna sends was a template literal inside
-- `server/_core/email.ts`. Changing one word of the welcome e-mail meant a code
-- change, a review and a deploy — so in practice the copy never changed.
--
-- Two kinds of row live here:
--
--   `override` — replaces a BUILT-IN e-mail, matched by `template_key` against
--                the registry in `server/services/emailTemplates.ts`. If the row
--                is absent, disabled, or fails to render, the built-in copy in
--                code is used. A broken template must never stop a password
--                reset from going out.
--
--   `custom`   — a template the admin wrote from scratch. `template_key` is NULL
--                for these; a UNIQUE index permits unlimited NULLs in MySQL/TiDB.
--
-- `body_html` is admin-authored and sanitised on write (server/_core/sanitizeHtml)
-- — it is trusted copy, not user input. The VALUES substituted into it at send
-- time are the untrusted part and are HTML-escaped separately. Those are two
-- different trust levels and they are handled in two different places on purpose.
--
-- `mediumtext`, not `text`: `text` holds 65,535 BYTES, and an e-mail body with
-- an image or two crosses that. Under strict mode the insert fails with an opaque
-- ER_DATA_TOO_LONG; without it, half an e-mail is stored and sent.

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  -- Registry key of the built-in this overrides, e.g. 'welcome'. NULL for custom.
  -- UNIQUE, so one built-in cannot end up with two competing overrides.
  `template_key` varchar(64) NULL,
  `name` varchar(200) NOT NULL,
  `subject` varchar(300) NOT NULL,
  `body_html` mediumtext NOT NULL,
  -- The button. Kept out of `body_html` so the shell can style it consistently
  -- and so the href can be validated (http/https only) after substitution.
  `cta_label` varchar(120) NULL,
  `cta_href` varchar(1000) NULL,
  `kind` enum('override','custom') NOT NULL,
  -- An override that is off falls back to the built-in copy, which is how you
  -- undo a bad edit without deleting the draft.
  `enabled` tinyint NOT NULL DEFAULT 1,
  `updated_by_user_id` int NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE now(),
  CONSTRAINT `email_templates_id` PRIMARY KEY(`id`),
  CONSTRAINT `email_templates_template_key_unique` UNIQUE(`template_key`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `email_templates_kind_idx` ON `email_templates` (`kind`);
