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
  facts?: Array<{ statement?: string | null; evidenceQuote?: string | null; sourceUrl?: string | null }> | null;
  summary?: string | null;
  offers?: string[] | null;
  differentiators?: string[] | null;
  websiteUrl?: string | null;
};

const NUMBER_RE = /\b\d{1,3}(?:[.,]\d+)?\s?%|\b\d{2,}(?:[.,]\d+)?\b/g;
const PRICE_RE = /(?:\bkr\.?\s?\d[\d\s.,]*|\b\d[\d\s.,]*\s?(?:kr|kroner|NOK)\b)/gi;
/**
 * Phrases that assert a specific customer outcome.
 *
 * PR #83 removed the bare `case` alternative: it fired on "vi bygger en solid
 * business case" and "i verste case er det gratis", so ordinary Norwegian prose
 * was graded high_risk. `kundecase` / `kundehistorie` still match.
 */
const STORY_RE = /(?:en kunde|kunden vår|en av våre kunder|kundehistorie|kundecase|kunde-case|vi hjalp en|takket være oss)/i;
const SUPERLATIVE_RE = /\b(best[e]? i (?:norge|landet|bransjen)|markedsleder|nummer 1|nr\.? 1|billigst|raskest i bransjen|garantert)\b/i;
const LINK_RE = /https?:\/\/[^\s)]+/gi;

/**
 * A fact that actually describes a customer outcome.
 *
 * No `\b` around the Norwegian verbs: JS word boundaries are ASCII-only, so
 * `\bøkte\b` can NEVER match and "kunden økte omsetningen 40 %" silently failed
 * the check. Boundaries are explicit non-letter lookarounds instead.
 */
const NO_LETTER = "a-zæøåA-ZÆØÅ";
const CUSTOMER_WORD = "(?:kunde|kunden|kunder|kundene|klient|klienten|klienter|oppdragsgiver)";
const OUTCOME_WORD = "(?:hjalp|hjulpet|leverte|levert|oppnådde|oppnådd|økte|økt|reduserte|redusert|sparte|spart|fikk|resultat|resultater|fornøyd|samarbeid|samarbeidet|prosjekt|case|anbefaler|tilbakemelding|stjerner)";
const CUSTOMER_STORY_FACT_RE = new RegExp(
  `(?<![${NO_LETTER}])${CUSTOMER_WORD}(?![${NO_LETTER}])[\\s\\S]{0,120}?(?<![${NO_LETTER}])${OUTCOME_WORD}(?![${NO_LETTER}])`
  + `|(?<![${NO_LETTER}])${OUTCOME_WORD}(?![${NO_LETTER}])[\\s\\S]{0,120}?(?<![${NO_LETTER}])${CUSTOMER_WORD}(?![${NO_LETTER}])`,
  "i",
);

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

/**
 * Does the brand have a DOCUMENTED customer story? (PR #83)
 *
 * The old check was `!/\bkunde/.test(grounded)` over ALL brand text — summary,
 * offers, differentiators — so "vi tar imot nye kunder hele året" counted, and a
 * fabricated "vi hjalp en kunde med å tredoble salget" passed verification and
 * could be approved and published.
 *
 * The rule now: a FACT — not prose — that reads like a customer outcome. Facts are
 * the curated, user-owned part of the Merkehjerne, so a story listed there is one
 * the business has asserted.
 *
 * Deliberately NOT requiring a sourceUrl. `brand.setFacts` defaults it to "" for
 * manual entries, so requiring one would reject exactly the fix the UI tells the
 * user to make — add the story as a fact — and leave the post permanently
 * unapprovable.
 */
export function hasDocumentedCustomerStory(brand: BrandFactsSource | null | undefined): boolean {
  for (const f of brand?.facts ?? []) {
    const statement = norm(f?.statement);
    if (statement && CUSTOMER_STORY_FACT_RE.test(statement)) return true;
  }
  return false;
}

/**
 * Strip Markdown that the model emits but no social platform renders (PR #83).
 *
 * LinkedIn and Facebook show `**bold**` and `## heading` as literal asterisks and
 * hashes, so leaving it meant the preview and the published post both looked like
 * broken source. Removes syntax, never words.
 */
export function stripMarkdown(input: string): string {
  if (typeof input !== "string" || !input) return "";

  // Take bare URLs out of harm's way first, then put them back untouched.
  //
  // Lookarounds are not enough to protect them: in
  // `https://x.no/wp/__cache__/bilde.png` the `__` delimiters are flanked by `/`,
  // a non-word character, so the emphasis rule matched and produced
  // `.../cache/bilde.png` — a 404 link, published, and verified as though the
  // mangled URL were the real one. Same for `/_kunder_/` and for a `*` in a query
  // string. A URL has no Markdown inside it, so masking is strictly correct.
  // Sentinel from the Unicode Private Use Area, not a control character: it
  // cannot occur in real copy, and it keeps the regexes free of \x00.
  const MARK = "\uE000";
  const urls: string[] = [];
  const masked = input.replace(/https?:\/\/[^\s)<>\]]+/gi, (u) => {
    urls.push(u);
    return `${MARK}${urls.length - 1}${MARK}`;
  });
  const restore = (t: string) =>
    t.replace(new RegExp(`${MARK}(\\d+)${MARK}`, "g"), (_m, i) => urls[Number(i)] ?? "");

  return restore(masked
    // fenced code blocks -> their contents
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    // images before links, so alt text does not survive as a stray "!"
    .replace(/!\[([^\]\n]*)\]\(([^)\n]*)\)/g, "$1")
    // [text](url) -> "text (url)" so the destination is not silently lost.
    //
    // ONE bounded class for the target, not `([^)\s]+)[^)]*`: those two unbounded
    // quantifiers backtracked against each other, and a run of "[a](" — which a
    // degenerate generation can produce — took 3 s at 3 200 chars and did not
    // finish at 20 000. This runs on model output, on the main event loop.
    .replace(/\[([^\]\n]{1,300})\]\(([^)\n]{0,500})\)/g, (_m, text, target) => {
      const url = String(target).trim().split(/\s+/)[0] ?? "";
      if (!url) return String(text);
      // Compare AFTER un-masking, so `[url](url)` still collapses to one copy.
      const label = restore(String(text).trim());
      return label === restore(url) ? url : `${text} (${url})`;
    })
    // Horizontal rules BEFORE bullets: "* * *" would otherwise lose its first
    // bullet to the list rule and leave "* *" behind.
    .replace(/^[ \t]{0,3}(?:\*[ \t]*){3,}$/gm, "")
    .replace(/^[ \t]{0,3}(?:-[ \t]*){3,}$/gm, "")
    .replace(/^[ \t]{0,3}(?:_[ \t]*){3,}$/gm, "")
    // ATX headings: "## Tittel" -> "Tittel" (a lone "#tag" is a hashtag)
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    // Emphasis. EVERY rule is flanked by non-word lookarounds, including `__`:
    // without them `https://x.no/wp/__cache__/bilde.png` became
    // `.../cache/bilde.png` — a 404 link, published, and verified as though the
    // mangled URL were the real one.
    .replace(/(?<![\w*])(\*\*\*)(?!\s)([^\n]*?[^\s*])\1(?![\w*])/g, "$2")
    .replace(/(?<![\w_])(___)(?!\s)([^\n]*?[^\s_])\1(?![\w_])/g, "$2")
    .replace(/(?<![\w*])(\*\*)(?!\s)([^\n]*?[^\s*])\1(?![\w*])/g, "$2")
    .replace(/(?<![\w_])(__)(?!\s)([^\n]*?[^\s_])\1(?![\w_])/g, "$2")
    .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, "$1")
    // Single-underscore italic, but never snake_case.
    .replace(/(?<![\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w_])/g, "$1")
    .replace(/~~(?!\s)([^\n]*?[^\s~])~~/g, "$1")
    // Leftover UNBALANCED asterisk emphasis: "halv **ferdig" would otherwise reach
    // LinkedIn with the asterisks intact. Only `*` runs of two or more — a single
    // `*` is multiplication ("3 * 5") and must survive.
    //
    // Deliberately NOT doing this for `__`: unlike `*`, a double underscore is a
    // normal part of identifiers and paths, so blanket-removing it is the very
    // corruption the lookarounds above exist to prevent. URLs are masked either
    // way, but `MY__VAR__NAME` in body text is not.
    .replace(/\*{2,}/g, "")
    // list bullets and blockquotes at line start
    .replace(/^[ \t]{0,3}[-*+][ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

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

  // A customer story must be backed by a documented fact — see
  // hasDocumentedCustomerStory for why "the word kunde appears somewhere" was not
  // good enough.
  const storyHit = content.match(STORY_RE);
  if (storyHit && !hasDocumentedCustomerStory(input.brand)) {
    issues.push({
      code: "customer_story",
      message: "Kundehistorie uten dokumentert kilde. Legg til historien som et faktum i Merkehjernen, eller fjern påstanden.",
      evidence: storyHit[0],
    });
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
