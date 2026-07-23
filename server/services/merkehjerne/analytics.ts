/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Merkehjerne product telemetry.
 *
 * Emits lightweight structured events to stdout for log aggregation. By design
 * it can ONLY carry a small allowlist of primitive fields — a caller can never
 * leak a URL, page text, corpus, evidence quote or secret through it, even by
 * mistake. Everything not on the allowlist is dropped.
 */

export type MerkehjerneEvent =
  | "brand_analysis_started"
  | "brand_analysis_completed"
  | "brand_analysis_failed"
  | "brand_analysis_skipped_unchanged"
  | "brand_profile_edited"
  | "brand_profile_confirmed";

/** Only these keys may ever be logged. No free-form text, URLs, or content. */
const ALLOWED_KEYS = new Set([
  "userId",
  "durationMs",
  "factsCount",
  "warningsCount",
  "errorCode",
  "hadExisting",
  "trigger",
]);

const MAX_STRING = 60;

/** Build the sanitized payload for an event. Pure — exported for testing. */
export function buildEventPayload(
  event: MerkehjerneEvent,
  props: Record<string, unknown> = {},
): Record<string, unknown> {
  const safe: Record<string, unknown> = { evt: event };
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
    } else if (typeof value === "boolean") {
      safe[key] = value;
    } else if (typeof value === "string") {
      safe[key] = value.slice(0, MAX_STRING);
    }
    // anything else (objects, arrays, null, undefined) is dropped
  }
  return safe;
}

/** Emit an event. Never throws — telemetry must not break the request path. */
export function logMerkehjerneEvent(
  event: MerkehjerneEvent,
  props: Record<string, unknown> = {},
): void {
  try {
    console.log("[merkehjerne]", JSON.stringify(buildEventPayload(event, props)));
  } catch {
    /* telemetry is best-effort */
  }
}
