/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { getUserPosts, getUserSubscription, getUserPreference } from "../db";

export const userRouter = router({
    getPreference: protectedProcedure.query(async ({ ctx }) => {
      const { getUserPreference, createUserPreference } = await import("../db");
      let preference = await getUserPreference(ctx.user.id);
      
      // Create default preference if it doesn't exist
      if (!preference) {
        preference = await createUserPreference({
          userId: ctx.user.id,
          language: "no", // Default to Norwegian
        });
      }
      
      return preference;
    }),
    
    updateLanguage: protectedProcedure
      .input(z.object({ language: z.enum(["no", "en"]) }))
      .mutation(async ({ ctx, input }) => {
        const { updateUserPreference, getUserPreference, createUserPreference } = await import("../db");
        
        const existing = await getUserPreference(ctx.user.id);
        if (existing) {
          await updateUserPreference(ctx.user.id, input.language);
        } else {
          await createUserPreference({
            userId: ctx.user.id,
            language: input.language,
          });
        }
        
        return { success: true };
      }),
      
    updateOpenAIConsent: protectedProcedure
      .input(z.object({ consent: z.number().min(0).max(2) })) // 0 = not asked, 1 = accepted, 2 = declined
      .mutation(async ({ ctx, input }) => {
        const { updateUserOpenAIConsent, getUserPreference, createUserPreference } = await import("../db");
        
        const existing = await getUserPreference(ctx.user.id);
        if (existing) {
          await updateUserOpenAIConsent(ctx.user.id, input.consent);
        } else {
          await createUserPreference({
            userId: ctx.user.id,
            language: "no",
            openaiConsent: input.consent,
          });
        }
        
        return { success: true };
      }),
      
    getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { onboardingStatus } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      const status = await db.select().from(onboardingStatus).where(eq(onboardingStatus.userId, ctx.user.id)).limit(1);
      
      // Create default status if it doesn't exist
      if (!status || status.length === 0) {
        await db.insert(onboardingStatus).values({
          userId: ctx.user.id,
          completed: 0,
        });
        return { completed: false };
      }
      
      return { completed: status[0].completed === 1 };
    }),
    
    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { onboardingStatus } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      await db.update(onboardingStatus)
        .set({ completed: 1, completedAt: new Date() })
        .where(eq(onboardingStatus.userId, ctx.user.id));
      
      return { success: true };
    }),
    
    restartOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { onboardingStatus } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      await db.update(onboardingStatus)
        .set({ completed: 0, completedAt: null })
        .where(eq(onboardingStatus.userId, ctx.user.id));
      
      return { success: true };
    }),

    getSubscription: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSubscription, createSubscription } = await import("../db");
      let subscription = await getUserSubscription(ctx.user.id);
      
      // Create default trial subscription if it doesn't exist
      if (!subscription) {
        subscription = await createSubscription({
          userId: ctx.user.id,
          status: "trial",
          postsGenerated: 0,
          trialPostsLimit: 2, // mirrors FREE_POSTS in @shared/pricing
        });
      }

      // Enrich with the EFFECTIVE limit, plan name and real usage so the UI doesn't
      // fall back to the trial limit / a hardcoded "Pro" label for active paid plans.
      let planName = "Gratis";
      let postsLimit = subscription.trialPostsLimit ?? 2;
      let postsUsed = subscription.postsGenerated ?? 0;

      if (subscription.status === "active" && subscription.planId) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { subscriptionPlans, userUsageTracking } = await import("../../drizzle/schema");
          const { eq, and, gte, lte } = await import("drizzle-orm");
          const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, subscription.planId))
            .limit(1);
          if (plan) {
            planName = plan.name;
            if (plan.postsPerMonth != null) postsLimit = plan.postsPerMonth;
          }
          const now = new Date();
          const [usage] = await db
            .select()
            .from(userUsageTracking)
            .where(
              and(
                eq(userUsageTracking.userId, ctx.user.id),
                gte(userUsageTracking.periodEndDate, now),
                lte(userUsageTracking.periodStartDate, now)
              )
            )
            .limit(1);
          postsUsed = usage?.postsUsed ?? 0;
        }
      }

      const postsRemaining = Math.max(0, postsLimit - postsUsed);
      return { ...subscription, planName, postsLimit, postsUsed, postsRemaining };
    }),

    getInvoices: protectedProcedure.query(async ({ ctx }) => {
      const { getUserInvoices } = await import("../db");
      return await getUserInvoices(ctx.user.id);
    }),

    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().url().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { upsertUser } = await import("../db");
        await upsertUser({
          openId: ctx.user.openId,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        });
        return { success: true };
      }),

    uploadAvatar: protectedProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("../storage");
        const { upsertUser } = await import("../db");
        
        // Convert base64 to buffer
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1];
        const fileKey = `avatars/${ctx.user.id}-${Date.now()}.${ext}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Update user avatarUrl in DB
        await upsertUser({
          openId: ctx.user.openId,
          avatarUrl: url,
        });
        
        return { url };
      }),

    getStatistics: protectedProcedure.query(async ({ ctx }) => {
      const { getUserStatistics } = await import("../db");
      return await getUserStatistics(ctx.user.id);
    }),

    getUsagePreferences: protectedProcedure.query(async ({ ctx }) => {
      const { getUserUsagePreferences } = await import("../db");
      return await getUserUsagePreferences(ctx.user.id);
    }),

    updateUsagePreferences: protectedProcedure
      .input(z.object({ preferences: z.string().max(1000) }))
      .mutation(async ({ ctx, input }) => {
        const { updateUserUsagePreferences } = await import("../db");
        await updateUserUsagePreferences(ctx.user.id, input.preferences);
        return { success: true };
      }),

    // Export user data (GDPR right to data portability)
    exportData: protectedProcedure.mutation(async ({ ctx }) => {
      // Get user data (already in ctx.user)
      const preferenceData = await getUserPreference(ctx.user.id);
      
      // Get the user's own posts and subscription so the GDPR export is
      // complete (both are scoped to ctx.user.id — never another user's data).
      const userPosts = await getUserPosts(ctx.user.id);
      const userSubscription = await getUserSubscription(ctx.user.id);

      return {
        user: ctx.user,
        preferences: preferenceData,
        posts: userPosts,
        subscription: userSubscription,
        exportedAt: new Date().toISOString(),
      };
    }),

    // Delete account (GDPR right to be forgotten)
    deleteAccount: protectedProcedure
      .input(z.object({ 
        confirmation: z.literal("DELETE"),
        reason: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const { deleteUser } = await import("../db");
        const cookieOptions = getSessionCookieOptions(ctx.req);
        
        // Delete user account and all related data
        await deleteUser(ctx.user.id);
        
        // Clear session cookie
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        
        // Log deletion reason if provided (for analytics)
        if (input.reason) {
          console.log(`Account deleted - User ID: ${ctx.user.id}, Reason: ${input.reason}`);
        }
        
        return {
          success: true,
          message: "Din konto og alle data har blitt permanent slettet.",
        };
      }),
  });