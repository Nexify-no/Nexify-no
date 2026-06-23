/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Shared Redis client (ioredis), connected via REDIS_URL.
 *
 * Used to back distributed rate limiting. On serverless (Vercel) the default
 * in-memory rate-limit store is per-instance and therefore ineffective; a shared
 * Redis store makes limits global. Returns null when REDIS_URL is unset so dev
 * can fall back to the in-memory store.
 */
import Redis from "ioredis";

let _client: Redis | null = null;
let _initialized = false;

export function getRedis(): Redis | null {
  if (_initialized) return _client;
  _initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[Redis] REDIS_URL is not set — rate limiting falls back to an in-memory store, which is ineffective on serverless. Set REDIS_URL (e.g. Upstash) in production."
      );
    }
    return null;
  }

  _client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  _client.on("error", (err) => console.error("[Redis] connection error:", err?.message || err));
  return _client;
}