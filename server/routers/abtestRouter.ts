/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const abtestRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { abTests } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db.select().from(abTests).where(eq(abTests.userId, ctx.user.id));
    }),
    
    create: protectedProcedure
      .input(z.object({
        topic: z.string(),
        variantA: z.string(),
        variantB: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb, getUserSubscription } = await import("../db");
        const { abTests } = await import("../../drizzle/schema");
        
        const subscription = await getUserSubscription(ctx.user.id);
        if (!subscription || subscription.status !== "active") {
          throw new Error("A/B Testing krever Pro-abonnement");
        }
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(abTests).values({
          userId: ctx.user.id,
          title: input.topic,
          platform: "linkedin",
          variantA: input.variantA,
          variantB: input.variantB,
        });
        
        return { success: true };
      }),
      
    generate: protectedProcedure
      .input(z.object({ topic: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { getUserSubscription } = await import("../db");
        const { invokeLLM } = await import("../_core/llm");
        
        const subscription = await getUserSubscription(ctx.user.id);
        if (!subscription || subscription.status !== "active") {
          throw new Error("A/B Testing krever Pro-abonnement");
        }
        
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Du er en ekspert på A/B testing for sosiale medier. Generer to forskjellige versjoner av samme innlegg.",
            },
            {
              role: "user",
              content: `Tema: ${input.topic}\n\nGenerer to varianter (A og B) av et innlegg. Variant A skal være mer formell, Variant B skal være mer casual. Svar i JSON format: {"variantA": "...", "variantB": "..."}`,
            },
          ],
        });
        
        const content = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        
        return { variantA: parsed.variantA, variantB: parsed.variantB };
      }),
      
    recordResult: protectedProcedure
      .input(z.object({ testId: z.number(), winner: z.enum(["a", "b"]) }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { abTests } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.update(abTests)
          .set({ winner: input.winner, status: "completed" })
          .where(and(eq(abTests.id, input.testId), eq(abTests.userId, ctx.user.id)));
        
        return { success: true };
      }),
  });