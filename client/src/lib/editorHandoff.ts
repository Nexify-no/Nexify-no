/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * In-memory editor handoff.
 *
 * Lets one page (Gjenbruk-Maskin, A/B-test winner, …) hand a payload to the
 * /generate editor WITHOUT putting it in the URL. Passing full post bodies as
 * query strings leaked them into browser history and server access logs; a
 * module-level singleton survives client-side (wouter) navigation with no leak.
 */

export interface EditorHandoff {
  /** A topic/idea to generate FROM (e.g. an A/B winning variant body). */
  topic?: string;
  /** Finished content to load straight into the editor (e.g. Gjenbruk output). */
  content?: string;
  /** Preferred target platform (linkedin | twitter | instagram | facebook). */
  platform?: string;
  /** Origin of the handoff, used to pick the right confirmation toast. */
  source?: "repurpose" | "abtest" | string;
  /**
   * A date picked in the calendar, carried ALL the way through generation so the
   * post can be scheduled for it afterwards (MB4). ISO-8601 string.
   */
  scheduledAt?: string;
}

let pending: EditorHandoff | null = null;

export function setEditorHandoff(h: EditorHandoff): void {
  pending = h;
}

/** Returns the pending handoff once, then clears it (so reloads don't re-apply). */
export function takeEditorHandoff(): EditorHandoff | null {
  const h = pending;
  pending = null;
  return h;
}

/** Hand-off for the A/B test page (Generate -> /ab-testing) — same no-URL-leak rationale. */
export interface AbTestHandoff {
  body: string;
  platform?: string;
  postId?: number;
}

let pendingAb: AbTestHandoff | null = null;

export function setAbTestHandoff(h: AbTestHandoff): void {
  pendingAb = h;
}

export function takeAbTestHandoff(): AbTestHandoff | null {
  const h = pendingAb;
  pendingAb = null;
  return h;
}
