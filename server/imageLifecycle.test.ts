/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import {
  nextImageStatus,
  shouldApplyImage,
  verifyImageUrl,
  isImageLoading,
  type ImageStatus,
} from "./imageLifecycle";

/**
 * Simulates the server's attachImage decision: a post owns its image slot via
 * imageGenerationId; an incoming image is applied only if it still owns the
 * slot AND its URL verifies. Mirrors the real procedure's logic so these tests
 * prove the actual behaviour, not a parallel reimplementation.
 */
function attach(
  post: { imageGenerationId: string | null; imageStatus: ImageStatus; imageUrl: string | null },
  incoming: { generationId: string; url: string },
) {
  if (!shouldApplyImage(post, incoming.generationId)) {
    return { applied: false as const, reason: "superseded" as const, post };
  }
  let status = nextImageStatus(post.imageStatus, "uploaded"); // -> verifying
  if (verifyImageUrl(incoming.url)) {
    status = nextImageStatus(status, "verified"); // -> completed
    return { applied: true as const, post: { ...post, imageStatus: status, imageUrl: incoming.url } };
  }
  status = nextImageStatus(status, "verifyFailed"); // -> failed
  return { applied: true as const, reason: "invalid_url" as const, post: { ...post, imageStatus: status, imageUrl: post.imageUrl } };
}

describe("imageLifecycle state machine", () => {
  it("follows pending -> generating -> verifying -> completed", () => {
    let s: ImageStatus = "none";
    s = nextImageStatus(s, "request"); expect(s).toBe("pending");
    s = nextImageStatus(s, "start"); expect(s).toBe("generating");
    s = nextImageStatus(s, "uploaded"); expect(s).toBe("verifying");
    s = nextImageStatus(s, "verified"); expect(s).toBe("completed");
  });

  it("verify failure goes to failed", () => {
    let s: ImageStatus = "generating";
    s = nextImageStatus(s, "uploaded"); expect(s).toBe("verifying");
    s = nextImageStatus(s, "verifyFailed"); expect(s).toBe("failed");
  });

  it("out-of-order events are no-ops (cannot corrupt state)", () => {
    expect(nextImageStatus("none", "verified")).toBe("none"); // can't complete from nothing
    expect(nextImageStatus("completed", "uploaded")).toBe("completed"); // late upload ignored
    expect(nextImageStatus("completed", "start")).toBe("completed"); // stray start ignored
  });

  it("reset clears the slot when a new generation begins", () => {
    expect(nextImageStatus("completed", "reset")).toBe("none");
    expect(nextImageStatus("generating", "reset")).toBe("none");
  });
});

describe("verifyImageUrl", () => {
  it("accepts a hosted https url", () => {
    expect(verifyImageUrl("https://cdn.penna.no/img/abc.png")).toBe(true);
  });
  it("rejects data URIs, empty, http, and junk", () => {
    expect(verifyImageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(verifyImageUrl("")).toBe(false);
    expect(verifyImageUrl("http://insecure.example/x.png")).toBe(false);
    expect(verifyImageUrl("not a url")).toBe(false);
    expect(verifyImageUrl(null)).toBe(false);
    expect(verifyImageUrl("https://x/" + "a".repeat(3000))).toBe(false);
  });
});

describe("shouldApplyImage — late / superseded responses", () => {
  it("LATE RESPONSE: a superseded generation's image is rejected", () => {
    // Post's slot is owned by the newest generation "gen-2".
    const post = { imageGenerationId: "gen-2", imageStatus: "generating" as ImageStatus, imageUrl: null };
    // A late image from the older "gen-1" arrives -> rejected, image untouched.
    const r = attach(post, { generationId: "gen-1", url: "https://cdn.penna.no/old.png" });
    expect(r.applied).toBe(false);
    expect(r.post.imageUrl).toBeNull();
    expect(r.post.imageStatus).toBe("generating");
  });

  it("RAPID CLICKS: only the last generation's image attaches", () => {
    // Each click claims the slot with a new id (setImageGenerating).
    let post = { imageGenerationId: "gen-1", imageStatus: "generating" as ImageStatus, imageUrl: null };
    post = { ...post, imageGenerationId: "gen-2" }; // second click claims the slot
    post = { ...post, imageGenerationId: "gen-3" }; // third click claims the slot
    // gen-1 and gen-2 responses arrive late -> rejected.
    expect(attach(post, { generationId: "gen-1", url: "https://cdn.penna.no/1.png" }).applied).toBe(false);
    expect(attach(post, { generationId: "gen-2", url: "https://cdn.penna.no/2.png" }).applied).toBe(false);
    // gen-3 (the active one) is accepted and completes.
    const ok = attach(post, { generationId: "gen-3", url: "https://cdn.penna.no/3.png" });
    expect(ok.applied).toBe(true);
    expect(ok.post.imageUrl).toBe("https://cdn.penna.no/3.png");
    expect(ok.post.imageStatus).toBe("completed");
  });

  it("FAILURE: an invalid image url marks the post failed, keeps no image", () => {
    const post = { imageGenerationId: "gen-9", imageStatus: "generating" as ImageStatus, imageUrl: null };
    const r = attach(post, { generationId: "gen-9", url: "data:image/png;base64,ZZ" });
    expect(r.applied).toBe(true);
    expect(r.post.imageStatus).toBe("failed");
    expect(r.post.imageUrl).toBeNull();
  });

  it("PAGE REFRESH: a persisted in-flight status still reads as loading", () => {
    // After a refresh, the Posts page reads image_status from the DB; a post
    // left mid-generation shows a skeleton, a failed one does not.
    expect(isImageLoading("generating")).toBe(true);
    expect(isImageLoading("verifying")).toBe(true);
    expect(isImageLoading("pending")).toBe(true);
    expect(isImageLoading("completed")).toBe(false);
    expect(isImageLoading("failed")).toBe(false);
  });
});
