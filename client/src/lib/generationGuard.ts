/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * A tiny request-identity guard for the content generation flow.
 *
 * The Generate page fires several overlapping async operations (text
 * generation, "forbedre", DALL·E / Nano Banana image generation) that all
 * write to the SAME shared React state (generatedContent, uploadedImage,
 * savedPostId). Without a request identity, a slow earlier response can land
 * AFTER a newer one and overwrite it — leaking text/images between unrelated
 * posts.
 *
 * Usage: call `start()` when a new user-initiated generation begins; it bumps
 * a monotonic counter and returns that generation's id. Every async callback
 * captures the id it belongs to and applies its result ONLY if
 * `isCurrent(id)` still holds. Late/out-of-order responses are dropped.
 */
export interface GenerationGuard {
  /** Begin a new generation; invalidates all in-flight ones. Returns its id. */
  start(): number;
  /** True only if `id` is the most recently started generation. */
  isCurrent(id: number): boolean;
  /** The id of the currently active generation (0 before the first start). */
  readonly current: number;
}

export function createGenerationGuard(): GenerationGuard {
  let active = 0;
  return {
    start() {
      return ++active;
    },
    isCurrent(id: number) {
      return id === active;
    },
    get current() {
      return active;
    },
  };
}
