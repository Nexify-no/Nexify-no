/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import { buildPlanSkeleton, totalPosts, normalizePerWeek } from "./planContent";

const START = new Date("2026-07-20T00:00:00"); // a Monday

describe("planContent.buildPlanSkeleton", () => {
  it("produces 8/12/20 posts for 2/3/5 per week, evenly across 4 weeks", () => {
    for (const [perWeek, total] of [[2, 8], [3, 12], [5, 20]] as const) {
      const items = buildPlanSkeleton({ goal: "mixed", postsPerWeek: perWeek, platforms: ["linkedin"], startDate: START });
      expect(items).toHaveLength(total);
      expect(totalPosts(perWeek)).toBe(total);
      for (let w = 1; w <= 4; w++) {
        expect(items.filter((i) => i.weekNumber === w)).toHaveLength(perWeek);
      }
    }
  });

  it("normalizes an unsupported cadence to 3/week", () => {
    expect(normalizePerWeek(4)).toBe(3);
    expect(normalizePerWeek(2)).toBe(2);
    expect(normalizePerWeek(5)).toBe(5);
  });

  it("uses the current year dynamically (never a hardcoded year)", () => {
    const items = buildPlanSkeleton({ goal: "customers", postsPerWeek: 3, platforms: ["linkedin"], startDate: START });
    expect(items.every((i) => i.suggestedDate.startsWith("2026-"))).toBe(true);
    const future = buildPlanSkeleton({ goal: "customers", postsPerWeek: 3, platforms: ["linkedin"], startDate: new Date("2030-01-07T00:00:00") });
    expect(future.every((i) => i.suggestedDate.startsWith("2030-"))).toBe(true);
  });

  it("assigns ascending weekday-only dates", () => {
    const items = buildPlanSkeleton({ goal: "trust", postsPerWeek: 5, platforms: ["linkedin"], startDate: START });
    const dates = items.map((i) => i.suggestedDate);
    expect(dates).toEqual([...dates].sort());
    for (const iso of dates) {
      const wd = new Date(`${iso}T00:00:00`).getDay();
      expect(wd).toBeGreaterThanOrEqual(1);
      expect(wd).toBeLessThanOrEqual(5);
    }
  });

  it("rotates across all selected platforms", () => {
    const items = buildPlanSkeleton({ goal: "mixed", postsPerWeek: 3, platforms: ["linkedin", "facebook", "instagram"], startDate: START });
    expect(new Set(items.map((i) => i.platform)).size).toBe(3);
  });

  it("never invents case/offer content when the brand lacks it", () => {
    const gated = buildPlanSkeleton({ goal: "offer", postsPerWeek: 5, platforms: ["linkedin"], hasCases: false, hasOffer: false, startDate: START });
    expect(gated.every((i) => i.contentType !== "case" && i.contentType !== "offer")).toBe(true);
  });

  it("includes offer/case content when the brand supports it", () => {
    const rich = buildPlanSkeleton({ goal: "offer", postsPerWeek: 5, platforms: ["linkedin"], hasCases: true, hasOffer: true, startDate: START });
    expect(rich.some((i) => i.contentType === "offer")).toBe(true);
  });

  it("produces varied content with a reason on every item", () => {
    const items = buildPlanSkeleton({ goal: "engagement", postsPerWeek: 5, platforms: ["linkedin"], startDate: START });
    expect(new Set(items.map((i) => i.contentType)).size).toBeGreaterThanOrEqual(3);
    expect(items.every((i) => typeof i.reason === "string" && i.reason.length > 3)).toBe(true);
  });
});
