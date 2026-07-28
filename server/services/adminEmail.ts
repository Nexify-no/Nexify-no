/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Admin-composed email (PR #86).
 *
 * Before this, there was no way for an admin to send an email at all. The only
 * control that looked like one — "Send Notification" in the bulk member actions —
 * was a `// TODO` followed by `toast.success("Notification sent to N members")`.
 *
 * Four rules are enforced here rather than in the router, because they are the
 * ones that stop this feature from becoming a liability:
 *
 *  1. **Refuse when the transport is unconfigured.** `sendEmail` returns `false`
 *     silently without a SendGrid key. Correct for the lifecycle scheduler,
 *     catastrophic for a human pressing Send on 500 customers.
 *  2. **Honour the opt-out.** `notification_settings.emailNotifications` already
 *     exists and is already respected by the weekly ritual mail. A hand-written
 *     broadcast that ignores it is the definition of spam. Opted-out recipients
 *     are recorded as `skipped`, not silently dropped.
 *  3. **Escape the admin's text.** The body is composed in a plain textarea and
 *     dropped into an HTML email. Unescaped, a stray `<` mangles the message and
 *     a pasted `<script>`/`<img onerror=...>` becomes an injection vector against
 *     whoever opens it.
 *  4. **Log one row per recipient, always** — including failures and skips. Once
 *     a message leaves SendGrid there is nothing left inside the product to
 *     inspect.
 */

import { randomUUID } from "crypto";
import { and, eq, inArray, isNotNull, lt, sql as sqlFn } from "drizzle-orm";
import { getDb } from "../db";
import { adminEmailSends, notificationSettings, users } from "../../drizzle/schema";
import { isEmailConfigured, pennaEmailShell, sendEmail } from "../_core/email";

/** Hard ceiling on one send. Above this it is a campaign tool's job, not ours. */
export const MAX_RECIPIENTS_PER_SEND = 500;

export type AdminEmailRecipient = {
  userId: number | null;
  email: string;
  name: string | null;
};

export type AdminEmailResult = {
  batchId: string;
  sent: number;
  failed: number;
  skipped: number;
  /** Per-recipient outcome, for showing the admin what actually happened. */
  details: Array<{ email: string; status: "sent" | "failed" | "skipped"; detail?: string }>;
};

/**
 * Escape text destined for an HTML email body, then turn blank lines into
 * paragraphs so a plainly-typed message still reads like one.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A CTA link that is safe to drop into `href="…"`.
 *
 * `z.string().url()` is not enough on its own: it validates with `new URL()`,
 * which happily accepts `javascript:alert(1)`, and it does not normalise a `"`
 * out of the path — so a crafted value could close the attribute and inject
 * markup into the email body, which is then persisted verbatim to the send log.
 * Only http/https survive, and the result is escaped like everything else.
 */
export function safeCtaHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
  return escapeHtml(parsed.toString());
}

export function renderAdminEmailBody(text: string): string {
  const escaped = escapeHtml(text);

  return escaped
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map(
      (para) =>
        `<p style="font-size:15px; line-height:1.65; margin:0 0 16px;">${para.replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

/** The set of user ids that have explicitly turned email notifications off. */
async function optedOutUserIds(userIds: number[]): Promise<Set<number>> {
  if (userIds.length === 0) return new Set();
  const db = await getDb();
  if (!db) return new Set();

  // Only rows that exist AND say false count as opt-outs. A user with no
  // notification_settings row has never expressed a preference, and the column
  // defaults to true, so absence means "yes".
  const rows = await db
    .select({ userId: notificationSettings.userId })
    .from(notificationSettings)
    .where(
      and(
        inArray(notificationSettings.userId, userIds),
        eq(notificationSettings.emailNotifications, false)
      )
    );
  return new Set(rows.map((r) => r.userId));
}

/**
 * Send one admin-composed message to a list of recipients.
 *
 * `respectOptOut: false` is available for genuinely operational mail (a security
 * notice, a billing failure) — the kind a customer cannot reasonably opt out of.
 * It is not the default, and the caller has to say so explicitly.
 */
export async function sendAdminEmail(opts: {
  sentByUserId: number;
  recipients: AdminEmailRecipient[];
  subject: string;
  /** Plain text, paragraph-wrapped and escaped. Ignored when `bodyHtml` is given. */
  bodyText?: string;
  /**
   * An already-rendered, already-SANITISED body, from a saved template.
   *
   * A template authored in the rich editor has formatting and hosted images; running
   * it through `renderAdminEmailBody` would escape its own markup into visible tags.
   * The caller must have put it through `sanitizeHtml` — `emailTemplates.renderStored`
   * does, on read as well as on write, so a row saved before the allow-list was last
   * tightened is still cleaned on the way out.
   */
  bodyHtml?: string;
  ctaLabel?: string;
  ctaHref?: string;
  respectOptOut?: boolean;
}): Promise<AdminEmailResult> {
  const respectOptOut = opts.respectOptOut !== false;

  if (!isEmailConfigured()) {
    // Refuse loudly. Reporting success for a message that was never handed to a
    // transport is the exact failure this whole change exists to remove.
    throw new Error(
      "E-post er ikke konfigurert (SENDGRID_API_KEY mangler). Ingenting ble sendt."
    );
  }
  if (opts.recipients.length === 0) {
    throw new Error("Ingen mottakere valgt.");
  }
  if (opts.recipients.length > MAX_RECIPIENTS_PER_SEND) {
    throw new Error(
      `For mange mottakere (${opts.recipients.length}). Maks ${MAX_RECIPIENTS_PER_SEND} per utsending.`
    );
  }

  const batchId = randomUUID();

  // The CTA goes into `href="${...}"` and `>${...}<` inside pennaEmailShell with
  // no escaping of its own — that shell was written for server-authored copy and
  // is now being handed operator-typed input. Escape the label and restrict the
  // href to http/https here, or rule 3 above only covers half the message.
  const ctaHref = safeCtaHref(opts.ctaHref);
  const ctaLabel = ctaHref && opts.ctaLabel ? escapeHtml(opts.ctaLabel) : undefined;

  if (!opts.bodyHtml && !opts.bodyText) {
    throw new Error("Ingen meldingstekst.");
  }
  const bodyHtml = pennaEmailShell({
    bodyHtml: opts.bodyHtml ?? renderAdminEmailBody(opts.bodyText ?? ""),
    ctaLabel,
    ctaHref,
  });

  const optedOut = respectOptOut
    ? await optedOutUserIds(opts.recipients.map((r) => r.userId).filter((id): id is number => id != null))
    : new Set<number>();

  const db = await getDb();
  const result: AdminEmailResult = { batchId, sent: 0, failed: 0, skipped: 0, details: [] };

  for (const r of opts.recipients) {
    let status: "sent" | "failed" | "skipped";
    let detail: string | undefined;

    if (!r.email) {
      status = "skipped";
      detail = "Ingen e-postadresse på kontoen";
    } else if (r.userId != null && optedOut.has(r.userId)) {
      status = "skipped";
      detail = "Brukeren har slått av e-postvarsler";
    } else {
      try {
        const ok = await sendEmail(r.email, opts.subject, bodyHtml);
        status = ok ? "sent" : "failed";
        if (!ok) detail = "SendGrid avviste meldingen";
      } catch (error) {
        status = "failed";
        detail = error instanceof Error ? error.message : String(error);
      }
    }

    result[status] += 1;
    result.details.push({ email: r.email || "(mangler)", status, detail });

    // Log every outcome, including skips. A recipient who is missing from the log
    // is indistinguishable from one who was never selected.
    if (db) {
      try {
        await db.insert(adminEmailSends).values({
          batchId,
          sentByUserId: opts.sentByUserId,
          recipientUserId: r.userId,
          recipientEmail: r.email || "",
          subject: opts.subject,
          bodyHtml,
          status,
          detail: detail?.slice(0, 500) ?? null,
        });
      } catch (error) {
        console.error("[adminEmail] failed to write send log:", error);
      }
    }
  }

  return result;
}

/** The WHERE clause behind a segment, shared by the count and the fetch. */
async function segmentWhere(segment: Segment) {
  const { users } = await import("../../drizzle/schema");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  switch (segment) {
    case "all":
      return and(inArray(users.status, ["active", "suspended"]), isNotNull(users.email));
    case "active":
      return and(eq(users.status, "active"), isNotNull(users.email));
    case "suspended":
      return and(eq(users.status, "suspended"), isNotNull(users.email));
    case "admins":
      return and(eq(users.status, "active"), eq(users.role, "admin"), isNotNull(users.email));
    case "inactive_30d":
      return and(
        eq(users.status, "active"),
        lt(users.lastSignedIn, thirtyDaysAgo),
        isNotNull(users.email)
      );
  }
}

export type Segment = "all" | "active" | "suspended" | "admins" | "inactive_30d";

/**
 * How many people a segment reaches — as a COUNT, not by loading them.
 *
 * The preview on the compose screen fires on mount. Resolving the segment to
 * rows just to call `.length` meant opening the page pulled every active user
 * over the wire; at 50 000 customers that is a full table scan and 50 000 rows
 * materialised in JS, to render one number.
 */
export async function countSegment(segment: Segment): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { users } = await import("../../drizzle/schema");
  const [row] = (await db
    .select({ n: sqlFn<number>`count(*)` })
    .from(users)
    .where(await segmentWhere(segment))) as Array<{ n: number }>;
  return Number(row?.n ?? 0);
}

/** Resolve a saved segment to its recipients. */
export async function resolveSegment(
  segment: Segment
): Promise<AdminEmailRecipient[]> {
  const db = await getDb();
  if (!db) return [];
  const { users } = await import("../../drizzle/schema");

  // Bounded. `sendAdminEmail` refuses above MAX_RECIPIENTS_PER_SEND anyway, so
  // fetching more than that only ever produced a slower error.
  const rows = await db
    .select({ userId: users.id, email: users.email, name: users.name })
    .from(users)
    .where(await segmentWhere(segment))
    .limit(MAX_RECIPIENTS_PER_SEND + 1);

  return rows
    .filter((r) => Boolean(r.email))
    .map((r) => ({ userId: r.userId, email: r.email as string, name: r.name }));
}
