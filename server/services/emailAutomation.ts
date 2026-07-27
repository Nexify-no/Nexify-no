/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * The automated emails, as data — so the admin can see them and switch them off.
 *
 * Two problems this solves.
 *
 * **1. The weekly ritual could send the same email more than once.**
 *
 * Every other automated email in this product claims a row in `lifecycle_emails`
 * before sending; the unique key on `(user_id, email_key)` means a second attempt
 * loses the race and skips. The Monday-08:00 ritual did not do this — it read a
 * recipient list and sent, with nothing recorded anywhere.
 *
 * That is only safe if exactly one process ever runs the cron. Nothing guarantees
 * that: `startScheduler()`'s guard is a module-level variable, so it protects a
 * single Node process and nothing else. A second instance, a staging service
 * pointed at the same database, or the overlap window of a zero-downtime deploy
 * each produce a complete second copy of the send. Customers received three.
 *
 * `claimAutomationSend` gives the ritual the same protection, keyed by ISO week,
 * so the second and third processes insert-fail and skip. No new table: the
 * unique key that already exists is the lock.
 *
 * **2. There was no way to turn any of them off** short of a redeploy. The
 * `admin_settings` key/value table has existed, unused, since the decorative
 * settings page was built; it is the store.
 *
 * TRANSACTIONAL EMAIL IS NOT LISTED HERE AND CANNOT BE SWITCHED OFF. A password
 * reset, an email verification, a support-ticket reply or a subscription receipt
 * is not marketing — a customer cannot opt out of them and an admin must not be
 * able to disable them by accident.
 */

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { adminSettings, lifecycleEmails, users } from "../../drizzle/schema";

/**
 * The ids, as a tuple — ONE source of truth, so the type, the registry and the
 * tRPC input schema cannot drift apart.
 *
 * `setEmailAutomation` used to repeat this list in its own `z.enum([...])`.
 * Adding an automation left that copy behind, and the switch for the new one was
 * rejected as invalid input by the very endpoint meant to flip it.
 */
export const AUTOMATION_IDS = [
  "weekly_ritual",
  "lifecycle_sequence",
  "linkedin_expiry",
  "subscription_reminder",
] as const;

export type AutomationId = (typeof AUTOMATION_IDS)[number];

export type Automation = {
  id: AutomationId;
  name: string;
  description: string;
  /** Human-readable schedule; the cron expression lives in schedulerService. */
  schedule: string;
  audience: string;
  /**
   * `markedsføring` honours the per-user opt-out; `drift` is operational.
   * `lovpålagt` is required by law — see `alwaysOn`.
   */
  kind: "markedsføring" | "drift" | "lovpålagt";
  /**
   * Listed so an admin can SEE it, but never switchable.
   *
   * There is a real difference between "we choose to send this" and "we are
   * required to send this", and the admin page has to show both or it is lying
   * about what leaves the system. Enforced in `isAutomationEnabled` and
   * `setAutomationEnabled`, not just hidden in the UI.
   */
  alwaysOn?: true;
};

export const AUTOMATIONS: Automation[] = [
  {
    id: "weekly_ritual",
    name: "Ukens innlegg",
    description:
      "«Klar for ukens innlegg?» — påminnelse om å lage ukens innhold.",
    schedule: "Mandager 08:00 (Europe/Oslo)",
    audience:
      "Innlogget siste 60 dager, e-postvarsler på, frekvens ikke «aldri», abonnement ikke avsluttet.",
    kind: "markedsføring",
  },
  {
    id: "lifecycle_sequence",
    name: "Kundereise",
    description:
      "Onboarding og re-engasjement. Maks ett steg per bruker per dag, hvert steg nøyaktig én gang.",
    schedule: "Daglig 10:00 (Europe/Oslo)",
    audience: "Avhenger av hvor langt brukeren har kommet.",
    kind: "markedsføring",
  },
  {
    id: "linkedin_expiry",
    name: "LinkedIn-token utløper",
    description:
      "Varsler før LinkedIn-tilgangen utløper, slik at automatisk publisering ikke stopper stille.",
    schedule: "Daglig 09:00 (Europe/Oslo)",
    audience: "Brukere med en LinkedIn-kobling som snart utløper.",
    kind: "drift",
  },
  {
    // This one was sending unlisted, so /admin/epost showed three automations
    // while four were going out. It is listed now — but NOT switchable, and it
    // does NOT honour the marketing opt-out.
    //
    // digitalytelsesloven requires telling a paying customer, at least every six
    // months, that the subscription is still running and how to cancel. A switch
    // on it would be a switch on a legal obligation, and the opt-out it would
    // have honoured is `notification_settings` — the CONTENT-notification
    // preference (trends, scheduled posts, analytics). Somebody who turned that
    // off to stop post reminders would have stopped the notice telling them they
    // are still being charged. The e-mail also carries no unsubscribe link,
    // because it was never meant to be opt-outable.
    id: "subscription_reminder",
    name: "Abonnementet er aktivt",
    description:
      "Halvårlig påminnelse om at abonnementet løper og hvordan man sier opp. Lovpålagt (digitalytelsesloven) — kan ikke slås av.",
    schedule: "Daglig 10:00 (Europe/Oslo) — maks én per abonnement per 6. måned",
    audience: "Aktive abonnement som ikke er påminnet de siste 182 dagene.",
    kind: "lovpålagt",
    alwaysOn: true,
  },
];

const SETTING_PREFIX = "email_automation.";

/**
 * Is this automation switched on? Defaults to ON — a missing row means nobody has
 * touched it, and an automation that silently stopped because a settings row was
 * absent would be far worse than one that keeps running.
 */
export async function isAutomationEnabled(id: AutomationId): Promise<boolean> {
  // A legally-required notice is not subject to a stored setting. Checked here
  // rather than only at the write, so a row inserted by hand, by an older build,
  // or straight into the database cannot switch it off either.
  if (AUTOMATIONS.find((a) => a.id === id)?.alwaysOn) return true;

  const db = await getDb();
  if (!db) return true;
  try {
    const [row] = await db
      .select({ value: adminSettings.settingValue })
      .from(adminSettings)
      .where(eq(adminSettings.settingKey, SETTING_PREFIX + id))
      .limit(1);
    if (!row) return true;
    return row.value !== "off";
  } catch (error) {
    console.error("[emailAutomation] could not read setting, defaulting to ON:", error);
    return true;
  }
}

export async function setAutomationEnabled(
  id: AutomationId,
  enabled: boolean,
  adminUserId: number
): Promise<void> {
  const automation = AUTOMATIONS.find((a) => a.id === id);
  if (automation?.alwaysOn) {
    throw new Error(
      `${automation.name} er lovpålagt og kan ikke slås av (digitalytelsesloven).`
    );
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const key = SETTING_PREFIX + id;
  const value = enabled ? "on" : "off";

  await db
    .insert(adminSettings)
    .values({
      settingKey: key,
      settingValue: value,
      description: `Automatisk e-post: ${id}`,
      category: "email_automation",
      lastUpdatedBy: adminUserId,
    })
    .onDuplicateKeyUpdate({
      set: { settingValue: value, lastUpdatedBy: adminUserId, updatedAt: new Date() },
    });
}

/** ISO week key, e.g. `2026-W31`. Stable across processes and time zones. */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday of the current ISO week decides the year.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Claim the right to send one automated email to one user, exactly once.
 *
 * Returns false if somebody already claimed it — another instance, an earlier run
 * today, or this same job retrying. The unique key on `(user_id, email_key)` is
 * what makes this atomic; the insert either wins or fails, with no read-then-write
 * window for a second process to slip through.
 */
export async function claimAutomationSend(userId: number, emailKey: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(lifecycleEmails).values({ userId, emailKey });
    return true;
  } catch {
    return false;
  }
}

/** Release a claim whose send then failed, so the next run can retry it. */
export async function releaseAutomationClaim(userId: number, emailKey: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .delete(lifecycleEmails)
      .where(and(eq(lifecycleEmails.userId, userId), eq(lifecycleEmails.emailKey, emailKey)));
  } catch (error) {
    console.error("[emailAutomation] could not release claim", emailKey, error);
  }
}

export type AutomationStatus = Automation & {
  enabled: boolean;
  /** When this automation last sent anything, from the claim log. */
  lastSentAt: Date | null;
  /** How many people it reached in the last 30 days. */
  sentLast30Days: number;
};

/** Everything the admin page needs, in one query per aggregate. */
export async function listAutomations(): Promise<AutomationStatus[]> {
  const db = await getDb();
  if (!db) {
    return AUTOMATIONS.map((a) => ({ ...a, enabled: true, lastSentAt: null, sentLast30Days: 0 }));
  }

  const settings = await db
    .select({ key: adminSettings.settingKey, value: adminSettings.settingValue })
    .from(adminSettings)
    .where(
      inArray(
        adminSettings.settingKey,
        AUTOMATIONS.map((a) => SETTING_PREFIX + a.id)
      )
    );
  const byKey = new Map(settings.map((s) => [s.key, s.value]));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // `email_key` carries the automation as its prefix (weekly_ritual_2026-W31,
  // lifecycle_<step>, linkedin_expiry_<date>), so one grouped scan answers both
  // "when last?" and "how many recently?" for every automation at once.
  const stats = await db
    .select({
      key: lifecycleEmails.emailKey,
      last: sql<Date>`max(${lifecycleEmails.sentAt})`,
      recent: sql<number>`sum(case when ${lifecycleEmails.sentAt} >= ${thirtyDaysAgo} then 1 else 0 end)`,
    })
    .from(lifecycleEmails)
    .groupBy(lifecycleEmails.emailKey);

  return AUTOMATIONS.map((a) => {
    // `lifecycle_sequence` is the catch-all: its keys are `lifecycle_<step>`,
    // which share no single prefix. So it takes everything that is not claimed by
    // a NAMED automation — derived from AUTOMATION_IDS rather than a hand-written
    // "not weekly_ritual and not linkedin_expiry", which silently double-counted
    // every id added after it was written.
    const mine = stats.filter((s) =>
      a.id === "lifecycle_sequence"
        ? !AUTOMATION_IDS.some((id) => id !== "lifecycle_sequence" && s.key.startsWith(id))
        : s.key.startsWith(a.id)
    );
    const lastSentAt = mine.reduce<Date | null>((acc, s) => {
      const d = s.last ? new Date(s.last) : null;
      return d && (!acc || d > acc) ? d : acc;
    }, null);
    return {
      ...a,
      enabled: (byKey.get(SETTING_PREFIX + a.id) ?? "on") !== "off",
      lastSentAt,
      sentLast30Days: mine.reduce((n, s) => n + Number(s.recent ?? 0), 0),
    };
  });
}

/** The most recent automated sends, newest first, with the recipient's email. */
export async function recentAutomationSends(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      emailKey: lifecycleEmails.emailKey,
      sentAt: lifecycleEmails.sentAt,
      userId: lifecycleEmails.userId,
      email: users.email,
      name: users.name,
    })
    .from(lifecycleEmails)
    .leftJoin(users, eq(users.id, lifecycleEmails.userId))
    .orderBy(desc(lifecycleEmails.sentAt))
    .limit(limit);
  return rows;
}

/** How many people one automation reached in a given ISO week. */
export async function weeklyRitualSentThisWeek(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const key = `weekly_ritual_${isoWeekKey(new Date())}`;
  const [row] = (await db
    .select({ n: sql<number>`count(*)` })
    .from(lifecycleEmails)
    .where(eq(lifecycleEmails.emailKey, key))) as Array<{ n: number }>;
  return Number(row?.n ?? 0);
}

/** Sends recorded since a cutoff — used by the admin page's "today" figure. */
export async function automationSendsSince(since: Date): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = (await db
    .select({ n: sql<number>`count(*)` })
    .from(lifecycleEmails)
    .where(gte(lifecycleEmails.sentAt, since))) as Array<{ n: number }>;
  return Number(row?.n ?? 0);
}
