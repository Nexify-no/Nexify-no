/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Telegram Webhook Route Registration
 * Registers the webhook endpoint with Express
 */

import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { handleTelegramWebhook } from "../telegramWebhook";

// Telegram authenticates webhook calls via the secret token configured in setWebhook,
// sent back on every request as the X-Telegram-Bot-Api-Secret-Token header. Verify it
// (constant-time) and fail closed so forged updates cannot drive AI generation / account links.
function verifyTelegramSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!expected) {
    console.error("[Telegram] TELEGRAM_WEBHOOK_SECRET not configured — rejecting webhook");
    return res.status(503).json({ error: "Webhook not configured" });
  }
  const got = (req.header("X-Telegram-Bot-Api-Secret-Token") as string) || "";
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(got, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function registerTelegramWebhook(app: Express) {
  app.post("/api/telegram/webhook", verifyTelegramSecret, handleTelegramWebhook);

  console.log("[Telegram] Webhook endpoint registered at /api/telegram/webhook");
}