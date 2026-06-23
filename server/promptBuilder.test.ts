/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect } from "vitest";
import { buildContentPrompt } from "./promptBuilder";

describe("buildContentPrompt", () => {
  it("makes Norwegian the highest-priority output language and re-asserts it as a hard rule", () => {
    const { system, user } = buildContentPrompt({
      topic: "Vi lanserer et nytt produkt",
      platform: "linkedin",
      language: "no",
    });
    expect(system).toContain("Output language");
    expect(system).toContain("Norwegian (Bokmål)");
    // Hard rule re-asserted in the Rules section + anchored on the user turn.
    expect(system).toMatch(/Write the ENTIRE post in Norwegian \(Bokmål\)/);
    expect(user).toContain("Norwegian (Bokmål)");
  });

  it("honours formatting options (hashtag count, no closing question)", () => {
    const { system } = buildContentPrompt({
      topic: "x",
      platform: "twitter",
      hashtagCount: 0,
      closingQuestion: false,
    });
    expect(system).toContain("Do not include any hashtags.");
    expect(system).toContain("Do not end with a question");
  });

  it("clamps an out-of-range hashtag count", () => {
    const { system } = buildContentPrompt({ topic: "x", platform: "linkedin", hashtagCount: 999 });
    expect(system).toContain("exactly 30 relevant");
  });

  it("includes a personal-voice section only when a voice profile is supplied", () => {
    const without = buildContentPrompt({ topic: "x", platform: "linkedin" }).system;
    expect(without).not.toContain("Personal voice");

    const withVoice = buildContentPrompt({
      topic: "x",
      platform: "linkedin",
      voiceProfile: { profileSummary: "Direct, witty, short sentences." },
    }).system;
    expect(withVoice).toContain("Personal voice");
    expect(withVoice).toContain("Direct, witty, short sentences.");
  });

  it("defaults to Norwegian when no language is given", () => {
    const { system } = buildContentPrompt({ topic: "x", platform: "facebook" });
    expect(system).toContain("Norwegian (Bokmål)");
  });
});