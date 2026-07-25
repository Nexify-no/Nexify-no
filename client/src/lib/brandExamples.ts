/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Example prompts for the Enkel generator, derived from the ACTIVE brand's
 * Merkehjerne (MB3) instead of hard-coded "ballongpakke" strings. Pure and
 * testable; falls back to neutral, brand-agnostic examples when the profile is
 * still empty.
 */

export type BrandExampleSource = {
  companyName?: string | null;
  offers?: unknown;
  contentIdeas?: unknown;
  contentPillars?: unknown;
  customerProblems?: unknown;
};

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(clean).filter(Boolean) : [];

const cap = (s: string, n = 90): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Up to 3 short, concrete example prompts for this brand. */
export function buildBrandExamples(brand: BrandExampleSource | null | undefined): string[] {
  const out: string[] = [];

  // 1) Generated content ideas are already phrased as post topics.
  const ideas = Array.isArray(brand?.contentIdeas) ? brand!.contentIdeas as Array<{ title?: unknown }> : [];
  for (const idea of ideas) {
    const title = clean(idea?.title);
    if (title) out.push(cap(title));
    if (out.length >= 2) break;
  }

  // 2) A concrete service/offer.
  const offer = list(brand?.offers)[0];
  if (offer) out.push(cap(`Vi vil fortelle om ${offer.toLowerCase()}`));

  // 3) A customer problem the brand solves.
  const problem = list(brand?.customerProblems)[0];
  if (problem) out.push(cap(`Tips til kunder som opplever ${problem.toLowerCase()}`));

  // 4) A content pillar.
  const pillar = list(brand?.contentPillars)[0];
  if (pillar) out.push(cap(`Et innlegg om ${pillar.toLowerCase()}`));

  const deduped = Array.from(new Set(out.filter(Boolean))).slice(0, 3);
  if (deduped.length > 0) return deduped;

  // Neutral fallback — never brand-specific guesses.
  return [
    "Fortell om en nyhet hos oss",
    "Del et tips kundene våre har nytte av",
    "En fornøyd kunde vi vil takke",
  ];
}
