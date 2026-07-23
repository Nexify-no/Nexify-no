import { describe, it, expect } from "vitest";
import { renderBrandVoiceBlock, renderBrandImageCue, buildOnboardingBrandSeed, type BrandHints } from "./brandContext";

const base: BrandHints = {
  companyName: "Ballong for Fest",
  industry: "party supplies",
  summary: null,
  audiences: ["barnefamilier", "eventbyråer"],
  tonePersonality: ["leken", "varm"],
  writingStyle: "korte, energiske setninger",
  preferredWords: ["feiring", "magi"],
  avoidWords: ["billig"],
  callsToAction: ["Bestill i dag"],
  facts: [{ statement: "Levering i hele Norge", sourceUrl: "https://x.no" }],
  brandColors: ["#FF0055", "#00AA88"],
};

describe("renderBrandVoiceBlock", () => {
  it("includes brand voice fields", () => {
    const b = renderBrandVoiceBlock(base);
    expect(b).toContain("Ballong for Fest");
    expect(b).toContain("Tone: leken, varm");
    expect(b).toContain("Unngå disse ordene: billig");
    expect(b).toContain("Levering i hele Norge");
  });
  it("returns empty string for null / empty", () => {
    expect(renderBrandVoiceBlock(null)).toBe("");
    expect(renderBrandVoiceBlock({ ...base, companyName: null, audiences: [], tonePersonality: [], writingStyle: null, preferredWords: [], avoidWords: [], callsToAction: [], facts: [] })).toBe("");
  });
  it("caps facts to 5 and never invents", () => {
    const many = { ...base, facts: Array.from({ length: 20 }, (_, i) => ({ statement: `fakta ${i}`, sourceUrl: "https://x.no" })) };
    const b = renderBrandVoiceBlock(many);
    expect((b.match(/•/g) ?? []).length).toBe(5);
  });
});

describe("renderBrandImageCue", () => {
  it("emits only industry mood + valid hex colours, no text/logos", () => {
    const c = renderBrandImageCue(base);
    expect(c).toContain("party supplies");
    expect(c).toContain("#FF0055");
    expect(c.toLowerCase()).not.toContain("logo");
    expect(c).not.toContain("Ballong"); // company name must never leak into an image scene
  });
  it("drops invalid colours and empty input", () => {
    expect(renderBrandImageCue({ industry: null, brandColors: ["red", "#ZZZ", "#123456"] })).toBe("with a colour palette inspired by #123456");
    expect(renderBrandImageCue(null)).toBe("");
  });
});

describe("buildOnboardingBrandSeed", () => {
  it("maps onboarding fields into a ready starter profile", () => {
    const seed = buildOnboardingBrandSeed({
      websiteUrl: "https://ballongforfest.no",
      companyName: "Ballong for Fest",
      industry: "party supplies",
      audience: "barnefamilier og eventbyråer",
      toneLabel: "leken og varm",
      topics: ["ballonger", "bursdager", "firmafest"],
    });
    expect(seed.status).toBe("ready");
    expect(seed.companyName).toBe("Ballong for Fest");
    expect(seed.audiences).toEqual(["barnefamilier og eventbyråer"]);
    expect(seed.tonePersonality).toEqual(["leken og varm"]);
    expect(seed.contentPillars).toEqual(["ballonger", "bursdager", "firmafest"]);
    expect(seed.facts).toEqual([]);
  });
  it("handles missing/empty fields (nulls + empty arrays, capped pillars)", () => {
    const seed = buildOnboardingBrandSeed({
      websiteUrl: "https://x.no",
      companyName: "  ",
      industry: null,
      audience: "",
      toneLabel: undefined,
      topics: Array.from({ length: 20 }, (_, i) => `t${i}`),
    });
    expect(seed.companyName).toBeNull();
    expect(seed.industry).toBeNull();
    expect(seed.audiences).toEqual([]);
    expect(seed.tonePersonality).toEqual([]);
    expect(seed.contentPillars.length).toBe(12);
  });
});

