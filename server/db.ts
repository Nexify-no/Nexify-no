/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { desc, eq, and, count, gte, lte, lt, sql, isNotNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
// The callback-style pool, not mysql2/promise: drizzle's mysql2 driver wraps it
// itself, and `ReturnType<typeof drizzle>` is typed against this one.
import { createPool } from "mysql2";
import * as schema from "../drizzle/schema";
import { sanitizeHtml } from "./_core/sanitizeHtml";
import { 
  InsertUser, 
  users, 
  posts, 
  Post, 
  InsertPost,
  voiceSamples,
  VoiceSample,
  InsertVoiceSample,
  subscriptions,
  subscriptionPlans,
  Subscription,
  InsertSubscription,
  userPreferences,
  UserPreference,
  InsertUserPreference,
  contentAnalysis,
  ContentAnalysis,
  InsertContentAnalysis,
  savedExamples,
  SavedExample,
  InsertSavedExample,
  blogPosts,
  BlogPost,
  InsertBlogPost,
  voiceProfiles,
  VoiceProfile,
  InsertVoiceProfile,
  userInterests,
  UserInterest,
  InsertUserInterest,
  trendingTopics,
  TrendingTopic,
  InsertTrendingTopic,
  faqs,
  FAQ,
  hashtagSuggestions,
  HashtagSuggestion,
  InsertHashtagSuggestion,
  hashtagPerformance,
  HashtagPerformance,
  InsertHashtagPerformance,
  trendingHashtags,
  TrendingHashtag,
  InsertTrendingHashtag,
  invoices,
  Invoice,
  InsertInvoice,
  generationPresets,
  GenerationPreset,
  InsertGenerationPreset
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { authTokens, scheduledPosts } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Pass the schema so Drizzle's relational query API (db.query.*) works —
      // without it, db.query is undefined and any findFirst/findMany throws
      // "Cannot read properties of undefined" (e.g. the whole settings feature).
      //
      // The pool is built explicitly rather than by handing drizzle the URL
      // string (which is exactly `createPool({ uri })`, so nothing the URL
      // encodes — TLS included — is lost) in order to set ONE option:
      // keepAliveInitialDelay.
      //
      // Without it mysql2 calls socket.setKeepAlive(true, undefined) and the OS
      // default takes over: roughly two hours before the first probe. TiDB
      // Cloud's serverless gateway drops an idle connection long before that,
      // and nothing tells us — the socket looks alive until a cron tick tries to
      // use it and has to pay for a fresh TLS handshake. A 30s probe keeps the
      // connection genuinely alive instead of nominally alive.
      //
      // Deliberately NOT set: `maxIdle`. mysql2 only starts its idle-reaper when
      // maxIdle < connectionLimit (base/pool.js), so leaving them equal keeps the
      // reaper switched off and idle connections warm — which is what we want on
      // a database that bills per connection. Lowering maxIdle "to be tidy" would
      // switch the reaper ON and make handshake churn worse, not better.
      const pool = createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 10,
        keepAliveInitialDelay: 30_000,
      });
      _db = drizzle(pool, { schema, mode: "default" });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "avatarUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (
      (ENV.ownerOpenId && user.openId === ENV.ownerOpenId) ||
      (process.env.OWNER_EMAIL &&
        user.email &&
        user.email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase())
    ) {
      // Owner bootstrap: the account matching OWNER_OPEN_ID or OWNER_EMAIL becomes
      // admin on login (so the owner can manage users without a DB edit).
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Look up a user by email (used by email/password auth). Returns the full row,
 * including passwordHash, or undefined when not found.
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create a new email/password user. The caller must have already hashed the
 * password (bcrypt) and ensured the email is not already taken.
 */
export async function createEmailUser(input: {
  openId: string;
  email: string;
  name?: string | null;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values({
    openId: input.openId,
    email: input.email,
    name: input.name ?? null,
    loginMethod: "email",
    passwordHash: input.passwordHash,
    lastSignedIn: new Date(),
  });
  const created = await getUserByOpenId(input.openId);
  if (!created) throw new Error("Failed to load newly created user");
  return created;
}

/** Mark a user's email as verified (idempotent). */
export async function markEmailVerified(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, userId));
}

/** Replace a user's password hash (used by password reset). */
export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

/** Store a single-use auth token (caller passes the SHA-256 hash, never the raw token). */
export async function createAuthToken(input: {
  userId: number;
  type: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(authTokens).values(input);
}

/** Return a token row only if it exists, matches the type, is unused and not expired. */
export async function getValidAuthToken(tokenHash: string, type: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, type)))
    .limit(1);
  const t = rows[0];
  if (!t) return undefined;
  if (t.usedAt) return undefined;
  if (new Date(t.expiresAt).getTime() < Date.now()) return undefined;
  return t;
}

/** Mark a token as used so it cannot be redeemed twice. */
export async function markAuthTokenUsed(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, id));
}

/**
 * Idempotency guard for payment webhooks. Returns true if this event is new
 * (and records it), false if it has already been processed.
 */
export async function markWebhookEventProcessed(eventId: string, source: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { processedWebhookEvents } = await import("../drizzle/schema");
  const existing = await db
    .select()
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.eventId, eventId))
    .limit(1);
  if (existing.length > 0) return false;
  await db.insert(processedWebhookEvents).values({ eventId, source });
  return true;
}

/**
 * Unified server-side post-quota enforcement — the single source of truth used
 * by every generation path. Reserves a slot atomically (never trusts the client
 * to self-report). Throws when the limit is reached or the subscription is unusable.
 *   - Trial:  cumulative cap (`subscriptions.postsGenerated` vs `trialPostsLimit`).
 *   - Active: monthly meter (`userUsageTracking.postsUsed` vs plan `postsPerMonth`).
 */
export async function enforcePostQuota(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { subscriptions, subscriptionPlans, userUsageTracking } = await import("../drizzle/schema");
  const { eq, and, gte, lte } = await import("drizzle-orm");

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (!sub) throw new Error("No subscription found");

  // Trial: cumulative total cap. Increment ATOMICALLY with a conditional update
  // so concurrent requests can't all read the same count and race past the cap.
  if (sub.status === "trial") {
    const res: any = await db.update(subscriptions)
      .set({ postsGenerated: sql`${subscriptions.postsGenerated} + 1`, updatedAt: new Date() })
      .where(and(eq(subscriptions.id, sub.id), lt(subscriptions.postsGenerated, subscriptions.trialPostsLimit)));
    const affected = res?.[0]?.affectedRows ?? res?.affectedRows ?? 0;
    if (affected === 0) {
      throw new Error("Trial limit reached. Please upgrade to continue.");
    }
    return;
  }

  // Beyond trial, only an active subscription may generate.
  if (sub.status !== "active") {
    throw new Error("Subscription is not active. Please renew to continue.");
  }
  if (!sub.planId) return; // active without a specific plan → no monthly cap

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, sub.planId))
    .limit(1);
  if (!plan || plan.postsPerMonth == null) return; // unlimited / unknown → no cap

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [usage] = await db
    .select()
    .from(userUsageTracking)
    .where(
      and(
        eq(userUsageTracking.userId, userId),
        eq(userUsageTracking.subscriptionId, sub.id),
        gte(userUsageTracking.periodEndDate, now),
        lte(userUsageTracking.periodStartDate, now)
      )
    )
    .limit(1);

  const used = usage?.postsUsed ?? 0;
  if (used >= plan.postsPerMonth) {
    throw new Error("Monthly post limit reached. Please upgrade your plan.");
  }

  if (usage) {
    // Atomic conditional increment — race-safe against the cap (see trial path).
    const res: any = await db.update(userUsageTracking)
      .set({ postsUsed: sql`${userUsageTracking.postsUsed} + 1` })
      .where(and(eq(userUsageTracking.id, usage.id), lt(userUsageTracking.postsUsed, plan.postsPerMonth)));
    const affected = res?.[0]?.affectedRows ?? res?.affectedRows ?? 0;
    if (affected === 0) {
      throw new Error("Monthly post limit reached. Please upgrade your plan.");
    }
  } else {
    await db.insert(userUsageTracking).values({
      userId,
      subscriptionId: sub.id,
      postsUsed: 1,
      imagesUsed: 0,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
    } as any);
  }
}


/**
 * Server-side image-quota enforcement (fal.ai / FLUX). Mirrors enforcePostQuota.
 * Free/trial users get 2 AI images per calendar month; active plans use
 * plan.imagesPerMonth (null = unlimited). Reserves a slot atomically.
 */
/** Read-only check: does the user still have image quota this period? No reservation (mirrors enforceImageQuota limits). */
export async function hasImageQuota(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { subscriptions, subscriptionPlans, userUsageTracking } = await import("../drizzle/schema");
  const { eq, and, gte, lte } = await import("drizzle-orm");
  const FREE_IMAGE_LIMIT = 2;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (!sub) return false;
  let limit: number | null;
  if (sub.status === "trial") { limit = FREE_IMAGE_LIMIT; }
  else if (sub.status === "active") {
    if (!sub.planId) return true;
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1);
    limit = plan?.imagesPerMonth ?? null;
    if (limit == null) return true;
  } else { return false; }
  const now = new Date();
  const [usage] = await db.select().from(userUsageTracking).where(and(
    eq(userUsageTracking.userId, userId),
    eq(userUsageTracking.subscriptionId, sub.id),
    gte(userUsageTracking.periodEndDate, now),
    lte(userUsageTracking.periodStartDate, now),
  )).limit(1);
  const used = usage?.imagesUsed ?? 0;
  return used < limit;
}

export async function enforceImageQuota(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { subscriptions, subscriptionPlans, userUsageTracking } = await import("../drizzle/schema");
  const { eq, and, gte, lte, lt, sql } = await import("drizzle-orm");

  const FREE_IMAGE_LIMIT = 2;

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (!sub) throw new Error("No subscription found");

  let limit: number | null;
  if (sub.status === "trial") {
    limit = FREE_IMAGE_LIMIT;
  } else if (sub.status === "active") {
    if (!sub.planId) return;
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1);
    limit = plan?.imagesPerMonth ?? null;
    if (limit == null) return;
  } else {
    throw new Error("Abonnementet ditt er ikke aktivt. Forny abonnementet for \u00e5 fortsette.");
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [usage] = await db
    .select()
    .from(userUsageTracking)
    .where(
      and(
        eq(userUsageTracking.userId, userId),
        eq(userUsageTracking.subscriptionId, sub.id),
        gte(userUsageTracking.periodEndDate, now),
        lte(userUsageTracking.periodStartDate, now)
      )
    )
    .limit(1);

  const limitMsg =
    sub.status === "trial"
      ? "Du har brukt opp de 2 gratis AI-bildene dine denne m\u00e5neden. Oppgrader til Pro for flere."
      : "Du har n\u00e5dd bildegrensen for planen din denne m\u00e5neden. Oppgrader for flere.";

  if (usage) {
    const res: any = await db
      .update(userUsageTracking)
      .set({ imagesUsed: sql`${userUsageTracking.imagesUsed} + 1` })
      .where(and(eq(userUsageTracking.id, usage.id), lt(userUsageTracking.imagesUsed, limit)));
    const affected = res?.[0]?.affectedRows ?? res?.affectedRows ?? 0;
    if (affected === 0) throw new Error(limitMsg);
  } else {
    await db.insert(userUsageTracking).values({
      userId,
      subscriptionId: sub.id,
      postsUsed: 0,
      imagesUsed: 1,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
    } as any);
  }
}

const FREE_ANALYSIS_LIMIT = 3;

/** Read-only: does the user still have Merkehjerne analysis quota this period? Mirrors hasImageQuota. */
export async function hasAnalysisQuota(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { subscriptions, subscriptionPlans, userUsageTracking } = await import("../drizzle/schema");
  const { eq, and, gte, lte } = await import("drizzle-orm");
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (!sub) return false;
  let limit: number | null;
  if (sub.status === "trial") {
    limit = FREE_ANALYSIS_LIMIT;
  } else if (sub.status === "active") {
    if (!sub.planId) return true;
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1);
    limit = plan?.analysesPerMonth ?? null;
    if (limit == null) return true;
  } else {
    return false;
  }
  const now = new Date();
  const [usage] = await db.select().from(userUsageTracking).where(and(
    eq(userUsageTracking.userId, userId),
    eq(userUsageTracking.subscriptionId, sub.id),
    gte(userUsageTracking.periodEndDate, now),
    lte(userUsageTracking.periodStartDate, now),
  )).limit(1);
  const used = usage?.analysesUsed ?? 0;
  return used < limit;
}

/**
 * Increment the analysis meter for the current period. Called only after a real
 * analysis (not for unchanged/cached re-scans). Per-user analyses are serialized
 * by the active-scan lock, so a read-check + increment is race-safe.
 */
export async function chargeAnalysisQuota(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { subscriptions, userUsageTracking } = await import("../drizzle/schema");
  const { eq, and, gte, lte, sql } = await import("drizzle-orm");
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (!sub) return;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [usage] = await db.select().from(userUsageTracking).where(and(
    eq(userUsageTracking.userId, userId),
    eq(userUsageTracking.subscriptionId, sub.id),
    gte(userUsageTracking.periodEndDate, now),
    lte(userUsageTracking.periodStartDate, now),
  )).limit(1);
  if (usage) {
    await db
      .update(userUsageTracking)
      .set({ analysesUsed: sql`${userUsageTracking.analysesUsed} + 1` })
      .where(eq(userUsageTracking.id, usage.id));
  } else {
    await db.insert(userUsageTracking).values({
      userId,
      subscriptionId: sub.id,
      postsUsed: 0,
      imagesUsed: 0,
      analysesUsed: 1,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
    } as any);
  }
}

/**
 * M5 bridge: create a starter Merkehjerne from the onboarding wizard's confirmed
 * data. Never clobbers an existing profile (a real scan wins). Returns true when
 * a new row was created.
 */
export async function seedBrandProfileFromOnboarding(userId: number, data: {
  websiteUrl: string;
  companyName?: string | null;
  industry?: string | null;
  audience?: string | null;
  toneLabel?: string | null;
  topics?: string[];
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const websiteUrl = (data.websiteUrl ?? "").trim();
  if (!websiteUrl) return false;
  const { brandProfiles } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const { buildOnboardingBrandSeed } = await import("./services/merkehjerne/brandContext");
  const [existing] = await db
    .select({ id: brandProfiles.id })
    .from(brandProfiles)
    .where(eq(brandProfiles.userId, userId))
    .limit(1);
  if (existing) return false; // keep any existing Merkehjerne intact
  // PR #79: the seed belongs to the account's active brand. Inserting it
  // unowned made it readable from every brand at once.
  let seedBrandId: number | null = null;
  try {
    const { getActiveBrandIdIfEnabled } = await import("./services/brands");
    seedBrandId = await getActiveBrandIdIfEnabled(userId);
  } catch { /* multi-brand off or unavailable — seed stays account-wide */ }
  const now = new Date();
  await db.insert(brandProfiles).values({
    userId,
    brandId: seedBrandId,
    ...buildOnboardingBrandSeed(data),
    analyzedAt: now,
    confirmedAt: now,
  } as any);
  return true;
}

/** Persist a server-issued payment order bound to the authenticated user. */
export async function createPaymentOrder(order: {
  orderId: string;
  userId: number;
  planId: number | null;
  expectedAmount: number;
  currency?: string;
  provider?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { paymentOrders } = await import("../drizzle/schema");
  await db.insert(paymentOrders).values({
    orderId: order.orderId,
    userId: order.userId,
    planId: order.planId,
    expectedAmount: order.expectedAmount,
    currency: order.currency ?? "NOK",
    provider: order.provider ?? "vipps",
    status: "pending",
  } as any);
}

export async function getPaymentOrder(orderId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const { paymentOrders } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select().from(paymentOrders).where(eq(paymentOrders.orderId, orderId)).limit(1);
  return row;
}

export async function markPaymentOrderStatus(
  orderId: string,
  status: "pending" | "captured" | "failed" | "cancelled",
  transactionId?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { paymentOrders } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(paymentOrders)
    .set({ status, ...(transactionId ? { transactionId } : {}), updatedAt: new Date() })
    .where(eq(paymentOrders.orderId, orderId));
}

/** Resolve a user from a Stripe customer id (via their subscription row). */
export async function getUserByStripeCustomerId(customerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const { subscriptions, users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId)).limit(1);
  if (!sub) return undefined;
  const [u] = await db.select().from(users).where(eq(users.id, sub.userId)).limit(1);
  return u;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Posts Queries ============

export async function createPost(post: InsertPost): Promise<Post> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Multi-brand: stamp the author's ACTIVE brand when the caller didn't pass
  // one, so every new post belongs to exactly one brand. No-op when the feature
  // is off.
  //
  // PR #79: with multi-brand ON, a post whose brand cannot be determined is NOT
  // saved. The previous behaviour — swallow the error, insert with brand_id
  // NULL — is what manufactured the unowned rows that then appeared under every
  // brand. Refusing the write is the safe failure: the user sees an error and
  // picks a brand, instead of silently creating cross-brand content.
  // Callers with an irreversible side effect (a post already live on LinkedIn)
  // must resolve the brand BEFORE that side effect and pass it in explicitly,
  // so this guard can never strand a published post.
  let values = post;
  if (post.brandId == null && post.userId != null) {
    const { getActiveBrandIdIfEnabled } = await import("./services/brands");
    // One retry: getActiveBrandIdIfEnabled swallows its own errors and returns
    // null, so a transient pool hiccup is indistinguishable from "no brand".
    // Retrying keeps a blip from surfacing as "velg en merkevare".
    let brandId = await getActiveBrandIdIfEnabled(post.userId);
    if (brandId == null) brandId = await getActiveBrandIdIfEnabled(post.userId);

    if (brandId != null) {
      values = { ...post, brandId };
    } else {
      const { ENV } = await import("./_core/env");
      if (ENV.featureMultiBrand) {
        throw new Error("Innlegget kan ikke lagres uten merkevare. Velg en merkevare og prøv igjen.");
      }
      // Multi-brand OFF: brand_id is meaningless, keep the previous behaviour.
    }
  }

  const [result] = await db.insert(posts).values(values).$returningId();
  const [newPost] = await db.select().from(posts).where(eq(posts.id, result.id));
  return newPost!;
}

/**
 * Posts for a user. When `brandId` is given (multi-brand) ONLY that brand's
 * posts are returned.
 *
 * PR #79: the old filter widened this with `OR brand_id IS NULL` so unowned
 * legacy rows would "stay visible". They stayed visible inside every brand at
 * once — that is the leak. Unowned rows are now reached through the
 * "Uklassifisert" surface instead (see services/brandScope.ts).
 */
export async function getUserPosts(userId: number, brandId?: number | null): Promise<Post[]> {
  const db = await getDb();
  if (!db) return [];

  const where = brandId == null
    ? eq(posts.userId, userId)
    : and(eq(posts.userId, userId), eq(posts.brandId, brandId));

  return db.select().from(posts).where(where).orderBy(desc(posts.createdAt));
}

export async function getPostById(postId: number): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return post;
}

export async function updatePost(postId: number, userId: number, content: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // SECURITY: ownership enforced at the SQL layer (postId AND userId), so a
  // forgotten application-level check can never edit another user's post.
  await db.update(posts)
    .set({ generatedContent: content, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));
}

/**
 * Mark an existing post as published (status + publishedAt). Used by the
 * generic publish path so the post the user clicked shows under "Publisert"
 * instead of leaving an orphan analytics row. Best-effort: never throws.
 */
export async function markPostPublished(postId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // SECURITY: ownership enforced at the SQL layer (postId AND userId).
  await db.update(posts)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));
}

export async function deletePost(postId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // PR #81: cancel any pending schedule FIRST, or the worker is left holding a
  // row whose post no longer exists. It then claims the orphan, fails with
  // "Post not found", marks the row failed, and pushes a "Publisering feilet —
  // sjekk LinkedIn-tilkoblingen" notification blaming the user's connection for a
  // post they deliberately deleted.
  //
  // Best-effort and BEFORE the delete: leaving a live row behind is worse than
  // failing the delete, and this became reachable as soon as scheduled posts
  // started appearing on the calendar where they can be deleted.
  try {
    await db
      .update(scheduledPosts)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(scheduledPosts.postId, postId),
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, "scheduled"),
      ));
  } catch (e) {
    console.warn("[posts.delete] could not cancel pending schedule:", (e as Error)?.message);
  }

  // SECURITY: ownership enforced at the SQL layer (postId AND userId).
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.userId, userId)));
}

/**
 * Invalidate ALL of a user's active sessions by bumping their token version.
 * Called on logout and on password reset. Best-effort: a failure here must not
 * break the calling flow (the cookie is still cleared).
 */
export async function incrementUserTokenVersion(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  } catch (e) {
    console.warn("[auth] incrementUserTokenVersion failed:", (e as Error)?.message);
  }
}

// ============ Voice Samples Queries ============

export async function createVoiceSample(sample: InsertVoiceSample): Promise<VoiceSample> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(voiceSamples).values(sample).$returningId();
  const [newSample] = await db.select().from(voiceSamples).where(eq(voiceSamples.id, result.id));
  return newSample!;
}

export async function getUserVoiceSamples(userId: number): Promise<VoiceSample[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(voiceSamples).where(eq(voiceSamples.userId, userId));
}

export async function deleteVoiceSample(sampleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(voiceSamples).where(eq(voiceSamples.id, sampleId));
}

// ============ Subscriptions Queries ============

export async function getUserSubscription(userId: number): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return subscription;
}

export async function createSubscription(subscription: InsertSubscription): Promise<Subscription> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(subscriptions).values(subscription).$returningId();
  const [newSubscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, result.id));
  return newSubscription!;
}

export async function updateSubscription(userId: number, updates: Partial<Subscription>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set({ ...updates, updatedAt: new Date() }).where(eq(subscriptions.userId, userId));
}

export async function incrementPostsGenerated(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const subscription = await getUserSubscription(userId);
  if (subscription) {
    await db.update(subscriptions)
      .set({ postsGenerated: subscription.postsGenerated + 1, updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId));
  }
}

export async function updateSubscriptionFromStripe(
  userId: number,
  stripeData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    status?: "trial" | "active" | "cancelled" | "expired";
    planId?: number;
    subscriptionEndDate?: Date;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: any = {
    updatedAt: new Date(),
  };

  if (stripeData.stripeCustomerId) updates.stripeCustomerId = stripeData.stripeCustomerId;
  if (stripeData.stripeSubscriptionId) updates.stripeSubscriptionId = stripeData.stripeSubscriptionId;
  if (stripeData.stripePriceId) updates.stripePriceId = stripeData.stripePriceId;
  // Without a planId the active subscription has no monthly cap (enforcePostQuota
  // returns early on null planId) — so paid users would get unlimited posts.
  if (stripeData.planId != null) updates.planId = stripeData.planId;
  if (stripeData.status) {
    updates.status = stripeData.status;
    if (stripeData.status === "active") {
      updates.subscriptionStartDate = new Date();
      // Use the caller-provided period end (derived from the plan interval or
      // Stripe's current_period_end). Fall back to +30 days for monthly.
      if (stripeData.subscriptionEndDate) {
        updates.subscriptionEndDate = stripeData.subscriptionEndDate;
      } else {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        updates.subscriptionEndDate = endDate;
      }
    }
  }
  
  await db.update(subscriptions)
    .set(updates)
    .where(eq(subscriptions.userId, userId));
}

/** Internal ENTERPRISE tier is presented as "Premium"; map tier → seeded plan name. */
const TIER_PLAN_NAME: Record<string, string> = { FREE: "Gratis", PRO: "Pro", ENTERPRISE: "Premium" };

/**
 * Idempotently seed the subscription_plans table from the single pricing source
 * (@shared/pricing). Without these rows, active subscriptions have no monthly cap
 * and Vipps amount-matching fails. Safe to call on every boot.
 */
export async function ensureSubscriptionPlans(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { subscriptionPlans } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const { PLANS, yearlyNOK } = await import("@shared/pricing");

  for (const plan of PLANS) {
    const name = TIER_PLAN_NAME[plan.key === "PREMIUM" ? "ENTERPRISE" : plan.key] ?? plan.name;
    const [existing] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, name)).limit(1);
    const row = {
      name,
      description: plan.tagline,
      priceMonthly: plan.monthlyNOK > 0 ? plan.monthlyNOK * 100 : null, // øre
      priceYearly: plan.monthlyNOK > 0 ? yearlyNOK(plan.monthlyNOK) * 100 : null,
      postsPerMonth: plan.postsPerMonth,
      imagesPerMonth: plan.monthlyNOK > 0 ? 50 : 0, // paid plans get 50 AI images/month (room for regenerations)
      canUseDALLE: plan.monthlyNOK > 0 ? 1 : 0,
      canUseVoiceTraining: plan.monthlyNOK > 0 ? 1 : 0,
      canUseContentCalendar: plan.monthlyNOK > 0 ? 1 : 0,
      canUseCompetitorRadar: plan.key === "PREMIUM" ? 1 : 0,
      canUseWeeklyReports: plan.monthlyNOK > 0 ? 1 : 0,
    };
    if (existing) {
      await db.update(subscriptionPlans).set(row).where(eq(subscriptionPlans.id, existing.id));
    } else {
      await db.insert(subscriptionPlans).values(row);
    }
  }
}

/** Look up the seeded plan id for a subscription tier (FREE/PRO/ENTERPRISE). */
export async function getPlanIdByTier(tier: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const { subscriptionPlans } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const name = TIER_PLAN_NAME[tier];
  if (!name) return null;
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, name)).limit(1);
  return plan?.id ?? null;
}

/**
 * Record a published post in post_analytics so the analytics dashboard reflects real
 * activity (the table was never written, so every metric was permanently zero).
 * Engagement/impressions start at 0 and can be refreshed later by a metrics job.
 */
export async function recordPostAnalytics(
  userId: number,
  postId: number,
  platform: "linkedin" | "twitter" | "instagram" | "facebook",
  publishedAt: Date = new Date(),
  platformPostId?: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { postAnalytics } = await import("../drizzle/schema");
  try {
    await db.insert(postAnalytics).values({
      userId,
      postId,
      platform,
      publishedAt,
      dayOfWeek: publishedAt.getDay(),
      hourOfDay: publishedAt.getHours(),
      engagement: 0,
      impressions: 0,
      platformPostId: platformPostId ?? null,
    });
  } catch (e) {
    console.warn("[analytics] could not record post analytics:", (e as Error)?.message);
  }
}

export async function updateSubscriptionStatus(
  userId: number,
  status: "trial" | "active" | "cancelled" | "expired"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions)
    .set({ status, updatedAt: new Date() })
    .where(eq(subscriptions.userId, userId));
}

// ============ User Preferences Queries ============

export async function getUserPreference(userId: number): Promise<UserPreference | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const [preference] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return preference;
}

export async function createUserPreference(preference: InsertUserPreference): Promise<UserPreference> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(userPreferences).values(preference).$returningId();
  const [newPreference] = await db.select().from(userPreferences).where(eq(userPreferences.id, result.id));
  return newPreference!;
}

export async function updateUserPreference(userId: number, language: "no" | "en"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(userPreferences).set({ language, updatedAt: new Date() }).where(eq(userPreferences.userId, userId));
}

export async function updateUserOpenAIConsent(userId: number, consent: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(userPreferences).set({ 
    openaiConsent: consent, 
    consentDate: new Date(),
    updatedAt: new Date() 
  }).where(eq(userPreferences.userId, userId));
}

// ============ Content Analysis Queries ============

export async function saveContentAnalysis(analysis: InsertContentAnalysis): Promise<ContentAnalysis> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(contentAnalysis).values(analysis).$returningId();
  const [newAnalysis] = await db.select().from(contentAnalysis).where(eq(contentAnalysis.id, result.id));
  return newAnalysis!;
}

export async function getUserAnalysisHistory(userId: number, limit: number = 30): Promise<ContentAnalysis[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(contentAnalysis)
    .where(eq(contentAnalysis.userId, userId))
    .orderBy(desc(contentAnalysis.createdAt))
    .limit(limit);
}

export async function getUserContentAnalyses(userId: number): Promise<ContentAnalysis[]> {
  return getUserAnalysisHistory(userId, 50);
}

// ============ Saved Examples Queries ============

export async function createSavedExample(example: InsertSavedExample): Promise<SavedExample> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(savedExamples).values(example).$returningId();
  const [newExample] = await db.select().from(savedExamples).where(eq(savedExamples.id, result.id));
  return newExample!;
}

export async function getUserSavedExamples(userId: number): Promise<SavedExample[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(savedExamples)
    .where(eq(savedExamples.userId, userId))
    .orderBy(desc(savedExamples.createdAt));
}

export async function getSavedExampleById(exampleId: number): Promise<SavedExample | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [example] = await db.select().from(savedExamples).where(eq(savedExamples.id, exampleId)).limit(1);
  return example;
}

export async function incrementExampleUsage(exampleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const example = await getSavedExampleById(exampleId);
  if (example) {
    await db.update(savedExamples)
      .set({ usageCount: example.usageCount + 1, updatedAt: new Date() })
      .where(eq(savedExamples.id, exampleId));
  }
}

export async function deleteSavedExample(exampleId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(savedExamples).where(eq(savedExamples.id, exampleId));
}

// ============ Generation Presets ============

export async function getUserPresets(userId: number): Promise<GenerationPreset[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(generationPresets)
    .where(eq(generationPresets.userId, userId))
    .orderBy(desc(generationPresets.isDefault), desc(generationPresets.updatedAt));
}

export async function getPresetById(presetId: number): Promise<GenerationPreset | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [preset] = await db.select().from(generationPresets).where(eq(generationPresets.id, presetId)).limit(1);
  return preset;
}

export async function createPreset(preset: InsertGenerationPreset): Promise<GenerationPreset> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (preset.isDefault) await clearDefaultPreset(preset.userId);
  const [result] = await db.insert(generationPresets).values(preset).$returningId();
  const [created] = await db.select().from(generationPresets).where(eq(generationPresets.id, result.id));
  return created!;
}

export async function updatePreset(
  presetId: number,
  userId: number,
  updates: Partial<InsertGenerationPreset>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (updates.isDefault) await clearDefaultPreset(userId);
  // Ownership enforced in-query.
  await db
    .update(generationPresets)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(generationPresets.id, presetId), eq(generationPresets.userId, userId)));
}

export async function deletePreset(presetId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(generationPresets)
    .where(and(eq(generationPresets.id, presetId), eq(generationPresets.userId, userId)));
}

/** Unset isDefault on all of a user's presets (so a new default is exclusive). */
async function clearDefaultPreset(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(generationPresets)
    .set({ isDefault: false })
    .where(and(eq(generationPresets.userId, userId), eq(generationPresets.isDefault, true)));
}

// ============================
// Blog Post Helpers
// ============================

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.published, 1))
      .orderBy(desc(blogPosts.createdAt));
  } catch (error) {
    console.error("[Database] Error fetching blog posts:", error);
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // `published = 1` is not optional here. This is reached from a
    // publicProcedure, and without it an unauthenticated caller who guesses (or
    // reads from a sitemap/preview link) a slug gets the full body of an
    // unreleased draft. getAllBlogPosts has always filtered; these two did not.
    const results = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, 1)))
      .limit(1);

    // Increment view count
    if (results[0]) {
      await db
        .update(blogPosts)
        .set({ viewCount: results[0].viewCount + 1 })
        .where(eq(blogPosts.id, results[0].id));
    }
    
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Error fetching blog post by slug:", error);
    return null;
  }
}

export async function getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Category is a closed enum, so without `published = 1` four unauthenticated
    // calls dump every unreleased draft in the system.
    return await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.category, category as any), eq(blogPosts.published, 1)))
      .orderBy(desc(blogPosts.createdAt));
  } catch (error) {
    console.error("[Database] Error fetching blog posts by category:", error);
    return [];
  }
}

export async function createBlogPost(post: InsertBlogPost): Promise<BlogPost | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Sanitize rich-text HTML at rest (defense-in-depth XSS)
  const safePost = post.content
    ? { ...post, content: sanitizeHtml(post.content) }
    : post;

  try {
    const result = await db.insert(blogPosts).values(safePost);
    const insertedId = result[0].insertId;
    
    const inserted = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, insertedId))
      .limit(1);
    
    return inserted[0] || null;
  } catch (error) {
    console.error("[Database] Error creating blog post:", error);
    return null;
  }
}

// Delete a user and ALL related data across every user-scoped table
// (GDPR Art. 17 — right to erasure). Resilient per-table so one failure does
// not abort the rest; the account row itself is removed last.
export async function deleteUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const s = await import("../drizzle/schema");

  // Every table carrying a `userId` (dependents first, `users` last).
  const userScopedTables: any[] = [
    s.abTests, s.activityLog, s.backupSchedule, s.competitors, s.contentAnalysis,
    s.contentSchedule, s.contentSeries, s.deletedPosts, s.drafts, s.generationPresets, s.hashtagPerformance,
    s.hashtagSuggestions, s.ideas, s.invoices, s.linkedinConnections, s.notificationSettings,
    s.lifecycleEmails, s.onboardingStatus, s.paymentOrders, s.platformIntegrationSettings, s.platformIntegrations,
    s.postAnalytics, s.postAuditLog, s.postBackups, s.postVersions, s.postingTimesAnalytics,
    s.posts, s.repurposedContent, s.savedExamples, s.scheduledPosts, s.schedulingPreferences,
    s.schedulingQueue, s.securityAlerts, s.stripePaymentIntents, s.subscriptionHistory,
    s.userUsageTracking, s.subscriptions, s.supportTicketReplies, s.supportTickets,
    s.telegramLinks, s.userAccountSettings, s.userContentPreferences, s.userInterests,
    s.userPreferences, s.voiceProfiles, s.voiceSamples, s.weeklyReportSettings, s.weeklyReports,
  ];

  for (const table of userScopedTables) {
    try {
      await db.delete(table).where(eq((table as any).userId, userId));
    } catch (err) {
      console.error("[deleteUser] failed deleting from a user table:", (err as Error)?.message);
    }
  }

  // Finally, the account itself.
  await db.delete(s.users).where(eq(s.users.id, userId));
}

// ============================================
// Blog Management Functions (Admin)
// ============================================

export async function updateBlogPostAdmin(id: number, updates: Partial<Omit<BlogPost, "id" | "createdAt">>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Sanitize rich-text HTML at rest (defense-in-depth XSS)
  const safeUpdates = typeof updates.content === "string"
    ? { ...updates, content: sanitizeHtml(updates.content) }
    : updates;

  await db.update(blogPosts)
    .set({
      ...safeUpdates,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, id));
}

export async function deleteBlogPostAdmin(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}

export async function getAllBlogPostsAdmin(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
}


// ============================================
// Voice Training Functions
// ============================================

export async function getVoiceProfile(userId: number): Promise<VoiceProfile | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const results = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.userId, userId))
      .limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Error fetching voice profile:", error);
    return null;
  }
}



export async function createOrUpdateVoiceProfile(
  userId: number, 
  profile: Partial<Omit<VoiceProfile, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<VoiceProfile | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Check if profile exists
    const existing = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.userId, userId))
      .limit(1);
    
    if (existing[0]) {
      // Update existing profile
      await db.update(voiceProfiles)
        .set({
          ...profile,
          updatedAt: new Date(),
        })
        .where(eq(voiceProfiles.userId, userId));
      
      const updated = await db
        .select()
        .from(voiceProfiles)
        .where(eq(voiceProfiles.userId, userId))
        .limit(1);
      return updated[0] || null;
    } else {
      // Create new profile
      const result = await db.insert(voiceProfiles).values({
        userId,
        ...profile,
      } as InsertVoiceProfile);
      
      const insertedId = result[0].insertId;
      const inserted = await db
        .select()
        .from(voiceProfiles)
        .where(eq(voiceProfiles.id, insertedId))
        .limit(1);
      
      return inserted[0] || null;
    }
  } catch (error) {
    console.error("[Database] Error creating/updating voice profile:", error);
    return null;
  }
}

// ============================================
// User Interests Functions
// ============================================

export async function getUserInterests(userId: number): Promise<UserInterest | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const results = await db
      .select()
      .from(userInterests)
      .where(eq(userInterests.userId, userId))
      .limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Error fetching user interests:", error);
    return null;
  }
}

export async function createOrUpdateUserInterests(
  userId: number,
  interests: Partial<Omit<UserInterest, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<UserInterest | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const existing = await db
      .select()
      .from(userInterests)
      .where(eq(userInterests.userId, userId))
      .limit(1);
    
    if (existing[0]) {
      await db.update(userInterests)
        .set({
          ...interests,
          updatedAt: new Date(),
        })
        .where(eq(userInterests.userId, userId));
      
      const updated = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .limit(1);
      return updated[0] || null;
    } else {
      const result = await db.insert(userInterests).values({
        userId,
        ...interests,
      } as InsertUserInterest);
      
      const insertedId = result[0].insertId;
      const inserted = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.id, insertedId))
        .limit(1);
      
      return inserted[0] || null;
    }
  } catch (error) {
    console.error("[Database] Error creating/updating user interests:", error);
    return null;
  }
}

// ============================================
// Trending Topics Functions
// ============================================

export async function getTrendingTopics(_category?: string): Promise<TrendingTopic[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const query = db
      .select()
      .from(trendingTopics)
      .where(eq(trendingTopics.active, 1))
      .orderBy(desc(trendingTopics.trendScore));
    
    return await query;
  } catch (error) {
    console.error("[Database] Error fetching trending topics:", error);
    return [];
  }
}

export async function createTrendingTopic(topic: InsertTrendingTopic): Promise<TrendingTopic | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(trendingTopics).values(topic);
    const insertedId = result[0].insertId;
    
    const inserted = await db
      .select()
      .from(trendingTopics)
      .where(eq(trendingTopics.id, insertedId))
      .limit(1);
    
    return inserted[0] || null;
  } catch (error) {
    console.error("[Database] Error creating trending topic:", error);
    return null;
  }
}


// ============================================
// Admin Stats Functions
// ============================================

export async function getAdminStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      proSubscribers: 0,
      totalPosts: 0,
      monthlyRevenue: 0,
      recentSubscriptions: [],
    };
  }
  
  try {
    const { sql } = await import("drizzle-orm");
    
    const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
    
    const [proSubscribersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));
    
    const [totalPostsResult] = await db.select({ count: sql<number>`count(*)` }).from(posts);
    
    /**
     * Monthly recurring revenue, from the plan each subscription is actually on.
     *
     * The previous version had two independent faults that both inflated or
     * flattened this number, and it is the number the owner reads to decide
     * whether the business is working:
     *
     *  1. It charged EVERY active subscription at the PRO price, whatever tier
     *     it was. A Premium customer counted as a Pro one; a comped Gratis
     *     account counted as a paying Pro one.
     *  2. Yearly billing was detected with `stripeSubscriptionId.includes("yearly")`.
     *     Stripe subscription ids look like `sub_1P9x...` and never contain the
     *     word "yearly", so `isYearly` was permanently false — the yearly branch
     *     was unreachable code.
     *
     * Fixed here: it now joins the plan row and reads that plan's real price, so
     * a Premium customer is counted at the Premium price.
     *
     * NOT fixed, and worth knowing before you trust the number: yearly billing
     * still cannot be detected. The check below compares the subscription's
     * `stripePriceId` against the plan's `stripePriceIdYearly`, and BOTH sides are
     * NULL today — `ensureSubscriptionPlans` never writes the Stripe price ids,
     * nothing writes `subscriptions.stripePriceId`, and `createCheckoutSession`
     * uses inline `price_data` rather than a reusable Stripe Price. So a yearly
     * subscriber is still counted at the monthly rate, which OVERSTATES MRR for
     * them. Wiring the price ids through checkout is what makes this branch live;
     * until then the number is "monthly-equivalent, assuming everyone pays
     * monthly". Prices are stored in øre, so divide by 100.
     */
    const activeSubscriptions = await db
      .select({
        id: subscriptions.id,
        stripePriceId: subscriptions.stripePriceId,
        planName: subscriptionPlans.name,
        priceMonthly: subscriptionPlans.priceMonthly,
        priceYearly: subscriptionPlans.priceYearly,
        yearlyPriceId: subscriptionPlans.stripePriceIdYearly,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.status, "active"));

    let unpricedSubscriptions = 0;
    const monthlyRevenue = activeSubscriptions.reduce((sum, sub) => {
      const isYearly =
        Boolean(sub.yearlyPriceId) && sub.stripePriceId === sub.yearlyPriceId;

      // Prices are øre in the database and kroner in this figure.
      const monthlyKr = (sub.priceMonthly ?? 0) / 100;
      const yearlyKr = (sub.priceYearly ?? 0) / 100;

      if (isYearly) {
        if (yearlyKr <= 0) {
          unpricedSubscriptions += 1;
          return sum;
        }
        return sum + yearlyKr / 12;
      }
      if (monthlyKr <= 0) {
        // A subscription with no plan row, or a free plan. Counting it at Pro's
        // price is how the old number got its optimism; count it at nothing and
        // report separately how many there were.
        unpricedSubscriptions += 1;
        return sum;
      }
      return sum + monthlyKr;
    }, 0);

    // Recent subscriptions, with the PLAN NAME in the plan column. It used to map
    // `plan: subscriptions.status`, so every row in the admin table rendered the
    // literal string "active" under a heading that said Plan.
    const recentSubscriptions = await db
      .select({
        id: subscriptions.id,
        userName: users.name,
        userEmail: users.email,
        plan: subscriptionPlans.name,
        status: subscriptions.status,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.status, "active"))
      .orderBy(desc(subscriptions.createdAt))
      .limit(10);

    // Paying subscribers per tier, so "how many are actually on Premium?" is
    // answerable without exporting the table.
    const byTier = await db
      .select({
        plan: subscriptionPlans.name,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.status, "active"))
      .groupBy(subscriptionPlans.name);

    return {
      totalUsers: totalUsersResult?.count || 0,
      proSubscribers: proSubscribersResult?.count || 0,
      totalPosts: totalPostsResult?.count || 0,
      monthlyRevenue: Math.round(monthlyRevenue),
      /** Active subscriptions we could not price — shown so the MRR is honest. */
      unpricedSubscriptions,
      subscriptionsByTier: byTier.map((t) => ({
        plan: t.plan ?? "Uten plan",
        count: Number(t.count ?? 0),
      })),
      recentSubscriptions,
    };
  } catch (error) {
    console.error("[Database] Error fetching admin stats:", error);
    return {
      totalUsers: 0,
      proSubscribers: 0,
      totalPosts: 0,
      monthlyRevenue: 0,
      recentSubscriptions: [],
    };
  }
}


// ============================================
// FAQ Management Functions
// ============================================

export async function getFAQs(language: string = 'no'): Promise<FAQ[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(faqs)
      .where(and(eq(faqs.isActive, true), eq(faqs.language, language)))
      .orderBy(faqs.category, faqs.order);
  } catch (error) {
    console.error("[FAQ] Error fetching FAQs:", error);
    return [];
  }
}

export async function getFAQsByCategory(category: string, language: string = 'no'): Promise<FAQ[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(faqs)
      .where(
        and(
          eq(faqs.category, category),
          eq(faqs.isActive, true),
          eq(faqs.language, language)
        )
      )
      .orderBy(faqs.order);
  } catch (error) {
    console.error("[FAQ] Error fetching FAQs by category:", error);
    return [];
  }
}

export async function searchFAQs(query: string, language: string = 'no'): Promise<FAQ[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Get all FAQs and filter in memory for better search
    const allFAQs = await db
      .select()
      .from(faqs)
      .where(and(eq(faqs.isActive, true), eq(faqs.language, language)));
    
    const searchLower = query.toLowerCase();
    return allFAQs.filter(faq => 
      faq.question.toLowerCase().includes(searchLower) || 
      faq.answer.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error("[FAQ] Error searching FAQs:", error);
    return [];
  }
}

export async function getFAQCategories(language: string = 'no'): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .selectDistinct({ category: faqs.category })
      .from(faqs)
      .where(and(eq(faqs.isActive, true), eq(faqs.language, language)))
      .orderBy(faqs.category);
    
    return result.map(r => r.category);
  } catch (error) {
    console.error("[FAQ] Error fetching FAQ categories:", error);
    return [];
  }
}


// ============================================
// Invoice Functions
// ============================================

export async function getUserInvoices(userId: number): Promise<Invoice[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const results = await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.invoiceDate));
    return results;
  } catch (error) {
    console.error("[Database] Error fetching invoices:", error);
    return [];
  }
}

export async function createInvoice(invoice: InsertInvoice): Promise<Invoice | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(invoices).values(invoice);
    const insertedId = result[0].insertId;
    
    const inserted = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, insertedId))
      .limit(1);
    
    return inserted[0] || null;
  } catch (error) {
    console.error("[Database] Error creating invoice:", error);
    return null;
  }
}

export async function updateInvoiceStatus(
  invoiceId: number, 
  status: "pending" | "paid" | "failed" | "refunded"
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.update(invoices)
      .set({
        status,
        updatedAt: new Date(),
        ...(status === "paid" && { paidAt: new Date() }),
      })
      .where(eq(invoices.id, invoiceId));
  } catch (error) {
    console.error("[Database] Error updating invoice status:", error);
  }
}

// ============================================
// User Statistics Functions
// ============================================

export async function getUserStatistics(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Get posts count
    const postsResult = await db
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.userId, userId));
    const postsCount = postsResult[0]?.count || 0;

    // Get saved examples count
    const savedExamplesResult = await db
      .select({ count: count() })
      .from(savedExamples)
      .where(eq(savedExamples.userId, userId));
    const savedExamplesCount = savedExamplesResult[0]?.count || 0;

    // Get content analyses count (AI Coach interactions)
    const analysesResult = await db
      .select({ count: count() })
      .from(contentAnalysis)
      .where(eq(contentAnalysis.userId, userId));
    const analysesCount = analysesResult[0]?.count || 0;

    // Get subscription info
    const subscription = await getUserSubscription(userId);

    // Get this month's posts
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyPostsResult = await db
      .select({ count: count() })
      .from(posts)
      .where(
        and(
          eq(posts.userId, userId),
          gte(posts.createdAt, monthStart),
          lte(posts.createdAt, monthEnd)
        )
      );
    const monthlyPostsCount = monthlyPostsResult[0]?.count || 0;

    // Get platform distribution
    const platformDistribution = await db
      .select({
        platform: posts.platform,
        count: count(),
      })
      .from(posts)
      .where(eq(posts.userId, userId))
      .groupBy(posts.platform);

    return {
      totalPosts: postsCount,
      monthlyPosts: monthlyPostsCount,
      savedExamples: savedExamplesCount,
      aiCoachInteractions: analysesCount,
      subscription,
      platformDistribution,
    };
  } catch (error) {
    console.error("[Database] Error fetching user statistics:", error);
    return null;
  }
}

export async function getUserUsagePreferences(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db
      .select({ usagePreferences: userPreferences.usagePreferences })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    
    return result[0]?.usagePreferences || null;
  } catch (error) {
    console.error("[Database] Error fetching usage preferences:", error);
    return null;
  }
}

export async function updateUserUsagePreferences(userId: number, preferences: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.update(userPreferences)
      .set({
        usagePreferences: preferences,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId));
  } catch (error) {
    console.error("[Database] Error updating usage preferences:", error);
  }
}


// ============ Hashtag Suggestions Queries ============

export async function createHashtagSuggestion(suggestion: InsertHashtagSuggestion): Promise<HashtagSuggestion> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(hashtagSuggestions).values(suggestion).$returningId();
  const [newSuggestion] = await db.select().from(hashtagSuggestions).where(eq(hashtagSuggestions.id, result.id));
  return newSuggestion!;
}

export async function getHashtagSuggestions(userId: number, limit: number = 10): Promise<HashtagSuggestion[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(hashtagSuggestions)
    .where(eq(hashtagSuggestions.userId, userId))
    .orderBy(desc(hashtagSuggestions.createdAt))
    .limit(limit);
}

// ============ Hashtag Performance Queries ============

export async function recordHashtagPerformance(performance: InsertHashtagPerformance): Promise<HashtagPerformance> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(hashtagPerformance).values(performance).$returningId();
  const [newPerformance] = await db.select().from(hashtagPerformance).where(eq(hashtagPerformance.id, result.id));
  return newPerformance!;
}

export async function getHashtagPerformance(userId: number, platform: string): Promise<HashtagPerformance[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(hashtagPerformance)
    .where(and(
      eq(hashtagPerformance.userId, userId),
      eq(hashtagPerformance.platform, platform as any)
    ))
    .orderBy(desc(hashtagPerformance.engagement))
    .limit(20);
}

export async function updateHashtagPerformance(
  userId: number,
  hashtag: string,
  platform: string,
  updates: Partial<HashtagPerformance>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(hashtagPerformance)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      eq(hashtagPerformance.userId, userId),
      eq(hashtagPerformance.hashtag, hashtag),
      eq(hashtagPerformance.platform, platform as any)
    ));
}

// ============ Trending Hashtags Queries ============

export async function getTrendingHashtags(platform: string, limit: number = 20): Promise<TrendingHashtag[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(trendingHashtags)
    .where(and(
      eq(trendingHashtags.platform, platform as any),
      eq(trendingHashtags.active, 1)
    ))
    .orderBy(desc(trendingHashtags.trendScore))
    .limit(limit);
}

export async function getTrendingHashtagsByCategory(platform: string, category: string, limit: number = 10): Promise<TrendingHashtag[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(trendingHashtags)
    .where(and(
      eq(trendingHashtags.platform, platform as any),
      eq(trendingHashtags.category, category),
      eq(trendingHashtags.active, 1)
    ))
    .orderBy(desc(trendingHashtags.trendScore))
    .limit(limit);
}

export async function createTrendingHashtag(hashtag: InsertTrendingHashtag): Promise<TrendingHashtag> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(trendingHashtags).values(hashtag).$returningId();
  const [newHashtag] = await db.select().from(trendingHashtags).where(eq(trendingHashtags.id, result.id));
  return newHashtag!;
}

export async function updateTrendingHashtag(hashtagId: number, updates: Partial<TrendingHashtag>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(trendingHashtags)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(trendingHashtags.id, hashtagId));
}


/**
 * Recipients for the weekly "Monday ritual" email: users with an email who signed
 * in within the last 60 days and have not opted out (notification_settings.emailNotifications
 * false or emailFrequency 'never'). A missing settings row counts as opted-in (defaults).
 */
/** Per-user state the lifecycle engine needs to decide which journey email is due. */
export interface LifecycleUserState {
  userId: number;
  email: string;
  name: string;
  createdAt: Date;
  lastSignedIn: Date;
  verified: boolean;
  subStatus: string | null;
  onboardingCompleted: boolean;
  hasPosted: boolean;
  hasLinkedIn: boolean;
  sentKeys: string[];
  lastLifecycleAt: Date | null;
}

/**
 * Load state for all users eligible for the automated customer-journey emails,
 * in a bounded, batched way (4 queries total, no N+1). Filters out opted-out
 * accounts and ended subscriptions up front — same bar as the weekly ritual.
 */
export async function getLifecycleUserStates(): Promise<LifecycleUserState[]> {
  const db = await getDb();
  if (!db) return [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const base = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      openId: users.openId,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      emailVerified: users.emailVerified,
      emailNotifications: schema.notificationSettings.emailNotifications,
      emailFrequency: schema.notificationSettings.emailFrequency,
      subStatus: subscriptions.status,
      onboardingCompleted: schema.onboardingStatus.completed,
    })
    .from(users)
    .leftJoin(schema.notificationSettings, eq(schema.notificationSettings.userId, users.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(schema.onboardingStatus, eq(schema.onboardingStatus.userId, users.id))
    .where(and(isNotNull(users.email), gte(users.createdAt, ninetyDaysAgo)))
    .limit(500);

  const eligible = base.filter(
    (r: any) =>
      !!r.email &&
      (r.emailNotifications ?? true) &&
      (r.emailFrequency ?? "daily") !== "never" &&
      r.subStatus !== "cancelled" &&
      r.subStatus !== "expired"
  );
  if (eligible.length === 0) return [];

  const ids = eligible.map((r: any) => r.userId);
  const [sent, posted, linked] = await Promise.all([
    db
      .select({
        userId: schema.lifecycleEmails.userId,
        emailKey: schema.lifecycleEmails.emailKey,
        sentAt: schema.lifecycleEmails.sentAt,
      })
      .from(schema.lifecycleEmails)
      .where(inArray(schema.lifecycleEmails.userId, ids)),
    db.selectDistinct({ userId: posts.userId }).from(posts).where(inArray(posts.userId, ids)),
    db
      .select({ userId: schema.linkedinConnections.userId })
      .from(schema.linkedinConnections)
      .where(inArray(schema.linkedinConnections.userId, ids)),
  ]);

  const sentByUser = new Map<number, { keys: string[]; last: Date | null }>();
  for (const s of sent as any[]) {
    const e = sentByUser.get(s.userId) ?? { keys: [], last: null };
    e.keys.push(s.emailKey);
    if (!e.last || s.sentAt > e.last) e.last = s.sentAt;
    sentByUser.set(s.userId, e);
  }
  const postedSet = new Set((posted as any[]).map((p) => p.userId));
  const linkedSet = new Set((linked as any[]).map((l) => l.userId));

  return eligible.map((r: any) => {
    const se = sentByUser.get(r.userId);
    const verified =
      r.emailVerified != null ||
      (typeof r.openId === "string" && !r.openId.startsWith("email_"));
    return {
      userId: r.userId,
      email: r.email as string,
      name: r.name || "",
      createdAt: r.createdAt,
      lastSignedIn: r.lastSignedIn,
      verified,
      subStatus: r.subStatus ?? null,
      onboardingCompleted: (r.onboardingCompleted ?? 0) === 1,
      hasPosted: postedSet.has(r.userId),
      hasLinkedIn: linkedSet.has(r.userId),
      sentKeys: se?.keys ?? [],
      lastLifecycleAt: se?.last ?? null,
    };
  });
}

/**
 * Atomically claim a lifecycle email step for a user. The UNIQUE(user_id,
 * email_key) constraint means only the first caller inserts the row (returns
 * true) and actually sends; any overlapping run gets a duplicate and returns
 * false. Claim BEFORE sending so a step is never delivered twice.
 */
export async function claimLifecycleEmail(userId: number, emailKey: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(schema.lifecycleEmails).values({ userId, emailKey });
    return true;
  } catch {
    return false; // duplicate (already claimed) — or a transient DB error; skip either way
  }
}

export async function getWeeklyRitualRecipients(): Promise<
  { userId: number; email: string; name: string }[]
> {
  const db = await getDb();
  if (!db) return [];
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      // userId is needed so the scheduler can claim a once-per-week send per user
      // before it goes out. Without it the job could only send blindly, which is
      // how the same email reached customers three times.
      userId: users.id,
      email: users.email,
      name: users.name,
      emailNotifications: schema.notificationSettings.emailNotifications,
      emailFrequency: schema.notificationSettings.emailFrequency,
      subStatus: subscriptions.status,
    })
    .from(users)
    .leftJoin(schema.notificationSettings, eq(schema.notificationSettings.userId, users.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(and(isNotNull(users.email), gte(users.lastSignedIn, sixtyDaysAgo)));
  return rows
    .filter((r: any) =>
      (r.emailNotifications ?? true) &&
      (r.emailFrequency ?? "daily") !== "never" &&
      !!r.email &&
      // Stop re-engagement/marketing emails to accounts that ended their subscription.
      r.subStatus !== "cancelled" && r.subStatus !== "expired")
    .map((r: any) => ({ userId: r.userId as number, email: r.email as string, name: r.name || "" }));
}

/**
 * Update a user's UI view mode (simple = essential nav only; advanced = full nav).
 * Per-account preference stored on user_preferences. Ensures a row exists first.
 */
export async function updateUserViewMode(
  userId: number,
  viewMode: "simple" | "advanced",
): Promise<void> {
  await getUserPreference(userId);
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  await db
    .update(userPreferences)
    .set({ viewMode })
    .where(eq(userPreferences.userId, userId));
}

/**
 * Read a user's UI view mode with a safe default of "advanced" (full nav).
 */
export async function getUserViewMode(userId: number): Promise<"simple" | "advanced"> {
  const pref = (await getUserPreference(userId)) as { viewMode?: "simple" | "advanced" } | undefined;
  return pref?.viewMode === "simple" ? "simple" : "advanced";
}
