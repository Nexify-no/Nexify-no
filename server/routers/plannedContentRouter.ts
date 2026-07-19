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
import { eq } from "drizzle-orm";
import { z } from "zod";
import { brandProfiles } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { aiProcedure, protectedProcedure, router } from "../_core/trpc";
import { buildPlanSkeleton, totalPosts, type PlanGoal } from "../planContent";
import { getDb } from "../db";
import { createPlanWithPosts, getPlanForUser, listPlansForUser } from "../planStore";

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
  preview: protectedProcedure
    .input(z.object({ goal: goalSchema, platform: platformSchema, postsPerWeek: perWeekSchema }))
    .query(({ input }) => {
      const posts = totalPosts(input.postsPerWeek);
      return { weeks: 4, posts, images: 0, contentQuotaNeeded: posts, imageQuotaNeeded: 0 };
    }),

  create: aiProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    requireFlag();
    const userId = ctx.user.id;
    const workspaceId = ctx.user.id; // workspace == user until multi-workspace lands

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Databasen er ikke tilgjengelig." });
    const [brand] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, userId)).limit(1);
    if (!brand || brand.status !== "ready") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Bygg Merkehjernen din først — planen lages fra bedriftens profil." });
    }

    const profileVersion = brand.updatedAt ? Math.floor(new Date(brand.updatedAt).getTime() / 1000) : 0;
    const hasCases = Array.isArray(brand.facts) && (brand.facts as unknown[]).length > 0;
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
});
