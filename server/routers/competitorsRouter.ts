/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const competitorsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { competitors } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db.select().from(competitors).where(eq(competitors.userId, ctx.user.id));
    }),
    
    add: protectedProcedure
      .input(z.object({
        name: z.string(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        profileUrl: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb, getUserSubscription } = await import("../db");
        const { competitors } = await import("../../drizzle/schema");
        
        // Check Pro subscription
        const subscription = await getUserSubscription(ctx.user.id);
        if (!subscription || subscription.status !== "active") {
          throw new Error("Konkurrent-Radar krever Pro-abonnement");
        }
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(competitors).values({
          userId: ctx.user.id,
          name: input.name,
          platform: input.platform,
          profileUrl: input.profileUrl,
        });
        
        return { success: true };
      }),
      
    toggle: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { competitors } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const [competitor] = await db.select().from(competitors)
          .where(and(eq(competitors.id, input.id), eq(competitors.userId, ctx.user.id)));
        
        if (!competitor) throw new Error("Not found");
        
        await db.update(competitors)
          .set({ isActive: competitor.isActive ? 0 : 1 })
          .where(eq(competitors.id, input.id));
        
        return { success: true };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { competitors } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(competitors)
          .where(and(eq(competitors.id, input.id), eq(competitors.userId, ctx.user.id)));
        
        return { success: true };
      }),
  });