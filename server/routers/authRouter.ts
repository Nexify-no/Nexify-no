/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
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

    /**
     * Change password for email/password accounts. Verifies the current password,
     * enforces the >=12-char policy, invalidates all OTHER sessions (tokenVersion
     * bump) and re-issues a fresh session cookie so THIS device stays signed in.
     */
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z.string().min(12).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const bcrypt = (await import("bcryptjs")).default;
        const { getUserById, updateUserPassword, incrementUserTokenVersion } = await import("../db");
        const user = await getUserById(ctx.user.id);
        if (!user?.passwordHash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Kontoen bruker sosial pålogging (Google/Vipps) og har ikke passord." });
        }
        const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Feil nåværende passord." });
        if (input.newPassword === input.currentPassword) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nytt passord kan ikke være likt det gamle." });
        }
        const hash = await bcrypt.hash(input.newPassword, 12);
        await updateUserPassword(ctx.user.id, hash);
        // Invalidate every other session, then keep THIS device signed in.
        await incrementUserTokenVersion(ctx.user.id);
        const { sdk } = await import("../_core/sdk");
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true } as const;
      }),
  });