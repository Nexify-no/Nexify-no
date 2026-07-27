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
import type { User } from "../../drizzle/schema";

/**
 * What the browser is allowed to know about the signed-in account.
 *
 * `me` used to be `opts.ctx.user` — the whole `users` row, straight out of the
 * database. That shipped four secrets to the client on every page load:
 *
 *   - `twoFactorSecret`     — the TOTP seed. Anyone who reads one response can
 *                             generate valid codes for this account forever.
 *   - `twoFactorBackupCodes` — skips the second factor outright.
 *   - `passwordHash`        — an offline cracking target.
 *   - `tokenVersion`        — the session-revocation counter.
 *
 * The first two mean the second factor protects nothing: the secret it is
 * derived from travels in the same response as the session it is meant to
 * guard, and sits in the query cache, in the browser's memory, and in anything
 * that records network traffic (error reporters, extensions, a shared screen).
 *
 * This is an explicit allow-list, not a delete-list, so a column added to
 * `users` later is private until somebody deliberately publishes it.
 */
function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    loginMethod: user.loginMethod,
    avatarUrl: user.avatarUrl,
    activeBrandId: user.activeBrandId,
    // Booleans, never the values behind them.
    emailVerified: user.emailVerified != null,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignedIn: user.lastSignedIn,
  };
}

export const authRouter = router({
    me: publicProcedure.query(({ ctx }) => (ctx.user ? toPublicUser(ctx.user) : null)),
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