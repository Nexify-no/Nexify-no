/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { and, eq } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { brandProfiles, brands } from "../drizzle/schema";
import { publicFailure, BrandAnalysisError } from "./services/merkehjerne/analyzeIntoBrand";

/**
 * PR #80 — "Legg til merkevare" from a website address.
 *
 * The acceptance criteria that matter are all about ORDER: the brand, its
 * Merkehjerne and its link must share one brand_id, and nothing may be generated
 * before the user has confirmed the profile.
 *
 * Those are made structural rather than hopeful: the brand row is created first
 * as a `draft`, the analysis writes into it, and a draft is invisible to
 * listBrands and unselectable — so no generator can reach it.
 */

const router = readFileSync("server/routers/brandsRouter.ts", "utf8");
const service = readFileSync("server/services/merkehjerne/analyzeIntoBrand.ts", "utf8");

const dialect = new MySqlDialect();

describe("publicFailure — errors stay safe to show", () => {
  it("passes a crawler's vetted public message through", () => {
    const err = Object.assign(new Error("internal"), {
      code: "blocked_host",
      publicMessage: "Denne nettadressen kan ikke analyseres.",
    });
    expect(publicFailure(err)).toEqual({
      code: "BAD_REQUEST",
      message: "Denne nettadressen kan ikke analyseres.",
    });
  });

  it("supplies a fallback when a known code carries no message", () => {
    const out = publicFailure(Object.assign(new Error("x"), { code: "invalid_url" }));
    expect(out.code).toBe("BAD_REQUEST");
    expect(out.message).toBe("Kunne ikke analysere denne nettadressen.");
  });

  it("maps a busy worker to a retryable code, not a 500", () => {
    expect(publicFailure(Object.assign(new Error("x"), { code: "busy" })).code)
      .toBe("TOO_MANY_REQUESTS");
  });

  it("never leaks an unexpected error's own message", () => {
    // Driver and fetch messages echo URLs and column values.
    const secret = "connect ECONNREFUSED 10.0.0.5:3306 for user admin";
    const out = publicFailure(new Error(secret));
    expect(out.code).toBe("INTERNAL_SERVER_ERROR");
    expect(out.message).not.toContain("10.0.0.5");
    expect(out.message).not.toContain("admin");
  });

  it("round-trips a BrandAnalysisError without re-wrapping it", () => {
    const failure = { code: "FORBIDDEN", message: "Kvoten er brukt opp." } as const;
    expect(publicFailure(new BrandAnalysisError({ ...failure }))).toEqual(failure);
  });

  it("truncates an over-long public message", () => {
    const err = Object.assign(new Error("x"), {
      code: "no_readable_content",
      publicMessage: "a".repeat(500),
    });
    expect(publicFailure(err).message.length).toBeLessThanOrEqual(300);
  });
});

describe("one brand_id from the first write", () => {
  it("the analysis targets an explicit brand, not whichever is active", () => {
    expect(service).toMatch(/export async function analyzeIntoBrand\([\s\S]{0,200}brandId: number \| null/);
  });

  it("the profile insert carries that brandId", () => {
    expect(service).toMatch(/\.insert\(brandProfiles\)[\s\S]{0,200}brandId,/);
  });

  it("startFromUrl creates the brand BEFORE analysing it", () => {
    const body = router.slice(router.indexOf("startFromUrl:"), router.indexOf("journey:"));
    expect(body.indexOf("insert(brands)")).toBeGreaterThan(-1);
    expect(body.indexOf("insert(brands)")).toBeLessThan(body.indexOf("analyzeIntoBrand("));
  });

  it("the scope used by the analysis is exact (user, brand)", () => {
    const scoped = and(eq(brandProfiles.userId, 7), eq(brandProfiles.brandId, 42))!;
    const sql = dialect.sqlToQuery(scoped).sql;
    expect(sql).not.toMatch(/is null/i);
    expect(sql).toContain("`brand_id` = ?");
  });
});

describe("nothing is generated before confirmation", () => {
  it("the new brand starts as a draft", () => {
    const body = router.slice(router.indexOf("startFromUrl:"), router.indexOf("journey:"));
    expect(body).toMatch(/brandStatus: "draft"/);
  });

  it("listBrands only ever returns active brands, so a draft cannot be read as one", () => {
    const brandsSrc = readFileSync("server/services/brands.ts", "utf8");
    expect(brandsSrc).toMatch(/eq\(brands\.brandStatus, "active"\)/);
  });

  it("a draft brand cannot be selected", () => {
    const body = router.slice(router.indexOf("setActive:"), router.indexOf("archive:"));
    // Goes through the shared guard, which rejects draft and archived alike.
    expect(body).toContain("requireActiveBrand");
    expect(router).toMatch(/requireActiveBrand[\s\S]{0,400}brand\.brandStatus !== "active"/);
  });

  it("does NOT gate generation on confirmedAt — the draft status does that job", () => {
    // A confirmedAt check would be weaker (content/repurpose/coach/images read
    // the profile via loadBrandHints and would stay ungated) and harmful
    // (brand.update and setFacts null confirmedAt, so editing one word of an
    // existing brand would block plan creation that worked a minute earlier).
    const plan = readFileSync("server/routers/plannedContentRouter.ts", "utf8");
    expect(plan).not.toMatch(/if \(!brand\.confirmedAt\)[\s\S]{0,200}throw new TRPCError/);
  });

  it("every Merkehjerne read is ordered, so a draft's newest row cannot win", () => {
    // With brandId null — multi-brand off, or a swallowed transient DB error —
    // ownedBy degrades to user_id alone. An unordered LIMIT 1 would then hand a
    // draft's unreviewed tone and facts to every AI tool.
    for (const path of [
      "server/services/merkehjerne/brandContext.ts",
      "server/routers/plannedContentRouter.ts",
      "server/routers/contentRouter.ts",
    ]) {
      const src = readFileSync(path, "utf8");
      const reads = src.match(/from\(brandProfiles\)[\s\S]{0,600}?\.limit\(1\)/g) ?? [];
      expect(reads.length, path).toBeGreaterThan(0);
      for (const r of reads) expect(r, path).toContain("orderBy(brandProfiles.id)");
    }
  });

  it("confirm refuses a profile that is not ready", () => {
    const body = router.slice(router.indexOf("confirmFromUrl:"), router.indexOf("discardDraft:"));
    expect(body).toMatch(/profile\.status !== "ready"[\s\S]{0,200}throw new TRPCError/);
  });
});

describe("confirming is what makes the brand real", () => {
  const body = router.slice(router.indexOf("confirmFromUrl:"), router.indexOf("discardDraft:"));

  it("stamps confirmedAt, activates the brand and selects it", () => {
    expect(body).toMatch(/confirmedAt: new Date\(\)/);
    expect(body).toMatch(/brandStatus: "active"/);
    expect(body).toMatch(/\.update\(users\)[\s\S]{0,120}activeBrandId: input\.brandId/);
  });

  it("scopes every write to the session account", () => {
    expect(body).toMatch(/eq\(brands\.accountId, ctx\.user\.id\)/);
    expect(body).toMatch(/eq\(brandProfiles\.userId, ctx\.user\.id\)/);
    expect(body).toMatch(/eq\(users\.id, ctx\.user\.id\)/);
  });

  it("carries the analysed website onto the brand, so brand and link agree", () => {
    expect(body).toMatch(/websiteUrl: profile\.websiteUrl/);
  });
});

describe("an abandoned journey leaves nothing behind", () => {
  const body = router.slice(router.indexOf("discardDraft:"));

  it("discard refuses anything that is not a draft", () => {
    // Otherwise this endpoint becomes a way to delete a real brand.
    expect(body).toMatch(/brand\.brandStatus !== "draft"[\s\S]{0,200}throw new TRPCError/);
  });

  it("a failed analysis cleans up the draft it created", () => {
    // The client never receives brandId when startFromUrl throws, so a draft
    // created in that call would be unreachable by discardDraft forever.
    const start = router.slice(router.indexOf("startFromUrl:"), router.indexOf("journey:"));
    expect(start).toMatch(/if \(createdHere\)[\s\S]{0,400}\.delete\(brands\)/);
  });

  it("removes the profile and the brand, both account-scoped", () => {
    expect(body).toMatch(/\.delete\(brandProfiles\)[\s\S]{0,200}eq\(brandProfiles\.userId, ctx\.user\.id\)/);
    expect(body).toMatch(/\.delete\(brands\)[\s\S]{0,240}eq\(brands\.brandStatus, "draft"\)/);
  });

  it("startFromUrl reuses an existing draft instead of piling them up", () => {
    const start = router.slice(router.indexOf("startFromUrl:"), router.indexOf("journey:"));
    expect(start).toMatch(/eq\(brands\.brandStatus, "draft"\)/);
    expect(start).toMatch(/if \(stale\)/);
  });

  it("the client discards the draft when the review step is abandoned", () => {
    const ui = readFileSync("client/src/components/AddBrandWizard.tsx", "utf8");
    expect(ui).toMatch(/step === "review" && brandId != null\) discard\.mutate/);
  });
});

describe("the journey the user actually sees", () => {
  const ui = readFileSync("client/src/components/AddBrandWizard.tsx", "utf8");

  it("starts from the URL alone", () => {
    expect(ui).toMatch(/startFromUrl\.useMutation/);
    expect(ui).toContain("Nettadressen til bedriften");
  });

  it("shows name, services, audience, tone and colours", () => {
    for (const label of ["Navn", "Tjenester", "Målgruppe", "Tone", "Farger"]) {
      expect(ui).toContain(label);
    }
  });

  it("shows each fact WITH its source", () => {
    // A claim the user cannot trace is a claim they cannot check, and these end
    // up in published posts.
    expect(ui).toContain("Fakta vi fant — med kilde");
    expect(ui).toMatch(/href=\{f\.sourceUrl\}/);
    expect(ui).toMatch(/rel="noreferrer noopener"/);
  });

  it("offers the optional connect step for all four platforms", () => {
    expect(ui).toContain("Koble til sidene dine");
    for (const p of ["LinkedIn", "Facebook", "Instagram"]) expect(ui).toContain(p);
    expect(ui).toContain("Koble til konto");
  });

  it("the connect step navigates client-side to a route that exists", () => {
    // /settings/platforms is not a route; a raw <a href> would also hard-reload
    // and tear the wizard down on the way to a 404.
    // No link or navigation may target it (the comment explaining why may).
    expect(ui).not.toMatch(/(href|setLocation\()\s*=?\s*["'`]\/settings\/platforms/);
    expect(ui).toMatch(/setLocation\("\/settings"\)/);
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toMatch(/path=\{"\/settings"\}/);
  });

  it("refetches the review data instead of trusting the 30s global cache", () => {
    // startFromUrl reuses an abandoned draft, so the same brandId recurs — the
    // cache would serve the PREVIOUS site's profile with no spinner.
    const q = ui.slice(ui.indexOf("brands.journey.useQuery"), ui.indexOf("startFromUrl.useMutation"));
    expect(q).toMatch(/staleTime: 0/);
    expect(q).toMatch(/refetchOnMount: "always"/);
  });

  it("has an error branch, so a discarded draft does not render an empty modal", () => {
    expect(ui).toMatch(/journey\.isError && \(/);
    expect(ui).toContain("Start på nytt");
  });

  it("invalidates every query on confirm, so all examples change over at once", () => {
    const confirmBlock = ui.slice(ui.indexOf("confirmFromUrl.useMutation"));
    expect(confirmBlock.slice(0, 500)).toContain("utils.invalidate()");
  });

  it("only a draft can be confirmed", () => {
    // Accepting an active brand would let a caller rename a live brand and stamp
    // confirmedAt on a Merkehjerne nobody reviewed.
    const body = router.slice(router.indexOf("confirmFromUrl:"), router.indexOf("discardDraft:"));
    expect(body).toMatch(/brand\.brandStatus !== "draft"[\s\S]{0,200}throw new TRPCError/);
  });

  it("classify and archive refuse a draft id, which the client already knows", () => {
    // classify onto a draft then discard left legacy rows pointing at a deleted
    // brand — invisible everywhere AND no longer NULL, so gone from Uklassifisert.
    expect(router).toMatch(/async function requireActiveBrand/);
    const classify = router.slice(router.indexOf("classify:"), router.indexOf("setActive:"));
    expect(classify).toContain("requireActiveBrand");
    const archive = router.slice(router.indexOf("archive:"));
    expect(archive).toContain("requireActiveBrand");
  });

  it("the name-only create endpoint is gone, not merely unused", () => {
    // It minted an active brand with no Merkehjerne — the behaviour this PR
    // removed from the UI. An unused endpoint keeps it reachable over tRPC.
    expect(router).not.toMatch(/^\s{2}create: protectedProcedure/m);
  });

  it("the draft id is learned from the INSERT, not a racy re-select", () => {
    const start = router.slice(router.indexOf("startFromUrl:"), router.indexOf("journey:"));
    expect(start).toContain("$returningId()");
  });

  it("cannot confirm before the analysis is ready", () => {
    expect(ui).toMatch(/disabled=\{!profile \|\| profile\.status !== "ready"/);
  });

  it("surfaces injection warnings rather than hiding them", () => {
    expect(ui).toMatch(/injectionWarnings/);
  });
});

describe("brand.analyze and the journey share one implementation", () => {
  it("brand.analyze delegates instead of keeping its own copy", () => {
    const brandRouter = readFileSync("server/routers/brandRouter.ts", "utf8");
    expect(brandRouter).toContain("analyzeIntoBrand");
    // The quota / cooldown / analysisId logic must live in exactly one place.
    expect(brandRouter).not.toContain("hasAnalysisQuota");
    expect(brandRouter).not.toContain("randomUUID");
  });

  it("the shared service still guards quota, in-flight scans and cooldown", () => {
    expect(service).toContain("hasAnalysisQuota");
    expect(service).toMatch(/ACTIVE_SCAN_WINDOW_MS/);
    expect(service).toMatch(/RESCAN_COOLDOWN_MS/);
    expect(service).toContain("chargeAnalysisQuota");
  });

  it("pins the write to its own scan, so an older request cannot overwrite a newer one", () => {
    expect(service).toMatch(/eq\(brandProfiles\.analysisId, analysisId\)/);
  });

  it("only charges quota for a real analysis, not a cached re-scan", () => {
    expect(service).toMatch(/if \(result\.unchanged\)[\s\S]{0,300}else \{[\s\S]{0,200}chargeAnalysisQuota/);
  });
});

describe("the draft status is registered everywhere it has to be", () => {
  it("the schema enum includes draft", () => {
    const schema = readFileSync("drizzle/schema.ts", "utf8");
    expect(schema).toMatch(/mysqlEnum\("brand_status", \["draft", "active", "archived"\]\)/);
  });

  it("a migration widens the column, and the journal knows about it", () => {
    const sql = readFileSync("drizzle/0093_brand_draft_status.sql", "utf8");
    expect(sql).toMatch(/MODIFY COLUMN `brand_status` enum\('draft','active','archived'\)/);
    // Default must stay 'active' — ensureDefaultBrand and create() rely on it.
    expect(sql).toMatch(/DEFAULT 'active'/);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries.map((e: { tag: string }) => e.tag)).toContain("0093_brand_draft_status");
  });

  it("brands table type still resolves", () => {
    // Cheap guard that the enum edit did not break the drizzle table object.
    expect(dialect.sqlToQuery(eq(brands.brandStatus, "draft")).sql).toContain("`brand_status`");
  });
});
