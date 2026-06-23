/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const stripeRouter = router({
    createCheckoutSession: protectedProcedure
      .input(z.object({
        productKey: z.enum(["PRO_MONTHLY", "PRO_YEARLY"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createCheckoutSession } = await import("../stripe/stripeService");
        
        const origin = ctx.req.headers.origin || process.env.PUBLIC_SITE_URL || "http://localhost:3000";
        
        const result = await createCheckoutSession({
          userId: ctx.user.id,
          userEmail: ctx.user.email || "",
          userName: ctx.user.name || undefined,
          productKey: input.productKey,
          successUrl: `${origin}/subscription/success`,
          cancelUrl: `${origin}/subscription/cancel`,
        });
        
        return result;
      }),

    getPortalUrl: protectedProcedure.mutation(async ({ ctx }) => {
      const { getUserSubscription } = await import("../db");
      const { createCustomerPortalSession } = await import("../stripe/stripeService");
      
      const subscription = await getUserSubscription(ctx.user.id);
      
      if (!subscription?.stripeCustomerId) {
        throw new Error("Ingen aktiv Stripe-konto funnet");
      }
      
      const origin = ctx.req.headers.origin || process.env.PUBLIC_SITE_URL || "http://localhost:3000";
      const url = await createCustomerPortalSession(
        subscription.stripeCustomerId,
        `${origin}/settings`
      );
      
      return { url };
    }),

    cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const { getUserSubscription, updateSubscriptionStatus } = await import("../db");
      const { cancelSubscription } = await import("../stripe/stripeService");
      
      const subscription = await getUserSubscription(ctx.user.id);
      
      if (!subscription?.stripeSubscriptionId) {
        throw new Error("Ingen aktiv abonnement funnet");
      }
      
      await cancelSubscription(subscription.stripeSubscriptionId);
      await updateSubscriptionStatus(ctx.user.id, "cancelled");
      
      return { success: true, message: "Abonnementet er kansellert" };
    }),
  });