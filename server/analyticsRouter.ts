/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { postAnalytics } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

/**
 * Analytics Router - Provides content performance metrics
 */
export const analyticsRouter = router({
  /**
   * Get engagement metrics for a date range
   */
  getEngagementMetrics: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const query = db
        .select({
          platform: postAnalytics.platform,
          totalEngagement: sql<number>`SUM(${postAnalytics.engagement})`,
          totalImpressions: sql<number>`SUM(${postAnalytics.impressions})`,
          averageEngagement: sql<number>`AVG(${postAnalytics.engagement})`,
          averageImpressions: sql<number>`AVG(${postAnalytics.impressions})`,
          postCount: sql<number>`COUNT(DISTINCT ${postAnalytics.postId})`,
        })
        .from(postAnalytics)
        .where(
          and(
            eq(postAnalytics.userId, ctx.user.id),
            gte(postAnalytics.publishedAt, input.startDate),
            lte(postAnalytics.publishedAt, input.endDate),
            input.platform ? eq(postAnalytics.platform, input.platform) : undefined
          )
        )
        .groupBy(postAnalytics.platform);

      const results = await query;

      return {
        metrics: results.map((r) => ({
          platform: r.platform,
          totalEngagement: r.totalEngagement || 0,
          totalImpressions: r.totalImpressions || 0,
          averageEngagement: Math.round(r.averageEngagement || 0),
          averageImpressions: Math.round(r.averageImpressions || 0),
          postCount: r.postCount || 0,
          engagementRate: r.totalImpressions
            ? Math.round((((r.totalEngagement || 0) / (r.totalImpressions || 1)) * 100) * 100) / 100
            : 0,
        })),
      };
    }),

  /**
   * Get best posting times (heatmap data)
   */
  getBestPostingTimes: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = await db
        .select({
          dayOfWeek: postAnalytics.dayOfWeek,
          hourOfDay: postAnalytics.hourOfDay,
          engagement: sql<number>`AVG(${postAnalytics.engagement})`,
          impressions: sql<number>`AVG(${postAnalytics.impressions})`,
          postCount: sql<number>`COUNT(*)`,
        })
        .from(postAnalytics)
        .where(
          and(
            eq(postAnalytics.userId, ctx.user.id),
            gte(postAnalytics.publishedAt, input.startDate),
            lte(postAnalytics.publishedAt, input.endDate),
            input.platform ? eq(postAnalytics.platform, input.platform) : undefined
          )
        )
        .groupBy(postAnalytics.dayOfWeek, postAnalytics.hourOfDay);

      // Transform to heatmap format
      const heatmapData = results.map((r) => ({
        day: r.dayOfWeek,
        hour: r.hourOfDay,
        engagement: Math.round(r.engagement || 0),
        impressions: Math.round(r.impressions || 0),
        postCount: r.postCount || 0,
      }));

      return { heatmapData };
    }),

  /**
   * Get platform performance comparison
   */
  getPlatformPerformance: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = await db
        .select({
          platform: postAnalytics.platform,
          totalEngagement: sql<number>`SUM(${postAnalytics.engagement})`,
          totalImpressions: sql<number>`SUM(${postAnalytics.impressions})`,
          postCount: sql<number>`COUNT(DISTINCT ${postAnalytics.postId})`,
          averageEngagement: sql<number>`AVG(${postAnalytics.engagement})`,
        })
        .from(postAnalytics)
        .where(
          and(
            eq(postAnalytics.userId, ctx.user.id),
            gte(postAnalytics.publishedAt, input.startDate),
            lte(postAnalytics.publishedAt, input.endDate)
          )
        )
        .groupBy(postAnalytics.platform)
        .orderBy(desc(sql`SUM(${postAnalytics.engagement})`));

      return {
        platformData: results.map((r) => ({
          platform: r.platform,
          totalEngagement: r.totalEngagement || 0,
          totalImpressions: r.totalImpressions || 0,
          postCount: r.postCount || 0,
          averageEngagement: Math.round(r.averageEngagement || 0),
          engagementRate: r.totalImpressions
            ? Math.round((((r.totalEngagement || 0) / (r.totalImpressions || 1)) * 100) * 100) / 100
            : 0,
        })),
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
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]).optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = await db
        .select({
          postId: postAnalytics.postId,
          platform: postAnalytics.platform,
          engagement: postAnalytics.engagement,
          impressions: postAnalytics.impressions,
          publishedAt: postAnalytics.publishedAt,
          dayOfWeek: postAnalytics.dayOfWeek,
          hourOfDay: postAnalytics.hourOfDay,
        })
        .from(postAnalytics)
        .where(
          and(
            eq(postAnalytics.userId, ctx.user.id),
            gte(postAnalytics.publishedAt, input.startDate),
            lte(postAnalytics.publishedAt, input.endDate),
            input.platform ? eq(postAnalytics.platform, input.platform) : undefined
          )
        )
        .orderBy(desc(postAnalytics.engagement))
        .limit(input.limit);

      return { topPosts: results };
    }),

  /**
   * Get engagement trend over time
   */
  getEngagementTrend: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]).optional(),
        groupBy: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // For simplicity, we'll group by day
      const results = await db
        .select({
          date: sql<string>`DATE(${postAnalytics.publishedAt})`,
          engagement: sql<number>`SUM(${postAnalytics.engagement})`,
          impressions: sql<number>`SUM(${postAnalytics.impressions})`,
          postCount: sql<number>`COUNT(DISTINCT ${postAnalytics.postId})`,
        })
        .from(postAnalytics)
        .where(
          and(
            eq(postAnalytics.userId, ctx.user.id),
            gte(postAnalytics.publishedAt, input.startDate),
            lte(postAnalytics.publishedAt, input.endDate),
            input.platform ? eq(postAnalytics.platform, input.platform) : undefined
          )
        )
        .groupBy(sql`DATE(${postAnalytics.publishedAt})`)
        .orderBy(sql`DATE(${postAnalytics.publishedAt})`);

      return {
        trendData: results.map((r) => ({
          date: r.date,
          engagement: r.engagement || 0,
          impressions: r.impressions || 0,
          postCount: r.postCount || 0,
        })),
      };
    }),

  /**
   * Get analytics summary
   */
  getSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select({
          totalEngagement: sql<number>`SUM(${postAnalytics.engagement})`,
          totalImpressions: sql<number>`SUM(${postAnalytics.impressions})`,
          totalPosts: sql<number>`COUNT(DISTINCT ${postAnalytics.postId})`,
          averageEngagement: sql<number>`AVG(${postAnalytics.engagement})`,
          averageImpressions: sql<number>`AVG(${postAnalytics.impressions})`,
        })
        .from(postAnalytics)
        .where(
          and(
            eq(postAnalytics.userId, ctx.user.id),
            gte(postAnalytics.publishedAt, input.startDate),
            lte(postAnalytics.publishedAt, input.endDate)
          )
        );

      const data = result[0];

      return {
        totalEngagement: data?.totalEngagement || 0,
        totalImpressions: data?.totalImpressions || 0,
        totalPosts: data?.totalPosts || 0,
        averageEngagement: Math.round(data?.averageEngagement || 0),
        averageImpressions: Math.round(data?.averageImpressions || 0),
        engagementRate: data?.totalImpressions
          ? Math.round((((data.totalEngagement || 0) / (data.totalImpressions || 1)) * 100) * 100) / 100
          : 0,
      };
    }),
});