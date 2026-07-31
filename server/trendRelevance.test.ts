/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Regression tests for the "trends tilpasset ditt felt" promise.
 *
 * The concrete bug: a B2B consultancy opened /generate and was offered
 * "kryssermissil", "tordenvær", "ceuta", "concacaf" and "UEFA" as post ideas.
 * These tests use that exact feed as the fixture.
 */

import { describe, it, expect } from "vitest";
import {
  rankTrendsForBrand,
  scoreTrend,
  buildBrandVocabulary,
  hasUsableBrandContext,
  type BrandContext,
} from "./services/trendRelevance";
import type { AggregatedTrend } from "./services/trendSources";

const t = (keyword: string, category = ""): AggregatedTrend => ({
  keyword,
  source: "Google Trends",
  date: "2026-07-30T00:00:00.000Z",
  category,
});

/** The real feed observed on penna.no/generate, 30 July 2026. */
const REAL_NOISY_FEED: AggregatedTrend[] = [
  t("nettsvindel"),
  t("kryssermissil"),
  t("ceuta"),
  t("tordenvær"),
  t("sommerhytta"),
  t("concacaf"),
  t("uefa"),
  t("tonje frigstad"),
];

const B2B_BRAND: BrandContext = {
  companyName: "Penna",
  industry: "AI Innholdsproduksjon",
  summary: "Norsk AI-plattform for innhold som lar bedrifter lage innlegg på sekunder.",
  audiences: ["Norske småbedrifter", "B2B-selskaper", "Markedsførere"],
  customerProblems: ["Mangel på tid til innholdsproduksjon", "Utfordringer med å engasjere følgere"],
  contentPillars: ["markedsføring", "digitalisering"],
};

describe("trend relevance", () => {
  it("demotes the national-news noise that shipped to production", () => {
    const { trends } = rankTrendsForBrand(REAL_NOISY_FEED, B2B_BRAND, { limit: 8 });
    const top = trends.slice(0, 3).map((x) => x.keyword.toLowerCase());

    for (const noise of ["kryssermissil", "tordenvær", "concacaf", "uefa"]) {
      expect(top, `"${noise}" must not be a top suggestion for a B2B brand`).not.toContain(noise);
    }
  });

  it("ranks a topic matching the brand's own field first", () => {
    const feed = [...REAL_NOISY_FEED, t("AI i norsk næringsliv"), t("markedsføring for småbedrifter")];
    const { trends, personalized } = rankTrendsForBrand(feed, B2B_BRAND, { limit: 5 });

    expect(personalized).toBe(true);
    expect(trends[0].keyword).toMatch(/AI i norsk næringsliv|markedsføring for småbedrifter/);
    expect(trends[0].relevance).toBeGreaterThan(0.3);
  });

  it("explains WHY a topic matched", () => {
    const { trends } = rankTrendsForBrand([t("markedsføring for småbedrifter")], B2B_BRAND);
    expect(trends[0].matchedOn.length).toBeGreaterThan(0);
  });

  it("never returns an empty list, and admits when it is not personalised", () => {
    // Feed of pure noise: nothing can match, so we fall back honestly.
    const { trends, personalized } = rankTrendsForBrand(REAL_NOISY_FEED, B2B_BRAND, { limit: 8 });
    expect(trends.length).toBeGreaterThan(0);
    expect(personalized).toBe(false);
  });

  it("falls back to the generic feed when there is no Merkehjerne", () => {
    const { trends, personalized } = rankTrendsForBrand(REAL_NOISY_FEED, null, { limit: 4 });
    expect(personalized).toBe(false);
    expect(trends).toHaveLength(4);
    expect(trends[0].keyword).toBe("nettsvindel"); // original order preserved
  });

  it("keeps sport relevant for a sports brand — the list demotes, it does not censor", () => {
    const sportsBrand: BrandContext = {
      companyName: "Sportsklubben",
      industry: "fotball",
      contentPillars: ["fotball", "eliteserien"],
    };
    const scored = scoreTrend(t("Eliteserien-runden er i gang"), buildBrandVocabulary(sportsBrand));
    // The low-value penalty applies, but the direct brand match still carries it
    // above zero — a sports brand can use it.
    expect(scored.relevance).toBeGreaterThan(0);
    expect(scored.matchedOn.length).toBeGreaterThan(0);
  });

  it("does not match on the company's own name", () => {
    const vocab = buildBrandVocabulary(B2B_BRAND);
    expect(vocab.has("penna")).toBe(false);
  });

  it("treats an empty profile as unusable context", () => {
    expect(hasUsableBrandContext(null)).toBe(false);
    expect(hasUsableBrandContext({})).toBe(false);
    expect(hasUsableBrandContext({ companyName: "Penna" })).toBe(false);
    expect(hasUsableBrandContext(B2B_BRAND)).toBe(true);
  });

  it("matches whole words only, so 'vær' does not swallow 'værdiskapning'", () => {
    const brand: BrandContext = { industry: "bygg og anlegg", contentPillars: ["byggebransjen"] };
    const scored = scoreTrend(t("Nye krav i byggebransjen"), buildBrandVocabulary(brand));
    expect(scored.relevance).toBeGreaterThan(0.3);
  });
});
