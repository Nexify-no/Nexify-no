/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Enkel 4-week content plans (Fase 1b, behind FEATURE_ENKEL_PLAN — off in prod).
 * user_id/workspace_id ALWAYS come from the session (ctx), never from input.
 * A foreign planId returns NOT_FOUND (no enumeration). create() is idempotent
 * on (workspace, idempotencyKey) and snapshots Merkehjerne at creation time.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { brandProfiles } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { aiProcedure, protectedProcedure, router } from "../_core/trpc";
import { buildPlanSkeleton, totalPosts, type PlanGoal } from "../planContent";
import { getDb } from "../db";
import { createPlanWithPosts, getPlanForUser, listPlansForUser, regeneratePostImage, approvePost, setPostApproval, editPostContent, removePlannedPost, approveAllDone, saveApprovedAsDrafts } from "../planStore";

const goalSchema = z.enum(["customers", "trust", "showcase", "engagement", "offer", "mixed"]);
const platformSchema = z.enum(["linkedin", "facebook", "instagram"]);
const perWeekSchema = z.union([z.literal(2), z.literal(3), z.literal(5)]);

const createInput = z.object({
  goal: goalSchema,
  platform: platformSchema, // MVP: exactly one platform per plan
  postsPerWeek: perWeekSchema,
  idempotencyKey: z.string().min(8).max(120),
  timeZone: z.string().min(1).max(64).optional(),
});

function requireFlag() {
  if (!ENV.featureEnkelPlan) {
    throw new TRPCError({ code: "FORBIDDEN", message: "FEATURE_DISABLED" });
  }
}

export const plannedContentRouter = router({
  /** Klient-flagg: om Enkel-plan er slatt pa (av i prod til Fase 3 + E2E). */
  flags: protectedProcedure.query(() => ({ enabled: ENV.featureEnkelPlan })),

  preview: protectedProcedure
    .input(z.object({ goal: goalSchema, platform: platformSchema, postsPerWeek: perWeekSchema }))
    .query(async ({ ctx, input }) => {
      const posts = totalPosts(input.postsPerWeek);
      // MB3: show the user WHICH brand this plan is for and what it costs of the
      // remaining monthly quota before anything is generated.
      let brandName = "";
      let postsRemaining: number | null = null;
      let imagesRemaining: number | null = null;
      try {
        const { getDb, getUserSubscription } = await import("../db");
        const db = await getDb();
        if (db) {
          const { brandProfiles, subscriptions, subscriptionPlans, userUsageTracking } = await import("../../drizzle/schema");
          const { and, eq, gte, lte } = await import("drizzle-orm");
          const { ownedBy } = await import("../services/brandScope");
          const { getActiveBrandIdIfEnabled } = await import("../services/brands");
          const activeId = await getActiveBrandIdIfEnabled(ctx.user.id);
          // PR #79: exact (user, brand) match — no NULL fallback.
          // PR #80: oldest first — see brandContext.ts. An unordered LIMIT 1 on the
          // degraded user-only scope could return a draft brand's profile.
          const [bp] = await db.select().from(brandProfiles).where(
            ownedBy(brandProfiles.userId, brandProfiles.brandId, ctx.user.id, activeId)
          ).orderBy(brandProfiles.id).limit(1);
          brandName = bp?.companyName ?? "";

          const sub = await getUserSubscription(ctx.user.id);
          if (sub?.planId) {
            const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1);
            const now = new Date();
            const [usage] = await db.select().from(userUsageTracking).where(and(
              eq(userUsageTracking.userId, ctx.user.id),
              eq(userUsageTracking.subscriptionId, sub.id),
              gte(userUsageTracking.periodEndDate, now),
              lte(userUsageTracking.periodStartDate, now),
            )).limit(1);
            if (plan?.postsPerMonth != null) postsRemaining = Math.max(0, plan.postsPerMonth - (usage?.postsUsed ?? 0));
            if (plan?.imagesPerMonth != null) imagesRemaining = Math.max(0, plan.imagesPerMonth - (usage?.imagesUsed ?? 0));
          }
          void subscriptions;
        }
      } catch {
        /* preview must never block the wizard */
      }
      return {
        weeks: 4,
        posts,
        images: posts,
        contentQuotaNeeded: posts,
        imageQuotaNeeded: posts,
        brandName,
        postsRemaining,
        imagesRemaining,
      };
    }),

  create: aiProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    requireFlag();
    const userId = ctx.user.id;
    const workspaceId = ctx.user.id; // workspace == user until multi-workspace lands

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Databasen er ikke tilgjengelig." });
    // The plan is built from the ACTIVE brand's Merkehjerne.
    // PR #79: exact (user, brand) match — a plan for Penna must never be seeded
    // from an unowned profile that Ballong is also reading.
    const { getActiveBrandIdIfEnabled } = await import("../services/brands");
    const { ownedBy } = await import("../services/brandScope");
    const activeBrandId = await getActiveBrandIdIfEnabled(userId);
    const [brand] = await db.select().from(brandProfiles).where(
      ownedBy(brandProfiles.userId, brandProfiles.brandId, userId, activeBrandId)
    ).orderBy(brandProfiles.id).limit(1);
    if (!brand || brand.status !== "ready") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Bygg Merkehjernen din først — planen lages fra bedriftens profil." });
    }
    // PR #80 note — deliberately NOT gating on `brand.confirmedAt` here.
    //
    // "Nothing is generated before the Merkehjerne is confirmed" is enforced
    // structurally instead: a brand created by the URL journey stays `draft`
    // until confirm, `listBrands` returns only active brands, and
    // getActiveBrandId can therefore never hand a draft to any generator. That
    // covers every entry point at once.
    //
    // A `confirmedAt` check here would have been both weaker and harmful: weaker
    // because content, repurpose, coach and images read the profile through
    // loadBrandHints and would still have been ungated; harmful because
    // brand.update and brand.setFacts reset confirmedAt to null, so editing one
    // word of an existing brand's writing style would have blocked plan creation
    // for accounts that were working fine a minute earlier.

    const profileVersion = brand.updatedAt ? Math.floor(new Date(brand.updatedAt).getTime() / 1000) : 0;
    // PR #83: do not generate a Kundecase without a DOCUMENTED customer story.
    //
    // `facts.length > 0` was the old test, so any fact at all — an opening hour, a
    // service list — unlocked a "customer case" slot, and the model then invented
    // the customer. Verification would flag the result high_risk, which is the
    // right verdict but the wrong moment: the user has already paid for the
    // generation and now has an unusable post in their plan.
    const { hasDocumentedCustomerStory } = await import("../services/verification/contentVerification");
    const hasCases = hasDocumentedCustomerStory(brand as never);
    const items = buildPlanSkeleton({
      goal: input.goal as PlanGoal,
      postsPerWeek: input.postsPerWeek,
      platforms: [input.platform],
      hasCases,
      hasOffer: input.goal === "offer",
    });

    const { planId, created } = await createPlanWithPosts({
      userId,
      workspaceId,
      idempotencyKey: input.idempotencyKey,
      goal: input.goal,
      platform: input.platform,
      postsPerWeek: input.postsPerWeek,
      timeZone: input.timeZone ?? "Europe/Oslo",
      brandId: activeBrandId,
      brandSnapshot: brand, // frozen copy — the worker never reads the live profile
      companyProfileVersion: profileVersion,
      visualIdentityVersion: profileVersion,
      items,
    });
    return { planId, created, posts: items.length };
  }),

  get: protectedProcedure.input(z.object({ planId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const result = await getPlanForUser(input.planId, ctx.user.id, ctx.user.id);
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Planen finnes ikke." });
    const total = result.posts.length;
    const done = result.posts.filter((p) => p.generationStatus === "done").length;
    const failed = result.posts.filter((p) => p.generationStatus === "failed").length;
    return { ...result, progress: { total, done, failed } };
  }),

  list: protectedProcedure.query(async ({ ctx }) => listPlansForUser(ctx.user.id, ctx.user.id)),
  /** Fase 3b — godkjenn/rediger/fjern + lagre godkjente som utkast (ingen auto-publisering). */
  approve: protectedProcedure.input(z.object({ planId: z.number().int().positive(), plannedPostId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireFlag();
    const ok = await approvePost(input.planId, input.plannedPostId, ctx.user.id);
    if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Innlegget kan ikke godkjennes ennå." });
    return { ok: true };
  }),
  unapprove: protectedProcedure.input(z.object({ planId: z.number().int().positive(), plannedPostId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireFlag();
    const ok = await setPostApproval(input.planId, input.plannedPostId, ctx.user.id, "draft");
    if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Innlegget finnes ikke." });
    return { ok: true };
  }),
  editPost: protectedProcedure.input(z.object({ planId: z.number().int().positive(), plannedPostId: z.number().int().positive(), content: z.string().trim().min(1).max(6000) })).mutation(async ({ ctx, input }) => {
    requireFlag();
    const ok = await editPostContent(input.planId, input.plannedPostId, ctx.user.id, input.content);
    if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Innlegget finnes ikke." });
    return { ok: true };
  }),
  removePost: protectedProcedure.input(z.object({ planId: z.number().int().positive(), plannedPostId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireFlag();
    const ok = await removePlannedPost(input.planId, input.plannedPostId, ctx.user.id);
    if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Innlegget finnes ikke." });
    return { ok: true };
  }),
  approveAll: protectedProcedure.input(z.object({ planId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireFlag();
    return { count: await approveAllDone(input.planId, ctx.user.id) };
  }),
  saveApproved: protectedProcedure.input(z.object({ planId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireFlag();
    // PR #83: `skipped` is the count held back as high_risk, so the UI can say so
    // instead of quietly returning a smaller number.
    const { saved, skipped } = await saveApprovedAsDrafts(input.planId, ctx.user.id);
    return { count: saved, skipped };
  }),


  /** "Bytt bilde": regenerate ONE post's image. Synchronous; charges image quota. */
  regenerateImage: aiProcedure
    .input(z.object({ planId: z.number().int().positive(), plannedPostId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireFlag();
      try {
        return await regeneratePostImage({ planId: input.planId, postId: input.plannedPostId, userId: ctx.user.id });
      } catch (err) {
        const msg = (err as Error)?.message ?? "";
        if (msg === "NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Innlegget finnes ikke." });
        if (msg === "POST_NOT_READY") throw new TRPCError({ code: "BAD_REQUEST", message: "Innlegget er ikke klart ennå." });
        throw new TRPCError({ code: "FORBIDDEN", message: msg || "Kunne ikke lage nytt bilde." });
      }
    }),
});
