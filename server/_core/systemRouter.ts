/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  sendContactMessage: publicProcedure
    .input(
      z.object({
        navn: z.string().min(1, "Navn er påkrevd"),
        epost: z.string().email("Ugyldig e-postadresse"),
        melding: z.string().min(10, "Meldingen må være minst 10 tegn"),
      })
    )
    .mutation(async ({ input }) => {
      // Send notification to owner about new contact message
      const delivered = await notifyOwner({
        title: `Ny kontaktmelding fra ${input.navn}`,
        content: `**Fra:** ${input.navn} (${input.epost})\n\n**Melding:**\n${input.melding}`,
      });
      
      return {
        success: delivered,
      } as const;
    }),

  /**
   * Which integrations are actually configured.
   *
   * Booleans only — never the values. The admin settings page used to render a
   * text field for an OpenAI key next to the claim "These settings are stored
   * securely" and "API keys are encrypted", while storing nothing at all: both
   * handlers were a single `toast.info()`. The security reasoning in those
   * comments was right (a key must never round-trip through the browser); the
   * page just needed to stop pretending. This is what it can honestly show.
   */
  getConfigStatus: adminProcedure.query(async () => {
    const { ENV } = await import("./env");
    const { isEmailConfigured } = await import("./email");
    return {
      email: isEmailConfigured(),
      openai: Boolean(ENV.forgeApiKey),
      database: Boolean(ENV.databaseUrl),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      sentry: Boolean(process.env.SENTRY_DSN),
      redis: Boolean(process.env.REDIS_URL),
      featureMultiBrand: ENV.featureMultiBrand,
      featureEnkelPlan: ENV.featureEnkelPlan,
      contentModel: ENV.contentModel,
      isProduction: ENV.isProduction,
    };
  }),

  getAdminStats: adminProcedure.query(async () => {
    const { getAdminStats } = await import("../db");
    return await getAdminStats();
  }),
});