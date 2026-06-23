/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Per-user rate-limit backstop for paid AI endpoints (LLM / image generation).
 *
 * This is a SAFETY NET against runaway cost and abuse — NOT the billing model.
 * It caps how fast a single account can call paid AI work, so a buggy client or a
 * malicious script can't burn an unbounded OpenAI bill. The nuanced per-plan AI
 * quota/credit gating is a separate (product) decision — see
 * docs/PRODUCTION_READINESS_BACKLOG.md §1.
 *
 * Limits are generous (real users won't hit them) and env-tunable. Backed by
 * Redis when REDIS_URL is set (global across instances); otherwise an in-memory
 * fallback (effective for a single instance — set REDIS_URL when scaling).
 */
import { TRPCError } from "@trpc/server";
import { getRedis } from "./redis";

const PER_MINUTE = parseInt(process.env.AI_RATE_PER_MINUTE || "20", 10);
const PER_DAY = parseInt(process.env.AI_RATE_PER_DAY || "500", 10);

// In-memory fixed-window buckets: key -> { count, resetAt }.
const mem = new Map<string, { count: number; resetAt: number }>();

function isTestEnv(): boolean {
  return !!process.env.VITEST || process.env.NODE_ENV === "test";
}

/** Increment `key` within `windowMs`; returns true if still within `limit`. */
async function withinLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const n = await redis.incr(key);
    if (n === 1) await redis.pexpire(key, windowMs);
    return n <= limit;
  }
  const now = Date.now();
  const bucket = mem.get(key);
  if (!bucket || bucket.resetAt <= now) {
    mem.set(key, { count: 1, resetAt: now + windowMs });
    return limit >= 1;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/**
 * Throw TOO_MANY_REQUESTS if the user has exceeded the per-minute or per-day AI
 * budget. No-op under test to keep the suite hermetic/deterministic.
 */
export async function enforceAiRateLimit(userId: number): Promise<void> {
  if (isTestEnv()) return;

  const now = Date.now();
  const minuteKey = `ai:rl:${userId}:m:${Math.floor(now / 60000)}`;
  const dayKey = `ai:rl:${userId}:d:${Math.floor(now / 86400000)}`;

  if (!(await withinLimit(minuteKey, PER_MINUTE, 60_000))) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Du sender for mange AI-forespørsler. Vent et øyeblikk og prøv igjen.",
    });
  }
  if (!(await withinLimit(dayKey, PER_DAY, 86_400_000))) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Du har nådd dagens AI-grense. Prøv igjen i morgen eller oppgrader.",
    });
  }

  // Opportunistic cleanup of expired in-memory buckets (no-op with Redis).
  if (mem.size > 5000) {
    mem.forEach((v, k) => { if (v.resetAt <= now) mem.delete(k); });
  }
}