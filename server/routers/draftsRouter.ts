/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const draftsRouter = router({
    // Save or update a draft (upsert)
    save: protectedProcedure
      .input(z.object({
        pageType: z.enum(["generate", "repurpose", "series", "ab_test", "engagement"]),
        formData: z.string(), // JSON string
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { drafts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Check if draft exists for this user and page
        const existing = await db.select()
          .from(drafts)
          .where(and(
            eq(drafts.userId, ctx.user.id),
            eq(drafts.pageType, input.pageType)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          // Update existing draft
          await db.update(drafts)
            .set({
              formData: input.formData,
              title: input.title,
            })
            .where(eq(drafts.id, existing[0].id));
          return { id: existing[0].id, updated: true };
        } else {
          // Create new draft
          const result = await db.insert(drafts).values({
            userId: ctx.user.id,
            pageType: input.pageType,
            formData: input.formData,
            title: input.title,
          });
          return { id: Number(result[0].insertId), updated: false };
        }
      }),

    // Get draft for a specific page
    get: protectedProcedure
      .input(z.object({
        pageType: z.enum(["generate", "repurpose", "series", "ab_test", "engagement"]),
      }))
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { drafts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const draft = await db.select()
          .from(drafts)
          .where(and(
            eq(drafts.userId, ctx.user.id),
            eq(drafts.pageType, input.pageType)
          ))
          .limit(1);
        
        return draft[0] || null;
      }),

    // Delete a draft
    delete: protectedProcedure
      .input(z.object({
        pageType: z.enum(["generate", "repurpose", "series", "ab_test", "engagement"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { drafts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(drafts)
          .where(and(
            eq(drafts.userId, ctx.user.id),
            eq(drafts.pageType, input.pageType)
          ));
        
        return { success: true };
      }),

    // List all drafts for user
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { drafts } = await import("../../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const userDrafts = await db.select()
        .from(drafts)
        .where(eq(drafts.userId, ctx.user.id))
        .orderBy(desc(drafts.lastSavedAt));
      
      return userDrafts;
    }),
  });