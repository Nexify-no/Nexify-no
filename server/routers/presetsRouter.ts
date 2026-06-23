/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Named generation presets: a reusable bundle of content-generation options.
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

// Persisted preset fields. Mirrors the generation_presets table; topic is NOT
// part of a preset (it's per-generation), so it's excluded here.
const presetShape = {
  name: z.string().min(1).max(100),
  platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
  tone: z.string().min(1).max(50),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  keywords: z.array(z.string().max(60)).max(20).optional(),
  targetAudience: z.string().max(280).optional(),
  goal: z.enum(["awareness", "engagement", "sales", "leads", "traffic", "community"]).optional(),
  cta: z.string().max(280).optional(),
  angle: z
    .enum([
      "personal_story", "actionable_tips", "contrarian_opinion", "case_study",
      "shocking_stat", "how_to", "listicle", "question",
    ])
    .optional(),
  emojiUsage: z.enum(["none", "minimal", "moderate", "heavy"]).default("minimal"),
  hashtagCount: z.number().int().min(0).max(30).default(3),
  useBullets: z.boolean().default(false),
  closingQuestion: z.boolean().default(true),
  language: z.enum(["no", "en", "ar"]).default("no"),
  isDefault: z.boolean().optional(),
} as const;

export const presetsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getUserPresets } = await import("../db");
    return getUserPresets(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object(presetShape))
    .mutation(async ({ ctx, input }) => {
      const { createPreset } = await import("../db");
      return createPreset({ ...input, userId: ctx.user.id });
    }),

  update: protectedProcedure
    .input(z.object(presetShape).partial().extend({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { updatePreset } = await import("../db");
      const { id, ...updates } = input;
      await updatePreset(id, ctx.user.id, updates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { deletePreset } = await import("../db");
      await deletePreset(input.id, ctx.user.id);
      return { success: true };
    }),
});