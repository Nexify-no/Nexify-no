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
 * Fatal (production): REDIS_URL (shared rate-limit store).
 * Warnings (production): VIPPS_SECRET_KEY, TELEGRAM_WEBHOOK_SECRET —
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

  // Production: REDIS_URL is REQUIRED. Without a shared store the rate limiters
  // (incl. the paid-AI cost backstop) fall back to per-instance memory, which is
  // bypassable across instances — so we FAIL CLOSED and refuse to start.
  if (PROD) {
    if (!process.env.REDIS_URL)
      errors.push("REDIS_URL is required in production — rate limiting must use a shared store (fail-closed).");
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