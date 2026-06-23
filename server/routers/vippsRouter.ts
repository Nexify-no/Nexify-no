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
import { z } from "zod";
import { vippsService } from "../_core/vipps";
import { vippsAuthService } from "../_core/vippsAuth";

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
    .query(async ({ input }: any) => {
      if (!vippsService) {
        throw new Error("Vipps service not configured");
      }

      try {
        const status = await vippsService.getPaymentStatus(input.orderId);
        return status;
      } catch (error) {
        console.error("Failed to get payment status:", error);
        throw new Error("Failed to get payment status");
      }
    }),

  /**
   * Cancel a payment
   */
  cancelPayment: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ input }: any) => {
      if (!vippsService) {
        throw new Error("Vipps service not configured");
      }

      try {
        await vippsService.cancelPayment(input.orderId);

        const { markPaymentOrderStatus } = await import("../db");
        await markPaymentOrderStatus(input.orderId, "cancelled");

        return { success: true };
      } catch (error) {
        console.error("Failed to cancel payment:", error);
        throw new Error("Failed to cancel payment");
      }
    }),

  /**
   * Refund a payment
   */
  refundPayment: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        amount: z.number().positive(),
      })
    )
    .mutation(async ({ input }: any) => {
      if (!vippsService) {
        throw new Error("Vipps service not configured");
      }

      try {
        await vippsService.refundPayment(input.orderId, input.amount);

        // The payment_orders enum has no "refunded" state, so mark it cancelled
        // (no longer an active/captured payment) to keep the DB consistent.
        const { markPaymentOrderStatus } = await import("../db");
        await markPaymentOrderStatus(input.orderId, "cancelled");

        return { success: true };
      } catch (error) {
        console.error("Failed to refund payment:", error);
        throw new Error("Failed to refund payment");
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
    .mutation(async ({ input }: { input: { code: string; state: string } }) => {
      if (!vippsAuthService) {
        throw new Error("Vipps Auth service not configured");
      }

      try {
        // Exchange code for tokens
        const tokens = await vippsAuthService.exchangeCodeForToken(input.code);

        // Decode ID token to get user info
        const userInfo = vippsAuthService.decodeIdToken(tokens.id_token);

        return {
          success: true,
          userInfo: {
            id: userInfo.sub,
            phone: userInfo.phone_number,
            email: userInfo.email,
            name: userInfo.name,
          },
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
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