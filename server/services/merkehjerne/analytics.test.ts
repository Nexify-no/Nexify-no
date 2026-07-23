import { describe, it, expect } from "vitest";
import { buildEventPayload } from "./analytics";

describe("merkehjerne analytics", () => {
  it("keeps only allowlisted primitive fields", () => {
    const p = buildEventPayload("brand_analysis_completed", {
      userId: 7,
      durationMs: 1234,
      factsCount: 5,
      warningsCount: 1,
      hadExisting: true,
    });
    expect(p).toEqual({
      evt: "brand_analysis_completed",
      userId: 7,
      durationMs: 1234,
      factsCount: 5,
      warningsCount: 1,
      hadExisting: true,
    });
  });

  it("drops URLs, page text, corpus and any non-allowlisted key", () => {
    const p = buildEventPayload("brand_analysis_started", {
      userId: 1,
      url: "https://example.com/secret",
      websiteUrl: "https://example.com",
      html: "<script>bad</script>",
      corpus: "lots of scraped text",
      statement: "a grounded fact",
      evidenceQuote: "verbatim source quote",
      apiKey: "sk-should-never-appear",
    });
    expect(p).toEqual({ evt: "brand_analysis_started", userId: 1 });
    const serialized = JSON.stringify(p);
    for (const leak of ["example.com", "script", "corpus", "sk-", "evidenceQuote", "statement"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("caps string fields and ignores non-finite numbers", () => {
    const p = buildEventPayload("brand_analysis_failed", {
      userId: Number.NaN,
      errorCode: "x".repeat(200),
      trigger: "facts",
    });
    expect(p.userId).toBeUndefined();
    expect((p.errorCode as string).length).toBe(60);
    expect(p.trigger).toBe("facts");
  });
});
