import { describe, it, expect } from "vitest";
import { verifyPostContent, isSafeToAutoApprove } from "./contentVerification";

const brand = {
  websiteUrl: "https://ballongforfest.no",
  summary: "Vi leverer ferdig oppblåste ballonger i hele Norge.",
  offers: ["Ballongbuketter", "Dekorasjon til firmafest"],
  facts: [
    { statement: "Vi leverer i hele Norge", evidenceQuote: "Vi leverer i hele Norge" },
    { statement: "Over 500 leveranser i 2025", evidenceQuote: "Over 500 leveranser i 2025" },
  ],
};

describe("verifyPostContent", () => {
  it("marks clean, grounded content as verified", () => {
    const r = verifyPostContent({ content: "Vi leverer i hele Norge — ta kontakt for ballongbuketter!", brand });
    expect(r.status).toBe("verified");
    expect(r.requiresReview).toBe(false);
    expect(isSafeToAutoApprove(r)).toBe(true);
  });

  it("flags an invented statistic as unsupported", () => {
    const r = verifyPostContent({ content: "Vi økte kundenes salg med 50% i fjor!", brand });
    expect(r.status).toBe("unsupported");
    expect(r.issues.some((i) => i.code === "unsupported_number")).toBe(true);
    expect(isSafeToAutoApprove(r)).toBe(false);
  });

  it("accepts a number that IS documented in the facts", () => {
    const r = verifyPostContent({ content: "Over 500 leveranser i 2025 — takk!", brand });
    expect(r.issues.some((i) => i.code === "unsupported_number")).toBe(false);
  });

  it("flags fabricated customer stories and unverifiable superlatives as high risk", () => {
    const story = verifyPostContent({ content: "En kunde fortalte at vi reddet bryllupet deres.", brand: { ...brand, facts: [] } });
    expect(story.status).toBe("high_risk");
    const sup = verifyPostContent({ content: "Vi er best i Norge på ballonger.", brand });
    expect(sup.status).toBe("high_risk");
  });

  it("flags unverified prices", () => {
    const r = verifyPostContent({ content: "Pakken koster kr 1 499 i august.", brand });
    expect(r.issues.some((i) => i.code === "unsupported_price")).toBe(true);
    expect(r.status).toBe("high_risk");
  });

  it("flags links that leave the brand's own site", () => {
    const own = verifyPostContent({ content: "Les mer: https://ballongforfest.no/tjenester", brand });
    expect(own.issues.some((i) => i.code === "external_link")).toBe(false);
    const foreign = verifyPostContent({ content: "Les mer: https://example.com/tilbud", brand });
    expect(foreign.issues.some((i) => i.code === "external_link")).toBe(true);
  });

  it("does not allow New Year content scheduled for August", () => {
    const r = verifyPostContent({
      content: "Godt nyttår! Vi feirer nyttår med tilbud.",
      brand,
      publishAt: new Date("2026-08-15T09:00:00Z"),
    });
    expect(r.issues.some((i) => i.code === "seasonal_mismatch")).toBe(true);
    const december = verifyPostContent({
      content: "Godt nyttår! Vi feirer nyttår med tilbud.",
      brand,
      publishAt: new Date("2026-12-30T09:00:00Z"),
    });
    expect(december.issues.some((i) => i.code === "seasonal_mismatch")).toBe(false);
  });

  it("catches a repeated message inside the same plan", () => {
    const text = "Vi leverer ferdig oppblåste ballonger til hele Norge hver dag";
    const r = verifyPostContent({ content: text, brand, siblingContents: [text] });
    expect(r.issues.some((i) => i.code === "duplicate_message")).toBe(true);
  });
});
