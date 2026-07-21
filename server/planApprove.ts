/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Pure approval + draft-mapping helpers for Enkel plans (Fase 3b). Kept free of
 * DB access so the rules — which posts may be approved, and how an approved
 * planned post becomes a draft in the `posts` table — are unit-testable.
 *
 * Product decision: approving + "lagre" produces DRAFTS in Mine innlegg. Nothing
 * is ever queued for auto-publishing here (no scheduledFor is set).
 */

export interface ApprovablePost {
  generationStatus: "pending" | "generating" | "done" | "failed";
  verificationStatus: "verified" | "needs_review" | "unsupported" | "high_risk";
}

/**
 * A post can be approved only when its text is finished and it is not flagged
 * high_risk. high_risk content must never be one-click approved.
 */
export function canApprove(post: ApprovablePost): boolean {
  return post.generationStatus === "done" && post.verificationStatus !== "high_risk";
}

export interface PlannedPostForDraft {
  userId: number;
  platform: "linkedin" | "facebook" | "instagram";
  content: string | null;
  reason: string | null;
  imageUrl: string | null;
  imageStatus: string;
  imageGenerationId: string | null;
  postGenerationId: string;
}

export interface DraftPostInsert {
  userId: number;
  platform: "linkedin" | "facebook" | "instagram";
  tone: string;
  rawInput: string;
  generatedContent: string;
  imageUrl: string | null;
  status: "draft";
  imageStatus: "none" | "completed";
  imageGenerationId: string | null;
  generationId: string;
  profileVersion: number;
}

/**
 * Map an approved planned post onto a `posts` draft row. Only a completed image
 * is carried over (skipped/failed/none → no image, status "none"). status is
 * always "draft" and scheduledFor is intentionally never set.
 */
export function plannedPostToDraft(post: PlannedPostForDraft): DraftPostInsert {
  const hasImage = post.imageStatus === "completed" && !!post.imageUrl;
  return {
    userId: post.userId,
    platform: post.platform,
    tone: "professional",
    rawInput: (post.reason && post.reason.trim()) || "Innholdsplan",
    generatedContent: post.content ?? "",
    imageUrl: hasImage ? post.imageUrl : null,
    status: "draft",
    imageStatus: hasImage ? "completed" : "none",
    imageGenerationId: hasImage ? post.imageGenerationId : null,
    generationId: post.postGenerationId,
    profileVersion: 0,
  };
}
