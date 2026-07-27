/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/** A fully-populated authenticated tRPC context, for router tests. */
export function mkCtx(userId = 1, over: Record<string, unknown> = {}) {
  return {
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: "Test User",
      email: `user${userId}@example.com`,
      role: "user" as const,
      status: "active" as const,
      suspendedAt: null,
      suspendedReason: null,
      loginMethod: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordHash: null,
      emailVerified: null,
      twoFactorSecret: null,
      twoFactorEnabled: 0,
      twoFactorBackupCodes: null,
      activeBrandId: null,
      tokenVersion: 0,
      ...over,
    },
    req: {} as never,
    res: {} as never,
  } as never;
}
