/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Shared Merkehjerne reuse layer (M4).
 *
 * One place that turns a user's stored brand profile into compact, safe context
 * for EVERY AI tool (content, repurpose, coach, images). The source is the
 * already-sanitized, evidence-grounded profile in `brand_profiles` — never raw
 * site text — so injecting it into prompts carries no new injection risk. Render
 * functions are pure (unit-testable) and length-capped.
 */

import type { BrandFact } from "../../../drizzle/schema";

export type BrandHints = {
  companyName: string | null;
  industry: string | null;
  summary: string | null;
  audiences: string[] | null;
  tonePersonality: string[] | null;
  writingStyle: string | null;
  preferredWords: string[] | null;
  avoidWords: string[] | null;
  callsToAction: string[] | null;
  facts: BrandFact[] | null;
  brandColors: string[] | null;
};

/**
 * Load the ACTIVE brand's READY Merkehjerne as compact hints, or null.
 *
 * PR #79 — this function is where the leak was loudest: it fed every AI tool
 * (content, repurpose, coach, images) and matched on `user_id` alone, so
 * whichever profile row came back first became the voice, facts and colours for
 * ALL of the account's brands. It now matches (user_id, brand_id) exactly. An
 * unowned profile is not used as a fallback — no hints is the correct answer,
 * and the caller degrades to generic output rather than another brand's words.
 */
export async function loadBrandHints(userId: number): Promise<BrandHints | null> {
  const { getDb } = await import("../../db");
  const db = await getDb();
  if (!db) return null;
  const { brandProfiles } = await import("../../../drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  const { activeBrandId, ownedBy } = await import("../brandScope");
  const brandId = await activeBrandId(userId);
  const [bp] = await db
    .select()
    .from(brandProfiles)
    .where(and(
      ownedBy(brandProfiles.userId, brandProfiles.brandId, userId, brandId),
      eq(brandProfiles.status, "ready"),
    ))
    // PR #80: oldest first, deliberately. When brandId is null — multi-brand off,
    // or getActiveBrandIdIfEnabled swallowed a transient DB error — ownedBy
    // degrades to user_id alone, and an account can now hold a draft brand's
    // unreviewed profile. That row is always the newest, so an unordered LIMIT 1
    // could hand the draft's tone, facts and colours to every AI tool as the
    // brand voice.
    .orderBy(brandProfiles.id)
    .limit(1);
  if (!bp) return null;
  return {
    companyName: bp.companyName,
    industry: bp.industry,
    summary: bp.summary,
    audiences: bp.audiences,
    tonePersonality: bp.tonePersonality,
    writingStyle: bp.writingStyle,
    preferredWords: bp.preferredWords,
    avoidWords: bp.avoidWords,
    callsToAction: bp.callsToAction,
    facts: bp.facts,
    brandColors: bp.brandColors,
  };
}

const joinList = (arr: readonly string[] | null | undefined, n: number): string =>
  (arr ?? [])
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, n)
    .map((x) => x.trim())
    .join(", ");

/**
 * A concise Norwegian brand-voice block for a system prompt. Pure. Returns "" when
 * there is nothing useful, so callers can append conditionally.
 */
export function renderBrandVoiceBlock(hints: BrandHints | null): string {
  if (!hints) return "";
  const lines: string[] = [];
  if (hints.companyName) {
    lines.push(
      `Bedrift: ${hints.companyName.slice(0, 120)}${hints.industry ? ` (${hints.industry.slice(0, 80)})` : ""}`,
    );
  }
  const aud = joinList(hints.audiences, 4);
  if (aud) lines.push(`Målgrupper: ${aud}`);
  const tone = joinList(hints.tonePersonality, 6);
  if (tone) lines.push(`Tone: ${tone}`);
  if (hints.writingStyle) lines.push(`Skrivestil: ${hints.writingStyle.slice(0, 300)}`);
  const pref = joinList(hints.preferredWords, 12);
  if (pref) lines.push(`Foretrukne ord: ${pref}`);
  const avoid = joinList(hints.avoidWords, 12);
  if (avoid) lines.push(`Unngå disse ordene: ${avoid}`);
  const cta = joinList(hints.callsToAction, 4);
  if (cta) lines.push(`Vanlige oppfordringer: ${cta}`);
  const facts = (hints.facts ?? [])
    .map((f) => (f && typeof f.statement === "string" ? f.statement.trim() : ""))
    .filter(Boolean)
    .slice(0, 5)
    .map((s) => `• ${s.slice(0, 160)}`);
  if (facts.length) {
    lines.push(`Verifiserte fakta (bruk kun disse, ikke dikt opp nye tall eller påstander):\n${facts.join("\n")}`);
  }
  if (!lines.length) return "";
  return `Følg denne merkevareprofilen (Merkehjerne) konsekvent:\n${lines.join("\n")}`;
}

/**
 * A short, TEXT-FREE brand cue for image scenes — industry mood + colour palette
 * only. Never emits logos, names or writing. Pure.
 */
export function renderBrandImageCue(
  hints: { industry?: string | null; brandColors?: readonly string[] | null } | null,
): string {
  if (!hints) return "";
  const parts: string[] = [];
  const industry = typeof hints.industry === "string" ? hints.industry.trim() : "";
  if (industry) parts.push(`in the context of a ${industry.slice(0, 60)} business`);
  const colors = (hints.brandColors ?? [])
    .filter((c): c is string => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c))
    .slice(0, 3);
  if (colors.length) parts.push(`with a colour palette inspired by ${colors.join(", ")}`);
  return parts.join(", ");
}


/**
 * Map the light onboarding-wizard result into a starter Merkehjerne row (M5).
 * Pure/testable — produces the column values (minus userId/timestamps). The
 * profile is intentionally light (no evidence-grounded facts); a later
 * "Analyser på nytt" in BrandBrain runs the full SSRF-hardened scan and enriches it.
 */
export function buildOnboardingBrandSeed(data: {
  websiteUrl: string;
  companyName?: string | null;
  industry?: string | null;
  audience?: string | null;
  toneLabel?: string | null;
  topics?: readonly string[] | null;
}): {
  websiteUrl: string;
  status: "ready";
  companyName: string | null;
  industry: string | null;
  audiences: string[];
  tonePersonality: string[];
  contentPillars: string[];
  facts: BrandFact[];
} {
  const clean = (v: string | null | undefined, n: number): string | null => {
    const t = typeof v === "string" ? v.trim() : "";
    return t ? t.slice(0, n) : null;
  };
  const audience = clean(data.audience, 300);
  const tone = clean(data.toneLabel, 120);
  return {
    websiteUrl: (data.websiteUrl ?? "").trim().slice(0, 1000),
    status: "ready",
    companyName: clean(data.companyName, 255),
    industry: clean(data.industry, 255),
    audiences: audience ? [audience] : [],
    tonePersonality: tone ? [tone] : [],
    contentPillars: (data.topics ?? [])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 200))
      .slice(0, 12),
    facts: [],
  };
}
