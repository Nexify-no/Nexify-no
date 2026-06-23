/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { desc, eq, and, count, gte, lte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Pass the schema so Drizzle's relational query API (db.query.*) works —
      // without it, db.query is undefined and any findFirst/findMany throws
      // "Cannot read properties of undefined" (e.g. the whole settings feature).
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: "default" });
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
    } else if (user.openId === ENV.ownerOpenId) {
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
  
  const [result] = await db.insert(posts).values(post).$returningId();
  const [newPost] = await db.select().from(posts).where(eq(posts.id, result.id));
  return newPost!;
}

export async function getUserPosts(userId: number): Promise<Post[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt));
}

export async function getPostById(postId: number): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return post;
}

export async function updatePost(postId: number, content: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(posts).set({ generatedContent: content, updatedAt: new Date() }).where(eq(posts.id, postId));
}

export async function deletePost(postId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(posts).where(eq(posts.id, postId));
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
      // Set end date to 30 days from now for monthly
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      updates.subscriptionEndDate = endDate;
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
      imagesPerMonth: plan.monthlyNOK > 0 ? plan.postsPerMonth : 0,
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
  publishedAt: Date = new Date()
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
    const results = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
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
    return await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.category, category as any))
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
    s.onboardingStatus, s.paymentOrders, s.platformIntegrationSettings, s.platformIntegrations,
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
    
    // Calculate monthly revenue. Prices come from the single source of truth
    // (shared/pricing.ts) so this can't drift when a plan price changes.
    const { getPlan, yearlyPerMonthNOK } = await import("@shared/pricing");
    const proMonthly = getPlan("PRO").monthlyNOK;
    const proYearlyPerMonth = yearlyPerMonthNOK(proMonthly);
    const activeSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    const monthlyRevenue = activeSubscriptions.reduce((sum, sub) => {
      // Assume monthly billing unless the Stripe subscription id marks it yearly.
      const isYearly = sub.stripeSubscriptionId?.includes("yearly") || false;
      return sum + (isYearly ? proYearlyPerMonth : proMonthly);
    }, 0);
    
    // Get recent subscriptions with user info
    const recentSubscriptions = await db
      .select({
        id: subscriptions.id,
        userName: users.name,
        userEmail: users.email,
        plan: subscriptions.status,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(eq(subscriptions.status, "active"))
      .orderBy(desc(subscriptions.createdAt))
      .limit(10);
    
    return {
      totalUsers: totalUsersResult?.count || 0,
      proSubscribers: proSubscribersResult?.count || 0,
      totalPosts: totalPostsResult?.count || 0,
      monthlyRevenue: Math.round(monthlyRevenue),
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