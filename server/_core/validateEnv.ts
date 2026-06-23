/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Boot-time environment validation. Aggregates all config problems into one
 * actionable error so misconfiguration fails fast and clearly instead of
 * surfacing as confusing runtime failures later.
 *
 * Fatal (always): JWT_SECRET (>=32), DATABASE_URL.
 * Fatal (production only): OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   TOKEN_ENCRYPTION_KEY, PUBLIC_SITE_URL.
 * Warnings (production): REDIS_URL, VIPPS_SECRET_KEY, TELEGRAM_WEBHOOK_SECRET —
 *   the app boots but the related feature is disabled / fail-closed.
 */
export function validateEnv(): void {
  const PROD = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const requireKey = (key: string, opts: { minLen?: number; prodOnly?: boolean } = {}) => {
    if (opts.prodOnly && !PROD) return;
    const val = process.env[key] || "";
    if (!val) {
      errors.push(`${key} is required${opts.prodOnly ? " in production" : ""}`);
      return;
    }
    if (opts.minLen && val.length < opts.minLen) {
      errors.push(`${key} must be at least ${opts.minLen} characters`);
    }
  };

  // Always required to boot
  requireKey("JWT_SECRET", { minLen: 32 });
  requireKey("DATABASE_URL");

  // Required in production
  requireKey("OPENAI_API_KEY", { prodOnly: true });
  requireKey("STRIPE_SECRET_KEY", { prodOnly: true });
  requireKey("STRIPE_WEBHOOK_SECRET", { prodOnly: true });
  requireKey("TOKEN_ENCRYPTION_KEY", { prodOnly: true });
  requireKey("PUBLIC_SITE_URL", { prodOnly: true });

  // Production warnings — boot, but the feature is degraded/fail-closed
  if (PROD) {
    if (!process.env.REDIS_URL)
      warnings.push("REDIS_URL not set — rate limiting uses an in-memory store (ineffective on serverless).");
    if (!process.env.VIPPS_SECRET_KEY)
      warnings.push("VIPPS_SECRET_KEY not set — Vipps webhooks will be rejected (fail-closed).");
    if (!process.env.TELEGRAM_WEBHOOK_SECRET)
      warnings.push("TELEGRAM_WEBHOOK_SECRET not set — Telegram webhook will be rejected (fail-closed).");
  }

  warnings.forEach((w) => console.warn(`[env] WARNING: ${w}`));

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration — refusing to start:\n  - ${errors.join("\n  - ")}`
    );
  }
}