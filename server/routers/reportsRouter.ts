/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const reportsRouter = router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { weeklyReportSettings } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const settings = await db.select().from(weeklyReportSettings).where(eq(weeklyReportSettings.userId, ctx.user.id)).limit(1);
      return settings[0] || null;
    }),
    
    updateSettings: protectedProcedure
      .input(z.object({ email: z.string().email(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { weeklyReportSettings } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(weeklyReportSettings).where(eq(weeklyReportSettings.userId, ctx.user.id)).limit(1);
        
        if (existing.length > 0) {
          await db.update(weeklyReportSettings)
            .set({ email: input.email, enabled: input.enabled ? 1 : 0, updatedAt: new Date() })
            .where(eq(weeklyReportSettings.userId, ctx.user.id));
        } else {
          await db.insert(weeklyReportSettings).values({
            userId: ctx.user.id,
            email: input.email,
            enabled: input.enabled ? 1 : 0,
          });
        }
        
        return { success: true };
      }),
      
    sendTestReport: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const { notifyOwner } = await import("../_core/notification");
        // In a real implementation, this would send an actual email
        // For now, we'll notify the owner
        await notifyOwner({
          title: "Test Weekly Report Sent",
          content: `Test report sent to ${input.email} for user ${ctx.user.name}`,
        });
        return { success: true };
      }),
  });