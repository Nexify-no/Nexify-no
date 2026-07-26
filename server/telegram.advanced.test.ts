/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * telegram.bulkDeletePosts / bulkMoveToIdeaBank / editPost.
 *
 * Same rewrite as the sibling telegram files: the module-scope
 * `vi.fn().mockReturnThis()` db mock is wiped by `mockReset: true`
 * (vitest.config.ts) before every test, so every case died on "Database not
 * available"; and every assertion was `expect(result).toBeDefined()`.
 *
 * Bulk operations are where a missing ownership predicate does the most damage —
 * one unscoped `inArray(posts.id, ids)` deletes other people's posts by the
 * dozen — so the compiled WHERE clause is asserted, not just the return value.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb, queryOf, type FakeDb } from "./testing/fakeDb";
import { mkCtx } from "./testing/ctx";

let fake: FakeDb;
/** What requireWriteBrandId resolves to. null = multi-brand off. */
let writeBrandId: number | null = null;

// Stubbed so the brand assertions are not vacuous: with FEATURE_MULTI_BRAND off
// the real requireWriteBrandId short-circuits to null, and "every row has the
// same brand" is then satisfied by every row having none.
vi.mock("./services/brandScope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/brandScope")>()),
  requireWriteBrandId: async () => writeBrandId,
}));

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

describe("telegram.bulkDeletePosts", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("reports how many ids it was given", async () => {
    const r = await (await caller()).telegram.bulkDeletePosts({ postIds: [1, 2, 3] });
    expect(r).toEqual({ success: true, count: 3 });
  });

  it("deletes all the ids in one statement, scoped to the caller", async () => {
    await (await caller(42)).telegram.bulkDeletePosts({ postIds: [1, 2, 3] });

    const del = fake.onlyOp("delete", "posts");
    const { sql, params } = queryOf(del.where);
    expect(sql).toContain("user_id");
    expect(sql).toContain("in (");
    // Every id AND the caller must be bound — an unscoped inArray would delete
    // whatever ids the client guessed.
    expect(params).toEqual(expect.arrayContaining([1, 2, 3, 42]));
  });

  it("handles an empty selection without deleting everything", async () => {
    const r = await (await caller()).telegram.bulkDeletePosts({ postIds: [] });
    expect(r).toEqual({ success: true, count: 0 });

    // The dangerous shape is a WHERE that degrades to "user_id = 1" alone, which
    // would wipe the account. Assert the property, not drizzle's spelling of it
    // (today an empty inArray compiles to the literal `false`, which a version
    // bump could change): the id predicate must still be present, and no post id
    // may be bound.
    const del = fake.onlyOp("delete", "posts");
    const { sql, params } = queryOf(del.where);
    expect(sql).toContain("user_id");
    expect(sql).not.toBe("`posts`.`user_id` = ?"); // not degraded to user-only
    expect(params).toEqual([1]); // only the caller — no ids at all
  });

  it("rejects a non-numeric id before touching the database", async () => {
    await expect(
      (await caller()).telegram.bulkDeletePosts({ postIds: ["1"] as never }),
    ).rejects.toThrow();
    expect(fake.ops).toHaveLength(0);
  });
});

describe("telegram.bulkMoveToIdeaBank", () => {
  const items = [
    { postId: 1, rawInput: "første idé" },
    { postId: 2, rawInput: "andre idé" },
  ];

  beforeEach(() => {
    fake = createFakeDb();
    writeBrandId = null;
  });

  it("inserts every idea in one statement, then deletes the posts", async () => {
    const r = await (await caller()).telegram.bulkMoveToIdeaBank({ items });
    expect(r).toEqual({ success: true, count: 2 });
    expect(fake.ops.map((o) => `${o.kind}:${o.table}`)).toEqual(["insert:ideas", "delete:posts"]);

    const values = fake.onlyOp("insert", "ideas").values as Array<Record<string, unknown>>;
    expect(values).toHaveLength(2);
    expect(values.map((v) => v.ideaText)).toEqual(["første idé", "andre idé"]);
  });

  it("stamps every idea in the batch with the same real brand id", async () => {
    // PR #79: the brand is resolved ONCE for the batch, so no row can be left
    // ownerless and none can drift onto a different brand mid-loop. Asserting the
    // concrete id matters — with the flag off every brandId is null and "all the
    // same" would hold no matter what the code did.
    writeBrandId = 9;
    await (await caller(7)).telegram.bulkMoveToIdeaBank({ items });
    const values = fake.onlyOp("insert", "ideas").values as Array<Record<string, unknown>>;

    expect(values).toHaveLength(2);
    expect(values.every((v) => v.brandId === 9)).toBe(true);
    expect(values.every((v) => v.userId === 7)).toBe(true);
    expect(values.every((v) => v.source === "manual" && v.status === "new")).toBe(true);
  });

  it("leaves the brand null while multi-brand is off", async () => {
    writeBrandId = null;
    await (await caller()).telegram.bulkMoveToIdeaBank({ items });
    const values = fake.onlyOp("insert", "ideas").values as Array<Record<string, unknown>>;
    expect(values.every((v) => v.brandId === null)).toBe(true);
  });

  it("refuses the whole batch when no brand can be resolved", async () => {
    // requireWriteBrandId throws with multi-brand ON and no brand selected. A
    // partial success here would be worse than a failure: some ideas saved
    // ownerless, the posts deleted anyway.
    const { TRPCError } = await import("@trpc/server");
    const boom = new TRPCError({ code: "BAD_REQUEST", message: "Velg en merkevare" });
    const spy = vi
      .spyOn(await import("./services/brandScope"), "requireWriteBrandId")
      .mockRejectedValue(boom);

    await expect((await caller()).telegram.bulkMoveToIdeaBank({ items })).rejects.toThrow(
      /Velg en merkevare/,
    );
    expect(fake.opsOf("insert", "ideas")).toHaveLength(0);
    expect(fake.opsOf("delete", "posts")).toHaveLength(0);
    spy.mockRestore();
  });

  it("deletes exactly the posts it moved, scoped to the caller", async () => {
    await (await caller(42)).telegram.bulkMoveToIdeaBank({ items });
    const { sql, params } = queryOf(fake.onlyOp("delete", "posts").where);
    expect(sql).toContain("user_id");
    expect(params).toEqual(expect.arrayContaining([1, 2, 42]));
  });

  it("works for a single item", async () => {
    const r = await (await caller()).telegram.bulkMoveToIdeaBank({ items: [items[0]] });
    expect(r.count).toBe(1);
    expect((fake.onlyOp("insert", "ideas").values as unknown[]).length).toBe(1);
  });

  it("does not delete the posts when the idea insert fails", async () => {
    fake = createFakeDb({ failOn: { ideas: new Error("insert failed") } });
    await expect((await caller()).telegram.bulkMoveToIdeaBank({ items })).rejects.toThrow(
      /insert failed/,
    );
    expect(fake.opsOf("delete", "posts")).toHaveLength(0);
  });
});

describe("telegram.editPost", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("writes the new content and bumps updatedAt", async () => {
    const before = Date.now();
    const r = await (await caller()).telegram.editPost({ postId: 1, newContent: "Ny tekst" });
    expect(r).toEqual({ success: true });

    const set = fake.onlyOp("update", "posts").set as Record<string, unknown>;
    expect(set.generatedContent).toBe("Ny tekst");
    expect((set.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("changes only the content — not the platform, tone or brand", async () => {
    await (await caller()).telegram.editPost({ postId: 1, newContent: "Ny tekst" });
    const set = fake.onlyOp("update", "posts").set as Record<string, unknown>;
    expect(Object.keys(set).sort()).toEqual(["generatedContent", "updatedAt"]);
  });

  it("scopes the update to the caller's own post", async () => {
    await (await caller(42)).telegram.editPost({ postId: 1, newContent: "x" });
    const { sql, params } = queryOf(fake.onlyOp("update", "posts").where);
    expect(sql).toContain("user_id");
    expect(params).toEqual(expect.arrayContaining([1, 42]));
  });

  it("stores long content verbatim", async () => {
    const long = "A".repeat(5000);
    await (await caller()).telegram.editPost({ postId: 1, newContent: long });
    const set = fake.onlyOp("update", "posts").set as Record<string, unknown>;
    expect(set.generatedContent).toBe(long);
  });

  it("rejects a missing newContent before touching the database", async () => {
    await expect(
      (await caller()).telegram.editPost({ postId: 1 } as never),
    ).rejects.toThrow();
    expect(fake.ops).toHaveLength(0);
  });
});
