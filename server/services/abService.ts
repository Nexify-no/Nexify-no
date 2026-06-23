/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * A/B Content Testing service.
 *
 * Pure business logic for the NEW `ab` namespace: AI variant generation, the
 * statistical winner engine (two-proportion z-test), stats aggregation, and
 * tracking-code generation. Kept free of HTTP/tRPC concerns so it can be unit
 * tested and reused by both the router and the background scheduler.
 */

import { customAlphabet } from "nanoid";

// URL-safe, unambiguous alphabet (no look-alike 0/O/1/l/I) for tracking codes.
const TRACKING_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
const nanoTracking = customAlphabet(TRACKING_ALPHABET, 8);

/** Generate a short, url-safe, collision-resistant tracking code (8 chars). */
export function genTrackingCode(): string {
  return nanoTracking();
}

export type VariantGenInput = {
  topic?: string;
  body?: string;
  platform: string;
  tone?: string;
  /** Which framing controls to emphasise (hook/cta/tone/length/image). */
  controls?: string[];
};

export type GeneratedVariant = { label: string; body: string };

const VARIANT_LABELS = ["Konservativ", "Oppmerksomhet", "Nysgjerrighet"] as const;

/**
 * Generate exactly 3 distinct content variants from a topic/body using the
 * existing text LLM. Each variant keeps the same core meaning and brand but
 * changes framing. Returns labelled variants; parsing is defensive.
 */
export async function generateVariants(input: VariantGenInput): Promise<GeneratedVariant[]> {
  const { topic, body, platform, tone, controls } = input;
  const source = (body || topic || "").trim();
  if (!source) {
    throw new Error("Mangler tema eller innhold for variantgenerering");
  }

  const { invokeLLM } = await import("../_core/llm");

  const controlText =
    controls && controls.length > 0
      ? `Fokuser spesielt på å variere: ${controls.join(", ")}.`
      : "Varier hook, vinkling og call-to-action.";

  const system = [
    "Du er en ekspert på A/B-testing av innhold for sosiale medier.",
    "Du lager nøyaktig 3 varianter av samme budskap som beholder kjernebetydningen,",
    "men endrer innramming/vinkling. Behold merkevarens stemme. Ingen duplikater.",
    "Svar KUN med gyldig JSON.",
  ].join(" ");

  const user = [
    `Plattform: ${platform}.`,
    tone ? `Tone: ${tone}.` : "",
    `Kildeinnhold: """${source}"""`,
    controlText,
    "Lag 3 varianter med disse rollene:",
    '1) "Konservativ" = trygg, rett-på-sak innramming.',
    '2) "Oppmerksomhet" = sterk hook som stopper scrollingen.',
    '3) "Nysgjerrighet" = pirrer nysgjerrighet / åpen sløyfe.',
    'Svar i dette JSON-formatet: {"variants":[{"label":"Konservativ","body":"..."},{"label":"Oppmerksomhet","body":"..."},{"label":"Nysgjerrighet","body":"..."}]}',
  ]
    .filter(Boolean)
    .join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    responseFormat: { type: "json_object" },
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);

  const parsed = parseVariants(text);

  // Normalise to exactly 3 labelled, de-duplicated variants.
  const out: GeneratedVariant[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parsed.length && out.length < 3; i++) {
    const b = (parsed[i].body || "").trim();
    if (!b) continue;
    const key = b.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: parsed[i].label || VARIANT_LABELS[out.length], body: b });
  }

  if (out.length === 0) {
    throw new Error("Klarte ikke å generere varianter. Prøv igjen.");
  }

  // Pad (defensive) so callers always receive a stable count when possible.
  while (out.length < 3) {
    out.push({ label: VARIANT_LABELS[out.length], body: source });
  }

  return out;
}

/** Robustly extract a variants array from possibly-messy LLM output. */
function parseVariants(text: string): GeneratedVariant[] {
  const tryParse = (s: string): GeneratedVariant[] | null => {
    try {
      const obj = JSON.parse(s);
      const arr = Array.isArray(obj) ? obj : obj.variants;
      if (Array.isArray(arr)) {
        return arr
          .map((v: any) => ({
            label: typeof v?.label === "string" ? v.label : "",
            body: typeof v?.body === "string" ? v.body : typeof v === "string" ? v : "",
          }))
          .filter((v: GeneratedVariant) => v.body);
      }
      return null;
    } catch {
      return null;
    }
  };

  // 1) direct parse
  const direct = tryParse(text);
  if (direct) return direct;

  // 2) strip code fences
  const fenced = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const f = tryParse(fenced);
  if (f) return f;

  // 3) grab the first {...} object substring
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = fenced.slice(start, end + 1);
    const s = tryParse(slice);
    if (s) return s;
  }

  return [];
}

export type VariantStat = {
  variantId: number;
  clicks: number;
  uniqueClicks: number;
};

export type WinnerResult = {
  winnerVariantId: number | null;
  reason: string;
  /** Per-variant computed metrics keyed by variantId. */
  metrics: Record<
    number,
    { ctr: number; confidence: number; winnerProbability: number }
  >;
};

const MIN_TOTAL_CLICKS = 100;
const CONFIDENCE_THRESHOLD = 0.95;

/**
 * Standard normal CDF via the Abramowitz & Stegun erf approximation.
 * Used to convert a z-score into a confidence (1 - p) for the z-test.
 */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Determine an A/B winner using a two-proportion z-test of the best variant
 * against the runner-up. Requires >= 100 total clicks AND >= 95% confidence.
 *
 * "Clicks" here are total click events; we model conversion as unique/clicks.
 * winner_probability is a simple normalised share of unique clicks (placeholder
 * for a full Bayesian model) and is also returned for the UI.
 */
export function computeWinner(variantsStats: VariantStat[]): WinnerResult {
  const metrics: WinnerResult["metrics"] = {};

  // CTR = unique / clicks (per-variant conversion proxy). Guard divide-by-zero.
  for (const v of variantsStats) {
    const ctr = v.clicks > 0 ? v.uniqueClicks / v.clicks : 0;
    metrics[v.variantId] = { ctr, confidence: 0, winnerProbability: 0 };
  }

  // winner_probability = normalised share of unique clicks.
  const totalUnique = variantsStats.reduce((s, v) => s + v.uniqueClicks, 0);
  for (const v of variantsStats) {
    metrics[v.variantId].winnerProbability =
      totalUnique > 0 ? v.uniqueClicks / totalUnique : 0;
  }

  const totalClicks = variantsStats.reduce((s, v) => s + v.clicks, 0);

  if (variantsStats.length < 2) {
    return { winnerVariantId: null, reason: "Trenger minst to varianter", metrics };
  }

  if (totalClicks < MIN_TOTAL_CLICKS) {
    return {
      winnerVariantId: null,
      reason: `Trenger mer data (${totalClicks}/${MIN_TOTAL_CLICKS} klikk)`,
      metrics,
    };
  }

  // Rank by CTR; compare top two.
  const ranked = [...variantsStats].sort(
    (a, b) => metrics[b.variantId].ctr - metrics[a.variantId].ctr
  );
  const best = ranked[0];
  const second = ranked[1];

  const n1 = best.clicks;
  const n2 = second.clicks;
  const x1 = best.uniqueClicks;
  const x2 = second.uniqueClicks;

  if (n1 === 0 || n2 === 0) {
    return { winnerVariantId: null, reason: "Ikke nok klikk på en variant", metrics };
  }

  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (se === 0) {
    return { winnerVariantId: null, reason: "Trenger mer data", metrics };
  }

  const z = (p1 - p2) / se;
  // Two-sided confidence that the two proportions differ.
  const confidence = 2 * normalCdf(Math.abs(z)) - 1;

  metrics[best.variantId].confidence = confidence;
  metrics[second.variantId].confidence = confidence;

  if (confidence >= CONFIDENCE_THRESHOLD) {
    return {
      winnerVariantId: best.variantId,
      reason: `Vinner med ${(confidence * 100).toFixed(1)}% sikkerhet`,
      metrics,
    };
  }

  return {
    winnerVariantId: null,
    reason: `Ikke statistisk signifikant ennå (${(confidence * 100).toFixed(1)}%)`,
    metrics,
  };
}

/**
 * Aggregate ab_click_events into ab_stats for every variant of an experiment.
 * Computes clicks (total events), unique_clicks (distinct session_hash), and
 * ctr (unique/clicks). confidence + winner_probability are written by the
 * winner engine; here we keep ctr fresh and persist click counts.
 */
export async function recomputeStats(experimentId: number): Promise<VariantStat[]> {
  const { getDb } = await import("../db");
  const { abVariants, abClickEvents, abStats } = await import("../../drizzle/schema");
  const { eq, sql } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const variants = await db
    .select()
    .from(abVariants)
    .where(eq(abVariants.experimentId, experimentId));

  const result: VariantStat[] = [];

  for (const v of variants) {
    const rows: any = await db
      .select({
        clicks: sql<number>`count(*)`,
        unique: sql<number>`count(distinct ${abClickEvents.sessionHash})`,
      })
      .from(abClickEvents)
      .where(eq(abClickEvents.variantId, v.id));

    const clicks = Number(rows?.[0]?.clicks ?? 0);
    const uniqueClicks = Number(rows?.[0]?.unique ?? 0);
    const ctr = clicks > 0 ? uniqueClicks / clicks : 0;

    // Upsert the stats row (it is created at experiment creation, but be safe).
    await db
      .insert(abStats)
      .values({ variantId: v.id, clicks, uniqueClicks, ctr })
      .onDuplicateKeyUpdate({
        set: { clicks, uniqueClicks, ctr, updatedAt: new Date() },
      });

    result.push({ variantId: v.id, clicks, uniqueClicks });
  }

  return result;
}

/**
 * Recompute stats AND persist confidence + winner_probability from the winner
 * engine. Returns the WinnerResult so callers (router.end, scheduler) can set
 * the experiment winner.
 */
export async function recomputeAndScore(experimentId: number): Promise<WinnerResult> {
  const stats = await recomputeStats(experimentId);
  const winner = computeWinner(stats);

  const { getDb } = await import("../db");
  const { abStats } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const variantId of Object.keys(winner.metrics)) {
    const id = Number(variantId);
    const m = winner.metrics[id];
    await db
      .update(abStats)
      .set({
        confidence: m.confidence,
        winnerProbability: m.winnerProbability,
        updatedAt: new Date(),
      })
      .where(eq(abStats.variantId, id));
  }

  return winner;
}
