/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const telegramRouter = router({
    // Generate link code for connecting Telegram account
    generateLinkCode: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { telegramLinks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Generate random 8-character code
      const linkCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Check if user already has a link
      const existing = await db.select()
        .from(telegramLinks)
        .where(eq(telegramLinks.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        // Update link code
        await db.update(telegramLinks)
          .set({ linkCode, linkCodeExpiry: expiry })
          .where(eq(telegramLinks.userId, ctx.user.id));
      } else {
        // Create new link entry
        await db.insert(telegramLinks).values({
          userId: ctx.user.id,
          telegramUserId: "", // Will be filled when user sends code
          linkCode,
          linkCodeExpiry: expiry,
          isActive: false,
        });
      }

      return { linkCode, expiresAt: expiry };
    }),

    // Get current Telegram connection status
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { telegramLinks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const link = await db.select()
        .from(telegramLinks)
        .where(eq(telegramLinks.userId, ctx.user.id))
        .limit(1);

      if (link.length === 0) {
        return { connected: false };
      }

      return {
        connected: link[0].isActive,
        telegramUsername: link[0].telegramUsername,
        telegramFirstName: link[0].telegramFirstName,
        linkedAt: link[0].linkedAt,
      };
    }),

    // Disconnect Telegram
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { telegramLinks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(telegramLinks)
        .where(eq(telegramLinks.userId, ctx.user.id));

      return { success: true };
    }),

    // Get recent posts generated via Telegram (last 10)
    getRecentPosts: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { posts } = await import("../../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const recentPosts = await db.select()
        .from(posts)
        .where(eq(posts.userId, ctx.user.id))
        .orderBy(desc(posts.createdAt))
        .limit(10);

      return recentPosts;
    }),

    // Generate 3 alternative versions of a post
    generateAlternatives: protectedProcedure
      .input(z.object({ postId: z.number(), rawInput: z.string() }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("../_core/llm");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Du er en ekspert på sosiale medier. Generer 3 FORSKJELLIGE versjoner av et LinkedIn-innlegg basert på brukerens idé. Hver versjon skal ha en unik vinkling: 1) Profesjonell/formell, 2) Personlig/historiefortelling, 3) Kort og engasjerende. Skriv på norsk. Svar i JSON format: {\"alt1\": \"...\", \"alt2\": \"...\", \"alt3\": \"...\"}"
            },
            {
              role: "user",
              content: `Idé: ${input.rawInput}\n\nGenerer 3 forskjellige versjoner av dette innlegget.`
            }
          ],
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

        return {
          alternatives: [parsed.alt1, parsed.alt2, parsed.alt3]
        };
      }),

    // Save post to "Mine innlegg" (already saved, just return success)
    savePost: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async () => {
        // Post is already in "posts" table, so it's already saved
        // This endpoint exists for UI consistency
        return { success: true, message: "Post is already saved in Mine innlegg" };
      }),

    // Delete post
    deletePost: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(posts)
          .where(and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          ));

        return { success: true };
      }),

    // Move idea to Idea Bank
    moveToIdeaBank: protectedProcedure
      .input(z.object({ postId: z.number(), rawInput: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { ideas, posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Add to idea bank
        await db.insert(ideas).values({
          userId: ctx.user.id,
          ideaText: input.rawInput,
          source: "manual",
          status: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Delete from posts
        await db.delete(posts)
          .where(and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          ));

        return { success: true };
      }),

    // Bulk delete posts
    bulkDeletePosts: protectedProcedure
      .input(z.object({ postIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { posts } = await import("../../drizzle/schema");
        const { inArray, and, eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(posts)
          .where(and(
            inArray(posts.id, input.postIds),
            eq(posts.userId, ctx.user.id)
          ));

        return { success: true, count: input.postIds.length };
      }),

    // Bulk move to idea bank
    bulkMoveToIdeaBank: protectedProcedure
      .input(z.object({ 
        items: z.array(z.object({ 
          postId: z.number(), 
          rawInput: z.string() 
        })) 
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { ideas, posts } = await import("../../drizzle/schema");
        const { inArray, and, eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Add all ideas to idea bank
        const ideaValues = input.items.map(item => ({
          userId: ctx.user.id,
          ideaText: item.rawInput,
          source: "manual" as const,
          status: "new" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        
        await db.insert(ideas).values(ideaValues);

        // Delete all posts
        const postIds = input.items.map(item => item.postId);
        await db.delete(posts)
          .where(and(
            inArray(posts.id, postIds),
            eq(posts.userId, ctx.user.id)
          ));

        return { success: true, count: input.items.length };
      }),

    // Edit post content
    editPost: protectedProcedure
      .input(z.object({ 
        postId: z.number(), 
        newContent: z.string() 
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(posts)
          .set({ 
            generatedContent: input.newContent,
            updatedAt: new Date(),
          })
          .where(and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          ));

        return { success: true };
      }),

    // Duplicate post (creates a new post with same content)
    duplicatePost: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get the original post
        const [originalPost] = await db.select()
          .from(posts)
          .where(and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          ))
          .limit(1);

        if (!originalPost) {
          throw new Error("Post not found");
        }

        // Create duplicate
        const [newPost] = await db.insert(posts).values({
          userId: ctx.user.id,
          platform: originalPost.platform,
          tone: originalPost.tone,
          rawInput: originalPost.rawInput,
          generatedContent: originalPost.generatedContent,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).$returningId();

        return { 
          success: true, 
          newPostId: newPost.id,
          content: originalPost.generatedContent 
        };
      }),

    // Add tag to post
    addTag: protectedProcedure
      .input(z.object({ 
        postId: z.number(), 
        tag: z.string().min(1).max(50) 
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get current post
        const [post] = await db.select()
          .from(posts)
          .where(and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          ))
          .limit(1);

        if (!post) {
          throw new Error("Post not found");
        }

        // Get current tags or initialize empty array
        const currentTags: string[] = post.tags ? (Array.isArray(post.tags) ? post.tags : []) : [];
        
        // Add tag if not already present
        if (!currentTags.includes(input.tag)) {
          const newTags = [...currentTags, input.tag];
          await db.update(posts)
            .set({ 
              tags: newTags,
              updatedAt: new Date(),
            })
            .where(and(
              eq(posts.id, input.postId),
              eq(posts.userId, ctx.user.id)
            ));
        }

        return { success: true };
      }),

    // Remove tag from post
    removeTag: protectedProcedure
      .input(z.object({ 
        postId: z.number(), 
        tag: z.string() 
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get current post
        const [post] = await db.select()
          .from(posts)
          .where(and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          ))
          .limit(1);

        if (!post) {
          throw new Error("Post not found");
        }

        // Get current tags
        const currentTags: string[] = post.tags ? (Array.isArray(post.tags) ? post.tags : []) : [];
        
        // Remove tag
        const newTags = currentTags.filter(t => t !== input.tag);
        await db.update(posts)
          .set({ 
            tags: newTags,
            updatedAt: new Date(),
          })
          .where(and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          ));

        return { success: true };
      }),

    // Get all unique tags for user
    getAllTags: protectedProcedure
      .query(async ({ ctx }) => {
        const { getDb } = await import("../db");
        const { posts } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get all posts for user
        const userPosts = await db.select()
          .from(posts)
          .where(eq(posts.userId, ctx.user.id));

        // Extract and deduplicate tags
        const allTags = new Set<string>();
        userPosts.forEach(post => {
          if (post.tags && Array.isArray(post.tags)) {
            post.tags.forEach((tag: string) => allTags.add(tag));
          }
        });

        return { tags: Array.from(allTags).sort() };
      }),
  });