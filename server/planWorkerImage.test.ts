/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import { runPlanTick, type PlanWorkerDeps, type ClaimedPlan, type ClaimedPost, type PostImageOutcome } from "./planWorker";

const T0 = new Date("2026-07-20T10:00:00Z");
const PLAN: ClaimedPlan = { id: 9, userId: 5, leaseToken: "pl1", goal: "mixed", platform: "linkedin", timeZone: "Europe/Oslo", brandSnapshot: {}, cancelRequested: false };
const mkPost = (id: number, attemptCount = 1): ClaimedPost => ({
  id, planId: 9, userId: 5, leaseToken: `pt${id}`, postGenerationId: `g${id}`,
  contentType: "tips", platform: "linkedin", weekNumber: 1, suggestedDate: "2026-07-20",
  attemptCount, reason: null,
});

function mkDeps(overrides: Partial<PlanWorkerDeps> = {}, postCount = 1) {
  const saved: Array<{ post: ClaimedPost; content: string; image?: PostImageOutcome }> = [];
  const posts = Array.from({ length: postCount }, (_, i) => mkPost(i + 1));
  let idx = 0;
  const deps: PlanWorkerDeps = {
    now: () => T0,
    claimPlan: async () => PLAN,
    claimNextPost: async () => (idx < posts.length ? posts[idx++] : null),
    heartbeat: async () => true,
    generateText: async () => "tekst",
    generateImage: async () => ({ status: "completed", url: "https://cdn.example.com/a.png", generationId: "g1" }),
    savePostSuccess: async (post, content, image) => { saved.push({ post, content, image }); return true; },
    savePostFailure: async () => true,
    finalizePlanIfDone: async () => {},
    releasePlan: async () => {},
    ...overrides,
  };
  return { deps, saved };
}

describe("planWorker Fase 2 — image step", () => {
  it("generates one image per post and passes the completed outcome to the success write", async () => {
    const { deps, saved } = mkDeps({}, 1);
    const r = await runPlanTick(deps, "w1", 5);
    expect(r.processed).toBe(1);
    expect(r.images).toBe(1);
    expect(saved[0].image).toEqual({ status: "completed", url: "https://cdn.example.com/a.png", generationId: "g1" });
  });

  it("an image failure NEVER fails the post — text is still saved (done) and counted", async () => {
    const { deps, saved } = mkDeps({
      generateImage: async () => ({ status: "failed" }),
    }, 1);
    const r = await runPlanTick(deps, "w1", 5);
    expect(r.processed).toBe(1);   // post still processed
    expect(r.images).toBe(0);      // but no image attached
    expect(saved[0].content).toBe("tekst");
    expect(saved[0].image).toEqual({ status: "failed" });
  });

  it("skips the image when image quota is empty (text kept, image_status=skipped)", async () => {
    const { deps, saved } = mkDeps({
      generateImage: async () => ({ status: "skipped" }),
    }, 1);
    const r = await runPlanTick(deps, "w1", 5);
    expect(r.processed).toBe(1);
    expect(r.images).toBe(0);
    expect(saved[0].image).toEqual({ status: "skipped" });
  });

  it("discards a stale write (lease lost) even when an image was generated", async () => {
    const { deps } = mkDeps({ savePostSuccess: async () => false }, 1);
    const r = await runPlanTick(deps, "w1", 5);
    expect(r.processed).toBe(0);
    expect(r.images).toBe(0);
  });

  it("never calls the image step when text generation throws (retry path)", async () => {
    let imageCalls = 0;
    const { deps } = mkDeps({
      generateText: async () => { throw new Error("rate limited"); },
      generateImage: async () => { imageCalls++; return { status: "completed", url: "https://x/y.png", generationId: "g1" }; },
    }, 1);
    const r = await runPlanTick(deps, "w1", 5);
    expect(imageCalls).toBe(0);
    expect(r.processed).toBe(0);
  });

  it("Fase 1 compatibility: a deps object without generateImage still processes text", async () => {
    const noImage = mkDeps({}, 1);
    delete (noImage.deps as Partial<PlanWorkerDeps>).generateImage;
    const r = await runPlanTick(noImage.deps, "w1", 5);
    expect(r.processed).toBe(1);
    expect(r.images).toBe(0);
    expect(noImage.saved[0].image).toBeUndefined();
  });
});
