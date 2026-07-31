/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Vipps Payment Router
 * tRPC procedures for Vipps payment handling
 */

import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { vippsService } from "../_core/vipps";
import { vippsAuthService } from "../_core/vippsAuth";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";

/**
 * Load a payment order and assert it belongs to the calling user. Prevents IDOR:
 * a user must never read/cancel/refund another tenant's order via a guessed orderId.
 * Returns the owned order (with the server-side expectedAmount).
 */
async function assertOwnedOrder(userId: number, orderId: string) {
  const { getPaymentOrder } = await import("../db");
  const order = await getPaymentOrder(orderId);
  if (!order || order.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Order not found or not yours" });
  }
  return order;
}

export const vippsRouter = router({
  /**
   * Initiate a Vipps payment
   */
  initiatePayment: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        orderId: z.string(),
        description: z.string(),
        fallbackUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      if (!vippsService) {
        throw new Error("Vipps service not configured");
      }

      // Integrity: never trust a client-supplied amount. Require it to match a
      // real plan price (monthly or yearly) so a user cannot pay 1 øre for Pro.
      const { getDb } = await import("../db");
      const { subscriptionPlans } = await import("../../drizzle/schema");
      const { eq, or } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const matchingPlan = await db
        .select()
        .from(subscriptionPlans)
        .where(
          or(
            eq(subscriptionPlans.priceMonthly, input.amount),
            eq(subscriptionPlans.priceYearly, input.amount)
          )
        )
        .limit(1);
      if (!matchingPlan.length) {
        throw new Error("Invalid payment amount");
      }

      // Persist a server-issued order bound to THIS authenticated user + plan +
      // expected amount. The webhook validates the capture against this record.
      const { createPaymentOrder } = await import("../db");
      await createPaymentOrder({
        orderId: input.orderId,
        userId: ctx.user.id,
        planId: matchingPlan[0].id,
        expectedAmount: input.amount,
        currency: matchingPlan[0].currency || "NOK",
      });

      try {
        const paymentResponse = await vippsService.initiatePayment({
          orderId: input.orderId,
          amount: input.amount,
          orderDescription: input.description,
          fallBack: input.fallbackUrl,
          callbackPrefix: process.env.VIPPS_CALLBACK_PREFIX,
        });

        return {
          success: true,
          url: paymentResponse.url,
          deepLinkUrl: paymentResponse.deepLinkUrl,
        };
      } catch (error) {
        console.error("Failed to initiate Vipps payment:", error);
        throw new Error("Failed to initiate payment");
      }
    }),

  /**
   * Get payment status
   */
  getPaymentStatus: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }: any) => {
      if (!vippsService) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Vipps service not configured" });
      }
      // Ownership check BEFORE touching the payment provider.
      await assertOwnedOrder(ctx.user.id, input.orderId);
      try {
        return await vippsService.getPaymentStatus(input.orderId);
      } catch (error) {
        console.error("Failed to get payment status:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get payment status" });
      }
    }),

  /**
   * Cancel a payment
   */
  cancelPayment: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }: any) => {
      if (!vippsService) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Vipps service not configured" });
      }
      await assertOwnedOrder(ctx.user.id, input.orderId);
      try {
        await vippsService.cancelPayment(input.orderId);
        const { markPaymentOrderStatus } = await import("../db");
        await markPaymentOrderStatus(input.orderId, "cancelled");
        return { success: true };
      } catch (error) {
        console.error("Failed to cancel payment:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to cancel payment" });
      }
    }),

  /**
   * Refund a payment
   */
  refundPayment: protectedProcedure
    // `amount` is intentionally NOT accepted from the client — the refund amount
    // is derived from the trusted server-side order (expectedAmount).
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }: any) => {
      if (!vippsService) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Vipps service not configured" });
      }
      const order = await assertOwnedOrder(ctx.user.id, input.orderId);
      try {
        // Refund exactly what we recorded at initiation — never a client value.
        await vippsService.refundPayment(input.orderId, order.expectedAmount);

        // The payment_orders enum has no "refunded" state, so mark it cancelled
        // (no longer an active/captured payment) to keep the DB consistent.
        const { markPaymentOrderStatus } = await import("../db");
        await markPaymentOrderStatus(input.orderId, "cancelled");

        return { success: true };
      } catch (error) {
        console.error("Failed to refund payment:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to refund payment" });
      }
    }),

  /**
   * Get Vipps login URL
   */
  getLoginUrl: publicProcedure
    .input(z.object({ state: z.string() }))
    .mutation(({ input }: { input: { state: string } }) => {
      if (!vippsAuthService) {
        throw new Error("Vipps Auth service not configured");
      }

      const url = vippsAuthService.getAuthorizationUrl(input.state);
      return { url, state: input.state };
    }),

  /**
   * Handle Vipps login callback
   */
  handleLoginCallback: publicProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      if (!vippsAuthService) {
        throw new Error("Vipps Auth service not configured");
      }

      try {
        // Exchange code for Vipps tokens, then decode the id_token for identity.
        const tokens = await vippsAuthService.exchangeCodeForToken(input.code);
        const userInfo = vippsAuthService.decodeIdToken(tokens.id_token);

        // SECURITY: establish a real app session server-side (httpOnly cookie),
        // exactly like the Google flow — and NEVER return the raw Vipps
        // access/refresh tokens to the browser (they used to be stored in
        // localStorage, readable by any XSS). The Vipps tokens stay on the server.
        const displayName = userInfo.name || userInfo.email?.split("@")[0] || "Vipps-bruker";

        // One account per email (see services/identityLinking.ts). Vipps does
        // not assert that the address it returns has been verified, so this
        // never auto-links into an existing account — it either recognises the
        // Vipps identity from a previous login, creates a new account, or
        // refuses and asks the person to sign in the way they registered.
        const resolved = await db.resolveOAuthLogin({
          provider: "vipps",
          subject: userInfo.sub,
          email: userInfo.email ?? null,
          emailVerified: false,
          name: displayName,
        });

        if (!resolved.ok) {
          const { refusalMessage } = await import("../services/identityLinking");
          throw new TRPCError({ code: "CONFLICT", message: refusalMessage(resolved.reason) });
        }

        const openId = resolved.openId;
        const sessionToken = await sdk.createSessionToken(openId, {
          name: displayName,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        // Return only non-sensitive profile info — no tokens.
        return {
          success: true,
          userInfo: {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
          },
        };
      } catch (error) {
        console.error("Failed to handle Vipps login callback:", error);
        throw new Error("Failed to complete Vipps login");
      }
    }),

  /**
   * Refresh Vipps access token
   */
  refreshToken: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }: { input: { refreshToken: string } }) => {
      if (!vippsAuthService) {
        throw new Error("Vipps Auth service not configured");
      }

      try {
        const result = await vippsAuthService.refreshAccessToken(
          input.refreshToken
        );
        return {
          success: true,
          accessToken: result.access_token,
          expiresIn: result.expires_in,
        };
      } catch (error) {
        console.error("Failed to refresh Vipps token:", error);
        throw new Error("Failed to refresh token");
      }
    }),

  /**
   * Logout from Vipps
   */
  logout: protectedProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ input }: { input: { accessToken: string } }) => {
      if (!vippsAuthService) {
        throw new Error("Vipps Auth service not configured");
      }

      try {
        await vippsAuthService.revokeToken(input.accessToken);
        return { success: true };
      } catch (error) {
        console.error("Failed to logout from Vipps:", error);
        // Don't throw - logout should succeed even if revocation fails
        return { success: true };
      }
    }),
});