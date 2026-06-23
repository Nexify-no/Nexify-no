/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getPostAnalytics,
  getPlatformStats,
  getTopPosts,
  getWeeklySummary,
  getMonthlySummary,
  getTrendingContent,
  getAnalyticsByDateRange,
} from "../services/analyticsService";

export const analyticsRouter = router({
  /**
   * Get analytics for a specific post
   */
  getPostAnalytics: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const analytics = await getPostAnalytics(input.postId, ctx.user.id);
      return {
        success: true,
        data: analytics,
      };
    }),

  /**
   * Get analytics for a date range
   */
  getAnalyticsByDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const analytics = await getAnalyticsByDateRange(
        ctx.user.id,
        input.startDate,
        input.endDate,
        input.platform
      );
      return {
        success: true,
        data: analytics,
        count: analytics.length,
      };
    }),

  /**
   * Get platform comparison stats
   */
  getPlatformStats: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const stats = await getPlatformStats(
        ctx.user.id,
        input.startDate,
        input.endDate
      );
      return {
        success: true,
        data: stats,
        count: stats.length,
      };
    }),

  /**
   * Get top performing posts
   */
  getTopPosts: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().min(1).max(50).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const posts = await getTopPosts(
        ctx.user.id,
        input.startDate,
        input.endDate,
        input.limit
      );
      return {
        success: true,
        data: posts,
        count: posts.length,
      };
    }),

  /**
   * Get weekly summary
   */
  getWeeklySummary: protectedProcedure
    .input(z.object({ weekStartDate: z.date() }))
    .query(async ({ ctx, input }) => {
      const summary = await getWeeklySummary(ctx.user.id, input.weekStartDate);
      return {
        success: true,
        data: summary,
      };
    }),

  /**
   * Get monthly summary
   */
  getMonthlySummary: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })) // YYYY-MM format
    .query(async ({ ctx, input }) => {
      const summary = await getMonthlySummary(ctx.user.id, input.month);
      return {
        success: true,
        data: summary,
      };
    }),

  /**
   * Get trending content
   */
  getTrendingContent: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(7),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const content = await getTrendingContent(
        ctx.user.id,
        input.days,
        input.limit
      );
      return {
        success: true,
        data: content,
        count: content.length,
      };
    }),

  /**
   * Get analytics dashboard summary
   */
  getDashboardSummary: protectedProcedure.query(async ({ ctx }) => {
    // Get last 30 days summary
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const platformStats = await getPlatformStats(ctx.user.id, startDate, endDate);
    const topPosts = await getTopPosts(ctx.user.id, startDate, endDate, 5);
    const trendingContent = await getTrendingContent(ctx.user.id, 7, 5);

    // Calculate totals
    const totalEngagement = platformStats.reduce((sum, stat) => sum + stat.totalEngagement, 0);
    const totalImpressions = platformStats.reduce((sum, stat) => sum + stat.totalImpressions, 0);
    const avgEngagementRate = platformStats.length > 0
      ? platformStats.reduce((sum, stat) => sum + stat.avgEngagementRate, 0) / platformStats.length
      : 0;

    return {
      success: true,
      data: {
        period: {
          startDate,
          endDate,
          days: 30,
        },
        summary: {
          totalEngagement,
          totalImpressions,
          avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
          platformCount: platformStats.length,
        },
        platformStats,
        topPosts,
        trendingContent,
      },
    };
  }),

  /**
   * Get analytics for a specific platform
   */
  getPlatformAnalytics: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const analytics = await getAnalyticsByDateRange(
        ctx.user.id,
        input.startDate,
        input.endDate,
        input.platform
      );

      // Calculate platform-specific stats
      const totalEngagement = analytics.reduce((sum, a) => sum + (a.engagement || 0), 0);
      const totalImpressions = analytics.reduce((sum, a) => sum + (a.impressions || 0), 0);
      const avgEngagementRate = totalImpressions > 0
        ? (totalEngagement / totalImpressions) * 100
        : 0;

      return {
        success: true,
        data: {
          platform: input.platform,
          period: {
            startDate: input.startDate,
            endDate: input.endDate,
          },
          stats: {
            totalPosts: analytics.length,
            totalEngagement,
            totalImpressions,
            avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
          },
          posts: analytics,
        },
      };
    }),

  /**
   * Get analytics comparison between two date ranges
   */
  getComparison: protectedProcedure
    .input(
      z.object({
        period1Start: z.date(),
        period1End: z.date(),
        period2Start: z.date(),
        period2End: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const period1Stats = await getPlatformStats(
        ctx.user.id,
        input.period1Start,
        input.period1End
      );
      const period2Stats = await getPlatformStats(
        ctx.user.id,
        input.period2Start,
        input.period2End
      );

      // Calculate totals for each period
      const period1Total = {
        engagement: period1Stats.reduce((sum, s) => sum + s.totalEngagement, 0),
        impressions: period1Stats.reduce((sum, s) => sum + s.totalImpressions, 0),
      };

      const period2Total = {
        engagement: period2Stats.reduce((sum, s) => sum + s.totalEngagement, 0),
        impressions: period2Stats.reduce((sum, s) => sum + s.totalImpressions, 0),
      };

      // Calculate growth
      const engagementGrowth = period1Total.engagement > 0
        ? ((period2Total.engagement - period1Total.engagement) / period1Total.engagement) * 100
        : 0;

      const impressionsGrowth = period1Total.impressions > 0
        ? ((period2Total.impressions - period1Total.impressions) / period1Total.impressions) * 100
        : 0;

      return {
        success: true,
        data: {
          period1: {
            startDate: input.period1Start,
            endDate: input.period1End,
            stats: period1Stats,
            totals: period1Total,
          },
          period2: {
            startDate: input.period2Start,
            endDate: input.period2End,
            stats: period2Stats,
            totals: period2Total,
          },
          growth: {
            engagementGrowth: parseFloat(engagementGrowth.toFixed(2)),
            impressionsGrowth: parseFloat(impressionsGrowth.toFixed(2)),
          },
        },
      };
    }),
});