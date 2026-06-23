/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getFAQs, getFAQsByCategory, searchFAQs, getFAQCategories } from "../db";

export const faqRouter = router({
  /**
   * Get all FAQs for a specific language
   */
  getAll: publicProcedure
    .input(z.object({ language: z.string().default("no") }))
    .query(async ({ input }) => {
      return await getFAQs(input.language);
    }),

  /**
   * Get FAQs by category
   */
  getByCategory: publicProcedure
    .input(
      z.object({
        category: z.string(),
        language: z.string().default("no"),
      })
    )
    .query(async ({ input }) => {
      return await getFAQsByCategory(input.category, input.language);
    }),

  /**
   * Search FAQs by query
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        language: z.string().default("no"),
      })
    )
    .query(async ({ input }) => {
      return await searchFAQs(input.query, input.language);
    }),

  /**
   * Get all FAQ categories
   */
  getCategories: publicProcedure
    .input(z.object({ language: z.string().default("no") }))
    .query(async ({ input }) => {
      return await getFAQCategories(input.language);
    }),
});