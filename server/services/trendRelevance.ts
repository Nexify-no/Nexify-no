/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Scores aggregated trends against the user's Brand Brain profile.
 *
 * Why: the landing page promises "trending-emner tilpasset ditt felt" (trends
 * matched to YOUR field), but the Generate sidebar was showing the raw national
 * feed — "kryssermissil", "tordenvær", "UEFA", "concacaf". For a B2B account
 * that is not merely unhelpful, it is the moment the product visibly fails the
 * promise the customer paid for. Highest-leverage retention fix in the audit.
 *
 * Design constraints:
 *   - No LLM call. This runs on every Generate page load; a paid round-trip per
 *     load would be both slow and expensive, and the signal here is lexical.
 *   - Deterministic and testable — same input, same ranking.
 *   - Never returns an empty list. If nothing matches the brand we degrade to
 *     the generic feed rather than showing a blank panel; the caller can tell
 *     the two apart via `personalized`.
 */

import type { AggregatedTrend } from "./trendSources";

/** The slice of a brand profile that matters for relevance. */
export interface BrandContext {
  industry?: string | null;
  companyName?: string | null;
  summary?: string | null;
  offers?: string[] | null;
  audiences?: string[] | null;
  customerProblems?: string[] | null;
  differentiators?: string[] | null;
  contentPillars?: string[] | null;
  preferredWords?: string[] | null;
}

export interface ScoredTrend extends AggregatedTrend {
  /** 0..1 — how well this matches the brand context. For display/threshold use. */
  relevance: number;
  /**
   * Unclamped score, used only for ordering.
   *
   * Kept separate because clamping at 0 throws away the difference between
   * "merely unrelated" (0) and "actively wrong for a business feed" (-0.5).
   * Without it, a fallback list of pure noise sorted as a no-op and still put
   * "kryssermissil" near the top — the exact symptom this module exists to fix.
   */
  rawScore: number;
  /** Which brand term(s) caused the match. Shown as a "hvorfor" hint in the UI. */
  matchedOn: string[];
}

/**
 * Categories that are almost never usable as B2B/brand content and that
 * dominate a raw national trend feed. Matching is on whole words so
 * "vaerforhold i byggebransjen" is not killed by "vaer".
 *
 * Note: this is a DEMOTION list, not a blocklist. A hit costs score; it does not
 * remove the item, because a sports brand legitimately wants "UEFA".
 */
const LOW_VALUE_TERMS = [
  // sport
  "uefa", "fifa", "concacaf", "eliteserien", "premier league", "champions league",
  "landslaget", "vm", "ol", "fotball", "håndball", "skiskyting", "langrenn", "kamp",
  // weather / natural events
  "tordenvær", "uvær", "snøfall", "yr", "værvarsel", "storm", "flom", "ras",
  // crime / accidents / conflict
  "drap", "drept", "skutt", "ulykke", "brann", "politiet", "siktet", "tiltalt",
  "krig", "kryssermissil", "rakett", "angrep", "eksplosjon", "gisler",
  // celebrity / entertainment
  "realityserie", "farmen", "skal vi danse", "melodi grand prix", "kjendis",
  "skilsmisse", "forlovet", "gravid", "død", "begravelse",
  // lottery / gambling
  "lotto", "vikinglotto", "eurojackpot", "tipping",
];

/**
 * Terms that make a trend inherently usable for business content regardless of
 * industry — the "any professional could post about this" set.
 */
const BUSINESS_TERMS = [
  "ai", "kunstig intelligens", "teknologi", "digitalisering", "automatisering",
  "bedrift", "bedrifter", "næringsliv", "arbeidsliv", "ledelse", "rekruttering",
  "marked", "markedsføring", "salg", "kunde", "kunder", "vekst", "økonomi",
  "budsjett", "rente", "skatt", "mva", "regnskap", "investering", "oppstart",
  "gründer", "startup", "bærekraft", "klima", "innovasjon", "produktivitet",
  "hjemmekontor", "remote", "kompetanse", "utdanning", "regelverk", "lovendring",
];

/** Split into comparable lowercase word tokens, dropping Norwegian stopwords. */
const STOPWORDS = new Set([
  "og", "i", "på", "for", "med", "til", "av", "en", "et", "den", "det", "de",
  "som", "er", "har", "kan", "vi", "du", "din", "ditt", "dine", "vår", "våre",
  "the", "and", "for", "with", "you", "your", "our", "a", "an", "of", "to", "in",
]);

function tokenize(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** True when `term` appears in `haystack` as a whole word / phrase. */
function containsTerm(haystack: string, term: string): boolean {
  if (!term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(haystack);
}

/**
 * Flatten the brand profile into a weighted vocabulary.
 * Industry and content pillars are what the user actually publishes about, so
 * they weigh more than a passing mention in the free-text summary.
 */
export function buildBrandVocabulary(brand: BrandContext): Map<string, number> {
  const vocab = new Map<string, number>();
  const add = (value: unknown, weight: number) => {
    for (const token of tokenize(String(value ?? ""))) {
      vocab.set(token, Math.max(vocab.get(token) ?? 0, weight));
    }
  };

  add(brand.industry, 1.0);
  for (const p of brand.contentPillars ?? []) add(p, 1.0);
  for (const o of brand.offers ?? []) add(o, 0.8);
  for (const a of brand.audiences ?? []) add(a, 0.8);
  for (const c of brand.customerProblems ?? []) add(c, 0.7);
  for (const d of brand.differentiators ?? []) add(d, 0.6);
  for (const w of brand.preferredWords ?? []) add(w, 0.6);
  add(brand.summary, 0.4);

  // The company's own name is a poor topic signal — a trend matching it is
  // usually coincidence, and self-referential topics make weak posts.
  for (const token of tokenize(String(brand.companyName ?? ""))) vocab.delete(token);

  return vocab;
}

/** True when the brand profile carries enough signal to personalise at all. */
export function hasUsableBrandContext(brand: BrandContext | null | undefined): boolean {
  if (!brand) return false;
  return buildBrandVocabulary(brand).size >= 3;
}

/**
 * Score one trend in 0..1.
 *   + direct overlap with the brand vocabulary (dominant term)
 *   + a smaller bonus for generic business relevance
 *   − a penalty for the low-value national-news categories
 */
export function scoreTrend(trend: AggregatedTrend, vocab: Map<string, number>): ScoredTrend {
  const haystack = `${trend.keyword} ${trend.category ?? ""}`.toLowerCase();
  const matchedOn: string[] = [];

  let brandScore = 0;
  for (const [term, weight] of vocab) {
    if (containsTerm(haystack, term)) {
      brandScore = Math.max(brandScore, weight);
      if (!matchedOn.includes(term)) matchedOn.push(term);
    }
  }

  const businessHit = BUSINESS_TERMS.some((t) => containsTerm(haystack, t));
  const lowValueHit = LOW_VALUE_TERMS.some((t) => containsTerm(haystack, t));

  let score = brandScore;
  if (businessHit) score += 0.35;
  if (lowValueHit) score -= 0.5;

  return {
    ...trend,
    relevance: Math.max(0, Math.min(1, score)),
    rawScore: score,
    matchedOn: matchedOn.slice(0, 3),
  };
}

export interface RankTrendsResult {
  trends: ScoredTrend[];
  /** False when we fell back to the generic feed (no brand signal / no matches). */
  personalized: boolean;
  /** How many items were dropped for being irrelevant. Surfaced for transparency. */
  filteredOut: number;
}

/**
 * Rank trends for a brand.
 *
 * `minRelevance` is intentionally low (0.3): one solid brand-term or
 * business-term hit clears it, while pure noise ("tordenvær", "concacaf") does
 * not. We keep at least `minResults` items so the panel is never empty —
 * showing nothing is a worse experience than showing the generic feed, as long
 * as we are honest about which one the user is looking at.
 */
export function rankTrendsForBrand(
  trends: AggregatedTrend[],
  brand: BrandContext | null | undefined,
  opts: { limit?: number; minRelevance?: number; minResults?: number } = {}
): RankTrendsResult {
  const limit = opts.limit ?? 8;
  const minRelevance = opts.minRelevance ?? 0.3;
  const minResults = opts.minResults ?? 4;

  if (!hasUsableBrandContext(brand)) {
    // No Merkehjerne: we cannot personalise, so present the feed as-is rather
    // than inventing an ordering we cannot justify.
    return {
      trends: trends
        .slice(0, limit)
        .map((t) => ({ ...t, relevance: 0, rawScore: 0, matchedOn: [] })),
      personalized: false,
      filteredOut: 0,
    };
  }

  const vocab = buildBrandVocabulary(brand as BrandContext);
  const scored = trends
    .map((t) => scoreTrend(t, vocab))
    // Stable sort on the UNCLAMPED score, then original order (recency).
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.rawScore - a.t.rawScore || a.i - b.i)
    .map(({ t }) => t);

  const relevant = scored.filter((t) => t.relevance >= minRelevance);

  if (relevant.length === 0) {
    // Nothing cleared the bar today. We still show something — an empty panel
    // is worse — but the demoted items (sport, weather, crime) now sink to the
    // bottom instead of leading the list, and `personalized: false` tells the
    // UI to label this honestly as a generic feed.
    return {
      trends: scored.slice(0, limit),
      personalized: false,
      filteredOut: 0,
    };
  }

  // Top up with the next-best items so the panel keeps a usable length, but
  // never re-introduce something we actively demoted to zero.
  const result = [...relevant];
  if (result.length < minResults) {
    for (const t of scored) {
      if (result.length >= minResults) break;
      if (!result.includes(t) && t.relevance > 0) result.push(t);
    }
  }

  return {
    trends: result.slice(0, limit),
    personalized: true,
    filteredOut: Math.max(0, trends.length - relevant.length),
  };
}
