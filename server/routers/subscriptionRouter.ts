/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { subscriptions, subscriptionPlans, userUsageTracking, usageOverages } from "../../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

const getDatabase = async () => {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
};

// Create admin procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if ((ctx.user as any).role !== "admin") {
    throw new Error("Unauthorized");
  }
  return next({ ctx });
});

export const subscriptionRouter = router({
  // Get current user's subscription
  getCurrentSubscription: protectedProcedure.query(async ({ ctx }: any) => {
    const subscription = await (await getDatabase())
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (!subscription.length) {
      return null;
    }

    const plan = await (await getDatabase())
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription[0].planId ?? 0))
      .limit(1);

    return {
      ...subscription[0],
      plan: plan[0] || null,
    };
  }),

  // Get subscription plans
  getPlans: publicProcedure.query(async () => {
    return await (await getDatabase())
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, 1))
      .orderBy(subscriptionPlans.displayOrder);
  }),

  // Check usage limits
  checkUsageLimits: protectedProcedure
    .input(z.object({
      usageType: z.enum(["posts", "images"]),
      amount: z.number().default(1),
    }))
    .query(async ({ ctx, input }: any) => {
      const subscription = await (await getDatabase())
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (!subscription.length) {
        throw new Error("No subscription found");
      }

      const plan = await (await getDatabase())
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, subscription[0].planId ?? 0))
        .limit(1);

      if (!plan.length) {
        throw new Error("Plan not found");
      }

      // Get current usage
      const today = new Date();
      const usage = await (await getDatabase())
        .select()
        .from(userUsageTracking)
        .where(
          and(
            eq(userUsageTracking.userId, ctx.user.id),
            eq(userUsageTracking.subscriptionId, subscription[0].id),
            gte(userUsageTracking.periodEndDate, today),
            lte(userUsageTracking.periodStartDate, today)
          )
        )
        .limit(1);

      const currentUsage = usage[0] || { postsUsed: 0, imagesUsed: 0 };
      const planData = plan[0];

      // Check limits
      if (input.usageType === "posts" && planData.postsPerMonth) {
        const available = planData.postsPerMonth - (currentUsage.postsUsed || 0);
        return {
          allowed: available >= input.amount,
          remaining: Math.max(0, available),
          limit: planData.postsPerMonth,
          used: currentUsage.postsUsed || 0,
        };
      }

      if (input.usageType === "images" && planData.imagesPerMonth) {
        const available = planData.imagesPerMonth - (currentUsage.imagesUsed || 0);
        return {
          allowed: available >= input.amount,
          remaining: Math.max(0, available),
          limit: planData.imagesPerMonth,
          used: currentUsage.imagesUsed || 0,
        };
      }

      // Unlimited
      return {
        allowed: true,
        remaining: 999999,
        limit: null,
        used: 0,
      };
    }),

  // Record usage
  recordUsage: protectedProcedure
    .input(z.object({
      usageType: z.enum(["posts", "images"]),
      amount: z.number().default(1),
    }))
    .mutation(async ({ ctx, input }: any) => {
      const subscription = await (await getDatabase())
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (!subscription.length) {
        throw new Error("No subscription found");
      }

      // Get or create usage tracking record
      const today = new Date();
      const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const usage = await (await getDatabase())
        .select()
        .from(userUsageTracking)
        .where(
          and(
            eq(userUsageTracking.userId, ctx.user.id),
            eq(userUsageTracking.subscriptionId, subscription[0].id)
          )
        )
        .limit(1);

      if (usage.length) {
        // Update existing
        if (input.usageType === "posts") {
          await (await getDatabase())
            .update(userUsageTracking)
            .set({ postsUsed: (usage[0].postsUsed || 0) + input.amount })
            .where(eq(userUsageTracking.id, usage[0].id));
        } else {
          await (await getDatabase())
            .update(userUsageTracking)
            .set({ imagesUsed: (usage[0].imagesUsed || 0) + input.amount })
            .where(eq(userUsageTracking.id, usage[0].id));
        }
      } else {
        // Create new
        const newUsage = {
          userId: ctx.user.id,
          subscriptionId: subscription[0].id,
          postsUsed: input.usageType === "posts" ? input.amount : 0,
          imagesUsed: input.usageType === "images" ? input.amount : 0,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
        };
        await (await getDatabase()).insert(userUsageTracking).values(newUsage);
      }

      return { success: true };
    }),

  // Get usage statistics
  getUsageStats: protectedProcedure.query(async ({ ctx }: any) => {
    const subscription = await (await getDatabase())
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (!subscription.length) {
      return null;
    }

    const today = new Date();
    const usage = await (await getDatabase())
      .select()
      .from(userUsageTracking)
      .where(
        and(
          eq(userUsageTracking.userId, ctx.user.id),
          gte(userUsageTracking.periodEndDate, today),
          lte(userUsageTracking.periodStartDate, today)
        )
      )
      .limit(1);

    const plan = await (await getDatabase())
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription[0].planId ?? 0))
      .limit(1);

    return {
      subscription: subscription[0],
      plan: plan[0],
      usage: usage[0] || { postsUsed: 0, imagesUsed: 0 },
    };
  }),

  // Admin: Get all subscriptions
  getAllSubscriptions: adminProcedure.query(async () => {
    return await (await getDatabase())
      .select()
      .from(subscriptions)
      .orderBy(subscriptions.createdAt);
  }),

  // Admin: Get user subscriptions
  getUserSubscriptions: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }: any) => {
      return await (await getDatabase())
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, input.userId));
    }),

  // Admin: Get usage overages
  getUsageOverages: adminProcedure.query(async () => {
    return await (await getDatabase())
      .select()
      .from(usageOverages)
      .where(eq(usageOverages.status, "pending"));
  }),
});