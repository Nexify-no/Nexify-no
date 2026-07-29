/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * PKCE for the X OAuth 2.0 flow.
 *
 * X mandates PKCE. The previous implementation satisfied the letter of that by
 * sending `code_challenge_method=plain` with the literal challenge `"challenge"`
 * and then the literal verifier `"challenge"` back — a constant, in the source,
 * identical for every user. That is not PKCE; it is the shape of PKCE with the
 * security removed. Anyone who intercepted an authorization code could redeem it,
 * because the verifier it had to be paired with was public knowledge.
 *
 * This module does the real thing: a fresh 32-byte verifier per attempt, an S256
 * challenge, and the verifier held server-side — never through the browser — for
 * the lifetime of the redirect.
 *
 * The store is Redis when REDIS_URL is set, and an in-memory map otherwise. The
 * distinction matters on more than one instance: a verifier written by the
 * instance that served /api/x/connect must be readable by whichever instance
 * receives the callback. In-memory works for a single process and for local dev;
 * it is not a silent fallback, it warns.
 */
import crypto from "crypto";
import { getRedis } from "../_core/redis";

/** Same 15 minutes the signed OAuth state allows. */
const TTL_SECONDS = 15 * 60;
const KEY_PREFIX = "x:pkce:";

export function createVerifier(): string {
  // 43–128 chars of [A-Za-z0-9-._~] per RFC 7636. base64url of 32 bytes is 43.
  return crypto.randomBytes(32).toString("base64url");
}

export function challengeFor(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/** state -> { verifier, expiresAt }, for the single-process fallback. */
const memory = new Map<string, { verifier: string; expiresAt: number }>();
let warnedAboutMemory = false;

function sweep(now: number) {
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
}

export async function rememberVerifier(state: string, verifier: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(KEY_PREFIX + state, verifier, "EX", TTL_SECONDS);
    return;
  }
  if (!warnedAboutMemory && process.env.NODE_ENV === "production") {
    warnedAboutMemory = true;
    console.warn(
      "[X OAuth] REDIS_URL is not set — PKCE verifiers are held in this process only. " +
        "With more than one instance, a callback handled by a different instance will fail with ugyldig_state.",
    );
  }
  const now = Date.now();
  sweep(now);
  memory.set(state, { verifier, expiresAt: now + TTL_SECONDS * 1000 });
}

/**
 * Read the verifier for this state and delete it.
 *
 * Single use, deliberately. A verifier that survives its callback lets an
 * authorization code be replayed, which is the attack PKCE exists to stop.
 */
export async function consumeVerifier(state: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    // GETDEL, not GET-then-DEL. Two round trips leave a window in which two
    // concurrent callbacks carrying the same state both read the verifier before
    // either deletes it — which is precisely the replay this function claims to
    // prevent. GETDEL is atomic (Redis 6.2+); fall back only if the server is
    // older, where the two-step is still better than nothing.
    const key = KEY_PREFIX + state;
    if (typeof (redis as any).getdel === "function") {
      return await (redis as any).getdel(key);
    }
    const verifier = await redis.get(key);
    if (verifier) await redis.del(key);
    return verifier;
  }
  const now = Date.now();
  sweep(now);
  const entry = memory.get(state);
  if (!entry) return null;
  memory.delete(state);
  return entry.expiresAt > now ? entry.verifier : null;
}

/** Test seam. */
export function __resetPkceMemory() {
  memory.clear();
  warnedAboutMemory = false;
}
