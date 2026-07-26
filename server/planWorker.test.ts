/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import { runPlanTick, type PlanWorkerDeps, type ClaimedPlan, type ClaimedPost } from "./planWorker";

const T0 = new Date("2026-07-20T10:00:00Z");
const PLAN: ClaimedPlan = { id: 9, userId: 5, leaseToken: "pl1", goal: "mixed", platform: "linkedin", timeZone: "Europe/Oslo", brandSnapshot: {}, cancelRequested: false };
const mkPost = (id: number, attemptCount = 1): ClaimedPost => ({
  id, planId: 9, userId: 5, leaseToken: `pt${id}`, postGenerationId: `g${id}`,
  contentType: "tips", platform: "linkedin", weekNumber: 1, suggestedDate: "2026-07-20",
  attemptCount, reason: null,
});

function mkDeps(overrides: Partial<PlanWorkerDeps> = {}) {
  const saved: Array<{ post: ClaimedPost; content: string }> = [];
  const failures: Array<{ post: ClaimedPost; err: string; action: string }> = [];
  const posts = [mkPost(1), mkPost(2)];
  let idx = 0;
  let finalized = false;
  let released = false;
  const deps: PlanWorkerDeps = {
    now: () => T0,
    claimPlan: async () => PLAN,
    claimNextPost: async () => (idx < posts.length ? posts[idx++] : null),
    heartbeat: async () => true,
    generateText: async () => "tekst",
    savePostSuccess: async (post, content) => { saved.push({ post, content }); return true; },
    savePostFailure: async (post, err, dec) => { failures.push({ post, err, action: dec.action }); return true; },
    finalizePlanIfDone: async () => { finalized = true; },
    releasePlan: async () => { released = true; },
    ...overrides,
  };
  return { deps, saved, failures, state: () => ({ finalized, released }) };
}

describe("planWorker.runPlanTick", () => {
  it("processes claimed posts, saves incrementally, finalizes and releases", async () => {
    const { deps, saved, state } = mkDeps();
    const r = await runPlanTick(deps, "w1", 5);
    // `images` joined the summary when image generation was added to the tick;
    // these fake deps generate none.
    expect(r).toEqual({ claimed: true, processed: 2, failed: 0, images: 0 });
    expect(saved).toHaveLength(2);
    expect(state()).toEqual({ finalized: true, released: true });
  });

  it("one transient failure retries (backoff) while the rest of the plan continues", async () => {
    let first = true;
    const { deps, saved, failures } = mkDeps({
      generateText: async () => { if (first) { first = false; throw new Error("rate limited"); } return "ok"; },
    });
    const r = await runPlanTick(deps, "w1", 5);
    expect(saved).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].action).toBe("retry"); // attempt 1 of 3
    expect(r.processed).toBe(1);
  });

  it("fails permanently once attempt_count reaches the max", async () => {
    let done = false;
    const { deps, failures } = mkDeps({
      claimNextPost: async () => (done ? null : ((done = true), mkPost(1, 3))),
      generateText: async () => { throw new Error("boom"); },
    });
    const r = await runPlanTick(deps, "w1", 5);
    expect(failures[0].action).toBe("fail");
    expect(r.failed).toBe(1);
  });

  it("discards a stale write when the lease was lost (savePostSuccess=false)", async () => {
    const { deps } = mkDeps({ savePostSuccess: async () => false });
    const r = await runPlanTick(deps, "w1", 5);
    expect(r.processed).toBe(0); // late responses are ignored, never counted
  });

  it("sanitizes errors before persisting (no huge payloads)", async () => {
    let captured = "";
    const { deps } = mkDeps({
      generateText: async () => { throw new Error(`resp "${"y".repeat(500)}"`); },
      savePostFailure: async (_p, err, _d) => { captured = err; return true; },
    });
    await runPlanTick(deps, "w1", 1);
    expect(captured.length).toBeLessThanOrEqual(280);
    expect(captured).not.toContain("y".repeat(100));
  });

  it("honors cancel_requested without processing posts", async () => {
    let cancelled = false;
    const { deps } = mkDeps({
      claimPlan: async () => ({ ...PLAN, cancelRequested: true }),
      markPlanCancelled: async () => { cancelled = true; },
    });
    const r = await runPlanTick(deps, "w1", 5);
    expect(cancelled).toBe(true);
    expect(r.processed).toBe(0);
  });

  it("is idle when no plan is claimable", async () => {
    const { deps } = mkDeps({ claimPlan: async () => null });
    const r = await runPlanTick(deps, "w1", 5);
    expect(r.claimed).toBe(false);
  });
});
