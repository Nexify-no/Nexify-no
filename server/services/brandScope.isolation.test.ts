/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { and, eq } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { brandProfiles, drafts, ideas, posts } from "../../drizzle/schema";
import { ownedBy, unclassified } from "./brandScope";
// One shared compiler, rather than a private copy per test file.
import { sqlOf } from "../testing/fakeDb";

/**
 * PR #79 — brand data ownership.
 *
 * The bug: every brand-scoped read widened its filter with `OR brand_id IS
 * NULL`. An unowned row therefore appeared inside EVERY brand — selecting Penna
 * showed Ballong's posts, ideas, Merkehjerne and links.
 *
 * Two layers of proof here:
 *   1. Behavioural — compile the real filters and assert on the SQL they emit.
 *   2. Shape guards — the query paths need a live MySQL this suite does not
 *      have, so we pin the source of the call sites. They fail loudly if the
 *      NULL fallback is reintroduced anywhere.
 */

const dialect = new MySqlDialect();

describe("ownedBy — the brand filter itself", () => {
  it("matches one brand exactly, with no NULL fallback", () => {
    const sql = sqlOf(ownedBy(posts.userId, posts.brandId, 7, 42));
    expect(sql).toContain("`user_id` = ?");
    expect(sql).toContain("`brand_id` = ?");
    expect(sql).not.toMatch(/is null/i);
    expect(sql).not.toMatch(/\bor\b/i);
  });

  it("binds the caller's user and brand, in that order", () => {
    const q = dialect.sqlToQuery(ownedBy(posts.userId, posts.brandId, 7, 42));
    expect(q.params).toEqual([7, 42]);
  });

  it("degrades to account-wide scoping when multi-brand is off (brandId null)", () => {
    const sql = sqlOf(ownedBy(posts.userId, posts.brandId, 7, null));
    expect(sql).toContain("`user_id` = ?");
    expect(sql).not.toContain("`brand_id`");
  });

  it("applies to every content table, not just posts", () => {
    for (const t of [
      [ideas.userId, ideas.brandId],
      [drafts.userId, drafts.brandId],
      [brandProfiles.userId, brandProfiles.brandId],
    ] as const) {
      const sql = sqlOf(ownedBy(t[0], t[1], 7, 42));
      expect(sql).not.toMatch(/is null/i);
      expect(sql).toContain("`brand_id` = ?");
    }
  });

  it("composes with other conditions without reopening the scope", () => {
    const sql = sqlOf(and(
      ownedBy(brandProfiles.userId, brandProfiles.brandId, 7, 42),
      eq(brandProfiles.status, "ready"),
    )!);
    expect(sql).not.toMatch(/is null/i);
    expect(sql).toContain("`status` = ?");
  });
});

describe("unclassified — the Uklassifisert bucket", () => {
  it("selects only this account's unowned rows", () => {
    const sql = sqlOf(unclassified(ideas.userId, ideas.brandId, 7));
    expect(sql).toContain("`user_id` = ?");
    expect(sql).toMatch(/`brand_id` is null/i);
  });

  it("can never reach a row that already has an owner", () => {
    // The only brand predicate is IS NULL, so an owned row cannot match — this
    // is what makes brands.classify unable to steal a row from another brand.
    const sql = sqlOf(unclassified(posts.userId, posts.brandId, 7));
    expect(sql).not.toContain("`brand_id` = ?");
  });
});

describe("no call site reintroduces the NULL fallback", () => {
  const readPaths = [
    "server/db.ts",
    "server/services/postManagementService.ts",
    "server/services/merkehjerne/brandContext.ts",
    "server/services/merkehjerne/analyzeIntoBrand.ts",
    "server/routers/brandRouter.ts",
    "server/routers/contentRouter.ts",
    "server/routers/plannedContentRouter.ts",
    "server/routers/ideasRouter.ts",
    "server/routers/draftsRouter.ts",
  ];

  for (const path of readPaths) {
    it(`${path} never ORs a brand filter with IS NULL`, () => {
      const src = readFileSync(path, "utf8");
      // e.g. or(eq(posts.brandId, brandId), isNull(posts.brandId))
      expect(src).not.toMatch(/or\(\s*eq\([\w.]*[Bb]randId[\s\S]{0,80}isNull\([\w.]*[Bb]randId/);
    });
  }
});

describe("writes always name a brand", () => {
  it("createPost refuses to insert an ownerless post while multi-brand is on", () => {
    const src = readFileSync("server/db.ts", "utf8");
    expect(src).toMatch(/ENV\.featureMultiBrand[\s\S]{0,200}throw new Error/);
  });

  it("ideas and drafts are stamped through requireWriteBrandId", () => {
    for (const path of ["server/routers/ideasRouter.ts", "server/routers/draftsRouter.ts"]) {
      expect(readFileSync(path, "utf8")).toContain("requireWriteBrandId");
    }
  });

  it("requireWriteBrandId throws rather than returning null under multi-brand", () => {
    const src = readFileSync("server/services/brandScope.ts", "utf8");
    expect(src).toMatch(/featureMultiBrand[\s\S]{0,200}throw new TRPCError/);
  });
});

describe("legacy adoption never guesses", () => {
  const src = readFileSync("server/services/brands.ts", "utf8");

  it("adopts only when the account owns exactly one brand", () => {
    expect(src).toMatch(/const unambiguous = all\.length === 1/);
    expect(src).toMatch(/if \(unambiguous\)/);
  });

  it("keeps every adoption write inside that guard", () => {
    const guardIdx = src.indexOf("if (unambiguous)");
    expect(guardIdx).toBeGreaterThan(-1);
    const beforeGuard = src.slice(0, guardIdx);
    // Only the brand_profiles single-row adoption may sit outside the guard.
    const strayBlanketUpdates = beforeGuard.match(/await adopt\("(posts|ideas|drafts|scheduled_posts|content_plans|planned_posts|content_schedule|linkedin_connections)"/g) ?? [];
    expect(strayBlanketUpdates).toEqual([]);
  });
});

describe("a Merkehjerne mutation touches at most one row", () => {
  const src = readFileSync("server/routers/brandRouter.ts", "utf8");
  // PR #80 moved the analysis writes into a shared service so the URL journey
  // and brand.analyze cannot drift; the invariant now spans both files.
  const writeSites = [
    "server/routers/brandRouter.ts",
    "server/services/merkehjerne/analyzeIntoBrand.ts",
  ];

  it("bounds every brand_profiles update with limit(1)", () => {
    // Slice each statement by its own start, not by the next semicolon — a `;`
    // inside a comment would otherwise truncate the match and pass vacuously.
    const statements = writeSites.flatMap((path) => {
      const text = readFileSync(path, "utf8");
      const out: string[] = [];
      for (let i = text.indexOf(".update(brandProfiles)"); i !== -1; i = text.indexOf(".update(brandProfiles)", i + 1)) {
        const rest = text.slice(i + 1);
        const nextStatement = Math.min(
          ...[".update(", ".select(", ".insert(", ".delete("]
            .map((m) => rest.indexOf(m))
            .filter((n) => n !== -1)
            .concat([rest.length]),
        );
        out.push(rest.slice(0, nextStatement));
      }
      return out;
    });
    expect(statements.length).toBeGreaterThanOrEqual(4);
    for (const st of statements) expect(st).toContain(".limit(1)");
  });

  it("orders every limited update and its readback identically", () => {
    // Without ORDER BY, `LIMIT 1` picks an arbitrary row — the update could hit
    // one profile while the readback returned another, so a saved edit would
    // appear to have been discarded. Only reachable with multi-brand OFF, where
    // duplicate NULL-brand rows are still possible.
    //
    // Counts limits on brandProfiles ONLY. Counting every `.limit(1)` in the file
    // made an unrelated primary-key lookup — `brands` by id, which returns one row
    // by definition — fail this, and "add a meaningless ORDER BY to satisfy the
    // test" is the wrong lesson to teach. The invariant is about the table where
    // duplicate rows are possible.
    const brandProfileLimits =
      src.match(/brandProfiles[\s\S]{0,400}?\.limit\(1\)/g) ?? [];
    const ordered = src.match(/\.orderBy\(brandProfiles\.id\)\s*\n?\s*\.limit\(1\)/g) ?? [];
    expect(brandProfileLimits.length).toBeGreaterThanOrEqual(4);
    expect(ordered.length).toBe(brandProfileLimits.length);
  });

  it("scopes the profile by exact (user, brand) at every write site", () => {
    for (const path of writeSites) {
      expect(readFileSync(path, "utf8"), path)
        .toMatch(/eq\(brandProfiles\.userId, userId\), eq\(brandProfiles\.brandId, brandId\)/);
    }
    void src;
  });
});

describe("legacy data stays recoverable", () => {
  it("adopts into the ACTIVE brand, not blindly the oldest one", () => {
    // Stamping an unowned Merkehjerne onto the oldest brand while a different
    // brand is active makes it read back as missing now that the NULL fallback
    // is gone — an empty Merkehjerne page and silently generic AI output.
    const src = readFileSync("server/services/brands.ts", "utf8");
    expect(src).toMatch(/activeIsOwned[\s\S]{0,120}brandId = activeIsOwned/);
  });

  it("exposes the Uklassifisert bucket over the API", () => {
    const src = readFileSync("server/routers/brandsRouter.ts", "utf8");
    expect(src).toContain("unclassified:");
    expect(src).toContain("classify:");
  });

  it("classify cannot touch a row that already belongs to a brand", () => {
    const src = readFileSync("server/services/brandScope.ts", "utf8");
    expect(src).toMatch(/assignUnclassified[\s\S]*?\.where\(unclassified\(/);
  });

  it("ships a client surface, or the data is unreachable in the product", () => {
    const ui = readFileSync("client/src/components/UnclassifiedData.tsx", "utf8");
    expect(ui).toContain("brands.unclassified.useQuery");
    expect(ui).toContain("brands.classify.useMutation");
    // Mounted somewhere a user actually lands.
    expect(readFileSync("client/src/pages/Dashboard.tsx", "utf8")).toContain("<UnclassifiedData />");
  });
});

describe("search and scheduling honour the active brand", () => {
  for (const path of ["server/services/searchService.ts", "server/services/schedulingService.ts"]) {
    it(`${path} scopes its reads by brand`, () => {
      const src = readFileSync(path, "utf8");
      expect(src).toContain("brandScopedUser");
      // No read may fall back to matching on the user alone.
      expect(src).not.toMatch(/\.where\(eq\((posts|scheduledPosts)\.userId, userId\)\)/);
    });
  }
});
