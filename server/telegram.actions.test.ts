/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * telegram.savePost / deletePost / moveToIdeaBank.
 *
 * The old version could not pass: its db mock was a `vi.fn().mockReturnThis()`
 * chain built at module scope, and the suite runs with `mockReset: true`
 * (vitest.config.ts), which strips spy implementations before every test — so
 * `getDb()` resolved to undefined and every procedure threw "Database not
 * available". The assertions were `expect(result).toBeDefined()` besides.
 *
 * These are destructive mutations, so what is worth pinning is the WHERE clause:
 * a delete that scoped by post id alone would let any caller delete any post.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb, queryOf, type FakeDb } from "./testing/fakeDb";
import { mkCtx } from "./testing/ctx";

let fake: FakeDb;

// Spread the real module: `caller()` imports the WHOLE router graph, and other
// routers (e.g. paymentRouter) import named db helpers eagerly. A factory that
// exported only getDb left those bindings undefined for the whole file — fine
// until someone adds a case that touches one, then an unreadable
// "x is not a function". Only getDb is overridden.
vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: async () => fake.db,
}));

async function caller(userId = 1) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(mkCtx(userId));
}

describe("telegram.savePost", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("is a no-op acknowledgement — the post is already in Mine innlegg", async () => {
    const r = await (await caller()).telegram.savePost({ postId: 1 });
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/already saved/i);
    // It must not write anything; the endpoint exists only for UI symmetry.
    expect(fake.ops).toHaveLength(0);
  });

  it("rejects a non-numeric postId", async () => {
    await expect((await caller()).telegram.savePost({ postId: "1" as never })).rejects.toThrow();
  });
});

describe("telegram.deletePost", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("deletes from posts and reports success", async () => {
    const r = await (await caller()).telegram.deletePost({ postId: 5 });
    expect(r).toEqual({ success: true });
    expect(fake.opsOf("delete", "posts")).toHaveLength(1);
  });

  it("scopes the delete by BOTH post id and caller", async () => {
    await (await caller(42)).telegram.deletePost({ postId: 5 });
    const { sql, params } = queryOf(fake.onlyOp("delete", "posts").where);
    expect(sql).toContain("user_id");
    expect(sql).toContain("`id`");
    expect(params).toEqual(expect.arrayContaining([5, 42]));
  });

  it("touches nothing but posts", async () => {
    await (await caller()).telegram.deletePost({ postId: 5 });
    expect(fake.ops.map((o) => `${o.kind}:${o.table}`)).toEqual(["delete:posts"]);
  });
});

describe("telegram.moveToIdeaBank", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("inserts the idea and then deletes the post", async () => {
    const r = await (await caller()).telegram.moveToIdeaBank({ postId: 5, rawInput: "en idé" });
    expect(r).toEqual({ success: true });

    // Order matters: deleting first and then failing the insert loses the idea.
    expect(fake.ops.map((o) => `${o.kind}:${o.table}`)).toEqual(["insert:ideas", "delete:posts"]);
  });

  it("stores the raw input as a new manual idea owned by the caller", async () => {
    const v = (await moved(7)).onlyOp("insert", "ideas").values as Record<string, unknown>;
    expect(v.userId).toBe(7);
    expect(v.ideaText).toBe("en idé");
    expect(v.source).toBe("manual");
    expect(v.status).toBe("new");
    expect(v.createdAt).toBeInstanceOf(Date);
  });

  it("stamps a brand id on the idea (null while multi-brand is off)", async () => {
    // PR #79 routes this through requireWriteBrandId so the idea can never land
    // in every brand's Idébank at once. With the flag off that is null, which is
    // the pre-multi-brand account-wide behaviour.
    const v = (await moved()).onlyOp("insert", "ideas").values as Record<string, unknown>;
    expect("brandId" in v).toBe(true);
    expect(v.brandId).toBeNull();
  });

  it("scopes the delete to the caller's own post", async () => {
    const { sql, params } = queryOf((await moved(42)).onlyOp("delete", "posts").where);
    expect(sql).toContain("user_id");
    expect(params).toEqual(expect.arrayContaining([5, 42]));
  });

  it("accepts a long idea text unchanged", async () => {
    const long = "Lang idé ".repeat(200);
    fake = createFakeDb();
    await (await caller()).telegram.moveToIdeaBank({ postId: 5, rawInput: long });
    const v = fake.onlyOp("insert", "ideas").values as Record<string, unknown>;
    expect(v.ideaText).toBe(long);
  });

  it("does not delete the post when the idea insert fails", async () => {
    fake = createFakeDb({ failOn: { ideas: new Error("insert failed") } });
    await expect(
      (await caller()).telegram.moveToIdeaBank({ postId: 5, rawInput: "en idé" }),
    ).rejects.toThrow(/insert failed/);
    expect(fake.opsOf("delete", "posts")).toHaveLength(0);
  });

  async function moved(userId = 1) {
    fake = createFakeDb();
    await (await caller(userId)).telegram.moveToIdeaBank({ postId: 5, rawInput: "en idé" });
    return fake;
  }
});
