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
        const { activeBrandId, ownedBy, requireWriteBrandId } = await import("../services/brandScope");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // PR #79: a draft is per (user, brand, page). Without the brand in the
        // key, switching from Ballong to Penna reopened Ballong's autosaved form.
        const brandId = await activeBrandId(ctx.user.id);
        const existing = await db.select()
          .from(drafts)
          .where(and(
            ownedBy(drafts.userId, drafts.brandId, ctx.user.id, brandId),
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
            brandId: await requireWriteBrandId(ctx.user.id),
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
        const { activeBrandId, ownedBy } = await import("../services/brandScope");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const brandId = await activeBrandId(ctx.user.id);
        const draft = await db.select()
          .from(drafts)
          .where(and(
            ownedBy(drafts.userId, drafts.brandId, ctx.user.id, brandId),
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
        
        const { activeBrandId: activeId, ownedBy: owned } = await import("../services/brandScope");
        const brandId = await activeId(ctx.user.id);
        await db.delete(drafts)
          .where(and(
            owned(drafts.userId, drafts.brandId, ctx.user.id, brandId),
            eq(drafts.pageType, input.pageType)
          ));
        
        return { success: true };
      }),

    // List all drafts for user
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { drafts } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const { activeBrandId, ownedBy } = await import("../services/brandScope");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const brandId = await activeBrandId(ctx.user.id);
      const userDrafts = await db.select()
        .from(drafts)
        .where(ownedBy(drafts.userId, drafts.brandId, ctx.user.id, brandId))
        .orderBy(desc(drafts.lastSavedAt));
      
      return userDrafts;
    }),
  });