/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Background worker for Enkel 4-week content plans — TEXT ONLY in Fase 1b
 * (image processing arrives in Fase 2). Driven by a scheduler tick; all
 * coordination is DB-lease based (see planLease.ts):
 *
 *  - claim plan/post with a NEW lease_token; only one worker wins (atomic UPDATE)
 *  - heartbeat extends both leases during long AI calls
 *  - EVERY result write is conditioned on the lease token → a worker that lost
 *    its lease can never persist a late response
 *  - transient failure → pending + next_attempt_at (exponential backoff);
 *    attempt_count >= MAX_ATTEMPTS → failed
 *  - a plan is finalized (ready/partial/failed) only when no post is
 *    pending/generating; one failed post never fails the whole plan
 *  - quota is charged idempotently per post (content_quota_charged flag)
 *
 * Deps are injected so the full behavior is testable without MySQL.
 */
import { HEARTBEAT_MS, retryDecision, sanitizeError, type RetryDecision } from "./planLease";

export interface ClaimedPost {
  id: number;
  planId: number;
  userId: number;
  leaseToken: string;
  postGenerationId: string;
  contentType: string;
  platform: string;
  weekNumber: number;
  suggestedDate: string;
  attemptCount: number;
  reason: string | null;
}

export interface ClaimedPlan {
  id: number;
  userId: number;
  leaseToken: string;
  goal: string;
  platform: string;
  timeZone: string;
  brandSnapshot: unknown;
  cancelRequested: boolean;
}

export interface PlanWorkerDeps {
  now(): Date;
  /** Atomically claim one runnable plan (new lease token) or null. */
  claimPlan(workerId: string): Promise<ClaimedPlan | null>;
  /** Atomically claim the next pending post of the plan (new token) or null when none left. */
  claimNextPost(planId: number, workerId: string): Promise<ClaimedPost | null>;
  /** Extend BOTH plan + post leases (same tokens). False = ownership lost. */
  heartbeat(plan: ClaimedPlan, post: ClaimedPost | null): Promise<boolean>;
  /** Generate the post text from the frozen snapshot. Pure — persists nothing. */
  generateText(plan: ClaimedPlan, post: ClaimedPost): Promise<string>;
  /** Lease-conditioned success write (+ idempotent quota charge). False = stale, discarded. */
  savePostSuccess(post: ClaimedPost, content: string): Promise<boolean>;
  /** Lease-conditioned failure write applying the retry decision. */
  savePostFailure(post: ClaimedPost, safeError: string, decision: RetryDecision): Promise<boolean>;
  /** Finalize the plan iff no pending/generating posts remain (derivePlanStatus). */
  finalizePlanIfDone(planId: number, leaseToken: string): Promise<void>;
  /** Release the plan lease without finalizing (posts still pending/backoff). */
  releasePlan(planId: number, leaseToken: string): Promise<void>;
  markPlanCancelled?(planId: number, leaseToken: string): Promise<void>;
}

/** Process at most `maxPosts` posts of one claimed plan. Returns a small summary. */
export async function runPlanTick(
  deps: PlanWorkerDeps,
  workerId: string,
  maxPosts = 3,
): Promise<{ claimed: boolean; processed: number; failed: number }> {
  const plan = await deps.claimPlan(workerId);
  if (!plan) return { claimed: false, processed: 0, failed: 0 };

  if (plan.cancelRequested && deps.markPlanCancelled) {
    await deps.markPlanCancelled(plan.id, plan.leaseToken);
    return { claimed: true, processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < maxPosts; i++) {
    const post = await deps.claimNextPost(plan.id, workerId);
    if (!post) break;

    // Heartbeat loop while the (potentially long) AI call runs.
    let hbAlive = true;
    const hb = setInterval(() => {
      void deps.heartbeat(plan, post).then((ok) => { if (!ok) hbAlive = false; });
    }, HEARTBEAT_MS);

    try {
      const content = await deps.generateText(plan, post);
      const applied = await deps.savePostSuccess(post, content);
      if (applied) processed++;
      // !applied → lease lost; the row was (or will be) re-claimed. Discard silently.
    } catch (err) {
      const decision = retryDecision(post.attemptCount, deps.now());
      const applied = await deps.savePostFailure(post, sanitizeError(err), decision);
      if (applied && decision.action === "fail") failed++;
    } finally {
      clearInterval(hb);
    }
    if (!hbAlive) break; // we lost the plan lease — stop touching this plan
  }

  await deps.finalizePlanIfDone(plan.id, plan.leaseToken);
  await deps.releasePlan(plan.id, plan.leaseToken);
  return { claimed: true, processed, failed };
}
