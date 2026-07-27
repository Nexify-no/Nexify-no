/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Regression tests for the admin surface (PR #86).
 *
 * Each block below corresponds to something that was either a security hole, a
 * data-destroying bug, or a control that reported success without doing anything.
 * They are written so that reverting the fix fails the test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./testing/fakeDb";
import { mkCtx } from "./testing/ctx";

let fake: FakeDb;

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: async () => fake.db,
}));

const admin = (id = 1) => mkCtx(id, { role: "admin" as const });

async function caller(ctx: ReturnType<typeof mkCtx>) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(ctx);
}

// ───────────────────────── security gating ─────────────────────────

describe("admin-only procedures reject ordinary users", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("scheduler.triggerNow is admin-only", async () => {
    // It was `protectedProcedure`. processScheduledPostsInner is not scoped to the
    // caller: it runs a global UPDATE over scheduledPosts and then publishes every
    // due row to ITS OWN owner's LinkedIn. Any signed-in user could drive the
    // publish pipeline for every other tenant on demand.
    const c = await caller(mkCtx(9)); // role: "user"
    await expect(c.scheduler.triggerNow()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin.updateUser, setUserStatus and deleteUser are admin-only", async () => {
    const c = await caller(mkCtx(9));
    await expect(c.admin.updateUser({ userId: 2, role: "admin" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(c.admin.setUserStatus({ userId: 2, status: "suspended" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      c.admin.deleteUser({ userId: 2, confirmEmail: "x@y.no" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin email procedures are admin-only", async () => {
    const c = await caller(mkCtx(9));
    await expect(
      c.admin.sendEmail({ segment: "all", subject: "s", body: "b", respectOptOut: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.admin.emailHistory({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ───────────────────────── lockout guards ─────────────────────────

describe("admin.updateUser cannot lock the admin out", () => {
  it("refuses to remove your own admin access", async () => {
    // With the dialog bug that fired this mutation with role:"user" on whoever was
    // open, this was two clicks away from an unrecoverable lockout.
    fake = createFakeDb({ rows: { users: [{ id: 1, role: "admin" }] } });
    const c = await caller(admin(1));
    await expect(c.admin.updateUser({ userId: 1, role: "user" })).rejects.toThrow(
      /din egen administratortilgang/
    );
    expect(fake.opsOf("update", "users")).toHaveLength(0);
  });

  it("refuses to demote the last remaining admin", async () => {
    // The lookup and the COUNT both read `users`, and the fake answers both from
    // the same row — so row[0] is the target AND carries the count as `n`.
    fake = createFakeDb({ rows: { users: [{ id: 2, role: "admin", n: 1 }] } });
    const c = await caller(admin(1));
    await expect(c.admin.updateUser({ userId: 2, role: "user" })).rejects.toThrow(
      /siste administratoren/
    );
    expect(fake.opsOf("update", "users")).toHaveLength(0);
  });

  it("allows a demotion when another admin remains", async () => {
    fake = createFakeDb({ rows: { users: [{ id: 2, role: "admin", n: 3 }] } });
    const c = await caller(admin(1));
    await expect(c.admin.updateUser({ userId: 2, role: "user" })).resolves.toEqual({
      success: true,
    });
    expect(fake.opsOf("update", "users")).toHaveLength(1);
  });

  it("writes the name it was given, which the old procedure silently discarded", async () => {
    fake = createFakeDb({ rows: { users: [{ id: 2, role: "user", n: 3 }] } });
    const c = await caller(admin(1));
    await c.admin.updateUser({ userId: 2, name: "Ola Nordmann" });

    const set = fake.onlyOp("update", "users").set as Record<string, unknown>;
    expect(set.name).toBe("Ola Nordmann");
  });

  it("never writes an email, even when one is smuggled in", async () => {
    // Deliberate: email/password login resolves the account BY EMAIL, so an
    // unverified admin-side edit would be an account-takeover primitive.
    //
    // Asserting only that the call REJECTS would be vacuous — zod strips the
    // unknown key and the empty-patch guard fires, so the test would pass against
    // an implementation that happily wrote the email alongside a name. Send a
    // valid name too, so the mutation succeeds, and check the UPDATE payload.
    fake = createFakeDb({ rows: { users: [{ id: 2, role: "user", n: 3 }] } });
    const c = await caller(admin(1));
    await c.admin.updateUser({ userId: 2, name: "Kari", email: "new@x.no" } as never);

    const set = fake.onlyOp("update", "users").set as Record<string, unknown>;
    expect(set.name).toBe("Kari");
    expect("email" in set).toBe(false);
  });
});

describe("admin.setUserStatus", () => {
  it("refuses to suspend yourself", async () => {
    fake = createFakeDb({ rows: { users: [{ id: 1, role: "admin", n: 5 }] } });
    const c = await caller(admin(1));
    await expect(c.admin.setUserStatus({ userId: 1, status: "suspended" })).rejects.toThrow(
      /din egen konto/
    );
  });

  it("refuses to suspend the last active admin", async () => {
    // Suspending an admin removes an admin just as surely as demoting one.
    fake = createFakeDb({ rows: { users: [{ id: 2, role: "admin", n: 1 }] } });
    const c = await caller(admin(1));
    await expect(c.admin.setUserStatus({ userId: 2, status: "suspended" })).rejects.toThrow(
      /siste aktive administratoren/
    );
    expect(fake.opsOf("update", "users")).toHaveLength(0);
  });

  it("records when and why on suspend, and clears both on reactivate", async () => {
    fake = createFakeDb({ rows: { users: [{ id: 2, role: "user", n: 3 }] } });
    let c = await caller(admin(1));
    await c.admin.setUserStatus({ userId: 2, status: "suspended", reason: "Misbruk" });
    let set = fake.onlyOp("update", "users").set as Record<string, unknown>;
    expect(set.status).toBe("suspended");
    expect(set.suspendedReason).toBe("Misbruk");
    expect(set.suspendedAt).toBeInstanceOf(Date);

    fake = createFakeDb({ rows: { users: [{ id: 2, role: "user", n: 3 }] } });
    c = await caller(admin(1));
    await c.admin.setUserStatus({ userId: 2, status: "active" });
    set = fake.onlyOp("update", "users").set as Record<string, unknown>;
    expect(set.status).toBe("active");
    expect(set.suspendedAt).toBeNull();
    expect(set.suspendedReason).toBeNull();
  });
});

describe("admin.deleteUser", () => {
  it("refuses unless the typed email matches the account", async () => {
    fake = createFakeDb({ rows: { users: [{ id: 2, email: "real@x.no", role: "user" }] } });
    const c = await caller(admin(1));
    await expect(
      c.admin.deleteUser({ userId: 2, confirmEmail: "typo@x.no" })
    ).rejects.toThrow(/stemmer ikke/);
    expect(fake.opsOf("delete")).toHaveLength(0);
  });

  it("refuses to delete your own account", async () => {
    fake = createFakeDb({ rows: { users: [{ id: 1, email: "me@x.no", role: "admin" }] } });
    const c = await caller(admin(1));
    await expect(c.admin.deleteUser({ userId: 1, confirmEmail: "me@x.no" })).rejects.toThrow(
      /din egen konto/
    );
  });

  it("purges every table that carries a user_id BEFORE removing the user row", async () => {
    // The old implementation was one line: DELETE FROM users. The schema declares
    // 78 tables and 4 foreign keys, so that left dozens of tables pointing at a
    // user id that no longer existed.
    fake = createFakeDb({ rows: { users: [{ id: 2, email: "gone@x.no", role: "user", n: 3 }] } });
    const c = await caller(admin(1));
    const res = await c.admin.deleteUser({ userId: 2, confirmEmail: "gone@x.no" });

    // Many tables, not one.
    expect(res.purgedTables).toBeGreaterThan(20);

    const deletes = fake.opsOf("delete");
    const tables = deletes.map((d) => d.table);
    expect(tables).toContain("posts");
    expect(tables).toContain("ideas");

    // The user row goes LAST: if a child delete fails, the account still exists
    // and the operation can be retried instead of leaving orphans behind.
    expect(tables[tables.length - 1]).toBe("users");
  });

  it("rolls the whole cascade back when one child table fails", async () => {
    // The first version of this fix issued 54 independent DELETEs and, on a
    // failure partway through, reported "the account is NOT deleted" — true, but
    // by then thirty tables of the customer's content were already gone with no
    // way back. It is one transaction now: all of it, or none of it.
    fake = createFakeDb({
      rows: { users: [{ id: 2, email: "gone@x.no", role: "user", n: 3 }] },
      failOn: { posts: new Error("deadlock") },
    });
    const c = await caller(admin(1));
    await expect(
      c.admin.deleteUser({ userId: 2, confirmEmail: "gone@x.no" })
    ).rejects.toThrow(/rullet tilbake/);
    expect(fake.opsOf("delete", "users")).toHaveLength(0);
  });

  it("leaves accounting records and other people's data alone", async () => {
    // "Has a user_id" is not "belongs to this user". Two classes must survive:
    // rows where user_id is someone ELSE (a support reply written by an admin,
    // sitting in another customer's ticket; a security alert ABOUT this account),
    // and records with a statutory retention period — Norwegian bokføringsloven
    // requires accounting material be kept for five years.
    fake = createFakeDb({ rows: { users: [{ id: 2, email: "gone@x.no", role: "user", n: 3 }] } });
    const c = await caller(admin(1));
    const res = await c.admin.deleteUser({ userId: 2, confirmEmail: "gone@x.no" });

    const deleted = fake.opsOf("delete").map((d) => d.table);
    for (const kept of [
      "invoices",
      "payment_orders",
      "stripe_payment_intents",
      "subscription_history",
      "support_ticket_replies",
      "security_alerts",
      "admin_email_sends",
    ]) {
      expect(deleted).not.toContain(kept);
    }
    // And the caller is told what survived, rather than having to guess.
    expect(res.retainedTables.map((r) => r.table)).toContain("invoices");
    expect(res.retainedTables.every((r) => r.reason.length > 0)).toBe(true);
  });
});

// ───────────────────────── email ─────────────────────────

describe("renderAdminEmailBody", () => {
  it("escapes HTML so a pasted tag cannot become markup in the recipient's inbox", async () => {
    const { renderAdminEmailBody } = await import("./services/adminEmail");
    const out = renderAdminEmailBody('<img src=x onerror="alert(1)"> & "quoted"');

    expect(out).toContain("&lt;img");
    expect(out).toContain("&amp;");
    expect(out).toContain("&quot;");

    // The property that matters is that no TAG can form from the admin's text —
    // `onerror=` surviving as literal characters inside an escaped `&lt;img` is
    // harmless. Strip the wrapper markup this function emits and nothing that
    // could open a tag may be left.
    const withoutOurMarkup = out
      .replace(/<p style="[^"]*">/g, "")
      .replace(/<\/p>/g, "")
      .replace(/<br \/>/g, "");
    expect(withoutOurMarkup).not.toMatch(/[<>]/);
  });

  it("turns blank lines into paragraphs and single newlines into breaks", async () => {
    const { renderAdminEmailBody } = await import("./services/adminEmail");
    const out = renderAdminEmailBody("Hei\nOla\n\nAndre avsnitt");
    expect(out.match(/<p /g)).toHaveLength(2);
    expect(out).toContain("Hei<br />Ola");
  });

  it("produces nothing for whitespace-only input", async () => {
    const { renderAdminEmailBody } = await import("./services/adminEmail");
    expect(renderAdminEmailBody("   \n\n  ")).toBe("");
  });
});

describe("sendAdminEmail refuses rather than reporting a false success", () => {
  beforeEach(() => {
    fake = createFakeDb();
    delete process.env.SENDGRID_API_KEY;
  });

  it("throws when email is not configured, instead of counting sends", async () => {
    // This is the whole point. `sendEmail` returns false and logs a warning when
    // SENDGRID_API_KEY is missing — correct for the lifecycle scheduler, and
    // catastrophic for a human pressing Send on 500 customers.
    const { sendAdminEmail } = await import("./services/adminEmail");
    await expect(
      sendAdminEmail({
        sentByUserId: 1,
        recipients: [{ userId: 2, email: "a@x.no", name: "A" }],
        subject: "s",
        bodyText: "b",
      })
    ).rejects.toThrow(/ikke konfigurert/);
  });

  it("refuses an empty recipient list", async () => {
    process.env.SENDGRID_API_KEY = "test";
    const { sendAdminEmail } = await import("./services/adminEmail");
    await expect(
      sendAdminEmail({ sentByUserId: 1, recipients: [], subject: "s", bodyText: "b" })
    ).rejects.toThrow(/Ingen mottakere/);
    delete process.env.SENDGRID_API_KEY;
  });

  it("refuses a batch above the ceiling", async () => {
    process.env.SENDGRID_API_KEY = "test";
    const { sendAdminEmail, MAX_RECIPIENTS_PER_SEND } = await import("./services/adminEmail");
    const many = Array.from({ length: MAX_RECIPIENTS_PER_SEND + 1 }, (_, i) => ({
      userId: i,
      email: `u${i}@x.no`,
      name: null,
    }));
    await expect(
      sendAdminEmail({ sentByUserId: 1, recipients: many, subject: "s", bodyText: "b" })
    ).rejects.toThrow(/For mange mottakere/);
    delete process.env.SENDGRID_API_KEY;
  });
});
