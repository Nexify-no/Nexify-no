/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * telegram.addTag / removeTag / getAllTags.
 *
 * Rewritten for two reasons: the module-scope `vi.fn().mockReturnThis()` db mock
 * cannot survive `mockReset: true` (vitest.config.ts), and the assertions were
 * `expect(result).toBeDefined()` — which a procedure passes by existing. Tag
 * editing is read-modify-write, so what needs pinning is the write it produces:
 * no duplicate tag, no write at all when nothing changes, and the surviving list
 * after a removal.
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

const post = (tags: unknown) => ({
  id: 1,
  userId: 1,
  brandId: null,
  platform: "linkedin",
  tone: "professional",
  rawInput: "idé",
  generatedContent: "innhold",
  tags,
  createdAt: new Date(),
  updatedAt: new Date(),
});

async function caller(userId = 1) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(mkCtx(userId));
}

/** The tag array the procedure wrote, or undefined if it wrote nothing. */
const writtenTags = () => {
  const updates = fake.opsOf("update", "posts");
  if (updates.length === 0) return undefined;
  return (updates[0].set as { tags: string[] }).tags;
};

describe("telegram.addTag", () => {
  beforeEach(() => {
    fake = createFakeDb({ rows: { posts: [post(["viktig"])] } });
  });

  it("appends a new tag to the existing list", async () => {
    const r = await (await caller()).telegram.addTag({ postId: 1, tag: "kampanje" });
    expect(r).toEqual({ success: true });
    expect(writtenTags()).toEqual(["viktig", "kampanje"]);
  });

  it("does not write at all when the tag is already there", async () => {
    const r = await (await caller()).telegram.addTag({ postId: 1, tag: "viktig" });
    expect(r).toEqual({ success: true });
    // Skipping the UPDATE is the point: rewriting the identical array would bump
    // updatedAt and make an untouched post look edited.
    expect(fake.opsOf("update", "posts")).toHaveLength(0);
  });

  it("treats a post with no tags as an empty list, not a crash", async () => {
    fake = createFakeDb({ rows: { posts: [post(null)] } });
    await (await caller()).telegram.addTag({ postId: 1, tag: "første" });
    expect(writtenTags()).toEqual(["første"]);
  });

  it("ignores a non-array tags column instead of spreading it", async () => {
    // Legacy rows can hold a JSON string. Spreading that would produce one tag
    // per character.
    fake = createFakeDb({ rows: { posts: [post("viktig")] } });
    await (await caller()).telegram.addTag({ postId: 1, tag: "ny" });
    expect(writtenTags()).toEqual(["ny"]);
  });

  it("scopes both the read and the write to the caller", async () => {
    // Distinct userId and postId: with both 1, `eq(userId, 1)` alone would pass.
    await (await caller(42)).telegram.addTag({ postId: 5, tag: "ny" });

    for (const op of [fake.onlyOp("select", "posts"), fake.onlyOp("update", "posts")]) {
      const { sql, params } = queryOf(op.where);
      expect(sql).toContain("user_id");
      expect(sql).toContain("`id`");
      expect(params).toEqual(expect.arrayContaining([5, 42]));
    }
  });

  it("refuses when the scoped lookup finds nothing, and writes nothing", async () => {
    // The cross-tenant property lives in the scoping test above; the fake does
    // not apply WHERE, so this only proves the not-found branch is a hard refusal.
    fake = createFakeDb({ rows: { posts: [] } });
    await expect((await caller()).telegram.addTag({ postId: 999, tag: "x" })).rejects.toThrow(
      /Post not found/,
    );
    expect(fake.opsOf("update")).toHaveLength(0);
  });

  it("rejects an empty tag and an over-long one before touching the database", async () => {
    const c = await caller();
    await expect(c.telegram.addTag({ postId: 1, tag: "" })).rejects.toThrow();
    await expect(c.telegram.addTag({ postId: 1, tag: "x".repeat(51) })).rejects.toThrow();
    expect(fake.ops).toHaveLength(0);
  });
});

describe("telegram.removeTag", () => {
  beforeEach(() => {
    fake = createFakeDb({ rows: { posts: [post(["viktig", "kampanje", "nyhet"])] } });
  });

  it("removes only the named tag and keeps the order of the rest", async () => {
    const r = await (await caller()).telegram.removeTag({ postId: 1, tag: "kampanje" });
    expect(r).toEqual({ success: true });
    expect(writtenTags()).toEqual(["viktig", "nyhet"]);
  });

  it("removes every copy when the list holds duplicates", async () => {
    fake = createFakeDb({ rows: { posts: [post(["a", "b", "a"])] } });
    await (await caller()).telegram.removeTag({ postId: 1, tag: "a" });
    expect(writtenTags()).toEqual(["b"]);
  });

  it("leaves the list intact when the tag was never on the post", async () => {
    await (await caller()).telegram.removeTag({ postId: 1, tag: "finnes-ikke" });
    expect(writtenTags()).toEqual(["viktig", "kampanje", "nyhet"]);
  });

  it("refuses when the scoped lookup finds nothing, and writes nothing", async () => {
    fake = createFakeDb({ rows: { posts: [] } });
    await expect((await caller()).telegram.removeTag({ postId: 999, tag: "x" })).rejects.toThrow(
      /Post not found/,
    );
    expect(fake.opsOf("update")).toHaveLength(0);
  });

  it("scopes the update to the caller's own post", async () => {
    await (await caller(42)).telegram.removeTag({ postId: 5, tag: "viktig" });
    const { sql, params } = queryOf(fake.onlyOp("update", "posts").where);
    expect(sql).toContain("user_id");
    expect(params).toEqual(expect.arrayContaining([5, 42]));
  });
});

describe("telegram.getAllTags", () => {
  it("deduplicates across posts and sorts the result", async () => {
    fake = createFakeDb({
      rows: {
        posts: [post(["viktig", "nyhet"]), post(["kampanje", "viktig"]), post(["nyhet"])],
      },
    });
    const r = await (await caller()).telegram.getAllTags();
    expect(r.tags).toEqual(["kampanje", "nyhet", "viktig"]);
  });

  it("returns an empty list when nothing is tagged", async () => {
    fake = createFakeDb({ rows: { posts: [post(null), post([])] } });
    const r = await (await caller()).telegram.getAllTags();
    expect(r.tags).toEqual([]);
  });

  it("returns an empty list when the user has no posts", async () => {
    fake = createFakeDb({ rows: { posts: [] } });
    const r = await (await caller()).telegram.getAllTags();
    expect(r.tags).toEqual([]);
  });

  it("skips rows whose tags column is not an array", async () => {
    fake = createFakeDb({ rows: { posts: [post("viktig"), post(["ekte"])] } });
    const r = await (await caller()).telegram.getAllTags();
    expect(r.tags).toEqual(["ekte"]);
  });

  it("reads only the caller's posts", async () => {
    fake = createFakeDb({ rows: { posts: [] } });
    await (await caller(42)).telegram.getAllTags();
    const { sql, params } = queryOf(fake.onlyOp("select", "posts").where);
    expect(sql).toContain("user_id");
    expect(params).toContain(42);
  });
});
