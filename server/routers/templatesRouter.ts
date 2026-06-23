/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const templatesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSavedExamples } = await import("../db");
      return getUserSavedExamples(ctx.user.id);
    }),

    save: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        tone: z.string().min(1),
        rawInput: z.string().min(1),
        generatedContent: z.string().min(1),
        postId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createSavedExample } = await import("../db");
        return createSavedExample({
          userId: ctx.user.id,
          postId: input.postId || 0,
          title: input.title,
          platform: input.platform,
          tone: input.tone,
          rawInput: input.rawInput,
          generatedContent: input.generatedContent,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getSavedExampleById, deleteSavedExample } = await import("../db");
        const example = await getSavedExampleById(input.id);
        if (!example || example.userId !== ctx.user.id) {
          throw new Error("Mal ikke funnet");
        }
        await deleteSavedExample(input.id);
        return { success: true };
      }),

    use: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getSavedExampleById, incrementExampleUsage } = await import("../db");
        const example = await getSavedExampleById(input.id);
        if (!example || example.userId !== ctx.user.id) {
          throw new Error("Mal ikke funnet");
        }
        await incrementExampleUsage(input.id);
        return example;
      }),
  });