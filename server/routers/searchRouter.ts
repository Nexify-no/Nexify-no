/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  searchPosts,
  searchByPlatform,
  searchByStatus,
  searchByDateRange,
  getFilteredPosts,
  getTrendingSearchTerms,
  getSearchSuggestions,
  getFilterOptions,
  advancedSearch,
  getPostStatistics,
} from "../services/searchService";

export const searchRouter = router({
  /**
   * Search posts with full-text search
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        platforms: z
          .array(z.enum(["linkedin", "twitter", "instagram", "facebook"]))
          .optional(),
        statuses: z
          .array(z.enum(["draft", "scheduled", "published", "failed"]))
          .optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        sortBy: z
          .enum(["createdAt", "updatedAt", "engagement"])
          .default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await searchPosts(ctx.user.id, input);
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Search by platform
   */
  searchByPlatform: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        query: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await searchByPlatform(
        ctx.user.id,
        input.platform,
        input.query,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Search by status
   */
  searchByStatus: protectedProcedure
    .input(
      z.object({
        status: z.enum(["draft", "scheduled", "published", "failed"]),
        query: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await searchByStatus(
        ctx.user.id,
        input.status,
        input.query,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Search by date range
   */
  searchByDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        query: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await searchByDateRange(
        ctx.user.id,
        input.startDate,
        input.endDate,
        input.query,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Get filtered posts
   */
  getFiltered: protectedProcedure
    .input(
      z.object({
        platforms: z
          .array(z.enum(["linkedin", "twitter", "instagram", "facebook"]))
          .optional(),
        statuses: z
          .array(z.enum(["draft", "scheduled", "published", "failed"]))
          .optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await getFilteredPosts(
        ctx.user.id,
        input.platforms,
        input.statuses,
        input.startDate,
        input.endDate,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Get trending search terms
   */
  getTrendingTerms: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const terms = await getTrendingSearchTerms(ctx.user.id, input.limit);
      return {
        success: true,
        data: terms,
      };
    }),

  /**
   * Get search suggestions
   */
  getSuggestions: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const suggestions = await getSearchSuggestions(
        ctx.user.id,
        input.query,
        input.limit
      );
      return {
        success: true,
        data: suggestions,
      };
    }),

  /**
   * Get filter options
   */
  getFilterOptions: protectedProcedure.query(async ({ ctx }) => {
    const options = await getFilterOptions(ctx.user.id);
    return {
      success: true,
      data: options,
    };
  }),

  /**
   * Advanced search with scoring
   */
  advancedSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        platforms: z
          .array(z.enum(["linkedin", "twitter", "instagram", "facebook"]))
          .optional(),
        statuses: z
          .array(z.enum(["draft", "scheduled", "published", "failed"]))
          .optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await advancedSearch(ctx.user.id, input.query, input);
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Get post statistics for filters
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getPostStatistics(ctx.user.id);
    return {
      success: true,
      data: stats,
    };
  }),

  /**
   * Quick search by status
   */
  getDrafts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await searchByStatus(
        ctx.user.id,
        "draft",
        undefined,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Get scheduled posts
   */
  getScheduled: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await searchByStatus(
        ctx.user.id,
        "scheduled",
        undefined,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: results,
      };
    }),

  /**
   * Get published posts
   */
  getPublished: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await searchByStatus(
        ctx.user.id,
        "published",
        undefined,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: results,
      };
    }),
});