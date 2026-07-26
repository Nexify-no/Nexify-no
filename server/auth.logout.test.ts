/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

/** User ids whose token version was bumped. Plain array — `mockReset`-proof. */
let revoked: number[] = [];

// Without this the revocation half of logout is unobservable: test-setup.ts forces
// DATABASE_URL empty, so the real incrementUserTokenVersion returns immediately
// and a logout that forgot to call it would look identical to one that did.
vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  incrementUserTokenVersion: async (userId: number) => {
    revoked.push(userId);
  },
}));

beforeEach(() => {
  revoked = [];
});

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    avatarUrl: null,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(), passwordHash: null, emailVerified: null, twoFactorSecret: null, twoFactorEnabled: 0, twoFactorBackupCodes: null, activeBrandId: null, tokenVersion: 0,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    // No try/catch: wrapping the assertions turned every real failure into
    // "expected [AssertionError] to be undefined", which hides what broke.
    const { appRouter } = await import("./routers");
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      // "lax", not "none" — see getSessionCookieOptions: lax is deliberate, it
      // blocks CSRF on state-changing GET (OAuth callbacks) while still letting
      // top-level navigations carry the session. The cookie must be cleared with
      // the same attributes it was set with, so this has to track that choice.
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });

  it("revokes every existing session, not just the cookie on this device", async () => {
    const { appRouter } = await import("./routers");
    const { ctx } = createAuthContext();

    await appRouter.createCaller(ctx).auth.logout();

    // Clearing the cookie alone leaves a previously-captured token replayable;
    // bumping tokenVersion is what actually ends the session.
    expect(revoked).toEqual([1]);
  });

  it("still clears the cookie for an unauthenticated caller, and revokes nothing", async () => {
    const { appRouter } = await import("./routers");
    const { ctx, clearedCookies } = createAuthContext();
    // logout is a publicProcedure — it must not throw when there is no session.
    const anon: TrpcContext = { ...ctx, user: null };

    await expect(appRouter.createCaller(anon).auth.logout()).resolves.toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(revoked).toEqual([]);
  });
});