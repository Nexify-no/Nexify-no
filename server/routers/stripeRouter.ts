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
        productKey: z.enum(["PRO_MONTHLY", "PRO_YEARLY", "ENTERPRISE_MONTHLY", "ENTERPRISE_YEARLY"]),
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

    /**
     * Verify a completed Checkout Session and activate the subscription.
     * Fallback to the Stripe webhook: the success page calls this so activation
     * works even if the webhook is delayed or misconfigured. Idempotent.
     */
    verifyCheckoutSession: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const { getCheckoutSession } = await import("../stripe/stripeService");
        const { getSubscriptionTier, STRIPE_PRODUCTS } = await import("../stripe/products");
        const { getPlanIdByTier, updateSubscriptionFromStripe } = await import("../db");

        const session = await getCheckoutSession(input.sessionId);

        // Security: the session must belong to the current user.
        const sessionUserId = parseInt(
          (session.metadata?.user_id as string) ||
            (session.client_reference_id as string) ||
            ""
        );
        if (!sessionUserId || sessionUserId !== ctx.user.id) {
          throw new Error("Denne betalingsøkten tilhører ikke din konto.");
        }

        const paid = session.payment_status === "paid" || session.status === "complete";
        if (!paid) {
          return { activated: false as const, status: "pending" as const };
        }

        const productKey = session.metadata?.product_key as string | undefined;
        const planId = productKey
          ? await getPlanIdByTier(getSubscriptionTier(productKey as any))
          : undefined;

        // Correct subscription end date: prefer Stripe's authoritative
        // current_period_end (subscription is expanded), else derive from the
        // plan interval (yearly = +1 year, monthly = +30 days).
        let subscriptionEndDate: Date | undefined;
        const sub = session.subscription as any;
        if (sub && typeof sub === "object" && sub.current_period_end) {
          subscriptionEndDate = new Date(sub.current_period_end * 1000);
        } else {
          const product = productKey ? (STRIPE_PRODUCTS as any)[productKey] : undefined;
          const d = new Date();
          if (product?.interval === "year") d.setFullYear(d.getFullYear() + 1);
          else d.setDate(d.getDate() + 30);
          subscriptionEndDate = d;
        }
        const customer =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer as any)?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as any)?.id;

        await updateSubscriptionFromStripe(ctx.user.id, {
          status: "active",
          planId: planId ?? undefined,
          stripeCustomerId: customer,
          stripeSubscriptionId: subscriptionId,
          subscriptionEndDate,
        });

        return { activated: true as const, status: "active" as const };
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