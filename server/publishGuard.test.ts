/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { assertBrandOwnsConnection } from "./services/socialDestinations";
import { DUPLICATE_WINDOW_MS, adHocKey } from "./services/publishGuard";

/**
 * PR #82 — the two protections the spec asks for by name:
 *
 *   1. A Penna post cannot be published through a Ballong destination.
 *   2. Clicking twice does not create two posts.
 *
 * The cross-brand rule is a pure function, so it is tested for real. The
 * duplicate rule needs a live MySQL this suite does not have, so its shape is
 * pinned at every call site — the point being that it no longer depends on the
 * CLIENT choosing to send an idempotency key.
 */

describe("a post cannot be published through another brand's destination", () => {
  const errors: unknown[][] = [];
  beforeEach(() => {
    errors.length = 0;
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args); });
  });
  afterEach(() => vi.restoreAllMocks());

  it("allows a publish when post and connection share a brand", () => {
    expect(() => assertBrandOwnsConnection({
      accountId: 1, postBrandId: 10, connectionBrandId: 10, platform: "linkedin", postId: 5,
    })).not.toThrow();
    expect(errors).toEqual([]);
  });

  it("blocks Penna's post going out through Ballong's LinkedIn", () => {
    expect(() => assertBrandOwnsConnection({
      accountId: 1, postBrandId: 10 /* Penna */, connectionBrandId: 11 /* Ballong */,
      platform: "linkedin", postId: 5,
    })).toThrow(/tilhører en annen merkevare/i);
  });

  it("logs a security event on the mismatch, without leaking content", () => {
    try {
      assertBrandOwnsConnection({
        accountId: 7, postBrandId: 10, connectionBrandId: 11, platform: "linkedin", postId: 5,
      });
    } catch { /* expected */ }
    expect(errors.length).toBe(1);
    const payload = String(errors[0][1] ?? "");
    expect(payload).toContain("cross_brand_publish_blocked");
    expect(payload).toContain('"postBrandId":10');
    expect(payload).toContain('"connectionBrandId":11');
  });

  it("blocks an UNOWNED connection rather than treating it as a wildcard", () => {
    // A connection with no brand is nobody's, not everybody's — the same rule as
    // PR #79's unowned rows.
    expect(() => assertBrandOwnsConnection({
      accountId: 1, postBrandId: 10, connectionBrandId: null, platform: "linkedin",
    })).toThrow();
  });

  it("blocks an UNOWNED post too", () => {
    expect(() => assertBrandOwnsConnection({
      accountId: 1, postBrandId: null, connectionBrandId: 10, platform: "linkedin",
    })).toThrow();
  });

  it("blocks when neither side has a brand", () => {
    expect(() => assertBrandOwnsConnection({
      accountId: 1, postBrandId: null, connectionBrandId: null, platform: "instagram",
    })).toThrow();
  });

  it("applies to every platform, not just LinkedIn", () => {
    for (const platform of ["linkedin", "facebook", "instagram", "twitter"] as const) {
      expect(() => assertBrandOwnsConnection({
        accountId: 1, postBrandId: 1, connectionBrandId: 2, platform,
      }), platform).toThrow();
    }
  });
});

/** Code only — so an assertion about the LOGIC is not satisfied or broken by prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("clicking twice does not publish twice", () => {
  const guard = readFileSync("server/services/publishGuard.ts", "utf8");

  it("protects an AD-HOC publish too, not just a saved post", () => {
    // The "Publiser til LinkedIn" button on an unsaved draft sends no postId, so
    // keying on postId alone left the most double-clickable button unprotected.
    expect(adHocKey("linkedin", "Hei   verden")).toBe(adHocKey("linkedin", "Hei verden"));
    expect(adHocKey("linkedin", "Hei verden")).not.toBe(adHocKey("linkedin", "Hei verden!"));
    expect(adHocKey("linkedin", "Hei")).not.toBe(adHocKey("facebook", "Hei"));
    expect(adHocKey("linkedin", "Hei").length).toBeLessThanOrEqual(64);
  });

  it("the server key is deterministic, so the unique index can actually fire", () => {
    // randomUUID in the key meant UNIQUE(account_id, idempotency_key) never
    // fired and the "already published" branch was dead code.
    expect(guard).not.toMatch(/randomUUID\(\)/);
    expect(guard).toMatch(/Math\.floor\(Date\.now\(\) \/ DUPLICATE_WINDOW_MS\)/);
  });

  it("the duplicate check does not depend on a client-supplied key", () => {
    // This is the whole gap: protection used to exist only when the client chose
    // to send an idempotencyKey, and the unprotected path is the one a
    // double-click takes.
    const fn = guard.slice(guard.indexOf("export async function assertNotDuplicatePublish"));
    const body = stripComments(fn.slice(0, fn.indexOf("\nexport ")));
    // Never READ as a value — it may appear as a column name in the ad-hoc lookup.
    expect(body).not.toMatch(/\binput\.idempotencyKey\b/);
    expect(body).not.toMatch(/idempotencyKey\?\./);
    expect(body).toMatch(/eq\(publications\.postId, postId\)/);
    expect(body).toMatch(/eq\(publications\.platform, platform\)/);
  });

  it("treats an in-flight (pending) attempt as a duplicate", () => {
    // Letting a second attempt past while the first is still talking to the
    // provider is exactly how one click became two live posts.
    expect(guard).toMatch(/inArray\(publications\.status, \["pending", "published"\]\)/);
  });

  it("bounds the window, so a deliberate re-publish later still works", () => {
    expect(DUPLICATE_WINDOW_MS).toBeGreaterThanOrEqual(30_000);
    expect(DUPLICATE_WINDOW_MS).toBeLessThanOrEqual(300_000);
    expect(guard).toMatch(/gte\(publications\.createdAt, new Date\(Date\.now\(\) - DUPLICATE_WINDOW_MS\)\)/);
  });

  it("claims the attempt BEFORE contacting the provider", () => {
    // A crash mid-publish must leave a pending trail, not nothing.
    const claim = guard.slice(guard.indexOf("export async function claimPublication"));
    expect(claim).toMatch(/status: "pending"/);
  });

  it("still honours the unique index when a key is supplied", () => {
    expect(guard).toMatch(/UNIQUE\(account_id, idempotency_key\)/);
    expect(guard).toMatch(/allerede publisert/);
  });

  it("generates a deterministic server key when the client sends none", () => {
    expect(guard).toMatch(/`srv-\$\{input\.postId\}-\$\{input\.platform\}-\$\{bucket\}`/);
    expect(guard).toMatch(/adHocKey\(input\.platform, input\.content\)/);
  });

  it("every publish path settles a failed attempt", () => {
    // An unsettled `pending` row refuses the user's own retry for the rest of the
    // window — an expired token locked them out of fixing it.
    const settle = guard.slice(guard.indexOf("export async function settlePublication"));
    expect(settle).toMatch(/status: "failed"/);
    for (const path of [
      "server/routers/platformRouter.ts",
      "server/routers/linkedinRouter.ts",
      "server/schedulerService.ts",
    ]) {
      expect(readFileSync(path, "utf8"), path).toMatch(/settlePublication\([\s\S]{0,300}status: ['"]failed['"]/);
    }
  });

  it("checks every platform before claiming any of them", () => {
    // Otherwise a refusal on platform #2 leaves platform #1 claimed and locked.
    const router = readFileSync("server/routers/platformRouter.ts", "utf8");
    const body = router.slice(router.indexOf("publishToSpecific:"));
    expect(body.indexOf("resolved.push(")).toBeLessThan(body.indexOf("claimPublication("));
  });
});

describe("the generic publish path is guarded, not just LinkedIn", () => {
  const platformRouter = readFileSync("server/routers/platformRouter.ts", "utf8");
  const linkedinRouter = readFileSync("server/routers/linkedinRouter.ts", "utf8");

  it("publishToSpecific resolves the brand and requires a destination", () => {
    // publishingService.publishToSpecificPlatforms resolves its provider token
    // from userId alone — it has no idea brands exist.
    const body = platformRouter.slice(platformRouter.indexOf("publishToSpecific:"));
    expect(body).toContain("resolvePublishBrand");
    expect(body).toContain("requireDestination");
    expect(body).toContain("assertNotDuplicatePublish");
  });

  it("checks every platform BEFORE anything is sent to a provider", () => {
    const body = platformRouter.slice(platformRouter.indexOf("publishToSpecific:"));
    expect(body.indexOf("requireDestination")).toBeLessThan(body.indexOf("publishToSpecificPlatforms("));
    expect(body.indexOf("assertNotDuplicatePublish")).toBeLessThan(body.indexOf("publishToSpecificPlatforms("));
  });

  it("both publish paths use the SAME guard, so they cannot drift", () => {
    for (const src of [platformRouter, linkedinRouter]) {
      expect(src).toContain("services/publishGuard");
    }
    // The old hand-rolled copy in linkedinRouter is gone.
    expect(linkedinRouter).not.toContain("assertBrandOwnsConnection");
    expect(linkedinRouter).not.toMatch(/insert\(publications\)/);
  });

  it("the post's own brand wins over whichever brand is active", () => {
    // Otherwise switching brand in another tab makes a stale list publish A as B.
    const guard = readFileSync("server/services/publishGuard.ts", "utf8");
    const fn = guard.slice(guard.indexOf("export async function resolvePublishBrand"));
    const body = fn.slice(0, fn.indexOf("\nexport "));
    expect(body.indexOf("posts.brandId")).toBeLessThan(body.indexOf("getActiveBrandId"));
  });
});

describe("the destination DRIVES the publish, it does not merely validate it", () => {
  it("publishToSpecificPlatforms takes the destinations and uses them", () => {
    // Validating upstream while this method still derived the author from the
    // account-wide linkedin_connections row made the whole guard cosmetic.
    const svc = readFileSync("server/services/publishingService.ts", "utf8");
    expect(svc).toMatch(/destinations\?: Map<string, \{ destinationId: string \| null; destinationType: string \| null \}>/);
    const method = svc.slice(svc.indexOf("async publishToSpecificPlatforms("));
    expect(method).toMatch(/const wanted = destinations\?\.get\(platform\)/);
    expect(method).toMatch(/wanted\?\.destinationId[\s\S]{0,300}urn:li:/);
  });

  it("the caller actually passes them", () => {
    const router = readFileSync("server/routers/platformRouter.ts", "utf8");
    expect(router).toMatch(/publishToSpecificPlatforms\([\s\S]{0,300}destinations,/);
  });

  it("linkedin.createPost derives its author from the brand destination", () => {
    const li = readFileSync("server/routers/linkedinRouter.ts", "utf8");
    expect(li).toMatch(/brandDestination\?\.destinationType/);
    expect(li).toMatch(/authorOverride = toOrg[\s\S]{0,160}brandDestination\?\.destinationId/);
  });

  it("the scheduler worker does too, instead of always posting to the personal feed", () => {
    // It passed no author override at all, so a brand whose destination is a
    // Company Page had its scheduled posts published to the user's own profile.
    const worker = readFileSync("server/schedulerService.ts", "utf8");
    expect(worker).toContain("requireDestination");
    expect(worker).toMatch(/createLinkedInPost\([\s\S]{0,200}authorOverride/);
    expect(worker).toContain("claimPublication");
  });

  it("ignores a client-supplied brandId", () => {
    // It was always overridden when the post had a brand, and let a caller drive
    // cross-brand attempts — and the security log — with ids of its choosing.
    const li = readFileSync("server/routers/linkedinRouter.ts", "utf8");
    expect(li).not.toMatch(/input\.brandId \?\?/);
    expect(li).toMatch(/input\.brandId is IGNORED/);
  });
});

describe("every publish and schedule path is gated", () => {
  it("publishToAll is refused under multi-brand", () => {
    // It iterates EVERY token the account owns: no brand, no destination, no
    // duplicate check.
    const router = readFileSync("server/routers/platformRouter.ts", "utf8");
    const body = router.slice(router.indexOf("publishToAll:"), router.indexOf("publishToSpecific:"));
    expect(body).toMatch(/ENV\.featureMultiBrand[\s\S]{0,200}throw new TRPCError/);
  });

  it("smartSchedulePost and content.reschedule pass the same gate", () => {
    expect(readFileSync("server/routers/schedulingRouter.ts", "utf8")
      .slice(0)).toMatch(/smartSchedulePost[\s\S]*?requireDestination/);
    expect(readFileSync("server/routers/contentRouter.ts", "utf8")).toMatch(/reschedule[\s\S]*?requireDestination/);
  });
});

describe("the connection mirror follows the provider, it is not written once", () => {
  const svc = readFileSync("server/services/socialDestinations.ts", "utf8");

  it("mirrors every platform, not only LinkedIn", () => {
    // Facebook, Instagram and X had no mirror row at all, so requiring a
    // destination made every one of them permanently unpublishable.
    expect(svc).toContain("platformIntegrations");
    expect(svc).not.toMatch(/if \(existing\) return;/);
  });

  it("refreshes a drifted row instead of freezing at first sight", () => {
    expect(svc).toMatch(/const drifted =/);
    expect(svc).toMatch(/\.update\(brandSocialConnections\)/);
  });

  it("revokes a row whose provider connection is gone", () => {
    // Disconnecting used to leave the mirror `active`: the page said "Tilkoblet",
    // scheduling succeeded, and it failed hours later in the worker.
    expect(svc).toMatch(/status: "revoked"/);
  });

  it("still never guesses the brand when there is more than one", () => {
    expect(svc).toMatch(/brands\.length === 1 \? brands\[0\]\.id : null/);
    expect(svc).toMatch(/needs_brand_assignment/);
  });
});

describe("nothing is scheduled that cannot be published", () => {
  it("schedulePost requires a destination first", () => {
    // Without this the failure surfaces hours later in the worker, as a
    // "Publisering feilet" notification, with the user nowhere near it.
    const router = readFileSync("server/routers/schedulingRouter.ts", "utf8");
    const body = router.slice(router.indexOf("schedulePost: protectedProcedure"));
    expect(body).toContain("requireDestination");
    expect(body.indexOf("requireDestination")).toBeLessThan(body.indexOf("await schedulePost("));
  });

  it("requireDestination refuses rather than falling back to any account token", () => {
    const guard = readFileSync("server/services/publishGuard.ts", "utf8");
    const fn = guard.slice(guard.indexOf("export async function requireDestination"));
    const body = fn.slice(0, fn.indexOf("\nexport "));
    expect(body).toMatch(/if \(!destination\)[\s\S]{0,200}throw new Error/);
    expect(body).toMatch(/Koble til en konto først/);
  });

  it("multi-brand OFF degrades to the previous behaviour", () => {
    const guard = readFileSync("server/services/publishGuard.ts", "utf8");
    expect(guard).toMatch(/if \(!ENV\.featureMultiBrand\) return null/);
    expect(guard).toMatch(/if \(brandId == null\) return null/);
  });
});

describe("the UI only offers what the brand can actually reach", () => {
  const generate = readFileSync("client/src/pages/Generate.tsx", "utf8");

  it("shows no platform chips until the destinations are known", () => {
    // Falling back to all three while loading made them flash up, the user click
    // one, and the choice vanish — or worse, stay and fail at publish time.
    expect(generate).toMatch(/const destinationsKnown =/);
    expect(generate).toMatch(/!destinationsKnown\s*\n?\s*\? \[\]/);
  });

  it("keys the loading state off isLoading, not isSuccess", () => {
    // isSuccess never becomes true on error, which left the page stuck on
    // "Henter kanalene …" with nothing selectable; and an unresolved flag query
    // let all three chips flash up on first paint.
    expect(generate).toMatch(/const flagsSettled = !socialFlags\.isLoading/);
    expect(generate).toMatch(/!destinationsQuery\.isLoading/);
    expect(generate).not.toMatch(/destinationsQuery\.isSuccess/);
  });

  it("a publish refusal is shown to the user", () => {
    // publishToSpecific RESOLVES with { success: false }, so a refusal arrived in
    // onSuccess with neither count set and the UI said nothing at all.
    const posts = readFileSync("client/src/pages/Posts.tsx", "utf8");
    expect(posts).toMatch(/if \(r\.success === false\)[\s\S]{0,200}toast\.error/);
  });

  it("says it is loading rather than showing an empty state", () => {
    expect(generate).toMatch(/\{!destinationsKnown && \(/);
    expect(generate).toContain("Henter kanalene til merkevaren");
  });

  it("offers a clear way out when nothing is connected", () => {
    expect(generate).toMatch(/destinationsKnown && platformPicks\.length === 0/);
    expect(generate).toContain("/settings/platforms");
  });
});

describe("the per-brand Kanaler page", () => {
  const page = readFileSync("client/src/pages/BrandPlatforms.tsx", "utf8");

  it("is scoped to the active brand and names it", () => {
    expect(page).toContain("social.destinations.useQuery");
    expect(page).toMatch(/destinations\.data\?\.brandName/);
  });

  it("offers Koble til konto for every unconnected channel", () => {
    expect(page).toContain("Koble til konto");
    expect(page).toMatch(/p\.connected \?/);
  });

  it("lets the user assign a legacy connection to the right brand", () => {
    expect(page).toContain("social.unassigned.useQuery");
    expect(page).toContain("social.assignBrand.useMutation");
    // The brand is chosen, never guessed.
    expect(page).toMatch(/<select/);
  });

  it("is routed and reachable", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toMatch(/path=\{"\/settings\/platforms"\} component=\{BrandPlatforms\}/);
    const nav = readFileSync("client/src/components/DashboardNav.tsx", "utf8");
    expect(nav).toContain("/settings/platforms");
    // Only shown when multi-brand is on — otherwise it answers a question the
    // account does not have.
    expect(nav).toMatch(/multiBrandEnabled \? \[\{ label: "Kanaler"/);
  });

  it("the brand wizard's connect step lands here", () => {
    const wizard = readFileSync("client/src/components/AddBrandWizard.tsx", "utf8");
    expect(wizard).toMatch(/setLocation\("\/settings\/platforms"\)/);
  });
});
