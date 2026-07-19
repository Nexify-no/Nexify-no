/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import {
  getTrendingKeywords,
  getTrendsByCategory,
  getTrendHistory,
  getCacheStatus,
  clearCache,
} from "../services/googleTrends";
import { z } from "zod";

export const trendsRouter = router({
  /**
   * Per-source top lists for the Trends dashboard grid, with a Norway/global
   * toggle. Server-cached 30 min per geo; each source fails soft.
   */
  getDashboard: publicProcedure
    .input(
      z.object({
        geo: z.enum(["no", "global"]).default("no"),
        force: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const { getTrendDashboard } = await import("../services/trendDashboard");
      return getTrendDashboard(input.geo, input.force ?? false);
    }),

  /**
   * Aggregated trends from multiple trusted sources (Google Trends, NRK,
   * Wikipedia), each item carrying its source and a real date.
   */
  getAggregatedTrends: publicProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const { getAggregatedTrends } = await import("../services/trendSources");
      const result = await getAggregatedTrends(input?.force ?? false);
      return {
        success: true,
        data: result.trends,
        sources: result.sources,
        count: result.trends.length,
        updatedAt: result.updatedAt,
        timestamp: new Date(),
      };
    }),

  /**
   * Get current trending keywords
   * Supports caching with 1-hour expiry
   */
  getTrendingKeywords: publicProcedure
    .input(
      z.object({
        region: z.string().default("NO").optional(),
      })
    )
    .query(async ({ input }) => {
      const trends = await getTrendingKeywords(input.region || "NO");
      return {
        success: true,
        data: trends,
        count: trends.length,
        timestamp: new Date(),
      };
    }),

  /**
   * Get trending keywords by category
   */
  getTrendsByCategory: publicProcedure
    .input(
      z.object({
        category: z.string(),
      })
    )
    .query(async ({ input }) => {
      const trends = await getTrendsByCategory(input.category);
      return {
        success: true,
        data: trends,
        count: trends.length,
        category: input.category,
      };
    }),

  /**
   * Get trend history (last 7 days)
   */
  getTrendHistory: publicProcedure.query(async () => {
    const trends = await getTrendHistory();
    return {
      success: true,
      data: trends,
      count: trends.length,
      period: "7 days",
    };
  }),

  /**
   * Get cache status information
   */
  getCacheStatus: publicProcedure.query(async () => {
    const status = getCacheStatus();
    return {
      success: true,
      ...status,
      cacheExpiryMinutes: Math.round(status.cacheExpiry / 1000 / 60),
    };
  }),

  /**
   * Manually clear cache (for testing)
   */
  clearCache: adminProcedure.mutation(async () => {
    clearCache();
    return {
      success: true,
      message: "Cache cleared successfully",
    };
  }),
});