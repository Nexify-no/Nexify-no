/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, publicProcedure } from "../_core/trpc";
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
  clearCache: publicProcedure.mutation(async () => {
    clearCache();
    return {
      success: true,
      message: "Cache cleared successfully",
    };
  }),
});