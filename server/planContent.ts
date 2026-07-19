/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Pure planning logic for the Enkel 4-week content plan. No I/O, no LLM — it
 * only decides WHAT to make (content-type mix, dates, platform rotation, and a
 * human "why"). The worker turns each skeleton item into real copy + image.
 *
 * Everything date-related is derived from `startDate` (default: now), so the
 * plan always uses the current year — never a hardcoded year.
 */

export type PlanGoal =
  | "customers"
  | "trust"
  | "showcase"
  | "engagement"
  | "offer"
  | "mixed";

export type ContentType =
  | "intro"
  | "problem"
  | "tips"
  | "question"
  | "case"
  | "behind_scenes"
  | "faq"
  | "cta"
  | "seasonal"
  | "offer";

export type PlanPlatform = "linkedin" | "facebook" | "instagram";

export interface PlannedItem {
  weekNumber: number; // 1..4
  suggestedDate: string; // yyyy-mm-dd (local)
  platform: PlanPlatform;
  contentType: ContentType;
  reason: string; // Norwegian one-liner shown on the card
}

export const WEEKS = 4;
export const VALID_PER_WEEK = [2, 3, 5] as const;

/** Ordered, repeating content-type mix per goal (variety, not repetition). */
const GOAL_MIX: Record<PlanGoal, ContentType[]> = {
  customers: ["intro", "problem", "cta", "tips", "faq", "case", "question", "seasonal"],
  trust: ["case", "behind_scenes", "tips", "faq", "intro", "question", "problem", "seasonal"],
  showcase: ["intro", "tips", "case", "behind_scenes", "faq", "cta", "question", "seasonal"],
  engagement: ["question", "tips", "behind_scenes", "seasonal", "problem", "faq", "intro", "case"],
  offer: ["offer", "cta", "problem", "tips", "faq", "intro", "question", "case"],
  mixed: ["intro", "tips", "problem", "question", "case", "behind_scenes", "faq", "cta", "seasonal", "offer"],
};

/** Safe fallback when a case/offer type isn't backed by Merkehjerne data. */
const FALLBACK_ORDER: ContentType[] = ["tips", "question", "intro", "faq", "problem", "behind_scenes"];

const REASONS: Record<ContentType, string> = {
  intro: "Presenterer bedriften og hva dere tilbyr.",
  problem: "Tar opp et problem kunden kjenner seg igjen i.",
  tips: "Gir et nyttig, konkret tips.",
  question: "Stiller et spørsmål for å skape engasjement.",
  case: "Viser et reelt prosjekt eller erfaring.",
  behind_scenes: "Gir et innblikk bak kulissene.",
  faq: "Svarer på et vanlig spørsmål.",
  cta: "Oppfordrer leseren til å ta kontakt.",
  seasonal: "Sesongaktuelt innhold for perioden.",
  offer: "Markedsfører et tilbud eller en kampanje.",
};

/** Days of week (0=Sun..6=Sat) each post lands on, spread across the week. */
function postingDays(perWeek: number): number[] {
  switch (perWeek) {
    case 2:
      return [2, 4]; // Tue, Thu
    case 3:
      return [1, 3, 5]; // Mon, Wed, Fri
    case 5:
      return [1, 2, 3, 4, 5]; // Mon–Fri
    default:
      return [1, 3, 5];
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday on or after the given date (so week 1 starts cleanly). */
function nextMonday(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = d.getDay(); // 0=Sun
  const delta = (8 - (day === 0 ? 7 : day)) % 7; // days until next Monday (0 if already Mon)
  d.setDate(d.getDate() + (delta === 0 ? 0 : delta));
  return d;
}

export function normalizePerWeek(perWeek: number): 2 | 3 | 5 {
  return (VALID_PER_WEEK as readonly number[]).includes(perWeek) ? (perWeek as 2 | 3 | 5) : 3;
}

export function totalPosts(perWeek: number): number {
  return normalizePerWeek(perWeek) * WEEKS;
}

/**
 * Build the deterministic skeleton for a 4-week plan. `hasCases`/`hasOffer`
 * gate the case/offer content-types so we never invent proof the brand lacks.
 */
export function buildPlanSkeleton(input: {
  goal: PlanGoal;
  postsPerWeek: number;
  platforms: PlanPlatform[];
  startDate?: Date;
  hasCases?: boolean;
  hasOffer?: boolean;
}): PlannedItem[] {
  const perWeek = normalizePerWeek(input.postsPerWeek);
  const platforms = input.platforms.length ? input.platforms : (["linkedin"] as PlanPlatform[]);
  const start = nextMonday(input.startDate ?? new Date());
  const mix = GOAL_MIX[input.goal] ?? GOAL_MIX.mixed;
  const days = postingDays(perWeek);

  const items: PlannedItem[] = [];
  let mixIdx = 0;
  let platIdx = 0;
  let fallbackIdx = 0;

  for (let week = 0; week < WEEKS; week++) {
    for (let slot = 0; slot < perWeek; slot++) {
      // Pick next content type, skipping unavailable case/offer.
      let type = mix[mixIdx % mix.length];
      mixIdx++;
      let guard = 0;
      while (
        ((type === "case" && !input.hasCases) || (type === "offer" && !input.hasOffer)) &&
        guard < mix.length
      ) {
        type = mix[mixIdx % mix.length];
        mixIdx++;
        guard++;
      }
      if ((type === "case" && !input.hasCases) || (type === "offer" && !input.hasOffer)) {
        type = FALLBACK_ORDER[fallbackIdx % FALLBACK_ORDER.length];
        fallbackIdx++;
      }

      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + (days[slot] - 1));

      items.push({
        weekNumber: week + 1,
        suggestedDate: toISODate(date),
        platform: platforms[platIdx % platforms.length],
        contentType: type,
        reason: REASONS[type],
      });
      platIdx++;
    }
  }

  return items;
}
