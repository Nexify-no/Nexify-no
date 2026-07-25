/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Content verification (MB4).
 *
 * Pure, dependency-free checks that grade a generated post BEFORE it can be
 * approved or published. Anything a reader would take as a hard claim — numbers,
 * percentages, prices, customer stories, awards, links — must be traceable to the
 * brand's Merkehjerne facts/profile. Seasonal content is checked against the
 * PROPOSED publish date (no New Year post in August), and repetition is checked
 * across a plan so 12 posts don't repeat one message.
 */

export type VerificationStatus = "verified" | "needs_review" | "unsupported" | "high_risk";

export type VerificationIssue = {
  code:
    | "unsupported_number"
    | "unsupported_price"
    | "customer_story"
    | "superlative_claim"
    | "external_link"
    | "seasonal_mismatch"
    | "duplicate_message";
  message: string;
  evidence?: string;
};

export type VerificationResult = {
  status: VerificationStatus;
  issues: VerificationIssue[];
  /** True when a human must look before this may go out. */
  requiresReview: boolean;
};

export type BrandFactsSource = {
  facts?: Array<{ statement?: string | null; evidenceQuote?: string | null }> | null;
  summary?: string | null;
  offers?: string[] | null;
  differentiators?: string[] | null;
  websiteUrl?: string | null;
};

const NUMBER_RE = /\b\d{1,3}(?:[.,]\d+)?\s?%|\b\d{2,}(?:[.,]\d+)?\b/g;
const PRICE_RE = /(?:\bkr\.?\s?\d[\d\s.,]*|\b\d[\d\s.,]*\s?(?:kr|kroner|NOK)\b)/gi;
const STORY_RE = /\b(en kunde|kunden vår|en av våre kunder|kundehistorie|case|vi hjalp|takket være oss)\b/i;
const SUPERLATIVE_RE = /\b(best[e]? i (?:norge|landet|bransjen)|markedsleder|nummer 1|nr\.? 1|billigst|raskest i bransjen|garantert)\b/i;
const LINK_RE = /https?:\/\/[^\s)]+/gi;

const MONTH_SEASONS: Record<number, RegExp> = {
  // month (1-12) -> phrases that do NOT belong in that month
  1: /\b(sommerferie|sankthans|17\.? mai)\b/i,
  2: /\b(jul|nyttår|sommerferie)\b/i,
  3: /\b(jul|nyttår)\b/i,
  4: /\b(jul|nyttår)\b/i,
  5: /\b(jul|nyttår)\b/i,
  6: /\b(jul|nyttår)\b/i,
  7: /\b(jul|nyttår|black friday)\b/i,
  8: /\b(jul|nyttår|black friday|påske)\b/i,
  9: /\b(jul|nyttår|påske|sommerferie)\b/i,
  10: /\b(nyttår|påske)\b/i,
  11: /\b(påske|17\.? mai)\b/i,
  12: /\b(påske|17\.? mai|sommerferie)\b/i,
};

const norm = (v: unknown): string => (typeof v === "string" ? v.toLowerCase() : "");

/** All brand text a claim may be grounded in. */
function haystack(brand: BrandFactsSource | null | undefined): string {
  if (!brand) return "";
  const parts: string[] = [];
  for (const f of brand.facts ?? []) {
    parts.push(norm(f?.statement), norm(f?.evidenceQuote));
  }
  parts.push(norm(brand.summary));
  for (const o of brand.offers ?? []) parts.push(norm(o));
  for (const d of brand.differentiators ?? []) parts.push(norm(d));
  return parts.filter(Boolean).join(" \n ");
}

/** Verify one post. `publishAt` enables the seasonal check. */
export function verifyPostContent(input: {
  content: string;
  brand?: BrandFactsSource | null;
  publishAt?: Date | null;
  /** Other posts in the same plan, to catch a repeated message. */
  siblingContents?: string[];
}): VerificationResult {
  const content = input.content ?? "";
  const lower = content.toLowerCase();
  const grounded = haystack(input.brand);
  const issues: VerificationIssue[] = [];

  // Numbers / percentages that appear nowhere in the brand's documented facts.
  for (const raw of content.match(NUMBER_RE) ?? []) {
    const token = raw.trim().toLowerCase();
    if (!grounded.includes(token.replace(/\s/g, ""))
      && !grounded.includes(token)) {
      issues.push({ code: "unsupported_number", message: "Tallet finnes ikke i Merkehjernen.", evidence: raw.trim() });
    }
  }
  for (const raw of content.match(PRICE_RE) ?? []) {
    const token = raw.trim().toLowerCase();
    if (!grounded.includes(token)) {
      issues.push({ code: "unsupported_price", message: "Prisen er ikke dokumentert i Merkehjernen.", evidence: raw.trim() });
    }
  }

  // Customer stories must be backed by a documented fact.
  if (STORY_RE.test(content) && !/\bkunde/.test(grounded)) {
    issues.push({ code: "customer_story", message: "Kundehistorie uten dokumentert kilde." });
  }

  // Unverifiable superlatives ("best i Norge", "garantert").
  const sup = content.match(SUPERLATIVE_RE);
  if (sup && !grounded.includes(norm(sup[0]))) {
    issues.push({ code: "superlative_claim", message: "Påstand som ikke kan dokumenteres.", evidence: sup[0] });
  }

  // Links must point at the brand's own site.
  const brandHost = (() => {
    try { return input.brand?.websiteUrl ? new URL(input.brand.websiteUrl).hostname.replace(/^www\./, "") : ""; }
    catch { return ""; }
  })();
  for (const url of content.match(LINK_RE) ?? []) {
    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { host = ""; }
    if (!host || !brandHost || host !== brandHost) {
      issues.push({ code: "external_link", message: "Lenken peker ikke til bedriftens eget nettsted.", evidence: url });
    }
  }

  // Seasonal sanity against the PROPOSED publish date.
  if (input.publishAt instanceof Date && !Number.isNaN(input.publishAt.getTime())) {
    const month = input.publishAt.getMonth() + 1;
    const wrong = MONTH_SEASONS[month];
    const hit = wrong ? content.match(wrong) : null;
    if (hit) {
      issues.push({
        code: "seasonal_mismatch",
        message: `Sesonginnhold passer ikke til publiseringsdatoen (måned ${month}).`,
        evidence: hit[0],
      });
    }
  }

  // Repetition across a plan: same opening message as a sibling post.
  const fingerprint = (t: string) => t.toLowerCase().replace(/[^a-zæøå0-9 ]/gi, " ").split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  const mine = fingerprint(content);
  if (mine && (input.siblingContents ?? []).some((sib) => fingerprint(sib) === mine)) {
    issues.push({ code: "duplicate_message", message: "Nesten identisk med et annet innlegg i planen." });
  }

  const hasHighRisk = issues.some((i) =>
    i.code === "unsupported_price" || i.code === "customer_story" || i.code === "superlative_claim");
  const hasUnsupported = issues.some((i) => i.code === "unsupported_number" || i.code === "external_link");

  const status: VerificationStatus = hasHighRisk
    ? "high_risk"
    : hasUnsupported
      ? "unsupported"
      : issues.length > 0
        ? "needs_review"
        : "verified";

  void lower;
  return { status, issues, requiresReview: status !== "verified" };
}

/** Only fully verified posts may be auto-approved in bulk. */
export function isSafeToAutoApprove(result: VerificationResult): boolean {
  return result.status === "verified";
}
