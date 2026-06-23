/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, aiProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  analyzeContent,
  getEnhancementSuggestions,
  applySuggestions,
  compareVersions,
} from "../services/contentEnhancementService";

export const contentEnhancementRouter = router({
  /**
   * Analyze content and get comprehensive enhancement suggestions
   */
  analyzeContent: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        language: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      const analysis = await analyzeContent(
        input.content,
        input.platform,
        input.language
      );
      return {
        success: true,
        data: analysis,
      };
    }),

  /**
   * Get writing improvement suggestions
   */
  getWritingSuggestions: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        language: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      const suggestions = await getEnhancementSuggestions(
        input.content,
        "writing",
        input.platform,
        input.language
      );
      return {
        success: true,
        data: suggestions,
      };
    }),

  /**
   * Get hashtag optimization suggestions
   */
  getHashtagSuggestions: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        language: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      const suggestions = await getEnhancementSuggestions(
        input.content,
        "hashtags",
        input.platform,
        input.language
      );
      return {
        success: true,
        data: suggestions,
      };
    }),

  /**
   * Get CTA improvement suggestions
   */
  getCTASuggestions: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        language: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      const suggestions = await getEnhancementSuggestions(
        input.content,
        "ctas",
        input.platform,
        input.language
      );
      return {
        success: true,
        data: suggestions,
      };
    }),

  /**
   * Get tone analysis and consistency suggestions
   */
  getToneAnalysis: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        language: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      const suggestions = await getEnhancementSuggestions(
        input.content,
        "tone",
        input.platform,
        input.language
      );
      return {
        success: true,
        data: suggestions,
      };
    }),

  /**
   * Apply enhancement suggestions to content
   */
  applySuggestions: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        spellCorrections: z
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
            })
          )
          .optional(),
        grammarCorrections: z
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
            })
          )
          .optional(),
        addHashtags: z.array(z.string()).optional(),
        replaceCTAs: z
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { content, ...suggestions } = input;
      const improvedContent = await applySuggestions(content, suggestions);
      return {
        success: true,
        data: {
          original: content,
          improved: improvedContent,
        },
      };
    }),

  /**
   * Compare two versions of content
   */
  compareVersions: aiProcedure
    .input(
      z.object({
        originalContent: z.string().min(10),
        improvedContent: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
      })
    )
    .query(async ({ input }) => {
      const comparison = await compareVersions(
        input.originalContent,
        input.improvedContent,
        input.platform
      );
      return {
        success: true,
        data: comparison,
      };
    }),

  /**
   * Get quick content score
   */
  getContentScore: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        language: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      const analysis = await analyzeContent(
        input.content,
        input.platform,
        input.language
      );
      return {
        success: true,
        data: {
          score: analysis.score,
          readability: analysis.readability,
          tone: analysis.tone,
          suggestions: analysis.suggestions,
        },
      };
    }),

  /**
   * Get full enhancement report
   */
  getFullReport: aiProcedure
    .input(
      z.object({
        content: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        language: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      const analysis = await analyzeContent(
        input.content,
        input.platform,
        input.language
      );
      return {
        success: true,
        data: {
          overallScore: analysis.score,
          readability: analysis.readability,
          tone: analysis.tone,
          writingSuggestions: analysis.suggestions,
          spellErrors: analysis.spellErrors,
          grammarErrors: analysis.grammarErrors,
          hashtags: analysis.hashtags,
          ctas: analysis.ctas,
        },
      };
    }),
});