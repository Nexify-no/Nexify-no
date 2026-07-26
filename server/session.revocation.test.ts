/**
 * Session revocation: after a security event (e.g. password reset) bumps the
 * user's tokenVersion, a JWT stamped with the OLD tokenVersion must be rejected.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";

const SECRET = "test_jwt_secret_at_least_32_chars_long__";
const OPEN_ID = "email_test123";

// Mutable user record the mocked db returns; tokenVersion starts at 0, then bumps.
const userRow: any = { id: 1, openId: OPEN_ID, name: "T", email: "t@e.no", role: "user", activeBrandId: null, tokenVersion: 0 };

// "./db", not "../db": this file lives in server/, so "../db" pointed at a
// non-existent module at the repo root and the mock never applied — the test
// reached the real database and died with "Failed to sync user info".
// Plain functions, not vi.fn(): the suite runs with `mockReset: true`, which
// strips implementations from spies before every test.
vi.mock("./db", () => ({
  getUserByOpenId: async () => userRow,
  upsertUser: async () => {},
}));

async function mintToken(tv: number): Promise<string> {
  return new SignJWT({ openId: OPEN_ID, appId: "", name: "T", tv })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

describe("session revocation via tokenVersion", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    userRow.tokenVersion = 0;
  });

  it("accepts a token whose tv matches, rejects it after the version is bumped", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await mintToken(0);
    const makeReq = () => ({ headers: { cookie: `app_session_id=${token}` } }) as any;

    // Valid while tv matches.
    const user = await sdk.authenticateRequest(makeReq());
    expect(user.id).toBe(1);

    // Simulate password reset / logout-everywhere bumping the stored version.
    userRow.tokenVersion = 1;

    // The old token (tv=0) must now be rejected.
    await expect(sdk.authenticateRequest(makeReq())).rejects.toBeTruthy();
  });
});
