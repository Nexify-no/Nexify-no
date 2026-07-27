/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Payment Router for Penna
 * 
 * Handles checkout sessions, subscription management, and billing
 */

import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
// stripeService instantiates the Stripe SDK at module load, so it's imported
// LAZILY inside each procedure (below) to keep it off the server boot path.
// products.ts is light config + types and stays eager.
import { STRIPE_PRODUCTS, type ProductKey } from "../stripe/products";
import { getPlan } from "@shared/pricing";
import { getUserSubscription, updateSubscription, getUserPosts } from "../db";
import { TRPCError } from "@trpc/server";

/**
 * The tier a subscription actually grants, derived from the plan row it points at.
 *
 * ONE definition, used by every procedure that answers "what is this customer
 * entitled to". `getCurrentSubscription` derived the tier from the plan while
 * `getSubscriptionUsage` used a Stripe heuristic that collapsed every paying
 * customer to "PRO" — so the billing page said Premium and the quota it enforced
 * was Pro's, and `limits.ENTERPRISE` was unreachable dead code.
 */
async function tierForSubscription(
  subscription: { status?: string | null; planId?: number | null } | null,
): Promise<"FREE" | "PRO" | "ENTERPRISE"> {
  if (!subscription || subscription.status !== "active" || !subscription.planId) return "FREE";

  const { getDb } = await import("../db");
  const db = await getDb();
  // No database to check against is not grounds for granting a paid tier.
  if (!db) return "FREE";

  const { subscriptionPlans } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, subscription.planId))
    .limit(1);

  const nameToTier: Record<string, "FREE" | "PRO" | "ENTERPRISE"> = {
    Gratis: "FREE",
    Pro: "PRO",
    Premium: "ENTERPRISE",
  };
  // An unrecognised PAID plan keeps paid features working rather than silently
  // demoting someone who is being charged.
  return nameToTier[plan?.name ?? ""] ?? "PRO";
}

/**
 * Monthly allowances per tier, taken from the single pricing source of truth so
 * the quota enforced can never drift from the price advertised.
 */
const TIER_LIMITS = {
  FREE: { posts: getPlan("FREE").postsPerMonth, platforms: 4, aiImages: 0 },
  PRO: { posts: getPlan("PRO").postsPerMonth, platforms: 4, aiImages: getPlan("PRO").postsPerMonth },
  ENTERPRISE: {
    posts: getPlan("PREMIUM").postsPerMonth,
    platforms: 4,
    aiImages: getPlan("PREMIUM").postsPerMonth,
  },
} as const;

export const paymentRouter = router({
  /**
   * Generate invoice PDF for download
   */
  generateInvoicePDF: protectedProcedure
    .input(
      z.object({
        invoiceNumber: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { generateInvoicePDF: generatePDF, formatInvoiceFilename } = await import("../invoiceGenerator");

        // For now, create a sample invoice
        // In production, fetch from database
        const pdfBuffer = await generatePDF({
          invoiceNumber: input.invoiceNumber,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          customerName: ctx.user.name || "Customer",
          customerEmail: ctx.user.email || "",
          planName: "Pro Månedlig",
          planDescription: "Professional plan with 100 posts per month",
          amount: 299,
          currency: "NOK",
          taxRate: 0.25,
          subscriptionPeriod: {
            start: new Date(),
            end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          companyName: "Nexify CRM Systems AS",
          companyEmail: "support@penna.no",
          companyAddress: "Norway",
        });

        return {
          pdf: pdfBuffer.toString("base64"),
          filename: formatInvoiceFilename(input.invoiceNumber, ctx.user.name || "Invoice"),
        };
      } catch (error) {
        console.error("[Payment] Error generating invoice PDF:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate invoice PDF",
        });
      }
    }),

  /**
   * Get available pricing plans
   */
  getPricingPlans: publicProcedure.query(async () => {
    return Object.entries(STRIPE_PRODUCTS).map(([key, product]) => ({
      key: key as ProductKey,
      ...product,
    }));
  }),

  /**
   * Create a checkout session for subscription
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        productKey: z.enum([
          "FREE",
          "PRO_MONTHLY",
          "PRO_YEARLY",
          "ENTERPRISE_MONTHLY",
          "ENTERPRISE_YEARLY",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // For free tier, no checkout needed
        if (input.productKey === "FREE") {
          // Update user subscription in database
          await updateSubscription(ctx.user.id, {
            status: "trial",
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            subscriptionStartDate: new Date(),
            subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });

          return {
            success: true,
            message: "Free tier activated",
            tier: "FREE",
          };
        }

        // For paid tiers, create checkout session
        const { createCheckoutSession } = await import("../stripe/stripeService");
        const result = await createCheckoutSession({
          userId: ctx.user.id,
          userEmail: ctx.user.email || "",
          userName: ctx.user.name || undefined,
          productKey: input.productKey as ProductKey,
          successUrl: `${ctx.req.headers.origin}/billing/success`,
          cancelUrl: `${ctx.req.headers.origin}/billing/cancel`,
        });

        return {
          success: true,
          sessionId: result.sessionId,
          url: result.url,
        };
      } catch (error) {
        console.error("Checkout session creation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }
    }),

  /**
   * Get checkout session details
   */
  getCheckoutSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      try {
        const { getCheckoutSession } = await import("../stripe/stripeService");
        const session = await getCheckoutSession(input.sessionId);

        // The session must belong to the caller. This was a publicProcedure that
        // returned payment status, subscription id and Stripe customer id for any
        // session id handed to it — the same pattern stripeRouter.verifyCheckoutSession
        // already guards against. Session ids leak through browser history, Referer
        // headers and support tickets; entropy is not an authorisation check.
        const sessionUserId = parseInt(
          (session.metadata?.user_id as string) || (session.client_reference_id as string) || ""
        );
        if (!sessionUserId || sessionUserId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Denne betalingsøkten tilhører ikke din konto.",
          });
        }

        return {
          id: session.id,
          status: session.payment_status,
          subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
          customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
        };
      } catch (error) {
        // Re-throw our own errors unchanged. Without this the FORBIDDEN above is
        // swallowed by this handler and reported as INTERNAL_SERVER_ERROR, which
        // tells the caller "we broke" instead of "that is not your session".
        if (error instanceof TRPCError) throw error;
        console.error("Get checkout session error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve checkout session",
        });
      }
    }),

  /**
   * Get current subscription status
   */
  getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
    try {
      const subscription = await getUserSubscription(ctx.user.id);

      if (!subscription) {
        return {
          tier: "FREE",
          status: "trial",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }

      const tier = await tierForSubscription(subscription);

      return {
        tier,
        status: subscription.status,
        currentPeriodStart: subscription.subscriptionStartDate,
        currentPeriodEnd: subscription.subscriptionEndDate,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      };
    } catch (error) {
      console.error("Get subscription error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve subscription",
      });
    }
  }),

  /**
   * Cancel subscription
   */
  cancelSubscription: protectedProcedure
    .input(z.object({ reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const subscription = await getUserSubscription(ctx.user.id);

        if (!subscription || !subscription.stripeSubscriptionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active subscription to cancel",
          });
        }

        // Cancel the Stripe subscription
        const { cancelSubscription } = await import("../stripe/stripeService");
        // Cancel at period end: no further charges, access continues until the paid
        // period ends. The Stripe webhook flips status to cancelled at period end.
        const updated = await cancelSubscription(subscription.stripeSubscriptionId);
        const periodEnd = (updated as any)?.current_period_end
          ? new Date((updated as any).current_period_end * 1000)
          : null;
        if (periodEnd) {
          await updateSubscription(ctx.user.id, { subscriptionEndDate: periodEnd });
        }

        // Log cancellation reason
        if (input.reason) {
          console.log(`User ${ctx.user.id} cancelled subscription. Reason: ${input.reason}`);
        }

        return {
          success: true,
          message: "Subscription cancelled. Access will continue until the end of the billing period.",
        };
      } catch (error) {
        console.error("Cancel subscription error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel subscription",
        });
      }
    }),

  /**
   * Create customer portal session for managing subscription
   */
  createBillingPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const subscription = await getUserSubscription(ctx.user.id);

      if (!subscription || !subscription.stripeCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Stripe customer found",
        });
      }

      const { createCustomerPortalSession } = await import("../stripe/stripeService");
      const portalUrl = await createCustomerPortalSession(
        subscription.stripeCustomerId,
        `${ctx.req.headers.origin}/settings/billing`
      );

      return {
        url: portalUrl,
      };
    } catch (error) {
      console.error("Create billing portal session error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create billing portal session",
      });
    }
  }),

  /**
   * Get billing history
   */
  getBillingHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get subscription invoices from Stripe
      const subscription = await getUserSubscription(ctx.user.id);
      
      if (!subscription || !subscription.stripeSubscriptionId) {
        return [];
      }
      
      // Return subscription history
      const invoices: Array<{
        id: string;
        date: Date;
        amount: number;
        currency: string;
        status: string;
        description: string;
        invoiceUrl?: string;
      }> = [];

      return invoices.map((invoice) => ({
        id: invoice.id,
        date: invoice.date,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        description: invoice.description,
        invoiceUrl: invoice.invoiceUrl,
      }));
    } catch (error) {
      console.error("Get billing history error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve billing history",
      });
    }
  }),

  /**
   * Get subscription usage
   */
  getSubscriptionUsage: protectedProcedure.query(async ({ ctx }) => {
    try {
      const subscription = await getUserSubscription(ctx.user.id);

      if (!subscription) {
        // These MUST be the same numbers as the FREE branch below. They were not:
        // this branch handed a brand-new account 5 posts and 1 platform while a
        // lapsed one got 2 and 4, so the allowance depended on whether a row
        // happened to exist.
        return {
          tier: "FREE" as const,
          postsUsed: 0,
          postsLimit: TIER_LIMITS.FREE.posts,
          platformsUsed: 0,
          platformsLimit: TIER_LIMITS.FREE.platforms,
          aiImagesUsed: 0,
          aiImagesLimit: TIER_LIMITS.FREE.aiImages,
        };
      }

      // Same derivation as getCurrentSubscription — the billing page and the
      // quota must not be able to disagree about what the customer bought.
      const tier = await tierForSubscription(subscription);
      const tierLimits = TIER_LIMITS[tier];

      // Calculate platform connections and AI images used
      // These can be calculated from posts table
      const userPosts = await getUserPosts(ctx.user.id);
      const uniquePlatforms = new Set(userPosts.map((p: any) => p.platform)).size;
      const aiImagesUsed = userPosts.filter((p: any) => p.imageUrl).length;

      return {
        tier: tier,
        postsUsed: subscription.postsGenerated,
        postsLimit: tierLimits.posts,
        platformsUsed: uniquePlatforms,
        platformsLimit: tierLimits.platforms,
        aiImagesUsed: aiImagesUsed,
        aiImagesLimit: tierLimits.aiImages,
      };
    } catch (error) {
      console.error("Get subscription usage error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve subscription usage",
      });
    }
  }),

  /**
   * Upgrade subscription
   */
  upgradeSubscription: protectedProcedure
    .input(z.object({ productKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const currentSubscription = await getUserSubscription(ctx.user.id);

        if (!currentSubscription || !currentSubscription.stripeSubscriptionId) {
          // No current subscription, create new checkout session
          const { createCheckoutSession } = await import("../stripe/stripeService");
          const result = await createCheckoutSession({
            userId: ctx.user.id,
            userEmail: ctx.user.email || "",
            userName: ctx.user.name || undefined,
            productKey: input.productKey as ProductKey,
            successUrl: `${ctx.req.headers.origin}/billing/success`,
            cancelUrl: `${ctx.req.headers.origin}/billing/cancel`,
          });

          return {
            success: true,
            sessionId: result.sessionId,
            url: result.url,
          };
        }

        // For now, redirect to billing portal for upgrade
        // In production, implement subscription update logic
        const { createCustomerPortalSession } = await import("../stripe/stripeService");
        const portalUrl = await createCustomerPortalSession(
          currentSubscription.stripeCustomerId || "",
          `${ctx.req.headers.origin}/settings/billing`
        );

        return {
          url: portalUrl,
          message: "Please manage your subscription in the billing portal",
        };
      } catch (error) {
        console.error("Upgrade subscription error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upgrade subscription",
        });
      }
    }),
});