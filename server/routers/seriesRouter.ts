/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

/** Strip markdown so series posts read like a normal clean social-media post. */
function stripMarkdown(input: string): string {
  return input
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*-]\s+/gm, "")
    .replace(/\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const seriesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { contentSeries, seriesPosts } = await import("../../drizzle/schema");
      const { eq, inArray } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const all = await db.select().from(contentSeries).where(eq(contentSeries.userId, ctx.user.id));
      if (all.length === 0) return [];
      // Count linked posts per series (JS-side to stay only_full_group_by-safe).
      const ids = all.map((s) => s.id);
      const links = await db.select().from(seriesPosts).where(inArray(seriesPosts.seriesId, ids));
      const counts = new Map<number, number>();
      for (const l of links) {
        if (l.postId != null) counts.set(l.seriesId, (counts.get(l.seriesId) || 0) + 1);
      }
      return all.map((s) => ({ ...s, generatedPosts: counts.get(s.id) || 0 }));
    }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string(),
        postCount: z.number().min(3).max(10),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb, getUserSubscription } = await import("../db");
        const { contentSeries } = await import("../../drizzle/schema");
        
        const subscription = await getUserSubscription(ctx.user.id);
        if (!subscription || subscription.status !== "active") {
          throw new Error("Innholds-Serier krever Pro-abonnement");
        }
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(contentSeries).values({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          totalParts: input.postCount,
          status: "planning",
        });
        
        return { success: true };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { contentSeries } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(contentSeries)
          .where(and(eq(contentSeries.id, input.id), eq(contentSeries.userId, ctx.user.id)));
        
        return { success: true };
      }),
      
    generatePost: protectedProcedure
      .input(z.object({ seriesId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { contentSeries } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const { invokeLLM } = await import("../_core/llm");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const [series] = await db.select().from(contentSeries)
          .where(and(eq(contentSeries.id, input.seriesId), eq(contentSeries.userId, ctx.user.id)));
        
        if (!series) throw new Error("Serie ikke funnet");
        // Count existing posts
        const { seriesPosts } = await import("../../drizzle/schema");
        const existingPosts = await db.select().from(seriesPosts)
          .where(eq(seriesPosts.seriesId, input.seriesId));
        
        if (existingPosts.length >= series.totalParts) {
          throw new Error("Alle innlegg er allerede generert");
        }
        
        // Generate next post using LLM
        const postNumber = existingPosts.length + 1;
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du er en ekspert på sosiale medier-innhold. Skriv ferdig, publiseringsklart innhold på norsk for innlegg ${postNumber} av ${series.totalParts} i en serie. VIKTIG: skriv REN tekst uten markdown — IKKE bruk **, ##, eller punktlister med * eller -. Bruk naturlige avsnitt, gjerne noen relevante emoji, og avslutt med 2-4 relevante hashtags.`,
            },
            {
              role: "user",
              content: `Serie: ${series.title}\n\nBeskrivelse: ${series.description}\n\nGenerer innlegg ${postNumber}/${series.totalParts}. Inkluder en kort intro som refererer til serien.`,
            },
          ],
        });
        
        const rawContent = response.choices[0]?.message?.content;
        if (typeof rawContent !== "string") throw new Error("Kunne ikke generere innlegg");
        const content = stripMarkdown(rawContent);

        // Persist the generated body as a real draft post so it shows in "Mine innlegg"
        // (previously only a metadata row was written and the text was lost).
        const { createPost } = await import("../db");
        const savedPost = await createPost({
          userId: ctx.user.id,
          platform: "linkedin",
          tone: "professional",
          rawInput: `${series.title} – Del ${postNumber}`,
          generatedContent: content,
          tags: null,
          status: "draft",
        });

        // Create series post entry linked to the saved post
        await db.insert(seriesPosts).values({
          seriesId: input.seriesId,
          postId: savedPost.id,
          partNumber: postNumber,
          title: `${series.title} - Del ${postNumber}`,
          status: "draft",
        });
        
        // Update series status
        const newStatus = postNumber === series.totalParts ? "completed" : "in_progress";
        await db.update(contentSeries)
          .set({ status: newStatus })
          .where(eq(contentSeries.id, input.seriesId));
        
        return { success: true, content };
      }),
  });