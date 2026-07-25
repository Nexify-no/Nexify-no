import { describe, it, expect } from "vitest";
import { buildImageAltText } from "./planImagePrompt";

describe("buildImageAltText (a11y for generated images)", () => {
  it("describes the post using its first sentence", () => {
    expect(buildImageAltText("tips", "Vi leverer ballonger i hele Norge. Ring oss i dag!"))
      .toBe("Illustrasjon til innlegget: Vi leverer ballonger i hele Norge.");
  });

  it("falls back to the content type when the post has no text yet", () => {
    expect(buildImageAltText("cta", "")).toBe("Illustrasjonsbilde for innhold av typen cta");
  });

  it("collapses whitespace and caps very long text", () => {
    const alt = buildImageAltText("case", `Lang   tekst\n${"x".repeat(400)}`);
    expect(alt.startsWith("Illustrasjon til innlegget: Lang tekst")).toBe(true);
    expect(alt.length).toBeLessThan(230);
  });

  it("never returns an empty alt attribute", () => {
    expect(buildImageAltText("intro", "   ").length).toBeGreaterThan(0);
  });
});
