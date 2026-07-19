/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Image lifecycle for a post's picture — a small, pure state machine + guards
 * shared by the server API. It exists so the "which image belongs to this post"
 * question has ONE authoritative answer, independent of client timing.
 *
 * The bug it fixes: a new post could show/keep an image produced by an earlier
 * generation, and a late image response could overwrite the current one. Every
 * image attempt is tagged with the generationId that owns it; a response is
 * applied ONLY if it still owns the post's image slot (shouldApplyImage), and
 * the status only reaches "completed" after the URL passes verifyImageUrl.
 */

export type ImageStatus =
  | "none"        // post has no image and none requested
  | "pending"     // an AI image was requested but generation hasn't started
  | "generating"  // the image model is producing the image
  | "verifying"   // an image URL arrived and is being validated
  | "completed"   // a verified image is attached
  | "failed";     // generation or verification failed

export type ImageEvent =
  | "request"      // user asked for an AI image
  | "start"        // generation began
  | "uploaded"     // an image URL came back
  | "verified"     // the URL passed validation
  | "verifyFailed" // generation/validation failed
  | "reset";       // a brand-new generation cleared the slot

/**
 * The only legal transitions. Any event that doesn't apply to the current
 * status is a no-op (returns the current status unchanged) — so out-of-order
 * or duplicate events can never move the machine into a wrong state.
 */
export function nextImageStatus(current: ImageStatus, event: ImageEvent): ImageStatus {
  switch (event) {
    case "reset":
      return "none";
    case "request":
      return "pending";
    case "start":
      return current === "pending" || current === "none" || current === "failed"
        ? "generating"
        : current;
    case "uploaded":
      return current === "generating" ? "verifying" : current;
    case "verified":
      return current === "verifying" ? "completed" : current;
    case "verifyFailed":
      return current === "verifying" || current === "generating" ? "failed" : current;
    default:
      return current;
  }
}

/**
 * A post's image slot is "owned" by exactly one generationId at a time. An
 * incoming image response is applied only if it still owns the slot; if a newer
 * generation has since claimed it (different id), the late response is rejected.
 */
export function shouldApplyImage(
  post: { imageGenerationId: string | null | undefined },
  incomingGenerationId: string | null | undefined,
): boolean {
  if (!incomingGenerationId) return false;
  return post.imageGenerationId === incomingGenerationId;
}

/**
 * Structural verification of an image URL before we mark it completed:
 * must be a non-empty https URL, never a data: URI, within a sane length.
 * (Pixel-level checks would require a network fetch and are out of scope here.)
 */
export function verifyImageUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  if (url.length === 0 || url.length > 2048) return false;
  if (url.startsWith("data:")) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** True when the UI should show a skeleton/loading state instead of an image. */
export function isImageLoading(status: ImageStatus): boolean {
  return status === "pending" || status === "generating" || status === "verifying";
}
