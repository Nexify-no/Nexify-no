/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import { canApprove, plannedPostToDraft, type PlannedPostForDraft } from "./planApprove";

describe("planApprove.canApprove", () => {
  it("allows a done, non-high-risk post", () => {
    expect(canApprove({ generationStatus: "done", verificationStatus: "needs_review" })).toBe(true);
    expect(canApprove({ generationStatus: "done", verificationStatus: "verified" })).toBe(true);
  });
  it("blocks high_risk even when done", () => {
    expect(canApprove({ generationStatus: "done", verificationStatus: "high_risk" })).toBe(false);
  });
  it("blocks posts that are not done yet", () => {
    expect(canApprove({ generationStatus: "generating", verificationStatus: "verified" })).toBe(false);
    expect(canApprove({ generationStatus: "failed", verificationStatus: "verified" })).toBe(false);
  });
});

const base: PlannedPostForDraft = {
  userId: 7, platform: "linkedin", content: "Hei verden", reason: "Presentasjon",
  imageUrl: "https://cdn.example.com/a.png", imageStatus: "completed",
  imageGenerationId: "gen-1", postGenerationId: "pg-1",
};

describe("planApprove.plannedPostToDraft", () => {
  it("maps a completed-image post to a draft (never scheduled)", () => {
    const d = plannedPostToDraft(base);
    expect(d.status).toBe("draft");
    expect(d).not.toHaveProperty("scheduledFor");
    expect(d.generatedContent).toBe("Hei verden");
    expect(d.imageUrl).toBe("https://cdn.example.com/a.png");
    expect(d.imageStatus).toBe("completed");
    expect(d.generationId).toBe("pg-1");
    expect(d.rawInput).toBe("Presentasjon");
  });
  it("drops a skipped/failed image (no image carried over)", () => {
    expect(plannedPostToDraft({ ...base, imageStatus: "skipped" }).imageUrl).toBeNull();
    expect(plannedPostToDraft({ ...base, imageStatus: "failed" }).imageStatus).toBe("none");
    expect(plannedPostToDraft({ ...base, imageStatus: "skipped" }).imageGenerationId).toBeNull();
  });
  it("falls back to a safe rawInput when reason is empty", () => {
    expect(plannedPostToDraft({ ...base, reason: null }).rawInput).toBe("Innholdsplan");
    expect(plannedPostToDraft({ ...base, reason: "   " }).rawInput).toBe("Innholdsplan");
  });
  it("uses empty string when content is missing (never null)", () => {
    expect(plannedPostToDraft({ ...base, content: null }).generatedContent).toBe("");
  });
});
