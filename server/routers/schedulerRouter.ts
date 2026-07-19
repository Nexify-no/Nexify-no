/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";

export const schedulerRouter = router({
    // Manually trigger scheduled posts processing (for testing)
    triggerNow: protectedProcedure.mutation(async () => {
      const { triggerScheduledPosts } = await import('../schedulerService');
      await triggerScheduledPosts();
      return { success: true, message: 'Scheduled posts processing triggered' };
    }),

    // Admin-only: run one pass of the customer-journey email sequence now.
    // Sends real emails, so it is gated to admins (never a normal user).
    triggerLifecycleEmails: adminProcedure.mutation(async () => {
      const { runLifecycleEmails } = await import('../services/lifecycleService');
      const summary = await runLifecycleEmails();
      return { success: true, ...summary };
    }),
  });