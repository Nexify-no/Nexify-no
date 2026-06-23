/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Router, Request, Response } from "express";
import { getDb, markWebhookEventProcessed } from "../db";
import { subscriptions, userUsageTracking } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// Verify Vipps webhook signature (constant-time, over the raw request bytes)
function verifyVippsSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  // Length guard before timingSafeEqual (it throws on length mismatch)
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Handle Vipps payment callback
router.post("/callback", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-vipps-signature"] as string;
    const vippsSecret = process.env.VIPPS_SECRET_KEY || "";

    // Fail closed: never accept webhooks when the signing secret is unconfigured.
    if (!vippsSecret) {
      console.error("[Vipps Webhook] VIPPS_SECRET_KEY is not configured — rejecting");
      return res.status(503).json({ error: "Webhook not configured" });
    }

    // Verify HMAC over the exact raw bytes Vipps signed (not a re-serialized body)
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (!verifyVippsSignature(rawBody, signature, vippsSecret)) {
      console.error("[Vipps Webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { orderId, status, amount, transactionId } = req.body;

    console.log(`[Vipps Webhook] Processing payment: ${orderId} - ${status}`);

    if (status === "RESERVED" || status === "CAPTURED") {
      // Idempotency: ignore re-delivered captures for the same transaction.
      if (transactionId && !(await markWebhookEventProcessed(`vipps_${transactionId}`, "vipps"))) {
        return res.json({ success: true, message: "Duplicate ignored" });
      }

      // Source of truth is the server-issued order — NOT the (client-derivable)
      // orderId string. A forged webhook with no matching order cannot activate.
      const { getPaymentOrder, markPaymentOrderStatus } = await import("../db");
      const order = await getPaymentOrder(orderId);
      if (!order) {
        console.error("[Vipps Webhook] No matching order for:", orderId);
        return res.status(400).json({ error: "Unknown order" });
      }
      // The captured amount must match what we recorded at initiation.
      if (typeof amount === "number" && amount !== order.expectedAmount) {
        console.error(`[Vipps Webhook] Amount mismatch ${orderId}: got ${amount}, expected ${order.expectedAmount}`);
        await markPaymentOrderStatus(orderId, "failed", transactionId);
        return res.status(400).json({ error: "Amount mismatch" });
      }
      if (order.status === "captured") {
        return res.json({ success: true, message: "Already captured" });
      }

      // Payment successful - activate subscription
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const userId = order.userId;

      // Update subscription status
      const subscription = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      if (subscription.length) {
        // Update subscription to active, bound to the paid plan
        await db
          .update(subscriptions)
          .set({
            status: "active",
            planId: order.planId,
          })
          .where(eq(subscriptions.id, subscription[0].id));

        // Initialize usage tracking for new period
        const today = new Date();
        const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const periodEnd = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0
        );

        const existingUsage = await db
          .select()
          .from(userUsageTracking)
          .where(eq(userUsageTracking.userId, userId))
          .limit(1);

        if (!existingUsage.length) {
          await db.insert(userUsageTracking).values({
            userId,
            subscriptionId: subscription[0].id,
            postsUsed: 0,
            imagesUsed: 0,
            periodStartDate: periodStart,
            periodEndDate: periodEnd,
          } as any);
        }

        console.log(
          `[Vipps Webhook] Subscription activated for user ${userId}`
        );
      }

      // Mark the order captured (also makes re-delivery a no-op above).
      await markPaymentOrderStatus(orderId, "captured", transactionId);

      return res.json({ success: true, message: "Payment processed" });
    }

    if (status === "FAILED" || status === "REJECTED") {
      // Payment failed - log and notify
      console.error(`[Vipps Webhook] Payment failed: ${orderId}`);

      const db = await getDb();
      if (db) {
        const userIdMatch = orderId.match(/user_(\d+)_/);
        if (userIdMatch) {
          const userId = parseInt(userIdMatch[1]);
          // Could send email notification here
          console.log(`[Vipps Webhook] Notifying user ${userId} of payment failure`);
        }
      }

      return res.json({ success: true, message: "Payment failure logged" });
    }

    if (status === "CANCELLED") {
      console.log(`[Vipps Webhook] Payment cancelled: ${orderId}`);
      return res.json({ success: true, message: "Cancellation logged" });
    }

    return res.json({ success: true, message: "Event logged" });
  } catch (error) {
    console.error("[Vipps Webhook] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Handle Vipps fallback callback (user returns to app)
router.post("/fallback", async (req: Request, res: Response) => {
  try {
    const { orderId, status } = req.body;

    console.log(
      `[Vipps Fallback] User returned from Vipps: ${orderId} - ${status}`
    );

    // Redirect user to appropriate page
    if (status === "RESERVED" || status === "CAPTURED") {
      return res.redirect("/payment/success?orderId=" + orderId);
    } else if (status === "FAILED" || status === "REJECTED") {
      return res.redirect("/payment/failure?orderId=" + orderId);
    } else {
      return res.redirect("/payment/pending?orderId=" + orderId);
    }
  } catch (error) {
    console.error("[Vipps Fallback] Error:", error);
    return res.redirect("/payment/error");
  }
});

export default router;