/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import { buildEnkelImagePrompt } from "./planImagePrompt";

const NO_TEXT = "no signs, screens, logos, labels or writing of any kind";

describe("buildEnkelImagePrompt", () => {
  it("uses the post's actual content so the image relates to the text", () => {
    const p = buildEnkelImagePrompt({ contentType: "tips", platform: "linkedin", content: "Slik holder du ballongene flytende lengre til festen" });
    expect(p).toContain("Slik holder du ballongene flytende lengre til festen");
    expect(p).toContain("visually represents the topic and mood");
    expect(p).toContain(NO_TEXT);
  });

  it("collapses whitespace and trims very long content to 240 chars of subject", () => {
    const long = "a".repeat(600);
    const p = buildEnkelImagePrompt({ contentType: "intro", platform: "instagram", content: `  ${long}  ` });
    // subject slice is 240 chars of the content
    expect(p).toContain("a".repeat(240));
    expect(p).not.toContain("a".repeat(241));
  });

  it("falls back to a per-type scene when there is no content yet", () => {
    const p = buildEnkelImagePrompt({ contentType: "case", platform: "facebook", content: null });
    expect(p).toContain("successfully completed project");
    expect(p).toContain(NO_TEXT);
  });

  it("applies platform-appropriate style", () => {
    expect(buildEnkelImagePrompt({ contentType: "tips", platform: "linkedin" })).toContain("professional business");
    expect(buildEnkelImagePrompt({ contentType: "tips", platform: "instagram" })).toContain("aesthetic, vibrant");
    expect(buildEnkelImagePrompt({ contentType: "tips", platform: "facebook" })).toContain("friendly, warm");
  });

  it("never emits raw content when empty/whitespace (uses fallback scene)", () => {
    const p = buildEnkelImagePrompt({ contentType: "faq", platform: "linkedin", content: "   " });
    expect(p).toContain("reassuring informational scene");
  });
});
