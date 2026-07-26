/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * DB layer for Enkel content plans. Applies planLease decisions atomically:
 * claims use conditional UPDATEs (only one worker wins), every result write is
 * conditioned on the current lease token, quota is charged idempotently per
 * post, and create() is idempotent on (workspace_id, idempotency_key) with
 * explicit duplicate-key handling. All timestamps are UTC.
 *
 * Fase 2: one image per post. The worker generates the image inline with the
 * text (same lease) and savePostSuccess persists both; a lost lease can never
 * write a stale image. Image quota is charged idempotently per post
 * (image_quota_charged) and only when an image is actually attached. The
 * user-triggered regeneratePostImage runs synchronously with reserve-first
 * quota and slot-ownership (image_generation_id) isolation.
 */
import { randomUUID } from "crypto";
import { and, eq, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { contentPlans, plannedPosts, type ContentPlan, type PlannedPost } from "../drizzle/schema";
import { getDb } from "./db";
import { LEASE_MS, derivePlanStatus, type RetryDecision } from "./planLease";
import { verifyImageUrl } from "./imageLifecycle";
import { canApprove, canBulkApprove, plannedPostToDraft } from "./planApprove";
import { buildEnkelImagePrompt, buildImageAltText } from "./planImagePrompt";
import type { ClaimedPlan, ClaimedPost, PostImageOutcome } from "./planWorker";
import type { PlannedItem } from "./planContent";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

const affected = (res: unknown): number =>
  (res as { affectedRows?: number })?.affectedRows ??
  (res as Array<{ affectedRows?: number }>)?.[0]?.affectedRows ?? 0;

/** Idempotent create: one plan per (workspace, idempotencyKey); loser reads the winner. */
export async function createPlanWithPosts(input: {
  userId: number;
  workspaceId: number;
  /** Multi-brand (MB1): which brand this plan belongs to. Null when the flag is off. */
  brandId?: number | null;
  idempotencyKey: string;
  goal: ContentPlan["goal"];
  platform: "linkedin" | "facebook" | "instagram";
  postsPerWeek: number;
  timeZone: string;
  brandSnapshot: unknown;
  companyProfileVersion: number;
  visualIdentityVersion: number;
  items: PlannedItem[];
}): Promise<{ planId: number; created: boolean }> {
  const db = await requireDb();
  const existing = await db.select({ id: contentPlans.id }).from(contentPlans)
    .where(and(eq(contentPlans.workspaceId, input.workspaceId), eq(contentPlans.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing.length) return { planId: existing[0].id, created: false };

  try {
    return await db.transaction(async (tx) => {
      const res = await tx.insert(contentPlans).values({
        userId: input.userId,
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        idempotencyKey: input.idempotencyKey,
        goal: input.goal,
        platform: input.platform,
        weeksCount: 4,
        postsPerWeek: input.postsPerWeek,
        timeZone: input.timeZone,
        brandSnapshot: input.brandSnapshot,
        companyProfileVersion: input.companyProfileVersion,
        visualIdentityVersion: input.visualIdentityVersion,
        totalContentQuota: input.items.length,
        // Fase 2: one image per post (best-effort). Informational only — the
        // worker charges image quota per actually-attached image.
        totalImageQuota: input.items.length,
        status: "queued",
      });
      const planId = (res as unknown as { insertId?: number })?.insertId ??
        (res as unknown as Array<{ insertId?: number }>)?.[0]?.insertId ?? 0;
      await tx.insert(plannedPosts).values(input.items.map((item) => ({
        contentPlanId: planId,
        userId: input.userId,
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        postGenerationId: randomUUID(),
        weekNumber: item.weekNumber,
        suggestedDate: new Date(`${item.suggestedDate}T00:00:00Z`),
        platform: item.platform as "linkedin" | "facebook" | "instagram",
        contentType: item.contentType,
        reason: item.reason,
        generationStatus: "pending" as const,
      })));
      return { planId, created: true };
    });
  } catch (err) {
    // Duplicate key (parallel create with same key): rollback happened inside
    // db.transaction — read the winning plan and return its id.
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY" || /Duplicate entry/i.test(String((err as Error)?.message))) {
      const winner = await db.select({ id: contentPlans.id }).from(contentPlans)
        .where(and(eq(contentPlans.workspaceId, input.workspaceId), eq(contentPlans.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (winner.length) return { planId: winner[0].id, created: false };
    }
    throw err;
  }
}

export async function getPlanForUser(planId: number, userId: number, workspaceId: number) {
  const db = await requireDb();
  const [plan] = await db.select().from(contentPlans)
    .where(and(eq(contentPlans.id, planId), eq(contentPlans.userId, userId), eq(contentPlans.workspaceId, workspaceId), isNull(contentPlans.deletedAt)))
    .limit(1);
  if (!plan) return null;
  const posts = await db.select().from(plannedPosts)
    .where(and(eq(plannedPosts.contentPlanId, planId), eq(plannedPosts.userId, userId)))
    .orderBy(plannedPosts.weekNumber, plannedPosts.suggestedDate);

  // PR #83: re-check on open. A verdict frozen at generation time means every
  // plan written before verification existed carries the DEFAULT status rather
  // than a judgement, and a plan written before the rules got stricter keeps its
  // old, more permissive one. The checks are pure regex over local text, and the
  // result is persisted with verifiedAt so this is idempotent, not a write on
  // every read. Best-effort: never block opening a plan.
  try {
    const { reverifyPlanPosts, brandFactsForUser } = await import("./services/verification/reverify");
    // The LIVE Merkehjerne, falling back to the plan's frozen snapshot.
    //
    // Re-checking against the snapshot made the UI's advice impossible to follow:
    // the user adds the customer story as a sourced fact, reopens the plan, and
    // the check still consults the facts as they were when the plan was created.
    // Generation still uses the snapshot — the content must not change under the
    // user — but the QUESTION "is this claim documented?" is about now.
    const liveBrand = await brandFactsForUser(userId);
    const updates = await reverifyPlanPosts({
      planId,
      userId,
      brand: (liveBrand ?? plan.brandSnapshot ?? null) as never,
      rows: posts.map((p) => ({
        id: p.id,
        content: p.content,
        generationStatus: p.generationStatus,
        suggestedDate: p.suggestedDate,
        verifiedAt: p.verifiedAt,
      })),
    });
    if (updates.size > 0) {
      for (const p of posts) {
        const u = updates.get(p.id);
        if (!u) continue;
        p.verificationStatus = u.status;
        p.verificationIssues = u.issues;
      }
    }
  } catch (e) {
    console.warn(`[plan ${planId}] re-verification skipped:`, (e as Error)?.message);
  }

  return { plan, posts };
}

/** Load a single post scoped to its owner + plan (foreign → null, no enumeration). */
export async function getPostForUser(planId: number, postId: number, userId: number): Promise<PlannedPost | null> {
  const db = await requireDb();
  const [post] = await db.select().from(plannedPosts)
    .where(and(eq(plannedPosts.id, postId), eq(plannedPosts.contentPlanId, planId), eq(plannedPosts.userId, userId)))
    .limit(1);
  return post ?? null;
}

export async function listPlansForUser(userId: number, workspaceId: number) {
  const db = await requireDb();
  // PR #84: scoped to the ACTIVE brand.
  //
  // /innholdsplan takes the newest plan for the USER, so with this unscoped a
  // Ballong plan appeared while the header said "Du jobber i Penna" — and the new
  // per-card Publiser nå would have sent it out through Penna's channel.
  const { activeBrandId, ownedBy } = await import("./services/brandScope");
  const brandId = await activeBrandId(userId);
  return db.select().from(contentPlans)
    .where(and(
      ownedBy(contentPlans.userId, contentPlans.brandId, userId, brandId),
      eq(contentPlans.workspaceId, workspaceId),
      isNull(contentPlans.deletedAt),
    ))
    .orderBy(sql`${contentPlans.createdAt} DESC`);
}

/** Atomic plan claim: pick a candidate, then conditionally take it (loser gets affectedRows=0). */
export async function claimPlan(workerId: string): Promise<ClaimedPlan | null> {
  const db = await requireDb();
  const now = new Date();
  const token = randomUUID();
  const candidates = await db.select({ id: contentPlans.id }).from(contentPlans).where(and(
    inArray(contentPlans.status, ["queued", "processing"]),
    isNull(contentPlans.deletedAt),
    or(isNull(contentPlans.lockExpiresAt), lt(contentPlans.lockExpiresAt, now)),
    or(isNull(contentPlans.nextAttemptAt), lte(contentPlans.nextAttemptAt, now)),
  )).orderBy(contentPlans.id).limit(1);
  if (!candidates.length) return null;
  const res = await db.update(contentPlans).set({
    leaseToken: token,
    lockedBy: workerId,
    lockedAt: now,
    lockExpiresAt: new Date(now.getTime() + LEASE_MS),
    attemptCount: sql`${contentPlans.attemptCount} + 1`,
    status: "processing",
  }).where(and(
    eq(contentPlans.id, candidates[0].id),
    inArray(contentPlans.status, ["queued", "processing"]),
    isNull(contentPlans.deletedAt),
    or(isNull(contentPlans.lockExpiresAt), lt(contentPlans.lockExpiresAt, now)),
  ));
  if (affected(res) === 0) return null;
  const [plan] = await db.select().from(contentPlans).where(eq(contentPlans.id, candidates[0].id)).limit(1);
  if (!plan || plan.leaseToken !== token) return null;
  return {
    id: plan.id, userId: plan.userId, leaseToken: token, goal: plan.goal,
    platform: plan.platform, timeZone: plan.timeZone, brandSnapshot: plan.brandSnapshot,
    cancelRequested: plan.cancelRequested,
  };
}

export async function claimNextPost(planId: number, workerId: string): Promise<ClaimedPost | null> {
  const db = await requireDb();
  const now = new Date();
  const token = randomUUID();
  const candidates = await db.select({ id: plannedPosts.id }).from(plannedPosts).where(and(
    eq(plannedPosts.contentPlanId, planId),
    eq(plannedPosts.generationStatus, "pending"),
    or(isNull(plannedPosts.lockExpiresAt), lt(plannedPosts.lockExpiresAt, now)),
    or(isNull(plannedPosts.nextAttemptAt), lte(plannedPosts.nextAttemptAt, now)),
  )).orderBy(plannedPosts.id).limit(1);
  if (!candidates.length) return null;
  const res = await db.update(plannedPosts).set({
    leaseToken: token,
    lockedBy: workerId,
    lockExpiresAt: new Date(now.getTime() + LEASE_MS),
    attemptCount: sql`${plannedPosts.attemptCount} + 1`,
    generationStatus: "generating",
  }).where(and(
    eq(plannedPosts.id, candidates[0].id),
    eq(plannedPosts.generationStatus, "pending"),
    or(isNull(plannedPosts.lockExpiresAt), lt(plannedPosts.lockExpiresAt, now)),
  ));
  if (affected(res) === 0) return null;
  const [post] = await db.select().from(plannedPosts).where(eq(plannedPosts.id, candidates[0].id)).limit(1);
  if (!post || post.leaseToken !== token) return null;
  return {
    id: post.id, planId: post.contentPlanId, userId: post.userId, leaseToken: token,
    postGenerationId: post.postGenerationId, contentType: post.contentType,
    platform: post.platform, weekNumber: post.weekNumber,
    suggestedDate: post.suggestedDate instanceof Date ? post.suggestedDate.toISOString().slice(0, 10) : String(post.suggestedDate),
    attemptCount: post.attemptCount, reason: post.reason,
  };
}

/** Extend both leases while the SAME tokens still own their rows. */
export async function heartbeat(plan: ClaimedPlan, post: ClaimedPost | null): Promise<boolean> {
  const db = await requireDb();
  const now = new Date();
  const expiry = new Date(now.getTime() + LEASE_MS);
  const planRes = await db.update(contentPlans).set({ lockExpiresAt: expiry })
    .where(and(eq(contentPlans.id, plan.id), eq(contentPlans.leaseToken, plan.leaseToken)));
  if (affected(planRes) === 0) return false;
  if (post) {
    const postRes = await db.update(plannedPosts).set({ lockExpiresAt: expiry })
      .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.leaseToken, post.leaseToken)));
    if (affected(postRes) === 0) return false;
  }
  return true;
}

/**
 * Lease-conditioned success write + idempotent text/image quota charge.
 * Persists text and (Fase 2) the best-effort image outcome together, so a
 * refresh/restart never shows text without its already-decided image state.
 */
export async function savePostSuccess(post: ClaimedPost, rawContent: string, image?: PostImageOutcome): Promise<boolean> {
  const db = await requireDb();
  const now = new Date();

  // Verify what will actually be PUBLISHED, not the Markdown source: stripping
  // afterwards could change a number or a link the checks had already cleared.
  const { stripMarkdown } = await import("./services/verification/contentVerification");
  const strippedContent = stripMarkdown(rawContent);
  const content = strippedContent;

  // The plan row carries the FROZEN brand snapshot + versions (MB1/MB4).
  const [planRow] = await db.select().from(contentPlans).where(eq(contentPlans.id, post.planId)).limit(1);

  // MB4: grade the generated text against the plan's FROZEN brand snapshot and
  // its own suggested publish date (seasonal check), plus the plan's other posts
  // (repetition check). Never trust the model's own claims.
  let verificationStatus: "verified" | "needs_review" | "unsupported" | "high_risk" = "needs_review";
  // PR #83: keep the findings too. Storing only the status let the UI say
  // "Høy risiko" and nothing else, so the only way to clear it was to guess which
  // sentence was the problem.
  let verificationIssues: Array<{ code: string; message: string; evidence?: string }> = [];
  try {
    const { verifyPostContent } = await import("./services/verification/contentVerification");
    const snapshot = (planRow?.brandSnapshot ?? {}) as {
      facts?: Array<{ statement?: string | null; evidenceQuote?: string | null }> | null;
      summary?: string | null;
      offers?: string[] | null;
      differentiators?: string[] | null;
      websiteUrl?: string | null;
    };
    const siblings = await db
      .select({ content: plannedPosts.content })
      .from(plannedPosts)
      .where(and(eq(plannedPosts.contentPlanId, post.planId), ne(plannedPosts.id, post.id)));
    const verdict = verifyPostContent({
      content,
      brand: snapshot,
      publishAt: post.suggestedDate ? new Date(post.suggestedDate) : null,
      siblingContents: siblings.map((r) => r.content ?? "").filter(Boolean),
    });
    verificationStatus = verdict.status;
    verificationIssues = verdict.issues.slice(0, 20).map((i) => ({
      code: i.code,
      message: i.message.slice(0, 300),
      ...(i.evidence ? { evidence: i.evidence.slice(0, 200) } : {}),
    }));
  } catch {
    // Verification must never block the worker — fall back to manual review.
    verificationStatus = "needs_review";
    verificationIssues = [];
  }

  // Map the best-effort image outcome onto the row's image columns.
  const imageFields: Partial<typeof plannedPosts.$inferInsert> = {};
  if (image) {
    if (image.status === "completed") {
      imageFields.imageUrl = image.url;
      imageFields.imageStatus = "completed";
      imageFields.imageGenerationId = image.generationId;
      // MB4: bind the image to the brand + visual-identity version it was made
      // for, and give it alt text so it is accessible when published.
      imageFields.imageAltText = buildImageAltText(post.contentType, content).slice(0, 300);
      imageFields.imageBrandId = planRow?.brandId ?? null;
      imageFields.imageVisualIdentityVersion = planRow?.visualIdentityVersion ?? null;
    } else if (image.status === "failed") {
      imageFields.imageStatus = "failed";
    } else {
      imageFields.imageStatus = "skipped";
    }
  }

  const res = await db.update(plannedPosts).set({
    // PR #83: Markdown is stripped ONCE, on the way in. LinkedIn and Facebook
    // render `**bold**` and `## heading` as literal asterisks and hashes, so
    // leaving it meant the preview and the published post both looked like broken
    // source. Doing it at display time only would still publish the raw text.
    content: strippedContent,
    generationStatus: "done",
    verificationStatus,
    verificationIssues,
    verifiedAt: now,
    lastError: null,
    leaseToken: null,
    lockedBy: null,
    lockExpiresAt: null,
    ...imageFields,
  }).where(and(
    eq(plannedPosts.id, post.id),
    eq(plannedPosts.leaseToken, post.leaseToken),
    sql`${plannedPosts.lockExpiresAt} > ${now}`,
  ));
  if (affected(res) === 0) return false; // stale worker — discard (image included)

  // Idempotent text quota charge: only the transition that flips the flag charges.
  const chargeRes = await db.update(plannedPosts).set({ contentQuotaCharged: true })
    .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.contentQuotaCharged, false)));
  if (affected(chargeRes) > 0) {
    const { enforcePostQuota } = await import("./db");
    try { await enforcePostQuota(post.userId); } catch {
      // Quota exhausted mid-plan: keep the text (already generated), flag stays set.
    }
  }

  // Idempotent image quota charge: only when an image was actually attached.
  if (image?.status === "completed") {
    const imgChargeRes = await db.update(plannedPosts).set({ imageQuotaCharged: true })
      .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.imageQuotaCharged, false)));
    if (affected(imgChargeRes) > 0) {
      const { enforceImageQuota } = await import("./db");
      try { await enforceImageQuota(post.userId); } catch {
        // Image quota exhausted at charge time: keep the image (already generated).
      }
    }
  }
  return true;
}

export async function savePostFailure(post: ClaimedPost, safeError: string, decision: RetryDecision): Promise<boolean> {
  const db = await requireDb();
  const now = new Date();
  const base = {
    lastError: safeError,
    leaseToken: null,
    lockedBy: null,
    lockExpiresAt: null,
  };
  const set = decision.action === "retry"
    ? { ...base, generationStatus: "pending" as const, nextAttemptAt: decision.nextAttemptAt }
    : { ...base, generationStatus: "failed" as const, nextAttemptAt: null };
  const res = await db.update(plannedPosts).set(set).where(and(
    eq(plannedPosts.id, post.id),
    eq(plannedPosts.leaseToken, post.leaseToken),
    sql`${plannedPosts.lockExpiresAt} > ${now}`,
  ));
  return affected(res) > 0;
}

/** Finalize only when no pending/generating remain (terminal gating). */
export async function finalizePlanIfDone(planId: number, leaseToken: string): Promise<void> {
  const db = await requireDb();
  const posts = await db.select({ generationStatus: plannedPosts.generationStatus })
    .from(plannedPosts).where(eq(plannedPosts.contentPlanId, planId));
  const status = derivePlanStatus(posts);
  if (status === "processing") return;
  await db.update(contentPlans).set({ status, lastError: null })
    .where(and(eq(contentPlans.id, planId), eq(contentPlans.leaseToken, leaseToken)));
}

export async function releasePlan(planId: number, leaseToken: string): Promise<void> {
  const db = await requireDb();
  await db.update(contentPlans).set({ leaseToken: null, lockedBy: null, lockExpiresAt: null })
    .where(and(eq(contentPlans.id, planId), eq(contentPlans.leaseToken, leaseToken)));
}

export async function markPlanCancelled(planId: number, leaseToken: string): Promise<void> {
  const db = await requireDb();
  await db.update(contentPlans).set({ status: "cancelled", leaseToken: null, lockedBy: null, lockExpiresAt: null })
    .where(and(eq(contentPlans.id, planId), eq(contentPlans.leaseToken, leaseToken)));
}

/** Norwegian topic instruction per content type — built from the FROZEN snapshot only. */
function topicFor(contentType: string, snapshot: Record<string, unknown>): string {
  const name = typeof snapshot?.companyName === "string" && snapshot.companyName ? snapshot.companyName : "bedriften";
  const year = new Date().getUTCFullYear();
  switch (contentType) {
    case "intro": return `Presenter ${name} og hva dere tilbyr.`;
    case "problem": return `Ta opp et vanlig problem kundene til ${name} kjenner seg igjen i, og pek mot losningen.`;
    case "tips": return `Del ett nyttig, konkret tips fra fagfeltet til ${name}.`;
    case "question": return `Still et engasjerende sporsmal til folgerne relatert til det ${name} driver med.`;
    case "case": return `Fortell om et dokumentert prosjekt eller en erfaring fra ${name} (kun dokumenterte fakta).`;
    case "behind_scenes": return `Gi et innblikk bak kulissene hos ${name}.`;
    case "faq": return `Svar pa et vanlig sporsmal kundene stiller ${name}.`;
    case "cta": return `Skriv en vennlig oppfordring til a ta kontakt med ${name}.`;
    case "seasonal": return `Lag et sesongaktuelt innlegg for ${name} tilpasset ${year}.`;
    case "offer": return `Presenter et tilbud fra ${name} uten a finne pa priser eller betingelser.`;
    default: return `Skriv et profesjonelt innlegg for ${name}.`;
  }
}


/**
 * Worker image step: best-effort, never throws. Skips when image quota is
 * exhausted (text stays), otherwise generates + structurally verifies one image.
 * The slot is owned by the post's own generation id.
 */
async function generateImageForPost(plan: ClaimedPlan, post: ClaimedPost, content?: string): Promise<PostImageOutcome> {
  try {
    const { hasImageQuota } = await import("./db");
    const ok = await hasImageQuota(post.userId);
    if (!ok) return { status: "skipped" };
    const { generateImage } = await import("./_core/imageGeneration");
    // Reuse Merkehjerne visual identity (industry mood + palette) — never text/logos (M4).
    const snap = (plan.brandSnapshot ?? {}) as { industry?: string | null; brandColors?: string[] | null };
    const { url } = await generateImage({ prompt: buildEnkelImagePrompt({ contentType: post.contentType, platform: post.platform, content, brand: { industry: snap.industry, brandColors: snap.brandColors } }) });
    if (!verifyImageUrl(url)) return { status: "failed" };
    return { status: "completed", url: url as string, generationId: post.postGenerationId };
  } catch {
    return { status: "failed" };
  }
}

/**
 * User-triggered "Bytt bilde" for one post. Synchronous, reserve-first quota,
 * slot-ownership isolation (image_generation_id): a concurrent regenerate that
 * claims the slot later makes this one's late response a no-op.
 */
export async function regeneratePostImage(input: {
  planId: number;
  postId: number;
  userId: number;
}): Promise<{ status: "completed" | "failed"; imageUrl?: string }> {
  const db = await requireDb();
  const post = await getPostForUser(input.planId, input.postId, input.userId);
  if (!post) throw new Error("NOT_FOUND");
  if (post.generationStatus !== "done") throw new Error("POST_NOT_READY");

  // Reserve image quota FIRST (atomic). Throws a friendly message when empty.
  const { enforceImageQuota } = await import("./db");
  await enforceImageQuota(input.userId);

  // Claim the image slot with a fresh generation id.
  const generationId = randomUUID();
  await db.update(plannedPosts).set({
    imageGenerationId: generationId,
    imageStatus: "generating",
    imageIdempotencyKey: randomUUID(),
  }).where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.userId, input.userId)));

  let url: string | undefined;
  try {
    const { generateImage } = await import("./_core/imageGeneration");
    const out = await generateImage({ prompt: buildEnkelImagePrompt({ contentType: post.contentType, platform: post.platform, content: post.content }) });
    url = out.url;
  } catch {
    url = undefined;
  }

  if (!verifyImageUrl(url)) {
    // Only mark failed if we still own the slot (a newer regenerate may have taken it).
    await db.update(plannedPosts).set({ imageStatus: "failed" })
      .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.imageGenerationId, generationId)));
    return { status: "failed" };
  }

  const applied = await db.update(plannedPosts).set({ imageUrl: url, imageStatus: "completed" })
    .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.imageGenerationId, generationId)));
  if (affected(applied) === 0) {
    // A newer generation claimed the slot; discard this late result (already charged).
    return { status: "completed", imageUrl: url };
  }
  // Fase 4: if this post is already saved as a draft, keep the draft's image in sync.
  if (post.savedPostId != null) {
    const { posts: postsTable } = await import("../drizzle/schema");
    await db.update(postsTable).set({ imageUrl: url, imageStatus: "completed", imageGenerationId: generationId })
      .where(and(eq(postsTable.id, post.savedPostId), eq(postsTable.userId, input.userId)));
  }
  return { status: "completed", imageUrl: url };
}

// ── Fase 3b: godkjenning + lagring som utkast (eierskap-scoped, ingen auto-publisering) ──

/** Approve one done, non-high-risk post (owner-scoped). False if not allowed/foreign. */
export async function approvePost(planId: number, postId: number, userId: number): Promise<boolean> {
  const db = await requireDb();
  const post = await getPostForUser(planId, postId, userId);
  if (!post || !canApprove({ generationStatus: post.generationStatus, verificationStatus: post.verificationStatus })) return false;
  await db.update(plannedPosts).set({ approvalStatus: "approved" })
    .where(and(eq(plannedPosts.id, postId), eq(plannedPosts.userId, userId)));
  return true;
}

/** Set a post's approval back to draft/needs_edit (owner-scoped). */
export async function setPostApproval(planId: number, postId: number, userId: number, status: "draft" | "needs_edit"): Promise<boolean> {
  const db = await requireDb();
  const post = await getPostForUser(planId, postId, userId);
  if (!post) return false;
  await db.update(plannedPosts).set({ approvalStatus: status })
    .where(and(eq(plannedPosts.id, postId), eq(plannedPosts.userId, userId)));
  return true;
}

/** Edit a post's text (owner-scoped); editing resets approval to draft. */
export async function editPostContent(planId: number, postId: number, userId: number, content: string): Promise<boolean> {
  const db = await requireDb();
  const post = await getPostForUser(planId, postId, userId);
  if (!post) return false;

  // PR #83: re-grade the edited text, immediately.
  //
  // The UI tells the user "fjern påstanden … da forsvinner flagget av seg selv".
  // That was false: `verifiedAt` still looked fresh, so the re-check on open
  // skipped the row and the post stayed high_risk — permanently unapprovable,
  // still quoting a sentence the user had already deleted. The mirror case was
  // worse: adding a fabricated claim to a `verified` post kept it verified and
  // bulk-approvable.
  //
  // Verified against the LIVE Merkehjerne, not the plan's frozen snapshot, so the
  // other advertised fix — add the story as a fact — works too.
  const { stripMarkdown, verifyPostContent } = await import("./services/verification/contentVerification");
  const clean = stripMarkdown(content);

  let verificationStatus = post.verificationStatus;
  let verificationIssues: Array<{ code: string; message: string; evidence?: string }> = [];
  try {
    const { brandFactsForUser } = await import("./services/verification/reverify");
    const siblings = await db
      .select({ id: plannedPosts.id, content: plannedPosts.content })
      .from(plannedPosts)
      .where(and(eq(plannedPosts.contentPlanId, planId), ne(plannedPosts.id, postId)));
    const verdict = verifyPostContent({
      content: clean,
      brand: (await brandFactsForUser(userId)) ?? (post as { brandSnapshot?: never }) as never,
      publishAt: post.suggestedDate ? new Date(post.suggestedDate) : null,
      siblingContents: siblings.map((r) => r.content ?? "").filter(Boolean),
    });
    verificationStatus = verdict.status;
    verificationIssues = verdict.issues.slice(0, 20).map((i) => ({
      code: i.code,
      message: i.message.slice(0, 300),
      ...(i.evidence ? { evidence: i.evidence.slice(0, 200) } : {}),
    }));
  } catch (e) {
    console.warn(`[plan ${planId}] post ${postId} not re-graded on edit:`, (e as Error)?.message);
  }

  await db.update(plannedPosts).set({
    content: clean,
    approvalStatus: "draft",
    verificationStatus,
    verificationIssues,
    verifiedAt: new Date(),
  }).where(and(eq(plannedPosts.id, postId), eq(plannedPosts.userId, userId)));

  // PR #84: if this post has already been saved as a draft, keep that copy in
  // sync. Otherwise editing after pressing Planlegg silently diverged: the plan
  // row held the fix, the saved post still held the text the user was fixing, and
  // that older text is what publishing would have sent.
  if (post.savedPostId != null) {
    const { posts: postsTable } = await import("../drizzle/schema");
    await db.update(postsTable)
      .set({
        generatedContent: clean,
        verificationStatus,
        verificationIssues,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(postsTable.id, post.savedPostId),
        eq(postsTable.userId, userId),
        // Never rewrite something already out in the world.
        eq(postsTable.status, "draft"),
      ));
  }
  return true;
}

/** Remove one post from the plan (owner-scoped hard delete of the planned row). */
export async function removePlannedPost(planId: number, postId: number, userId: number): Promise<boolean> {
  const db = await requireDb();
  const post = await getPostForUser(planId, postId, userId);
  if (!post) return false;
  const suggested = post.suggestedDate instanceof Date ? post.suggestedDate : new Date(String(post.suggestedDate));
  await db.transaction(async (tx) => {
    await tx.delete(plannedPosts).where(and(eq(plannedPosts.id, postId), eq(plannedPosts.userId, userId)));
    await tx.insert(plannedPosts).values({
      contentPlanId: planId,
      userId: post.userId,
      workspaceId: post.workspaceId,
      postGenerationId: randomUUID(),
      weekNumber: post.weekNumber,
      suggestedDate: suggested,
      platform: post.platform,
      contentType: post.contentType,
      reason: post.reason,
      generationStatus: "pending",
    });
    await tx.update(contentPlans).set({ status: "queued" })
      .where(and(eq(contentPlans.id, planId), eq(contentPlans.userId, userId)));
  });
  return true;
}

/** Approve every done, non-high-risk post in the plan. Returns count approved. */
export async function approveAllDone(planId: number, userId: number): Promise<number> {
  const db = await requireDb();
  const result = await getPlanForUser(planId, userId, userId);
  if (!result) return 0;
  let n = 0;
  for (const post of result.posts) {
    if (post.approvalStatus === "approved") continue;
    if (!canBulkApprove({ generationStatus: post.generationStatus, verificationStatus: post.verificationStatus })) continue;
    await db.update(plannedPosts).set({ approvalStatus: "approved" })
      .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.userId, userId)));
    n++;
  }
  return n;
}

/**
 * Copy every approved-and-not-yet-saved post into `posts` as a DRAFT (Mine
 * innlegg). Idempotent via saved_post_id: an already-saved post is skipped, and
 * a lost claim deletes the just-inserted draft so a double click never
 * duplicates. Nothing is scheduled or published (scheduledFor stays null).
 */
export async function saveApprovedAsDrafts(
  planId: number,
  userId: number,
): Promise<{ saved: number; skipped: number }> {
  const db = await requireDb();
  const result = await getPlanForUser(planId, userId, userId);
  if (!result) return { saved: 0, skipped: 0 };
  const { posts: postsTable } = await import("../drizzle/schema");
  let saved = 0;
  // PR #83: report what was held back. Skipping in silence meant "4 lagret" with
  // no hint of which fifth post was refused or why, and it was retried and
  // skipped again on every click.
  let skipped = 0;
  for (const post of result.posts) {
    if (post.approvalStatus !== "approved" || post.savedPostId != null || post.generationStatus !== "done") continue;
    // PR #83: a high-risk post must not escape into "Mine innlegg", where nothing
    // remembers why it was flagged. getPlanForUser above has just re-checked it,
    // so this reflects the CURRENT rules — an approval given before the rules
    // tightened does not carry the post through.
    if (post.verificationStatus === "high_risk") { skipped++; continue; }
    const draft = plannedPostToDraft({
      userId: post.userId, brandId: post.brandId, platform: post.platform, content: post.content,
      reason: post.reason, imageUrl: post.imageUrl, imageStatus: post.imageStatus,
      imageGenerationId: post.imageGenerationId, postGenerationId: post.postGenerationId,
    });
    // The verdict travels WITH the post. Without this a flagged claim became
    // publishable simply by changing table.
    const res = await db.insert(postsTable).values({
      ...draft,
      verificationStatus: post.verificationStatus,
      verificationIssues: post.verificationIssues ?? [],
      verifiedAt: post.verifiedAt ?? new Date(),
    } as typeof draft);
    const newId = (res as unknown as { insertId?: number })?.insertId ??
      (res as unknown as Array<{ insertId?: number }>)?.[0]?.insertId ?? 0;
    const upd = await db.update(plannedPosts).set({ savedPostId: newId })
      .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.userId, userId), isNull(plannedPosts.savedPostId)));
    if (affected(upd) > 0) saved++;
    else if (newId) await db.delete(postsTable).where(eq(postsTable.id, newId)); // lost claim → drop duplicate
  }
  return { saved, skipped };
}

/**
 * Save ONE planned post as a real draft and return its id (PR #84).
 *
 * The Enkel card offers "Publiser nå" and "Planlegg", and both need a `posts` row:
 * publishing and scheduling are defined on saved posts, not on plan rows. Saving
 * the whole plan just to act on one card is the wrong granularity — the user
 * picked one post.
 *
 * Reuses the existing row when the post has already been saved, so pressing
 * Planlegg twice does not create a second draft.
 */
export async function saveOnePlannedPost(
  planId: number,
  plannedPostId: number,
  userId: number,
): Promise<{ postId: number | null; blocked: "high_risk" | "not_ready" | null }> {
  const db = await requireDb();
  const post = await getPostForUser(planId, plannedPostId, userId);
  if (!post) return { postId: null, blocked: "not_ready" };
  if (post.savedPostId != null) return { postId: post.savedPostId, blocked: null };
  if (post.generationStatus !== "done" || !post.content) return { postId: null, blocked: "not_ready" };
  // PR #83's rule, applied to the single-post path too: an undocumented claim must
  // not reach "Mine innlegg", where nothing remembers why it was flagged.
  if (post.verificationStatus === "high_risk") return { postId: null, blocked: "high_risk" };

  const { posts: postsTable } = await import("../drizzle/schema");
  const draft = plannedPostToDraft({
    userId: post.userId, brandId: post.brandId, platform: post.platform, content: post.content,
    reason: post.reason, imageUrl: post.imageUrl, imageStatus: post.imageStatus,
    imageGenerationId: post.imageGenerationId, postGenerationId: post.postGenerationId,
  });
  const [inserted] = await db.insert(postsTable).values({
    ...draft,
    verificationStatus: post.verificationStatus,
    verificationIssues: post.verificationIssues ?? [],
    verifiedAt: post.verifiedAt ?? new Date(),
  } as typeof draft).$returningId();
  const newId = inserted?.id ?? 0;
  if (!newId) return { postId: null, blocked: "not_ready" };

  // Claim the link. A lost race means someone else saved it first — use theirs and
  // drop ours, rather than leaving two drafts of the same post.
  const upd = await db.update(plannedPosts)
    .set({ savedPostId: newId, approvalStatus: "approved" })
    .where(and(
      eq(plannedPosts.id, plannedPostId),
      eq(plannedPosts.userId, userId),
      isNull(plannedPosts.savedPostId),
    ));
  if (affected(upd) > 0) return { postId: newId, blocked: null };

  await db.delete(postsTable).where(eq(postsTable.id, newId));
  const again = await getPostForUser(planId, plannedPostId, userId);
  return { postId: again?.savedPostId ?? null, blocked: null };
}

/** Real worker deps wired to planStore + generateContent (pure; persists nothing itself). */
export async function buildPlanWorkerDeps(): Promise<import("./planWorker").PlanWorkerDeps> {
  const { generateContent } = await import("./openaiService");
  return {
    now: () => new Date(),
    claimPlan,
    claimNextPost,
    heartbeat,
    generateText: async (plan, post) => {
      const snapshot = (plan.brandSnapshot ?? {}) as Record<string, unknown>;
      const params = {
        topic: topicFor(post.contentType, snapshot),
        platform: post.platform,
        tone: "professional",
        length: "medium",
        language: "no",
        brandProfile: snapshot,
      } as unknown as Parameters<typeof generateContent>[0];
      return generateContent(params);
    },
    generateImage: generateImageForPost,
    savePostSuccess,
    savePostFailure,
    finalizePlanIfDone,
    releasePlan,
    markPlanCancelled,
  };
}
