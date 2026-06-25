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
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]).default("linkedin"),
        tone: z.enum(["professional", "casual", "friendly", "formal", "humorous"]).default("professional"),
        language: z.enum(["no", "en"]).default("no"),
        generateImage: z.boolean().default(false),
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
          platform: input.platform,
          tone: input.tone,
          language: input.language,
          generateImage: input.generateImage ? 1 : 0,
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

        // Build "previous parts" context so each new part builds on the prior ones
        // and the series reads as a coherent, connected whole.
        const { getPostById } = await import("../db");
        const previousSummaries: string[] = [];
        for (const ep of existingPosts) {
          if (ep.postId == null) continue;
          const prevPost = await getPostById(ep.postId);
          const body = prevPost?.generatedContent;
          if (typeof body === "string" && body.trim()) {
            const snippet = body.trim().replace(/\s+/g, " ").slice(0, 280);
            previousSummaries.push(`- Del ${ep.partNumber}: ${snippet}`);
          }
        }
        const previousContext = previousSummaries.length
          ? `Tidligere deler i serien:\n${previousSummaries.join("\n")}`
          : "";

        const languageLabel = series.language === "en" ? "engelsk" : "norsk";

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du er en ekspert på sosiale medier-innhold. Skriv ferdig, publiseringsklart innhold for ${series.platform} på ${languageLabel} i en tone som er ${series.tone}. VIKTIG: skriv REN tekst uten markdown (ingen **, ##, eller punktlister med * eller -). Dette er del ${postNumber} av ${series.totalParts} i en sammenhengende serie — bygg eksplisitt videre på de forrige delene, unngå å gjenta dem, og skap en rød tråd. Avslutt med 2-4 relevante hashtags.`,
            },
            {
              role: "user",
              content: `Serie: ${series.title}\n\nBeskrivelse: ${series.description}\n\n${previousContext}\n\nSkriv del ${postNumber}/${series.totalParts}. Referer kort til serien og de forrige delene der det er naturlig.`,
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
          platform: series.platform as any,
          tone: series.tone,
          rawInput: `${series.title} – Del ${postNumber}`,
          generatedContent: content,
          tags: null,
          status: "draft",
        });

        // Optionally generate and attach an image for this part (best-effort:
        // never fail the post if image generation/storage is unavailable).
        if (series.generateImage === 1) {
          try {
            const { generateImage } = await import("../_core/imageGeneration");
            const img = await generateImage({ prompt: `${series.title}: ${content.slice(0, 180)}` });
            if (img?.url && /^https?:\/\//.test(img.url)) {
              // only persist hosted URLs, never a giant data: URL
              const { getDb } = await import("../db");
              const { posts } = await import("../../drizzle/schema");
              const { eq } = await import("drizzle-orm");
              const db2 = await getDb();
              if (db2) await db2.update(posts).set({ imageUrl: img.url }).where(eq(posts.id, savedPost.id));
            }
          } catch (err) {
            console.error("Series image generation failed (non-fatal)", err);
          }
        }

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
        
        return { success: true, content, postId: savedPost.id };
      }),
  });