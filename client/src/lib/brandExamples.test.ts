import { describe, it, expect } from "vitest";
import { buildBrandExamples } from "./brandExamples";

describe("buildBrandExamples", () => {
  it("uses the active brand's own ideas and offers", () => {
    const ex = buildBrandExamples({
      companyName: "Nexify CRM Systems AS",
      contentIdeas: [{ title: "Slik automatiserer du oppfølging" }],
      offers: ["CRM-oppsett for småbedrifter"],
      customerProblems: ["rot i kundeoppfølgingen"],
    });
    expect(ex[0]).toBe("Slik automatiserer du oppfølging");
    expect(ex.join(" ")).toContain("crm-oppsett");
    expect(ex.join(" ").toLowerCase()).not.toContain("ballong");
    expect(ex.length).toBeLessThanOrEqual(3);
  });

  it("falls back to neutral examples for an empty profile", () => {
    const ex = buildBrandExamples(null);
    expect(ex).toHaveLength(3);
    expect(ex.join(" ").toLowerCase()).not.toContain("ballong");
  });

  it("caps long titles and de-duplicates", () => {
    const long = "x".repeat(200);
    const ex = buildBrandExamples({ contentIdeas: [{ title: long }, { title: long }], offers: [] });
    expect(ex[0].length).toBeLessThanOrEqual(90);
    expect(new Set(ex).size).toBe(ex.length);
  });
});
