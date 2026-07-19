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
 */
import { randomUUID } from "crypto";
import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { contentPlans, plannedPosts, type ContentPlan, type PlannedPost } from "../drizzle/schema";
import { getDb } from "./db";
import { LEASE_MS, derivePlanStatus, type RetryDecision } from "./planLease";
import type { ClaimedPlan, ClaimedPost } from "./planWorker";
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
        totalImageQuota: 0,
        status: "queued",
      });
      const planId = (res as unknown as { insertId?: number })?.insertId ??
        (res as unknown as Array<{ insertId?: number }>)?.[0]?.insertId ?? 0;
      await tx.insert(plannedPosts).values(input.items.map((item) => ({
        contentPlanId: planId,
        userId: input.userId,
        workspaceId: input.workspaceId,
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
  return { plan, posts };
}

export async function listPlansForUser(userId: number, workspaceId: number) {
  const db = await requireDb();
  return db.select().from(contentPlans)
    .where(and(eq(contentPlans.userId, userId), eq(contentPlans.workspaceId, workspaceId), isNull(contentPlans.deletedAt)))
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

/** Lease-conditioned success write + idempotent quota charge (content_quota_charged). */
export async function savePostSuccess(post: ClaimedPost, content: string): Promise<boolean> {
  const db = await requireDb();
  const now = new Date();
  const res = await db.update(plannedPosts).set({
    content,
    generationStatus: "done",
    verificationStatus: "needs_review",
    lastError: null,
    leaseToken: null,
    lockedBy: null,
    lockExpiresAt: null,
  }).where(and(
    eq(plannedPosts.id, post.id),
    eq(plannedPosts.leaseToken, post.leaseToken),
    sql`${plannedPosts.lockExpiresAt} > ${now}`,
  ));
  if (affected(res) === 0) return false; // stale worker — discard

  // Idempotent quota charge: only the transition that flips the flag charges.
  const chargeRes = await db.update(plannedPosts).set({ contentQuotaCharged: true })
    .where(and(eq(plannedPosts.id, post.id), eq(plannedPosts.contentQuotaCharged, false)));
  if (affected(chargeRes) > 0) {
    const { enforcePostQuota } = await import("./db");
    try { await enforcePostQuota(post.userId); } catch {
      // Quota exhausted mid-plan: keep the text (already generated), flag stays set.
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
    savePostSuccess,
    savePostFailure,
    finalizePlanIfDone,
    releasePlan,
    markPlanCancelled,
  };
}
