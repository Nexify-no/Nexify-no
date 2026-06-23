/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const examplesRouter = router({
    save: protectedProcedure
      .input(z.object({
        postId: z.number(),
        title: z.string().min(1).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getPostById, createSavedExample } = await import("../db");
        
        // Get the post
        const post = await getPostById(input.postId);
        if (!post || post.userId !== ctx.user.id) {
          throw new Error("Post not found or unauthorized");
        }
        
        // Save as example
        const example = await createSavedExample({
          userId: ctx.user.id,
          postId: post.id,
          title: input.title,
          platform: post.platform,
          tone: post.tone,
          rawInput: post.rawInput,
          generatedContent: post.generatedContent,
        });
        
        return example;
      }),
      
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSavedExamples } = await import("../db");
      return getUserSavedExamples(ctx.user.id);
    }),
    
    use: protectedProcedure
      .input(z.object({ exampleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getSavedExampleById, incrementExampleUsage } = await import("../db");
        
        const example = await getSavedExampleById(input.exampleId);
        if (!example || example.userId !== ctx.user.id) {
          throw new Error("Example not found or unauthorized");
        }
        
        // Increment usage count
        await incrementExampleUsage(input.exampleId);
        
        return example;
      }),
      
    delete: protectedProcedure
      .input(z.object({ exampleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getSavedExampleById, deleteSavedExample } = await import("../db");
        
        const example = await getSavedExampleById(input.exampleId);
        if (!example || example.userId !== ctx.user.id) {
          throw new Error("Example not found or unauthorized");
        }
        
        await deleteSavedExample(input.exampleId);
        return { success: true };
      }),
  });