/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * `auth.me` runs on every page load and its answer is what the whole client
 * treats as "the signed-in user". It used to be `opts.ctx.user` — the raw
 * `users` row — so every browser session was handed the account's TOTP seed,
 * its 2FA backup codes, its password hash and its session-revocation counter.
 *
 * The TOTP seed is the one that matters most: a second factor whose secret is
 * published to the client in the same response as the session it protects is
 * not a second factor. These tests pin the allow-list.
 */

import { describe, it, expect } from "vitest";
import { mkCtx } from "./testing/ctx";

/** Anything on this list reaching a browser is a security defect. */
const SECRETS = [
  "passwordHash",
  "twoFactorSecret",
  "twoFactorBackupCodes",
  "tokenVersion",
] as const;

/**
 * Sentinels, chosen so that searching the serialised payload actually works.
 *
 * Two traps, both of which this file fell into before:
 *   - A short value (`tokenVersion: 7`) matches a digit inside a timestamp and
 *     fails for no reason.
 *   - A value containing quotes — the natural `JSON.stringify(["11111111"])` for
 *     backup codes — comes back out of `JSON.stringify` escaped as `\"`, so the
 *     raw substring is never present and a genuine leak passes the search.
 *     Verified: publishing the backup codes under an allow-listed key was green.
 * So: long, distinctive, and free of anything JSON escapes.
 */
const SECRET_VALUES = {
  passwordHash: "$2b$12$notarealhashbutlongenoughtolooklikeone",
  twoFactorSecret: "JBSWY3DPEHPK3PXP",
  twoFactorBackupCodes: "BACKUPCODE-AAAA1111-BBBB2222",
  tokenVersion: 918273645,
};

async function me(over: Record<string, unknown> = {}) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(mkCtx(42, { ...SECRET_VALUES, ...over })).auth.me();
}

describe("auth.me", () => {
  it.each(SECRETS)("never returns %s", async (field) => {
    const result = (await me()) as Record<string, unknown>;
    expect(result).not.toHaveProperty(field);
  });

  it("does not carry a secret anywhere in the payload, under any key or nesting", async () => {
    // Stronger than a key check: catches a secret renamed, or tucked inside a
    // nested object where a top-level scan of the keys would miss it. The wire
    // format is JSON, so searching the serialised payload is what the browser
    // actually receives.
    const wire = JSON.stringify(await me());
    for (const secret of Object.values(SECRET_VALUES)) {
      expect(wire).not.toContain(String(secret));
    }
  });

  it("is an allow-list, so a new column is private until published", async () => {
    // If this test fails because you added a field, that is the point: decide
    // deliberately whether the browser should see it, then update this list.
    const result = (await me()) as Record<string, unknown>;
    expect(Object.keys(result).sort()).toEqual(
      [
        "activeBrandId",
        "avatarUrl",
        "createdAt",
        "email",
        "emailVerified",
        "id",
        "lastSignedIn",
        "loginMethod",
        "name",
        "role",
        "status",
        "twoFactorEnabled",
        "updatedAt",
      ].sort()
    );
  });

  it("does not leak a column added to the users row later", async () => {
    // The allow-list is what makes this hold: a `{...user}` spread, or any
    // delete-list implementation, publishes tomorrow's column by default.
    const wire = JSON.stringify(await me({ someNewSecret: "hunter2" }));
    expect(wire).not.toContain("someNewSecret");
    expect(wire).not.toContain("hunter2");
  });

  it("reports 2FA and verification as booleans, not as their values", async () => {
    const on = (await me({
      twoFactorEnabled: 1,
      emailVerified: new Date("2026-01-01T00:00:00Z"),
    })) as Record<string, unknown>;
    expect(on.twoFactorEnabled).toBe(true);
    expect(on.emailVerified).toBe(true);

    const off = (await me({ twoFactorEnabled: 0, emailVerified: null })) as Record<
      string,
      unknown
    >;
    expect(off.twoFactorEnabled).toBe(false);
    expect(off.emailVerified).toBe(false);
  });

  it("still carries what the client actually needs", async () => {
    const result = (await me({ role: "admin", name: "Tamer" })) as Record<string, unknown>;
    expect(result.id).toBe(42);
    expect(result.role).toBe("admin");
    expect(result.name).toBe("Tamer");
    expect(result.email).toBe("user42@example.com");
  });

  it("returns null when nobody is signed in", async () => {
    const { appRouter } = await import("./routers");
    const anon = { user: null, req: {}, res: {} } as never;
    expect(await appRouter.createCaller(anon).auth.me()).toBeNull();
  });
});
