/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const ideasRouter = router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["new", "in_progress", "used", "archived", "all"]).optional().default("all"),
        search: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { ideas } = await import("../../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        const { activeBrandId, ownedBy } = await import("../services/brandScope");

        // PR #79: ideas belong to one brand. Selecting Penna must not list a
        // single Ballong idea, and unowned legacy ideas are not shown here at
        // all — they live under "Uklassifisert" until the user classifies them.
        const brandId = await activeBrandId(ctx.user.id);
        const results = await db.select().from(ideas)
          .where(ownedBy(ideas.userId, ideas.brandId, ctx.user.id, brandId))
          .orderBy(desc(ideas.createdAt));
        
        // Filter by status if not "all"
        let filtered = results;
        if (input?.status && input.status !== "all") {
          filtered = results.filter(idea => idea.status === input.status);
        }
        
        // Filter by search term
        if (input?.search) {
          const searchLower = input.search.toLowerCase();
          filtered = filtered.filter(idea => 
            idea.ideaText.toLowerCase().includes(searchLower) ||
            (idea.tags && idea.tags.toLowerCase().includes(searchLower))
          );
        }
        
        return filtered;
      }),

    create: protectedProcedure
      .input(z.object({
        ideaText: z.string().min(1),
        source: z.enum(["manual", "voice", "trend", "competitor"]).optional().default("manual"),
        tags: z.array(z.string()).optional(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { ideas } = await import("../../drizzle/schema");
        const { requireWriteBrandId } = await import("../services/brandScope");

        // PR #79: with multi-brand on, this throws rather than writing an
        // ownerless row.
        const brandId = await requireWriteBrandId(ctx.user.id);

        const result = await db.insert(ideas).values({
          userId: ctx.user.id,
          brandId,
          ideaText: input.ideaText,
          source: input.source,
          tags: input.tags ? JSON.stringify(input.tags) : null,
          platform: input.platform || null,
          status: "new",
        });
        
        return { success: true, id: Number((result as unknown as { insertId: number }).insertId) };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        ideaText: z.string().min(1).optional(),
        status: z.enum(["new", "in_progress", "used", "archived"]).optional(),
        tags: z.array(z.string()).optional(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { ideas } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        const updateData: Record<string, unknown> = {};
        if (input.ideaText) updateData.ideaText = input.ideaText;
        if (input.status) updateData.status = input.status;
        if (input.tags !== undefined) updateData.tags = input.tags ? JSON.stringify(input.tags) : null;
        if (input.platform !== undefined) updateData.platform = input.platform;
        
        await db.update(ideas)
          .set(updateData)
          .where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { ideas } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        await db.delete(ideas)
          .where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
        
        return { success: true };
      }),

    convertToPost: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { ideas } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        // Get the idea
        const ideaResults = await db.select().from(ideas)
          .where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)))
          .limit(1);
        
        if (!ideaResults || ideaResults.length === 0) {
          throw new Error("Idé ikke funnet");
        }
        
        const idea = ideaResults[0];
        
        // Mark as in_progress (will be marked as used after post is created)
        await db.update(ideas)
          .set({ status: "in_progress" })
          .where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
        
        return { 
          success: true, 
          idea: {
            id: idea.id,
            ideaText: idea.ideaText,
            platform: idea.platform,
            tags: idea.tags ? (() => { try { return JSON.parse(idea.tags!); } catch { return []; } })() : [],
          }
        };
      }),

    markAsUsed: protectedProcedure
      .input(z.object({ id: z.number(), postId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { ideas } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        const updateData: any = { status: "used" };
        if (input.postId) {
          updateData.convertedPostId = input.postId;
        }
        
        await db.update(ideas)
          .set(updateData)
          .where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
        
        return { success: true };
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { ideas } = await import("../../drizzle/schema");
      const { activeBrandId, ownedBy } = await import("../services/brandScope");

      // PR #79: counters are per brand too — a Penna badge counting Ballong
      // ideas is the same leak, just smaller.
      const brandId = await activeBrandId(ctx.user.id);
      const allIdeas = await db.select().from(ideas)
        .where(ownedBy(ideas.userId, ideas.brandId, ctx.user.id, brandId));
      
      return {
        total: allIdeas.length,
        new: allIdeas.filter(i => i.status === "new").length,
        inProgress: allIdeas.filter(i => i.status === "in_progress").length,
        used: allIdeas.filter(i => i.status === "used").length,
        archived: allIdeas.filter(i => i.status === "archived").length,
      };
    }),
  });