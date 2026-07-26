/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * telegram.generateLinkCode / getStatus / disconnect / getRecentPosts /
 * generateAlternatives.
 *
 * Rewritten: the module-scope `vi.fn().mockReturnThis()` db mock is stripped by
 * `mockReset: true` (vitest.config.ts) before every test, so all five procedures
 * threw "Database not available"; and every assertion was
 * `expect(result).toBeDefined()`, which cannot distinguish a working link code
 * from a broken one.
 *
 * generateLinkCode is the interesting one: it is an account-linking credential,
 * so the shape, the expiry and — above all — the update-vs-insert branch matter.
 * Getting that branch wrong means a second call creates a second row and the bot
 * matches the stale code.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { desc } from "drizzle-orm";
import { posts as postsTable } from "../drizzle/schema";
import { createFakeDb, queryOf, sqlOf, type FakeDb } from "./testing/fakeDb";
import { mkCtx } from "./testing/ctx";

let fake: FakeDb;
/** What the mocked LLM returns as message content. */
let llmContent: unknown;
let llmMessages: unknown;

// Spread the real module: `caller()` imports the WHOLE router graph, and other
// routers (e.g. paymentRouter) import named db helpers eagerly. A factory that
// exported only getDb left those bindings undefined for the whole file — fine
// until someone adds a case that touches one, then an unreadable
// "x is not a function". Only getDb is overridden.
vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: async () => fake.db,
}));

// Plain function, not a spy: `mockReset: true` would strip the implementation.
vi.mock("./_core/llm", () => ({
  invokeLLM: async (args: { messages: unknown }) => {
    llmMessages = args.messages;
    return { choices: [{ message: { content: llmContent } }] };
  },
}));

async function caller(userId = 1) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(mkCtx(userId));
}

const LINK = {
  id: 1,
  userId: 1,
  telegramUserId: "tg-1",
  telegramUsername: "olanordmann",
  telegramFirstName: "Ola",
  linkCode: "OLDCODE1",
  linkCodeExpiry: new Date("2020-01-01T00:00:00Z"),
  isActive: true,
  linkedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("telegram.generateLinkCode", () => {
  beforeEach(() => {
    fake = createFakeDb({ rows: { telegram_links: [] } });
  });

  it("returns an 8-character code the webhook will recognise, with a ten-minute expiry", async () => {
    // The caller is resolved BEFORE the clock reading: `caller()` imports the
    // whole router graph, which takes seconds on a cold run, and measuring the
    // expiry across that import made the upper bound flaky.
    const c = await caller();
    const before = Date.now();
    const r = await c.telegram.generateLinkCode();

    // telegramWebhook.ts gates on exactly `text.length === 8 && /^[A-Z0-9]+$/`;
    // a code outside that shape is silently unusable.
    expect(r.linkCode).toMatch(/^[A-Z0-9]{8}$/);

    const ttl = r.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(9 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
  });

  it("draws the code from a CSPRNG, not Math.random", async () => {
    // This is an account-linking credential: whoever sends it to the bot is
    // treated as the owner. Math.random's state is recoverable from a handful of
    // outputs, and codes are minted minutes apart.
    const spy = vi.spyOn(Math, "random");
    const c = await caller();
    await c.telegram.generateLinkCode();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("avoids characters that are ambiguous when read off a screen", async () => {
    const c = await caller();
    const codes: string[] = [];
    for (let i = 0; i < 40; i++) {
      fake = createFakeDb({ rows: { telegram_links: [] } });
      codes.push((await c.telegram.generateLinkCode()).linkCode);
    }
    // 0/O and 1/I in a code the user retypes into Telegram is a support ticket.
    expect(codes.join("")).not.toMatch(/[O0I1]/);
  });

  it("inserts an inactive placeholder row when the user has no link yet", async () => {
    await (await caller(7)).telegram.generateLinkCode();

    const insert = fake.onlyOp("insert", "telegram_links");
    const v = insert.values as Record<string, unknown>;
    expect(v.userId).toBe(7);
    expect(v.isActive).toBe(false); // not linked until the user sends the code
    expect(v.linkCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(fake.opsOf("update", "telegram_links")).toHaveLength(0);

    // telegram_user_id is NOT NULL UNIQUE (drizzle/0014), so the placeholder must
    // be per-user. A shared "" meant the second user ever to ask for a code hit a
    // duplicate-key error instead of getting one.
    expect(v.telegramUserId).not.toBe("");
    expect(v.telegramUserId).toContain("7");
  });

  it("gives two different users placeholders that cannot collide on the unique index", async () => {
    await (await caller(7)).telegram.generateLinkCode();
    const first = fake.onlyOp("insert", "telegram_links").values as Record<string, unknown>;

    fake = createFakeDb({ rows: { telegram_links: [] } });
    await (await caller(8)).telegram.generateLinkCode();
    const second = fake.onlyOp("insert", "telegram_links").values as Record<string, unknown>;

    expect(first.telegramUserId).not.toBe(second.telegramUserId);
  });

  it("updates the existing row instead of inserting a second one", async () => {
    fake = createFakeDb({ rows: { telegram_links: [LINK] } });
    const r = await (await caller()).telegram.generateLinkCode();

    // A second row would leave two live codes for one account and the bot would
    // match whichever it read first.
    expect(fake.opsOf("insert", "telegram_links")).toHaveLength(0);
    const set = fake.onlyOp("update", "telegram_links").set as Record<string, unknown>;
    expect(set.linkCode).toBe(r.linkCode);
    expect(set.linkCodeExpiry).toEqual(r.expiresAt);
  });

  it("does not resurrect a disconnected link while re-coding it", async () => {
    fake = createFakeDb({ rows: { telegram_links: [{ ...LINK, isActive: false }] } });
    await (await caller()).telegram.generateLinkCode();

    const set = fake.onlyOp("update", "telegram_links").set as Record<string, unknown>;
    expect("isActive" in set).toBe(false);
  });

  it("scopes the lookup and the update to the caller", async () => {
    fake = createFakeDb({ rows: { telegram_links: [LINK] } });
    await (await caller(42)).telegram.generateLinkCode();

    for (const op of [
      fake.onlyOp("select", "telegram_links"),
      fake.onlyOp("update", "telegram_links"),
    ]) {
      const { sql, params } = queryOf(op.where);
      expect(sql).toContain("user_id");
      expect(params).toContain(42);
    }
  });

  it("mints a different code each time", async () => {
    const a = await (await caller()).telegram.generateLinkCode();
    fake = createFakeDb({ rows: { telegram_links: [] } });
    const b = await (await caller()).telegram.generateLinkCode();
    expect(a.linkCode).not.toBe(b.linkCode);
  });
});

describe("telegram.getStatus", () => {
  it("reports not connected when there is no link row", async () => {
    fake = createFakeDb({ rows: { telegram_links: [] } });
    const r = await (await caller()).telegram.getStatus();
    expect(r).toEqual({ connected: false });
  });

  it("reports the linked account when the link is active", async () => {
    fake = createFakeDb({ rows: { telegram_links: [LINK] } });
    const r = await (await caller()).telegram.getStatus();
    expect(r).toEqual({
      connected: true,
      telegramUsername: "olanordmann",
      telegramFirstName: "Ola",
      linkedAt: LINK.linkedAt,
    });
  });

  it("reports not connected for a pending row that only holds a code", async () => {
    // A row exists as soon as a code is generated. Treating "row exists" as
    // "connected" would show a confirmed Telegram link that does not exist.
    fake = createFakeDb({
      rows: {
        telegram_links: [
          { ...LINK, isActive: false, telegramUserId: "", telegramUsername: null, linkedAt: null },
        ],
      },
    });
    const r = await (await caller()).telegram.getStatus();
    expect(r.connected).toBe(false);
  });

  it("reads only the caller's row", async () => {
    fake = createFakeDb({ rows: { telegram_links: [] } });
    await (await caller(42)).telegram.getStatus();
    const { sql, params } = queryOf(fake.onlyOp("select", "telegram_links").where);
    expect(sql).toContain("user_id");
    expect(params).toContain(42);
  });
});

describe("telegram.disconnect", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("deletes the caller's link row and nothing else", async () => {
    const r = await (await caller(42)).telegram.disconnect();
    expect(r).toEqual({ success: true });

    expect(fake.ops.map((o) => `${o.kind}:${o.table}`)).toEqual(["delete:telegram_links"]);
    const { sql, params } = queryOf(fake.onlyOp("delete", "telegram_links").where);
    expect(sql).toContain("user_id");
    expect(params).toEqual([42]);
  });

  it("does not delete the user's posts", async () => {
    await (await caller()).telegram.disconnect();
    expect(fake.opsOf("delete", "posts")).toHaveLength(0);
  });
});

describe("telegram.getRecentPosts", () => {
  it("returns the caller's posts, newest first, capped at ten", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, userId: 1 }));
    fake = createFakeDb({ rows: { posts: rows } });

    const r = await (await caller(1)).telegram.getRecentPosts();
    expect(r).toEqual(rows);

    const read = fake.onlyOp("select", "posts");
    expect(read.limit).toBe(10);
    // Compile the ORDER BY rather than just asserting it exists — `toBeDefined()`
    // passes for `asc(createdAt)` too, which is the opposite of "newest first".
    expect(sqlOf(read.orderBy)).toBe(sqlOf(desc(postsTable.createdAt)));

    const { sql, params } = queryOf(read.where);
    expect(sql).toContain("user_id");
    expect(params).toEqual([1]);
  });

  it("returns an empty list rather than throwing when there are no posts", async () => {
    fake = createFakeDb({ rows: { posts: [] } });
    const r = await (await caller()).telegram.getRecentPosts();
    expect(r).toEqual([]);
  });
});

describe("telegram.generateAlternatives", () => {
  beforeEach(() => {
    fake = createFakeDb();
    llmMessages = null;
    llmContent = JSON.stringify({
      alt1: "Profesjonell versjon",
      alt2: "Personlig versjon",
      alt3: "Kort og engasjerende",
    });
  });

  it("returns exactly the three alternatives, in order", async () => {
    const r = await (await caller()).telegram.generateAlternatives({
      postId: 1,
      rawInput: "Test post content",
    });
    expect(r.alternatives).toEqual([
      "Profesjonell versjon",
      "Personlig versjon",
      "Kort og engasjerende",
    ]);
  });

  it("passes the user's idea through to the model and asks for Norwegian", async () => {
    await (await caller()).telegram.generateAlternatives({
      postId: 1,
      rawInput: "Spesialtegn: @#$%",
    });

    const messages = llmMessages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("norsk");
    expect(messages[1].content).toContain("Spesialtegn: @#$%");
  });

  it("accepts an already-parsed object as well as a JSON string", async () => {
    // invokeLLM's content is typed loosely; a provider returning an object used
    // to be re-stringified and re-parsed, which must stay lossless.
    llmContent = { alt1: "a", alt2: "b", alt3: "c" };
    const r = await (await caller()).telegram.generateAlternatives({ postId: 1, rawInput: "x" });
    expect(r.alternatives).toEqual(["a", "b", "c"]);
  });

  it("fails loudly when the model does not return JSON", async () => {
    llmContent = "beklager, jeg kan ikke";
    await expect(
      (await caller()).telegram.generateAlternatives({ postId: 1, rawInput: "x" }),
    ).rejects.toThrow();
  });

  it("does not read or write the database", async () => {
    await (await caller()).telegram.generateAlternatives({ postId: 1, rawInput: "x" });
    expect(fake.ops).toHaveLength(0);
  });
});
