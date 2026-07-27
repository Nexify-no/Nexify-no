/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * The weekly ritual sent the same email to the same customer three times.
 *
 * Cause: it was the ONLY automated email with no claim record. Every other one
 * inserts into `lifecycle_emails` first, and the unique key on
 * `(user_id, email_key)` makes the second attempt lose. This job read a recipient
 * list and sent, which is safe only if exactly one process ever runs the cron —
 * and nothing guarantees that.
 *
 * These tests pin the week key (the thing that makes the claim idempotent) and
 * the claim/release behaviour.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./testing/fakeDb";
import { mkCtx } from "./testing/ctx";

let fake: FakeDb;

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: async () => fake.db,
}));

describe("isoWeekKey", () => {
  it("gives the same key for every day of one ISO week", async () => {
    const { isoWeekKey } = await import("./services/emailAutomation");
    // Mon 27 Jul 2026 → Sun 2 Aug 2026 is one ISO week.
    const week = new Date(Date.UTC(2026, 6, 27));
    const keys = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(week);
      d.setUTCDate(d.getUTCDate() + i);
      keys.add(isoWeekKey(d));
    }
    expect(keys.size).toBe(1);
  });

  it("changes on the next Monday", async () => {
    const { isoWeekKey } = await import("./services/emailAutomation");
    const monday = new Date(Date.UTC(2026, 6, 27));
    const nextMonday = new Date(Date.UTC(2026, 7, 3));
    expect(isoWeekKey(monday)).not.toBe(isoWeekKey(nextMonday));
  });

  it("keeps a year-boundary week together", async () => {
    const { isoWeekKey } = await import("./services/emailAutomation");
    // 31 Dec 2025 (Wed) and 1 Jan 2026 (Thu) are the same ISO week.
    expect(isoWeekKey(new Date(Date.UTC(2025, 11, 31)))).toBe(
      isoWeekKey(new Date(Date.UTC(2026, 0, 1)))
    );
  });

  it("is zero-padded so keys sort and compare as text", async () => {
    const { isoWeekKey } = await import("./services/emailAutomation");
    expect(isoWeekKey(new Date(Date.UTC(2026, 0, 8)))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("claimAutomationSend", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("claims by inserting, so a second process loses the race", async () => {
    const { claimAutomationSend } = await import("./services/emailAutomation");
    const ok = await claimAutomationSend(7, "weekly_ritual_2026-W31");
    expect(ok).toBe(true);

    const insert = fake.onlyOp("insert", "lifecycle_emails");
    const v = insert.values as Record<string, unknown>;
    expect(v.userId).toBe(7);
    expect(v.emailKey).toBe("weekly_ritual_2026-W31");
  });

  it("returns false when the insert fails — that IS the duplicate check", async () => {
    // The unique key on (user_id, email_key) is the lock. There is no
    // read-then-write window for a second instance to slip through.
    fake = createFakeDb({ failOn: { lifecycle_emails: new Error("Duplicate entry") } });
    const { claimAutomationSend } = await import("./services/emailAutomation");
    expect(await claimAutomationSend(7, "weekly_ritual_2026-W31")).toBe(false);
  });

  it("releases a claim so a failed send can be retried", async () => {
    // Without this, one SendGrid hiccup would silently skip that customer for the
    // whole week — the claim would sit there recording a send that never happened.
    const { releaseAutomationClaim } = await import("./services/emailAutomation");
    await releaseAutomationClaim(7, "weekly_ritual_2026-W31");
    expect(fake.opsOf("delete", "lifecycle_emails")).toHaveLength(1);
  });
});

describe("automation switches", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("defaults to ON when no setting row exists", async () => {
    // A missing row means nobody has touched it. An automation that stopped
    // because a settings row was absent would be worse than one that keeps going.
    const { isAutomationEnabled } = await import("./services/emailAutomation");
    expect(await isAutomationEnabled("weekly_ritual")).toBe(true);
  });

  it("is off only when the stored value says off", async () => {
    const { isAutomationEnabled } = await import("./services/emailAutomation");
    fake = createFakeDb({ rows: { admin_settings: [{ value: "off" }] } });
    expect(await isAutomationEnabled("weekly_ritual")).toBe(false);

    fake = createFakeDb({ rows: { admin_settings: [{ value: "on" }] } });
    expect(await isAutomationEnabled("weekly_ritual")).toBe(true);
  });

  it("stays ON if the settings read throws", async () => {
    fake = createFakeDb({ failOn: { admin_settings: new Error("table missing") } });
    const { isAutomationEnabled } = await import("./services/emailAutomation");
    expect(await isAutomationEnabled("weekly_ritual")).toBe(true);
  });

  it("records who flipped the switch", async () => {
    const { setAutomationEnabled } = await import("./services/emailAutomation");
    await setAutomationEnabled("weekly_ritual", false, 42);

    const v = fake.onlyOp("insert", "admin_settings").values as Record<string, unknown>;
    expect(v.settingKey).toBe("email_automation.weekly_ritual");
    expect(v.settingValue).toBe("off");
    expect(v.lastUpdatedBy).toBe(42);
  });
});

describe("the automation list is admin-only", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("rejects an ordinary user", async () => {
    const { appRouter } = await import("./routers");
    const c = appRouter.createCaller(mkCtx(9));
    await expect(c.admin.listEmailAutomations()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      c.admin.setEmailAutomation({ id: "weekly_ritual", enabled: false })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never lists a transactional email as switchable", async () => {
    // Password resets, verification links, receipts and support replies must not
    // appear here — a customer cannot opt out of them, and an admin must not be
    // able to disable them by accident.
    const { AUTOMATIONS } = await import("./services/emailAutomation");
    const ids = AUTOMATIONS.map((a) => a.id);
    for (const forbidden of [
      "welcome",
      "verification",
      "password_reset",
      "support_reply",
      "subscription_confirmation",
    ]) {
      expect(ids).not.toContain(forbidden);
    }
    // And each one that IS listed says when it runs and who it reaches.
    for (const a of AUTOMATIONS) {
      expect(a.schedule.length).toBeGreaterThan(0);
      expect(a.audience.length).toBeGreaterThan(0);
    }
  });
});


/**
 * The half-yearly "your subscription is active" e-mail.
 *
 * It was sending unlisted: /admin/epost showed three automations while four were
 * going out. Listing it is right. The first attempt at listing it was NOT — it
 * gave the mail a marketing classification, an admin switch, and a
 * `notification_settings` opt-out gate. digitalytelsesloven requires this notice
 * at least every six months, and the preference it would have honoured is the
 * CONTENT-notification setting: somebody who turned that off to stop post
 * reminders would have stopped the notice telling them they are still being
 * charged. It carries no unsubscribe link, because it was never opt-outable.
 *
 * So: visible, and un-switchable. These tests pin both halves.
 */
describe("the statutory subscription reminder", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("is listed, so an admin can see that it exists", async () => {
    const { AUTOMATIONS } = await import("./services/emailAutomation");
    const sub = AUTOMATIONS.find((a) => a.id === "subscription_reminder");
    expect(sub).toBeDefined();
    expect(sub!.kind).toBe("lovpålagt");
    expect(sub!.alwaysOn).toBe(true);
  });

  it("cannot be switched off, whatever the stored setting says", async () => {
    // Not just hidden in the UI: a row written by an older build, by hand, or
    // straight into the database must not silence a legal obligation either.
    fake = createFakeDb({ rows: { admin_settings: [{ value: "off" }] } });
    const { isAutomationEnabled } = await import("./services/emailAutomation");
    expect(await isAutomationEnabled("subscription_reminder")).toBe(true);
    // Control: a switchable one does obey the same stored row.
    expect(await isAutomationEnabled("weekly_ritual")).toBe(false);
  });

  it("refuses the write, rather than accepting it and ignoring it", async () => {
    const { setAutomationEnabled } = await import("./services/emailAutomation");
    await expect(setAutomationEnabled("subscription_reminder", false, 1)).rejects.toThrow(
      /lovpålagt/i
    );
    expect(fake.opsOf("insert", "admin_settings")).toHaveLength(0);
  });

  it("an admin turning it off gets an error, not a silent no-op", async () => {
    const { appRouter } = await import("./routers");
    const admin = appRouter.createCaller(mkCtx(1, { role: "admin" }));
    await expect(
      admin.admin.setEmailAutomation({ id: "subscription_reminder", enabled: false })
    ).rejects.toThrow(/lovpålagt/i);
  });

  it("the tRPC input accepts every id the page renders a switch for", async () => {
    // With an ADMIN context, so the FORBIDDEN middleware cannot short-circuit
    // before the input is parsed — which is what made an earlier version of this
    // test pass against a deliberately stale z.enum.
    const { AUTOMATIONS } = await import("./services/emailAutomation");
    const { appRouter } = await import("./routers");
    const admin = appRouter.createCaller(mkCtx(1, { role: "admin" }));
    for (const a of AUTOMATIONS.filter((x) => !x.alwaysOn)) {
      await expect(
        admin.admin.setEmailAutomation({ id: a.id, enabled: true })
      ).resolves.toBeDefined();
    }
    await expect(
      // @ts-expect-error — an id outside the registry must be rejected as input.
      admin.admin.setEmailAutomation({ id: "not_an_automation", enabled: true })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("the registry and the id list cannot drift apart", async () => {
    const { AUTOMATIONS, AUTOMATION_IDS } = await import("./services/emailAutomation");
    expect([...AUTOMATION_IDS].sort()).toEqual(AUTOMATIONS.map((a) => a.id).sort());
  });

  it("does not double-count its sends into the Kundereise bucket", async () => {
    // `lifecycle_sequence` is the catch-all — its keys are `lifecycle_<step>`,
    // with no shared prefix — so it takes whatever no NAMED automation claims.
    // That test used to be hand-written as "not weekly_ritual and not
    // linkedin_expiry", which counted every later id twice.
    fake = createFakeDb({
      rows: {
        lifecycle_emails: [
          { key: "subscription_reminder_2026-07", last: new Date(), recent: 5 },
          { key: "lifecycle_welcome", last: new Date(), recent: 3 },
        ],
      },
    });
    const { listAutomations } = await import("./services/emailAutomation");
    const list = await listAutomations();
    const byId = new Map(list.map((a) => [a.id, a]));
    expect(byId.get("subscription_reminder")!.sentLast30Days).toBe(5);
    expect(byId.get("lifecycle_sequence")!.sentLast30Days).toBe(3);
  });
});
