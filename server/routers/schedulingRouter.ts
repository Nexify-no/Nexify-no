/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getOptimalPostingTimes,
  getNextOptimalTime,
  getSchedulingRecommendations,
  schedulePost,
  getScheduledPosts,
  getUpcomingScheduledPosts,
  cancelScheduledPost,
  reschedulePost,
  markPostAsPublished,
  markPostAsFailed,
  updateSchedulingPreferences,
  getSchedulingStats,
  getOrCreateSchedulingPreferences,
} from "../services/schedulingService";

// General industry-benchmark optimal times (mirrors schedulingService's internal
// DEFAULT_OPTIMAL_TIMES, which is not exported). Used as the honest fallback when a
// user has no personalized engagement data yet.
const DEFAULT_OPTIMAL_TIMES: Record<
  "linkedin" | "twitter" | "instagram" | "facebook",
  { days: number[]; hours: number[] }
> = {
  linkedin: { days: [1, 2, 3, 4, 5], hours: [8, 9, 12, 17, 18] },
  twitter: { days: [1, 2, 3, 4, 5], hours: [9, 12, 17, 20] },
  instagram: { days: [0, 1, 2, 3, 4, 5, 6], hours: [8, 12, 18, 20, 21] },
  facebook: { days: [1, 2, 3, 4, 5], hours: [12, 13, 19, 20] },
};

const PLATFORMS = ["linkedin", "twitter", "instagram", "facebook"] as const;

export const schedulingRouter = router({
  /**
   * Get optimal posting times for a platform
   */
  getOptimalTimes: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const optimalTimes = await getOptimalPostingTimes(ctx.user.id, input.platform);
      return {
        success: true,
        data: optimalTimes,
      };
    }),

  /**
   * Get next optimal posting time
   */
  getNextOptimalTime: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        startDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const nextTime = await getNextOptimalTime(
        ctx.user.id,
        input.platform,
        input.startDate
      );
      return {
        success: true,
        data: nextTime,
      };
    }),

  /**
   * Get scheduling recommendations for all platforms
   */
  getRecommendations: protectedProcedure.query(async ({ ctx }) => {
    const recommendations = await getSchedulingRecommendations(ctx.user.id);
    return {
      success: true,
      data: recommendations,
    };
  }),

  /**
   * Schedule a post
   */
  schedulePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        scheduledFor: z.date(),
        timezone: z.string().optional().default("UTC"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // PR #82: refuse to schedule what cannot be published.
      //
      // Without this the post sat in the calendar looking fine until its time
      // came, then failed in the worker — where the user is not watching and the
      // only signal is a "Publisering feilet" notification hours later. The same
      // brand-ownership check as the publish paths, applied at the moment the
      // user can still do something about it.
      const { resolvePublishBrand, requireDestination } = await import("../services/publishGuard");
      const brandId = await resolvePublishBrand(ctx.user.id, input.postId);
      await requireDestination(ctx.user.id, brandId, input.platform, input.postId);

      const result = await schedulePost(
        input.postId,
        ctx.user.id,
        input.platform,
        input.scheduledFor,
        input.timezone
      );
      return {
        success: true,
        data: result,
      };
    }),

  /**
   * Get scheduled posts
   */
  getScheduledPosts: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["scheduled", "publishing", "published", "failed", "cancelled"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const posts = await getScheduledPosts(ctx.user.id, input.status);
      return {
        success: true,
        data: posts,
        count: posts.length,
      };
    }),

  /**
   * Get upcoming scheduled posts
   */
  getUpcomingPosts: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const posts = await getUpcomingScheduledPosts(ctx.user.id, input.limit);
      return {
        success: true,
        data: posts,
        count: posts.length,
      };
    }),

  /**
   * Cancel a scheduled post
   */
  cancelPost: protectedProcedure
    .input(z.object({ scheduledPostId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await cancelScheduledPost(input.scheduledPostId, ctx.user.id);
      return {
        success: true,
        message: "Post cancelled successfully",
      };
    }),

  /**
   * Reschedule a post
   */
  reschedulePost: protectedProcedure
    .input(
      z.object({
        scheduledPostId: z.number(),
        newScheduledFor: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await reschedulePost(
        input.scheduledPostId,
        ctx.user.id,
        input.newScheduledFor
      );
      return {
        success: true,
        message: "Post rescheduled successfully",
      };
    }),

  /**
   * Mark post as published
   */
  markAsPublished: protectedProcedure
    .input(z.object({ scheduledPostId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markPostAsPublished(input.scheduledPostId, ctx.user.id);
      return {
        success: true,
        message: "Post marked as published",
      };
    }),

  /**
   * Mark post as failed
   */
  markAsFailed: protectedProcedure
    .input(
      z.object({
        scheduledPostId: z.number(),
        failureReason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await markPostAsFailed(
        input.scheduledPostId,
        ctx.user.id,
        input.failureReason
      );
      return {
        success: true,
        message: "Post marked as failed",
      };
    }),

  /**
   * Update scheduling preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        timezone: z.string().optional(),
        enableAutoScheduling: z.boolean().optional(),
        enableNotifications: z.boolean().optional(),
        notificationMinutesBefore: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateSchedulingPreferences(ctx.user.id, input);
      return {
        success: true,
        message: "Preferences updated successfully",
      };
    }),

  /**
   * Get scheduling preferences
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await getOrCreateSchedulingPreferences(ctx.user.id);
    return {
      success: true,
      data: prefs,
    };
  }),

  /**
   * Get scheduling statistics
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getSchedulingStats(ctx.user.id);
    return {
      success: true,
      data: stats,
    };
  }),

  /**
   * Get dashboard overview
   */
  getDashboardOverview: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getSchedulingStats(ctx.user.id);
    const upcoming = await getUpcomingScheduledPosts(ctx.user.id, 5);
    const recommendations = await getSchedulingRecommendations(ctx.user.id);

    return {
      success: true,
      data: {
        stats,
        upcomingPosts: upcoming,
        recommendations,
      },
    };
  }),

  /**
   * Smart schedule a post (automatically find best time)
   */
  smartSchedulePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        daysAhead: z.number().min(0).max(30).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get next optimal time
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + input.daysAhead);

      const optimalTime = await getNextOptimalTime(
        ctx.user.id,
        input.platform,
        startDate
      );

      // PR #82: same gate as schedulePost — refuse to schedule what cannot be
      // published, while the user is still here to fix it.
      const { resolvePublishBrand: brandOf, requireDestination: needDest } =
        await import("../services/publishGuard");
      await needDest(ctx.user.id, await brandOf(ctx.user.id, input.postId), input.platform, input.postId);

      // Schedule the post
      const result = await schedulePost(
        input.postId,
        ctx.user.id,
        input.platform,
        optimalTime
      );

      return {
        success: true,
        data: {
          scheduledFor: optimalTime,
          result,
        },
        message: `Post scheduled for ${optimalTime.toLocaleString()}`,
      };
    }),
  /**
   * Best-times overview — the REAL "best time to post" answer per platform.
   * Returns personalized slots derived from the user's own published-post
   * engagement when available, with an honest fallback to general benchmarks.
   * JS-side aggregation only (only_full_group_by safe).
   */
  getBestTimesOverview: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const db = await getDb();
    const { postingTimesAnalytics, postAnalytics } = await import(
      "../../drizzle/schema"
    );
    const { eq, and } = await import("drizzle-orm");

    type Slot = { dayOfWeek: number; hour: number; score: number };
    type PlatformOverview = {
      source: "personalized" | "general";
      slots: Slot[];
      totalPosts: number;
      topDay: number | null;
      topHour: number | null;
      note?: string;
    };

    const overview: Record<string, PlatformOverview> = {};

    for (const platform of PLATFORMS) {
      // Default general fallback (used if no db or no data).
      const general = DEFAULT_OPTIMAL_TIMES[platform];
      const buildGeneral = (totalPosts: number): PlatformOverview => ({
        source: "general",
        slots: general.hours.map((h) => ({
          dayOfWeek: general.days[0],
          hour: h,
          score: 70,
        })),
        totalPosts,
        topDay: general.days[0] ?? null,
        topHour: general.hours[0] ?? null,
        note:
          totalPosts > 0
            ? "Venter på engasjementsdata fra plattformen."
            : undefined,
      });

      if (!db) {
        overview[platform] = buildGeneral(0);
        continue;
      }

      // Personalized aggregated rows.
      let ptaRows: any[] = [];
      try {
        ptaRows = await db
          .select()
          .from(postingTimesAnalytics)
          .where(
            and(
              eq(postingTimesAnalytics.userId, ctx.user.id),
              eq(postingTimesAnalytics.platform, platform)
            )
          );
      } catch {
        ptaRows = [];
      }

      // Count of raw published-post rows for this platform (may be 0).
      let postCount = 0;
      try {
        const raw = await db
          .select({ id: postAnalytics.id })
          .from(postAnalytics)
          .where(
            and(
              eq(postAnalytics.userId, ctx.user.id),
              eq(postAnalytics.platform, platform)
            )
          );
        postCount = raw.length;
      } catch {
        postCount = 0;
      }

      // Aggregate signal in JS.
      let totalGroupPosts = 0;
      let totalEngagementSignal = 0;
      for (const r of ptaRows) {
        const avgEng = Number(r.avgEngagement ?? 0);
        const tp = Number(r.totalPosts ?? 0);
        totalGroupPosts += tp;
        totalEngagementSignal += avgEng * tp;
      }

      if (ptaRows.length > 0 && totalEngagementSignal > 0) {
        // Personalized.
        const sorted = [...ptaRows].sort(
          (a, b) => Number(b.avgEngagement) - Number(a.avgEngagement)
        );
        const best = Number(sorted[0].avgEngagement) || 1;
        const slots: Slot[] = sorted.slice(0, 6).map((r) => {
          const ratio = best > 0 ? Number(r.avgEngagement) / best : 0;
          const score = Math.max(40, Math.round(ratio * 100));
          return { dayOfWeek: r.dayOfWeek, hour: r.hourOfDay, score };
        });

        // topDay = mode of dayOfWeek weighted by engagement.
        const dayWeight = new Map<number, number>();
        const hourWeight = new Map<number, number>();
        for (const r of ptaRows) {
          const w = Number(r.avgEngagement ?? 0) * Number(r.totalPosts ?? 0);
          dayWeight.set(r.dayOfWeek, (dayWeight.get(r.dayOfWeek) ?? 0) + w);
          hourWeight.set(r.hourOfDay, (hourWeight.get(r.hourOfDay) ?? 0) + w);
        }
        const pickMode = (m: Map<number, number>): number | null => {
          let bestKey: number | null = null;
          let bestVal = -1;
          for (const [k, v] of m.entries()) {
            if (v > bestVal) {
              bestVal = v;
              bestKey = k;
            }
          }
          return bestKey;
        };

        overview[platform] = {
          source: "personalized",
          slots,
          totalPosts: totalGroupPosts,
          topDay: pickMode(dayWeight),
          topHour: pickMode(hourWeight),
        };
      } else {
        overview[platform] = buildGeneral(postCount);
      }
    }

    return overview;
  }),

  /**
   * Refresh the signed-in user's engagement metrics on demand, then re-aggregate
   * their personalized best-times. Returns how many rows were refreshed.
   */
  refreshMyMetrics: protectedProcedure.mutation(async ({ ctx }) => {
    const { fetchAndStoreMetrics, aggregatePostingTimes } = await import(
      "../services/engagementMetricsService"
    );
    const { updated } = await fetchAndStoreMetrics(ctx.user.id);
    await aggregatePostingTimes(ctx.user.id);
    return { success: true, updated };
  }),
});