/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
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
   * Trends ranked against the caller's Merkehjerne (Brand Brain).
   *
   * The landing page promises "trending-emner tilpasset ditt felt". Until now
   * the Generate sidebar rendered the raw national feed, so a B2B account was
   * offered "kryssermissil", "tordenvær" and "concacaf" as post ideas — the
   * product visibly contradicting its own sales promise on first use.
   *
   * `personalized: false` means we could not personalise (no Merkehjerne yet,
   * or nothing in today's feed matched) and the caller is looking at the
   * generic list. The UI MUST surface that difference rather than implying a
   * match that isn't there — an honest "generic" label costs far less trust
   * than a false "tailored for you".
   *
   * Ranking is lexical and deterministic (see services/trendRelevance.ts) — no
   * LLM call, because this runs on every Generate page load.
   */
  getRelevantTrends: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(20).default(8),
          force: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 8;

      const { getAggregatedTrends } = await import("../services/trendSources");
      const { rankTrendsForBrand } = await import("../services/trendRelevance");

      const result = await getAggregatedTrends(input?.force ?? false);

      // Brand context is a ranking hint, not a hard dependency: if the profile
      // lookup fails we still want to show trends, just unpersonalised.
      let brand = null;
      try {
        const { getDb } = await import("../db");
        const { brandProfiles } = await import("../../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        const { getActiveBrandIdIfEnabled } = await import("../services/brands");

        const db = await getDb();
        if (db) {
          const brandId = await getActiveBrandIdIfEnabled(ctx.user.id);
          const where =
            brandId == null
              ? eq(brandProfiles.userId, ctx.user.id)
              : and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.brandId, brandId));
          const [profile] = await db
            .select({
              industry: brandProfiles.industry,
              companyName: brandProfiles.companyName,
              summary: brandProfiles.summary,
              offers: brandProfiles.offers,
              audiences: brandProfiles.audiences,
              customerProblems: brandProfiles.customerProblems,
              differentiators: brandProfiles.differentiators,
              contentPillars: brandProfiles.contentPillars,
              preferredWords: brandProfiles.preferredWords,
            })
            .from(brandProfiles)
            .where(where)
            .orderBy(brandProfiles.id)
            .limit(1);
          brand = profile ?? null;
        }
      } catch (error) {
        console.error("[trends.getRelevantTrends] brand lookup failed:", error);
      }

      const ranked = rankTrendsForBrand(result.trends, brand, { limit });

      return {
        success: true,
        data: ranked.trends,
        personalized: ranked.personalized,
        filteredOut: ranked.filteredOut,
        /** Null when unpersonalised — the UI uses it for "Tilpasset <bransje>". */
        industry: ranked.personalized ? (brand?.industry ?? null) : null,
        /** True when the user has no Merkehjerne yet, so the UI can prompt for it. */
        needsBrandProfile: !brand,
        sources: result.sources,
        count: ranked.trends.length,
        updatedAt: result.updatedAt,
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