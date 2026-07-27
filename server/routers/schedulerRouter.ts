/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { adminProcedure, router } from "../_core/trpc";

export const schedulerRouter = router({
    // Manually run one pass of the scheduled-post publisher.
    //
    // ADMIN ONLY, and it has to be. `processScheduledPostsInner` is not scoped to
    // the caller: it runs a global UPDATE over `scheduledPosts` and then publishes
    // every due row to ITS OWN owner's LinkedIn. As a protectedProcedure, any
    // signed-in user on the free tier could force-publish other customers' posts
    // and mutate their rows on demand. Same reasoning as triggerLifecycleEmails
    // below — a whole-platform operation is never a normal user's to trigger.
    triggerNow: adminProcedure.mutation(async () => {
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