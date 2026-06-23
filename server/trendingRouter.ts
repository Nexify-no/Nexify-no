/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getTrendingKeywords,
  getTrendsByCategory,
  getTrendHistory,
  clearCache,
  getCacheStatus,
} from "./services/googleTrends";

/**
 * Trending Router
 * Handles all trending keywords and Google Trends related procedures
 */
export const trendingRouter = router({
  /**
   * Get current trending keywords
   * Uses caching with 1-hour expiry
   */
  getTrendingKeywords: publicProcedure
    .input(
      z
        .object({
          region: z.string().default("NO"),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const region = input?.region || "NO";
      const trends = await getTrendingKeywords(region);
      return {
        success: true,
        trends,
        count: trends.length,
        cachedAt: new Date(),
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
        trends,
        count: trends.length,
      };
    }),

  /**
   * Get trend history (last 7 days)
   */
  getTrendHistory: publicProcedure.query(async () => {
    const trends = await getTrendHistory();
    return {
      success: true,
      trends,
      count: trends.length,
    };
  }),

  /**
   * Get cache status
   * Useful for debugging and monitoring
   */
  getCacheStatus: publicProcedure.query(async () => {
    const status = getCacheStatus();
    return {
      success: true,
      ...status,
    };
  }),

  /**
   * Manually clear cache
   * Useful for forcing a refresh
   */
  clearCache: publicProcedure.mutation(async () => {
    clearCache();
    return {
      success: true,
      message: "Cache cleared successfully",
    };
  }),

  /**
   * Get trending keywords with suggestions for content generation
   * Returns trends with AI-suggested content angles
   */
  getTrendingWithSuggestions: publicProcedure
    .input(
      z
        .object({
          region: z.string().default("NO"),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const region = input?.region || "NO";
      const trends = await getTrendingKeywords(region);

      // Add content suggestions for each trend
      const trendsWithSuggestions = trends.map((trend) => ({
        ...trend,
        contentSuggestions: {
          angles: [
            `How ${trend.title} is changing the industry`,
            `5 ways to leverage ${trend.title}`,
            `The future of ${trend.title}`,
            `Common misconceptions about ${trend.title}`,
          ],
          platforms: trend.suggestedPlatforms,
          contentTypes: ["article", "thread", "video", "infographic"],
        },
      }));

      return {
        success: true,
        trends: trendsWithSuggestions,
        count: trendsWithSuggestions.length,
      };
    }),

  /**
   * Get trending keywords for a specific platform
   */
  getTrendingForPlatform: publicProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        region: z.string().default("NO"),
      })
    )
    .query(async ({ input }) => {
      const allTrends = await getTrendingKeywords(input.region);

      // Filter trends suitable for the platform
      const platformTrends = allTrends.filter((trend) =>
        trend.suggestedPlatforms.includes(input.platform)
      );

      return {
        success: true,
        platform: input.platform,
        trends: platformTrends,
        count: platformTrends.length,
      };
    }),

  /**
   * Get trending keywords sorted by engagement potential
   */
  getTrendingByEngagement: publicProcedure
    .input(
      z
        .object({
          region: z.string().default("NO"),
          limit: z.number().min(1).max(50).default(10),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const region = input?.region || "NO";
      const limit = input?.limit || 10;
      const trends = await getTrendingKeywords(region);

      // Sort by trend score (engagement potential)
      const sorted = trends
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, limit);

      return {
        success: true,
        trends: sorted,
        count: sorted.length,
      };
    }),

  /**
   * Search for a specific keyword in trending data
   */
  searchTrending: publicProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(100),
        region: z.string().default("NO"),
      })
    )
    .query(async ({ input }) => {
      const trends = await getTrendingKeywords(input.region);

      const filtered = trends.filter(
        (trend) =>
          trend.title.toLowerCase().includes(input.keyword.toLowerCase()) ||
          trend.description?.toLowerCase().includes(input.keyword.toLowerCase())
      );

      return {
        success: true,
        keyword: input.keyword,
        trends: filtered,
        count: filtered.length,
      };
    }),
});