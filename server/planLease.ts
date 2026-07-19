/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Pure lease/state logic for the Enkel plan worker. No I/O — every decision
 * (claim windows, heartbeat extension, ownership checks, retry backoff, safe
 * error messages, terminal plan state) lives here so it can be unit-tested
 * exhaustively. planStore.ts applies these decisions atomically in SQL, and
 * every result-write is conditioned on the lease token so a worker that lost
 * its lease can never write a late response.
 */

export const LEASE_MS = 90_000; // claim window per unit of work
export const HEARTBEAT_MS = 30_000; // extend lease this often during long AI calls
export const MAX_ATTEMPTS = 3;
export const BACKOFF_BASE_MS = 30_000; // 30s, 60s, 120s (+ jitter)

export interface Lease {
  leaseToken: string;
  lockedBy: string;
  lockedAt: Date;
  lockExpiresAt: Date;
}

/** Fresh lease values for a claim. A NEW token every claim (never reused). */
export function newLease(workerId: string, now: Date, makeToken: () => string): Lease {
  return {
    leaseToken: makeToken(),
    lockedBy: workerId,
    lockedAt: now,
    lockExpiresAt: new Date(now.getTime() + LEASE_MS),
  };
}

/** Whether a row is claimable: not locked, or its lease has expired, and its backoff window has passed. */
export function isClaimable(row: { lockExpiresAt: Date | null; nextAttemptAt: Date | null }, now: Date): boolean {
  const lockFree = !row.lockExpiresAt || row.lockExpiresAt.getTime() < now.getTime();
  const backoffPassed = !row.nextAttemptAt || row.nextAttemptAt.getTime() <= now.getTime();
  return lockFree && backoffPassed;
}

/** Heartbeat: the new expiry while the SAME token keeps working. */
export function heartbeatExpiry(now: Date): Date {
  return new Date(now.getTime() + LEASE_MS);
}

/** Ownership check applied (in SQL) to every result write. */
export function ownsLease(row: { leaseToken: string | null; lockExpiresAt: Date | null }, token: string, now: Date): boolean {
  return row.leaseToken === token && !!row.lockExpiresAt && row.lockExpiresAt.getTime() > now.getTime();
}

export type RetryDecision =
  | { action: "retry"; nextAttemptAt: Date }
  | { action: "fail" };

/**
 * attempt_count is the number of attempts ALREADY made (incremented at claim).
 * < MAX_ATTEMPTS → back to pending with exponential backoff (+ deterministic-free jitter).
 */
export function retryDecision(attemptCount: number, now: Date, jitterMs = 0): RetryDecision {
  if (attemptCount >= MAX_ATTEMPTS) return { action: "fail" };
  const delay = BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attemptCount - 1)) + jitterMs;
  return { action: "retry", nextAttemptAt: new Date(now.getTime() + delay) };
}

/**
 * Terminal gating: a plan is only finished when NO post is pending/generating.
 * Otherwise it stays processing regardless of how many are done/failed.
 */
export function derivePlanStatus(posts: Array<{ generationStatus: string }>): "processing" | "ready" | "partial" | "failed" {
  if (posts.some((p) => p.generationStatus === "pending" || p.generationStatus === "generating")) return "processing";
  const failed = posts.filter((p) => p.generationStatus === "failed").length;
  if (failed === 0) return "ready";
  if (failed === posts.length) return "failed";
  return "partial";
}

/** Short, safe error message: never a prompt/response body, capped length. */
export function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  // Strip anything that looks like long quoted content and collapse whitespace.
  const cleaned = raw.replace(/\s+/g, " ").replace(/["'`]{1}[^"'`]{80,}["'`]{1}/g, "[redacted]").trim();
  return cleaned.slice(0, 280);
}
