/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * What one authenticated HTTP request costs the database — the auth half.
 *
 * `authenticateRequest` used to run TWICE per request: once in the Express
 * middleware that populates `req.user` (_core/index.ts) and again in the tRPC
 * context factory (_core/context.ts). Each run is a SELECT on `users` AND a
 * write (upsertUser stamping lastSignedIn). On a database billed per request
 * unit, that is two reads and two writes to learn the same fact twice.
 *
 * This file lives apart from requestCost.query.test.ts on purpose: it needs
 * `./db` mocked at module load (sdk.ts imports it statically), and that file
 * needs the real one.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";

const SECRET = "test_jwt_secret_at_least_32_chars_long__";
const OPEN_ID = "email_costtest";

/** Every call the code under test makes into the db module, in order. */
let dbCalls: string[] = [];

/** When set, getUserByOpenId rejects with exactly this object. */
let readFailure: Error | null = null;

const userRow: any = {
  id: 42,
  openId: OPEN_ID,
  name: "Cost Test",
  email: "cost@example.no",
  role: "user",
  status: "active",
  activeBrandId: null,
  tokenVersion: 0,
};

// Plain closures, not vi.fn(): the suite runs with mockReset/restoreMocks, which
// strips implementations off spies before each test.
vi.mock("./db", () => ({
  getUserByOpenId: async () => {
    dbCalls.push("getUserByOpenId");
    if (readFailure) throw readFailure;
    return userRow;
  },
  upsertUser: async () => {
    dbCalls.push("upsertUser");
  },
}));

async function mintToken(): Promise<string> {
  return new SignJWT({ openId: OPEN_ID, appId: "", name: "Cost Test", tv: 0 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

describe("authenticateRequest is memoised per request", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    dbCalls = [];
    readFailure = null;
    userRow.status = "active";
  });

  it("hits the database once even though two layers ask for the same request", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await mintToken();
    const req = { headers: { cookie: `app_session_id=${token}` } } as any;

    // This is the real call pattern: _core/index.ts middleware, then
    // _core/context.ts. Same `req` object, two independent callers.
    const fromMiddleware = await sdk.authenticateRequest(req);
    const fromContext = await sdk.authenticateRequest(req);

    expect(fromMiddleware.id).toBe(42);
    // Identity, not equality: the second caller must get the very same object
    // back, which is only true if nothing re-fetched it.
    expect(fromContext).toBe(fromMiddleware);

    // One read, one write — the whole point.
    expect(dbCalls).toEqual(["getUserByOpenId", "upsertUser"]);
  });

  it("replays a real failure instead of re-running the query", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await mintToken();
    const req = { headers: { cookie: `app_session_id=${token}` } } as any;

    // A VALID session whose database read fails. The earlier version of this
    // test used a malformed cookie, which verifySession rejects before touching
    // the database at all — so it proved nothing about the memo. The session has
    // to be good enough to reach the db for the replay to be observable.
    readFailure = new Error("connection lost");

    const first = await sdk.authenticateRequest(req).catch((e) => e);
    const second = await sdk.authenticateRequest(req).catch((e) => e);

    expect(first).toBeInstanceOf(Error);
    // The SAME error object, not an equal one: proof the second call replayed
    // the cached promise rather than issuing a second query.
    expect(second).toBe(first);
    expect(dbCalls).toEqual(["getUserByOpenId"]);
  });

  it("does not serve one request's user to another request", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await mintToken();

    await sdk.authenticateRequest({ headers: { cookie: `app_session_id=${token}` } } as any);
    dbCalls = [];
    await sdk.authenticateRequest({ headers: { cookie: `app_session_id=${token}` } } as any);

    // A fresh request object must do its own work. If the memo ever moved to
    // module scope this would be [] and a suspended or revoked account would
    // keep sailing through on a stale cached user.
    expect(dbCalls).toEqual(["getUserByOpenId", "upsertUser"]);
  });

  it("still rejects a suspended account, on the first ask and the replay", async () => {
    const { sdk } = await import("./_core/sdk");
    userRow.status = "suspended";
    const token = await mintToken();
    const req = { headers: { cookie: `app_session_id=${token}` } } as any;

    await expect(sdk.authenticateRequest(req)).rejects.toThrow(/sperret/i);
    await expect(sdk.authenticateRequest(req)).rejects.toThrow(/sperret/i);
  });
});
