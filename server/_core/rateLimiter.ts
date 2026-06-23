/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import rateLimit, { ipKeyGenerator, type Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { Request, Response, NextFunction } from "express";
import { getRedis } from "./redis";

/**
 * Level 2: Rate Limiting Middleware
 * Prevents API abuse by limiting requests per user/IP
 */

// Build a Redis-backed store (shared across instances) when REDIS_URL is set;
// otherwise return undefined so express-rate-limit uses its in-memory store (dev).
function makeStore(prefix: string): Store | undefined {
  const client = getRedis();
  if (!client) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) =>
      client.call(...(args as [string, ...string[]])) as Promise<any>,
  });
}

// IP-based rate limiter (general API)
export const ipRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:ip:"),
  skip: (req) => {
    // Only rate-limit the API surface. Static assets, the SPA shell, fonts and (in
    // dev) Vite's many per-page module requests must NOT count toward the limit — a
    // single page load is dozens of requests, so otherwise a normal user reloading a
    // couple of times gets 429'd and the app fails to bootstrap (white screen).
    return !req.path.startsWith("/api");
  },
});

// User-based rate limiter (stricter for authenticated users)
export const userRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per user
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    const user = (req as any).user;
    return user?.id ? `user-${user.id}` : ipKeyGenerator(req as any);
  },
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:user:"),
});

// AI endpoint rate limiter (very strict)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.id ? `ai-${user.id}` : ipKeyGenerator(req as any);
  },
  message: "Too many AI requests. Please wait before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:ai:"),
  skip: (req) => {
    // Skip for admin users
    const user = (req as any).user;
    return user?.role === "admin";
  },
});

// Custom middleware to check subscription limits
export async function checkSubscriptionLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // NOTE: this runs globally on /api/trpc, which also serves PUBLIC procedures
  // (login, plan listing, auth.me). It must therefore be non-blocking — it only
  // attaches the subscription for downstream use. Subscription/trial gating is
  // enforced per-procedure (e.g. content generation), not globally here.
  try {
    const user = (req as any).user;
    if (!user) return next();

    const { getUserSubscription } = await import("../db");
    const subscription = await getUserSubscription(user.id);
    if (subscription) {
      (req as any).subscription = subscription;
    }
    next();
  } catch (error) {
    console.error("[RateLimiter] Error checking subscription:", error);
    next();
  }
}

// Custom middleware to check plan limits
export async function checkPlanLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Non-blocking: attaches monthly-usage info for any procedure that wants it.
  // Hard quota enforcement lives in the generation procedures themselves
  // (they count real usage server-side), so this must not 429 unrelated reads.
  try {
    const user = (req as any).user;
    const subscription = (req as any).subscription;

    if (!user || !subscription) {
      return next();
    }

    // Define limits per plan
    const planLimits: Record<string, { postsPerMonth: number; aiRequestsPerDay: number }> = {
      trial: { postsPerMonth: 5, aiRequestsPerDay: 5 },
      pro_monthly: { postsPerMonth: 100, aiRequestsPerDay: 50 },
      pro_yearly: { postsPerMonth: 100, aiRequestsPerDay: 50 },
      enterprise_monthly: { postsPerMonth: 999999, aiRequestsPerDay: 999999 },
      enterprise_yearly: { postsPerMonth: 999999, aiRequestsPerDay: 999999 },
    };

    const limit = planLimits[subscription.planId] || planLimits.trial;

    // Check monthly limit
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const { posts } = await import("../../drizzle/schema");
    const { eq, gte, and } = await import("drizzle-orm");

    const postsThisMonth = await db
      .select()
      .from(posts)
      .where(and(eq(posts.userId, user.id), gte(posts.createdAt, monthStart)));

    // Attach limit info to request (informational; not enforced here)
    (req as any).planLimit = {
      ...limit,
      used: postsThisMonth.length,
      remaining: Math.max(0, limit.postsPerMonth - postsThisMonth.length),
      exceeded: postsThisMonth.length >= limit.postsPerMonth,
    };

    next();
  } catch (error) {
    console.error("[RateLimiter] Error checking plan limit:", error);
    next();
  }
}

// Exponential backoff for retries
export function exponentialBackoff(attempt: number): number {
  // Returns milliseconds to wait
  // Attempt 1: 1000ms, 2: 2000ms, 3: 4000ms, 4: 8000ms, max 60000ms
  return Math.min(1000 * Math.pow(2, attempt - 1), 60000);
}