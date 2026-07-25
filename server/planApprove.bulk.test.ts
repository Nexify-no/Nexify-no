import { describe, it, expect } from "vitest";
import { canApprove, canBulkApprove } from "./planApprove";

const post = (verificationStatus: "verified" | "needs_review" | "unsupported" | "high_risk") =>
  ({ generationStatus: "done" as const, verificationStatus });

describe("bulk approval is stricter than single approval (MB4)", () => {
  it("bulk-approves ONLY fully verified posts", () => {
    expect(canBulkApprove(post("verified"))).toBe(true);
    expect(canBulkApprove(post("needs_review"))).toBe(false);
    expect(canBulkApprove(post("unsupported"))).toBe(false);
    expect(canBulkApprove(post("high_risk"))).toBe(false);
  });

  it("still lets a human approve a reviewed post one by one (but never high risk)", () => {
    expect(canApprove(post("needs_review"))).toBe(true);
    expect(canApprove(post("unsupported"))).toBe(true);
    expect(canApprove(post("high_risk"))).toBe(false);
  });

  it("never approves a post that has not finished generating", () => {
    expect(canBulkApprove({ generationStatus: "pending", verificationStatus: "verified" })).toBe(false);
    expect(canApprove({ generationStatus: "failed", verificationStatus: "verified" })).toBe(false);
  });
});
