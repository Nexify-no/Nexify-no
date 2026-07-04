/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";

export const authRouter = router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      // Revoke every existing session for this user (not just clear the cookie on
      // this device) so a previously-captured token can no longer be replayed.
      if (ctx.user?.id) {
        const { incrementUserTokenVersion } = await import("../db");
        await incrementUserTokenVersion(ctx.user.id);
      }
      return {
        success: true,
      } as const;
    }),

    /**
     * Log out of ALL devices/sessions: bump the user's tokenVersion so every
     * previously-issued JWT is rejected, and clear the cookie on this device.
     */
    logoutEverywhere: protectedProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      const { incrementUserTokenVersion } = await import("../db");
      await incrementUserTokenVersion(ctx.user.id);
      return { success: true } as const;
    }),
  });