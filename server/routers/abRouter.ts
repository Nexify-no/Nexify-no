/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * A/B Content Testing router (NEW `ab` namespace).
 *
 * Real click-tracking experiment engine — distinct from the legacy manual
 * `abtest` router. All procedures are ownership-checked against ctx.user.id.
 */

import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// --- tiny in-memory stats cache (~10s) for the `get` hot path ---
type CacheEntry = { at: number; data: unknown };
const STATS_CACHE_TTL_MS = 10_000;
const statsCache = new Map<number, CacheEntry>();

const variantInputSchema = z.object({
  label: z.string().max(40).optional(),
  body: z.string().min(1).max(20000),
  imageUrl: z.string().url().max(1000).optional().or(z.literal("")),
});

/** Load an experiment and assert the caller owns it. */
async function loadOwnedExperiment(experimentId: number, userId: number) {
  const { getDb } = await import("../db");
  const { abExperiments } = await import("../../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [exp] = await db
    .select()
    .from(abExperiments)
    .where(and(eq(abExperiments.id, experimentId), eq(abExperiments.userId, userId)))
    .limit(1);

  if (!exp) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Eksperiment ikke funnet" });
  }
  return { db, exp };
}

export const abRouter = router({
  /** Generate 3 AI variants from a topic/body. */
  generateVariants: protectedProcedure
    .input(
      z.object({
        topic: z.string().max(5000).optional(),
        body: z.string().max(20000).optional(),
        platform: z.string().min(1).max(20),
        tone: z.string().max(40).optional(),
        controls: z.array(z.string().max(40)).max(10).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!input.topic && !input.body) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Oppgi tema eller innhold" });
      }
      const { generateVariants } = await import("../services/abService");
      const variants = await generateVariants(input);
      return { variants };
    }),

  /** Create + START an experiment with its variants. */
  create: protectedProcedure
    .input(
      z.object({
        postId: z.number().int().positive().optional(),
        platform: z.string().min(1).max(20),
        destinationUrl: z.string().url().max(1000),
        durationHours: z.number().int().min(1).max(720),
        goal: z.string().min(1).max(20).default("clicks"),
        variants: z.array(variantInputSchema).min(2).max(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { abExperiments, abVariants, abStats } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { genTrackingCode } = await import("../services/abService");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + input.durationHours * 60 * 60 * 1000);

      const insertExp: any = await db.insert(abExperiments).values({
        userId: ctx.user.id,
        postId: input.postId ?? null,
        platform: input.platform,
        goal: input.goal,
        status: "running",
        destinationUrl: input.destinationUrl,
        startedAt,
        endsAt,
      });
      const experimentId = Number(insertExp?.[0]?.insertId ?? insertExp?.insertId);
      if (!experimentId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kunne ikke opprette eksperiment" });
      }

      const allocation = Math.floor(100 / input.variants.length);
      for (let i = 0; i < input.variants.length; i++) {
        const v = input.variants[i];
        // Generate a unique tracking code (retry on rare collision).
        let trackingCode = genTrackingCode();
        for (let attempt = 0; attempt < 5; attempt++) {
          const existing = await db
            .select({ id: abVariants.id })
            .from(abVariants)
            .where(eq(abVariants.trackingCode, trackingCode))
            .limit(1);
          if (existing.length === 0) break;
          trackingCode = genTrackingCode();
        }

        const insertVar: any = await db.insert(abVariants).values({
          experimentId,
          label: v.label ?? null,
          body: v.body,
          imageUrl: v.imageUrl || null,
          trackingCode,
          destinationUrl: input.destinationUrl,
          allocationPercent: allocation,
        });
        const variantId = Number(insertVar?.[0]?.insertId ?? insertVar?.insertId);
        if (variantId) {
          await db.insert(abStats).values({ variantId });
        }
      }

      return { id: experimentId };
    }),

  /** List the caller's experiments with light summary stats. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { abExperiments, abVariants, abStats } = await import("../../drizzle/schema");
    const { eq, desc, inArray } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const experiments = await db
      .select()
      .from(abExperiments)
      .where(eq(abExperiments.userId, ctx.user.id))
      .orderBy(desc(abExperiments.createdAt));

    if (experiments.length === 0) return [];

    const expIds = experiments.map((e) => e.id);
    const variants = await db
      .select()
      .from(abVariants)
      .where(inArray(abVariants.experimentId, expIds));

    const variantIds = variants.map((v) => v.id);
    const { liveCountsByVariant } = await import("../services/abService");
    const live = await liveCountsByVariant(variantIds);

    return experiments.map((e) => {
      const vs = variants.filter((v) => v.experimentId === e.id);
      const totalClicks = vs.reduce(
        (sum, v) => sum + (live.get(v.id)?.clicks ?? 0),
        0
      );
      return {
        ...e,
        variantCount: vs.length,
        totalClicks,
      };
    });
  }),

  /** Full experiment detail: variants, live stats, and an hourly click timeline. */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const cached = statsCache.get(input.id);
      if (cached && Date.now() - cached.at < STATS_CACHE_TTL_MS) {
        // Still verify ownership even on a cache hit.
        await loadOwnedExperiment(input.id, ctx.user.id);
        return cached.data;
      }

      const { exp, db } = await loadOwnedExperiment(input.id, ctx.user.id);
      const { abVariants, abStats, abClickEvents } = await import("../../drizzle/schema");
      const { eq, inArray, sql } = await import("drizzle-orm");

      const variants = await db
        .select()
        .from(abVariants)
        .where(eq(abVariants.experimentId, exp.id));
      const variantIds = variants.map((v) => v.id);

      let baseStats: any[] = [];
      try {
        baseStats =
          variantIds.length > 0
            ? await db.select().from(abStats).where(inArray(abStats.variantId, variantIds))
            : [];
      } catch (e) {
        console.error("[ab.get] stats query failed:", e);
      }
      // Live click counts so the dashboard updates in real time (ab_stats is only
      // rolled up on end/cron). Keep confidence from the stored stats.
      const { liveCountsByVariant } = await import("../services/abService");
      let live = new Map<number, { clicks: number; uniqueClicks: number }>();
      try {
        live = await liveCountsByVariant(variantIds);
      } catch (e) {
        console.error("[ab.get] live counts failed:", e);
      }
      const baseByVariant = new Map(baseStats.map((s: any) => [s.variantId, s]));
      const totalLive = variantIds.reduce((sum, vid) => sum + (live.get(vid)?.clicks ?? 0), 0);
      const stats = variantIds.map((vid) => {
        const b: any = baseByVariant.get(vid) || {};
        const lc = live.get(vid) || { clicks: 0, uniqueClicks: 0 };
        return {
          variantId: vid,
          clicks: lc.clicks,
          uniqueClicks: lc.uniqueClicks,
          ctr: b.ctr ?? 0,
          confidence: b.confidence ?? 0,
          winnerProbability: totalLive > 0 ? Math.round((lc.clicks / totalLive) * 100) / 100 : (b.winnerProbability ?? 0),
        };
      });

      // Hourly click timeline across all variants of this experiment.
      let timeline: Array<{ hour: string; clicks: number }> = [];
      try {
      if (variantIds.length > 0) {
        // Use ONE shared expression in both SELECT and GROUP BY so the rendered
        // SQL is byte-identical — required by TiDB's only_full_group_by mode.
        const hourExpr = sql<string>`date_format(${abClickEvents.ts}, '%Y-%m-%d %H:00')`;
        const rows: any = await db
          .select({
            hour: hourExpr,
            clicks: sql<number>`count(*)`,
          })
          .from(abClickEvents)
          .where(inArray(abClickEvents.variantId, variantIds))
          .groupBy(hourExpr);
        timeline = (rows ?? []).map((r: any) => ({
          hour: String(r.hour),
          clicks: Number(r.clicks ?? 0),
        }));
      }
      } catch (e) {
        console.error("[ab.get] timeline query failed:", e);
      }

      const result = { experiment: exp, variants, stats, timeline };
      statsCache.set(input.id, { at: Date.now(), data: result });
      return result;
    }),

  /** End an experiment: recompute stats, pick a winner, mark completed. */
  end: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, exp } = await loadOwnedExperiment(input.id, ctx.user.id);
      const { abExperiments } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { recomputeAndScore } = await import("../services/abService");

      const winner = await recomputeAndScore(exp.id);

      await db
        .update(abExperiments)
        .set({ status: "completed", winnerVariantId: winner.winnerVariantId ?? null })
        .where(eq(abExperiments.id, exp.id));

      statsCache.delete(input.id);
      return { winnerVariantId: winner.winnerVariantId, reason: winner.reason };
    }),

  /** Pause a running experiment. */
  pause: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, exp } = await loadOwnedExperiment(input.id, ctx.user.id);
      const { abExperiments } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      if (exp.status !== "running") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bare aktive tester kan pauses" });
      }
      await db.update(abExperiments).set({ status: "paused" }).where(eq(abExperiments.id, exp.id));
      statsCache.delete(input.id);
      return { success: true };
    }),

  /** Resume a paused experiment. */
  resume: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, exp } = await loadOwnedExperiment(input.id, ctx.user.id);
      const { abExperiments } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      if (exp.status !== "paused") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bare pausede tester kan gjenopptas" });
      }
      await db.update(abExperiments).set({ status: "running" }).where(eq(abExperiments.id, exp.id));
      statsCache.delete(input.id);
      return { success: true };
    }),

  /** Duplicate an experiment as a fresh draft with new tracking codes. */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, exp } = await loadOwnedExperiment(input.id, ctx.user.id);
      const { abExperiments, abVariants, abStats } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { genTrackingCode } = await import("../services/abService");

      const srcVariants = await db
        .select()
        .from(abVariants)
        .where(eq(abVariants.experimentId, exp.id));

      const insertExp: any = await db.insert(abExperiments).values({
        userId: ctx.user.id,
        postId: exp.postId ?? null,
        platform: exp.platform,
        goal: exp.goal,
        status: "draft",
        destinationUrl: exp.destinationUrl ?? null,
      });
      const newId = Number(insertExp?.[0]?.insertId ?? insertExp?.insertId);
      if (!newId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kunne ikke duplisere" });
      }

      for (const v of srcVariants) {
        let trackingCode = genTrackingCode();
        for (let attempt = 0; attempt < 5; attempt++) {
          const existing = await db
            .select({ id: abVariants.id })
            .from(abVariants)
            .where(eq(abVariants.trackingCode, trackingCode))
            .limit(1);
          if (existing.length === 0) break;
          trackingCode = genTrackingCode();
        }
        const insertVar: any = await db.insert(abVariants).values({
          experimentId: newId,
          label: v.label,
          body: v.body,
          imageUrl: v.imageUrl,
          trackingCode,
          destinationUrl: v.destinationUrl,
          allocationPercent: v.allocationPercent,
        });
        const variantId = Number(insertVar?.[0]?.insertId ?? insertVar?.insertId);
        if (variantId) {
          await db.insert(abStats).values({ variantId });
        }
      }

      return { id: newId };
    }),
});
