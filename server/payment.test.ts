/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * payment router: pricing plans, current subscription, usage.
 *
 * The previous version of this file did not test the product at all. Each of its
 * 16 cases configured a db mock to return a literal, read that literal back
 * through the mock, and then asserted the literal — `mockDb.limit
 * .mockResolvedValueOnce([{ id: 1, name: "Pro" }])` followed by
 * `expect(plans).toBeDefined()`. Every assertion was additionally wrapped in
 * `if (rows.length > 0)` inside a `try/catch` that converted failures to
 * "expected [Error] to be undefined", so the file could neither fail usefully nor
 * pass meaningfully. It failed anyway: the mock chain was built with
 * `vi.fn().mockReturnThis()` at module scope and the suite runs with
 * `mockReset: true` (vitest.config.ts), which strips spy implementations before
 * every test.
 *
 * This version drives the real procedures. The things worth protecting here are
 * the ones that decide what a customer is charged and what they may use: the
 * tier derived from the plan row, and the quota attached to that tier.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./testing/fakeDb";
import { mkCtx } from "./testing/ctx";
import { getPlan } from "../shared/pricing";

let fake: FakeDb;
/** What `getUserSubscription` resolves to. null = no subscription row. */
let subscription: Record<string, unknown> | null = null;
/** What `getUserPosts` resolves to. */
let userPosts: Array<Record<string, unknown>> = [];
let askedSubscriptionFor: number | null = null;

// Plain functions, not spies: `mockReset: true` strips spy implementations
// before every test, which is what broke the previous version of this file.
// The real module is spread in first: `caller()` imports the whole router graph
// and several routers import named db helpers eagerly, so a factory that exported
// only these four would leave every other binding undefined for the whole file.
vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: async () => fake.db,
  getUserSubscription: async (userId: number) => {
    askedSubscriptionFor = userId;
    return subscription;
  },
  getUserPosts: async () => userPosts,
  updateSubscription: async () => undefined,
}));

async function caller(userId = 1) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(mkCtx(userId));
}

const activeSub = (over: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 1,
  planId: 2,
  status: "active",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_123",
  subscriptionStartDate: new Date("2026-07-01T00:00:00Z"),
  subscriptionEndDate: new Date("2026-08-01T00:00:00Z"),
  postsGenerated: 4,
  ...over,
});

beforeEach(() => {
  fake = createFakeDb();
  subscription = null;
  userPosts = [];
  askedSubscriptionFor = null;
});

describe("payment.getPricingPlans", () => {
  it("exposes the tiers the checkout accepts, priced from the shared source of truth", async () => {
    const plans = await (await caller()).payment.getPricingPlans();
    const byKey = Object.fromEntries(plans.map((p) => [p.key, p]));

    // Drift between the backend catalogue and @shared/pricing is how a customer
    // gets shown one price and charged another.
    expect(byKey.FREE.priceNOK).toBe(getPlan("FREE").monthlyNOK);
    expect(byKey.PRO_MONTHLY.priceNOK).toBe(getPlan("PRO").monthlyNOK);
    expect(byKey.PRO_MONTHLY.interval).toBe("month");
    expect(byKey.PRO_YEARLY.interval).toBe("year");

    // A yearly plan must be cheaper than twelve monthly ones or the discount it
    // advertises is a lie.
    expect(byKey.PRO_YEARLY.priceNOK).toBeLessThan(byKey.PRO_MONTHLY.priceNOK * 12);
  });

  it("carries a name, description and features for every plan", async () => {
    const plans = await (await caller()).payment.getPricingPlans();
    expect(plans.length).toBeGreaterThanOrEqual(3);
    for (const p of plans) {
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(Array.isArray(p.features)).toBe(true);
      expect(p.features.length).toBeGreaterThan(0);
    }
  });

  it("needs no database and no session", async () => {
    await (await caller()).payment.getPricingPlans();
    expect(fake.ops).toHaveLength(0);
  });
});

describe("payment.getCurrentSubscription", () => {
  it("reports FREE/trial when the user has no subscription row", async () => {
    const r = await (await caller()).payment.getCurrentSubscription();
    expect(r).toEqual({
      tier: "FREE",
      status: "trial",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  it("asks only about the calling user", async () => {
    await (await caller(42)).payment.getCurrentSubscription();
    expect(askedSubscriptionFor).toBe(42);
  });

  it("derives the tier from the plan row, so Premium is not reported as Pro", async () => {
    // The bug this replaced: a stripe heuristic called every paying customer
    // "PRO", so an Enterprise account silently got Pro's limits.
    subscription = activeSub();
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Premium" }] } });

    const r = await (await caller()).payment.getCurrentSubscription();
    expect(r.tier).toBe("ENTERPRISE");
  });

  it("maps Pro and Gratis plan names to their tiers", async () => {
    subscription = activeSub();

    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Pro" }] } });
    expect((await (await caller()).payment.getCurrentSubscription()).tier).toBe("PRO");

    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Gratis" }] } });
    expect((await (await caller()).payment.getCurrentSubscription()).tier).toBe("FREE");
  });

  it("falls back to PRO for an unrecognised paid plan name", async () => {
    // Deliberate: an unknown paid plan should keep paid features working rather
    // than silently demote a paying customer to FREE.
    subscription = activeSub();
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Byrå 2027" }] } });
    expect((await (await caller()).payment.getCurrentSubscription()).tier).toBe("PRO");
  });

  it("stays FREE while the subscription is not active", async () => {
    subscription = activeSub({ status: "past_due" });
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Premium" }] } });

    const r = await (await caller()).payment.getCurrentSubscription();
    expect(r.tier).toBe("FREE");
    expect(r.status).toBe("past_due");
    // No point querying the plan when the tier cannot be paid anyway.
    expect(fake.opsOf("select", "subscription_plans")).toHaveLength(0);
  });

  it("stays FREE when the row has no plan attached", async () => {
    subscription = activeSub({ planId: null });
    expect((await (await caller()).payment.getCurrentSubscription()).tier).toBe("FREE");
  });

  it("passes through the billing period and the Stripe id", async () => {
    subscription = activeSub();
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Pro" }] } });

    const r = await (await caller()).payment.getCurrentSubscription();
    expect(r.currentPeriodStart).toEqual(new Date("2026-07-01T00:00:00Z"));
    expect(r.currentPeriodEnd).toEqual(new Date("2026-08-01T00:00:00Z"));
    expect(r.stripeSubscriptionId).toBe("sub_123");
  });
});

describe("payment.getSubscriptionUsage", () => {
  it("gives an account with no subscription the SAME free allowance as a lapsed one", async () => {
    // These used to differ: the no-subscription branch hardcoded 5 posts and 1
    // platform while the FREE tier table said 2 and 4, so a brand-new account got
    // a bigger allowance than someone whose subscription had ended.
    const fresh = await (await caller()).payment.getSubscriptionUsage();

    subscription = activeSub({ status: "cancelled" });
    const lapsed = await (await caller()).payment.getSubscriptionUsage();

    expect(fresh.tier).toBe("FREE");
    expect(fresh.postsUsed).toBe(0);
    expect(fresh.postsLimit).toBe(getPlan("FREE").postsPerMonth);
    expect(fresh.aiImagesLimit).toBe(0); // no AI images on the free tier

    expect(lapsed.postsLimit).toBe(fresh.postsLimit);
    expect(lapsed.platformsLimit).toBe(fresh.platformsLimit);
    expect(lapsed.aiImagesLimit).toBe(fresh.aiImagesLimit);
  });

  it("reports the Pro allowance for an active Pro subscription", async () => {
    subscription = activeSub({ postsGenerated: 4 });
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Pro" }] } });
    const r = await (await caller()).payment.getSubscriptionUsage();

    expect(r.tier).toBe("PRO");
    expect(r.postsUsed).toBe(4);
    expect(r.postsLimit).toBe(getPlan("PRO").postsPerMonth);
    expect(r.aiImagesLimit).toBeGreaterThan(0);
  });

  it("reports the PREMIUM allowance for a Premium subscription, not Pro's", async () => {
    // The bug: usage derived the tier from a Stripe heuristic that returned "PRO"
    // for anyone paying, so the ENTERPRISE row of the limits table was
    // unreachable and every Premium customer was capped at Pro's quota — while
    // getCurrentSubscription told them they were on Premium.
    subscription = activeSub();
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Premium" }] } });
    const r = await (await caller()).payment.getSubscriptionUsage();

    expect(r.tier).toBe("ENTERPRISE");
    expect(r.postsLimit).toBe(getPlan("PREMIUM").postsPerMonth);
    expect(r.postsLimit).toBeGreaterThan(getPlan("PRO").postsPerMonth);
  });

  it("agrees with getCurrentSubscription about the tier", async () => {
    // One subscription must not be Premium on the billing page and Pro in the
    // quota check.
    subscription = activeSub();
    for (const [name, tier] of [
      ["Gratis", "FREE"],
      ["Pro", "PRO"],
      ["Premium", "ENTERPRISE"],
    ] as const) {
      fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name }] } });
      const c = await caller();
      const current = await c.payment.getCurrentSubscription();
      fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name }] } });
      const usage = await c.payment.getSubscriptionUsage();

      expect(current.tier).toBe(tier);
      expect(usage.tier).toBe(tier);
    }
  });

  it("keeps the free allowance when the subscription is not active", async () => {
    subscription = activeSub({ status: "cancelled" });
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Premium" }] } });
    const r = await (await caller()).payment.getSubscriptionUsage();
    expect(r.tier).toBe("FREE");
    expect(r.postsLimit).toBe(getPlan("FREE").postsPerMonth);
  });

  it("counts DISTINCT platforms, not posts", async () => {
    subscription = activeSub();
    userPosts = [
      { platform: "linkedin", imageUrl: null },
      { platform: "linkedin", imageUrl: null },
      { platform: "facebook", imageUrl: null },
    ];
    const r = await (await caller()).payment.getSubscriptionUsage();
    expect(r.platformsUsed).toBe(2);
  });

  it("counts only posts that actually have an image against the image quota", async () => {
    subscription = activeSub();
    userPosts = [
      { platform: "linkedin", imageUrl: "https://x/1.png" },
      { platform: "linkedin", imageUrl: null },
      { platform: "linkedin", imageUrl: "" }, // empty string is not an image
    ];
    const r = await (await caller()).payment.getSubscriptionUsage();
    expect(r.aiImagesUsed).toBe(1);
  });

  it("never reports a limit of zero posts for a paying tier", async () => {
    subscription = activeSub();
    fake = createFakeDb({ rows: { subscription_plans: [{ id: 2, name: "Pro" }] } });
    const r = await (await caller()).payment.getSubscriptionUsage();
    expect(r.postsLimit).toBeGreaterThan(0);
    expect(r.platformsLimit).toBeGreaterThan(0);
  });
});

describe("payment.getBillingHistory", () => {
  it("returns an empty list when there is nothing to bill", async () => {
    expect(await (await caller()).payment.getBillingHistory()).toEqual([]);
  });

  it("returns an empty list rather than throwing for a subscription with no Stripe id", async () => {
    subscription = activeSub({ stripeSubscriptionId: null });
    expect(await (await caller()).payment.getBillingHistory()).toEqual([]);
  });
});
