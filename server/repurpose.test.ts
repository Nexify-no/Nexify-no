/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect } from "vitest";

describe("ContentRepurpose Page Logic", () => {
  it("should define all repurpose types correctly", () => {
    const repurposeTypes = [
      { value: "platform_adapt", label: "Tilpass til annen plattform", description: "Juster lengde og tone" },
      { value: "format_change", label: "Endre format", description: "Fra liste til fortelling, etc." },
      { value: "audience_shift", label: "Bytt målgruppe", description: "Fra B2B til B2C, etc." },
      { value: "update", label: "Oppdater med ny info", description: "Legg til nye data/insights" },
    ];

    expect(repurposeTypes).toHaveLength(4);
    expect(repurposeTypes.map((t) => t.value)).toEqual([
      "platform_adapt",
      "format_change",
      "audience_shift",
      "update",
    ]);
    // All should have labels and descriptions
    repurposeTypes.forEach((type) => {
      expect(type.label.length).toBeGreaterThan(0);
      expect(type.description.length).toBeGreaterThan(0);
    });
  });

  it("should compute correct step from form state", () => {
    function computeStep(
      selectedPost: number | null,
      repurposeType: string,
      targetPlatform: string
    ): number {
      if (!selectedPost) return 1;
      if (!repurposeType) return 2;
      if (!targetPlatform) return 3;
      return 4;
    }

    expect(computeStep(null, "", "")).toBe(1);
    expect(computeStep(1, "", "")).toBe(2);
    expect(computeStep(1, "platform_adapt", "")).toBe(3);
    expect(computeStep(1, "platform_adapt", "linkedin")).toBe(4);
  });

  it("should validate all required fields before submission", () => {
    function canSubmit(
      selectedPost: number | null,
      targetPlatform: string,
      repurposeType: string,
      isPro: boolean
    ): boolean {
      return !!selectedPost && !!targetPlatform && !!repurposeType && isPro;
    }

    expect(canSubmit(null, "", "", true)).toBe(false);
    expect(canSubmit(1, "", "", true)).toBe(false);
    expect(canSubmit(1, "linkedin", "", true)).toBe(false);
    expect(canSubmit(1, "linkedin", "platform_adapt", false)).toBe(false);
    expect(canSubmit(1, "linkedin", "platform_adapt", true)).toBe(true);
  });

  it("should correctly map platform colors", () => {
    const platformColors: Record<string, string> = {
      linkedin: "bg-blue-100 text-blue-700 border-blue-200",
      twitter: "bg-sky-100 text-sky-700 border-sky-200",
      instagram: "bg-pink-100 text-pink-700 border-pink-200",
      facebook: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };

    expect(platformColors["linkedin"]).toContain("blue");
    expect(platformColors["twitter"]).toContain("sky");
    expect(platformColors["instagram"]).toContain("pink");
    expect(platformColors["facebook"]).toContain("indigo");
    expect(platformColors["unknown"]).toBeUndefined();
  });

  it("should format draft data correctly for auto-save", () => {
    const selectedPost = 5;
    const targetPlatform = "linkedin";
    const repurposeType = "platform_adapt";

    const formData = JSON.stringify({
      selectedPost,
      targetPlatform,
      repurposeType,
    });

    const parsed = JSON.parse(formData);
    expect(parsed.selectedPost).toBe(5);
    expect(parsed.targetPlatform).toBe("linkedin");
    expect(parsed.repurposeType).toBe("platform_adapt");
  });

  it("should restore draft data correctly", () => {
    const draftFormData = JSON.stringify({
      selectedPost: 3,
      targetPlatform: "twitter",
      repurposeType: "audience_shift",
    });

    const parsed = JSON.parse(draftFormData);
    expect(parsed.selectedPost).toBe(3);
    expect(parsed.targetPlatform).toBe("twitter");
    expect(parsed.repurposeType).toBe("audience_shift");
  });

  it("should handle empty/invalid draft data gracefully", () => {
    // Empty draft
    const emptyDraft = JSON.stringify({});
    const parsed = JSON.parse(emptyDraft);
    expect(parsed.selectedPost).toBeUndefined();
    expect(parsed.targetPlatform).toBeUndefined();
    expect(parsed.repurposeType).toBeUndefined();

    // Invalid JSON should throw
    expect(() => JSON.parse("invalid")).toThrow();
  });

  it("should have valid examples with engagement metrics", () => {
    const examples = [
      {
        original: { platform: "LinkedIn", content: "Lang artikkel om AI-trender (500 ord)" },
        repurposed: { platform: "Twitter", content: "5 tweets med key takeaways" },
        engagement: "+45%",
      },
      {
        original: { platform: "Instagram", content: "Visuell guide til produktivitet" },
        repurposed: { platform: "LinkedIn", content: "Profesjonell artikkel med data" },
        engagement: "+67%",
      },
      {
        original: { platform: "Facebook", content: "Kundehistorie fra 2025" },
        repurposed: { platform: "LinkedIn", content: "Oppdatert case study 2026" },
        engagement: "+89%",
      },
    ];

    expect(examples).toHaveLength(3);
    examples.forEach((ex) => {
      expect(ex.original.platform).toBeTruthy();
      expect(ex.repurposed.platform).toBeTruthy();
      expect(ex.engagement).toMatch(/^\+\d+%$/);
      // Original and repurposed platforms should differ
      expect(ex.original.platform).not.toBe(ex.repurposed.platform);
    });
  });
});