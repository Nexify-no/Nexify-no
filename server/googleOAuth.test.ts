/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Google OAuth login/callback routes.
 *
 * The previous version of this file mocked `google-auth-library` and then
 * asserted on the mock: `client.getToken()` returns what the mock was told to
 * return, `expect(COOKIE_NAME).toBe("app_session_id")` where COOKIE_NAME was a
 * local const declared two lines above. None of the seven tests imported
 * `googleOAuthRoutes` at all, so the actual login flow was untested — and the two
 * that touched the mock failed anyway, because `mockReset: true`
 * (vitest.config.ts) strips a spy's implementation before every test, and the
 * OAuth2Client mock was an implementation set at module scope.
 *
 * This version drives the real handlers. What matters here is security, so that
 * is what is pinned: the CSRF `state` guard, the PKCE challenge, single-use
 * transaction cookies, and the `google_` openId prefix that keeps Google
 * identities from colliding with Manus ones.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Recorders. Plain objects/functions — not vi.fn() — so `mockReset: true`
// cannot strip the implementations out from under the tests.
// ---------------------------------------------------------------------------

let authUrlOptions: Record<string, unknown> | null = null;
let getTokenArgs: unknown = null;
let verifyArgs: unknown = null;
let upserted: Array<Record<string, unknown>> = [];
let sessionTokenFor: string | null = null;
/** Set to make the token exchange fail. */
let tokenExchangeError: Error | null = null;
/** Payload the ID token verifies to; null means "no payload". */
let idTokenPayload: Record<string, unknown> | null = null;

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    generateAuthUrl(opts: Record<string, unknown>) {
      authUrlOptions = opts;
      const q = new URLSearchParams({
        client_id: "test_client_id",
        state: String(opts.state ?? ""),
        code_challenge: String(opts.code_challenge ?? ""),
        code_challenge_method: String(opts.code_challenge_method ?? ""),
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
    }
    async getToken(args: unknown) {
      getTokenArgs = args;
      if (tokenExchangeError) throw tokenExchangeError;
      return { tokens: { id_token: "mock_id_token", access_token: "mock_access_token" } };
    }
    async verifyIdToken(args: unknown) {
      verifyArgs = args;
      return { getPayload: () => idTokenPayload };
    }
  },
}));

/**
 * The callback no longer upserts on the Google openId — it asks the DB layer to
 * resolve the identity to exactly ONE account (migration 0100). Recording the
 * argument lets the tests below assert what the route tells the resolver,
 * including the `emailVerified` claim the anti-pre-hijacking rule hangs on.
 */
let resolveArgs: Array<Record<string, unknown>> = [];
/** Set to make the resolver refuse the link (email owned by another account). */
let resolveRefusal: string | null = null;

vi.mock("./db", () => ({
  upsertUser: async (row: Record<string, unknown>) => {
    upserted.push(row);
  },
  resolveOAuthLogin: async (identity: Record<string, unknown>) => {
    resolveArgs.push(identity);
    if (resolveRefusal) return { ok: false, reason: resolveRefusal };
    return {
      ok: true,
      openId: `${identity.provider}_${identity.subject}`,
      userId: 1,
      linked: false,
      passwordInvalidated: false,
    };
  },
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: async (openId: string) => {
      sessionTokenFor = openId;
      return `session_for_${openId}`;
    },
    authenticateRequest: async () => {
      throw new Error("not authenticated");
    },
  },
}));

// ---------------------------------------------------------------------------
// A tiny Express double: collects handlers by path, records what they emit.
// ---------------------------------------------------------------------------

type Handler = (req: any, res: any) => unknown;

function mkRes() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const cleared: string[] = [];
  const out = {
    cookies,
    cleared,
    redirectedTo: null as string | null,
    statusCode: null as number | null,
    json: null as unknown,
    cookie(name: string, value: string, options: Record<string, unknown> = {}) {
      cookies.push({ name, value, options });
      return out;
    },
    clearCookie(name: string) {
      cleared.push(name);
      return out;
    },
    redirect(status: number, url: string) {
      out.statusCode = status;
      out.redirectedTo = url;
      return out;
    },
    status(code: number) {
      out.statusCode = code;
      return out;
    },
  };
  (out as any).json = (body: unknown) => {
    (out as any).jsonBody = body;
    return out;
  };
  return out as typeof out & { jsonBody?: unknown };
}

const mkReq = (over: Record<string, unknown> = {}) => ({
  protocol: "https",
  headers: { host: "penna.no" },
  query: {},
  cookies: {},
  ...over,
});

async function routes(): Promise<Record<string, Handler>> {
  const table: Record<string, Handler> = {};
  const app = { get: (path: string, h: Handler) => { table[path] = h; } };
  const { registerGoogleOAuthRoutes } = await import("./routes/googleOAuthRoutes");
  registerGoogleOAuthRoutes(app as never);
  return table;
}

const cookieValue = (res: ReturnType<typeof mkRes>, name: string) =>
  res.cookies.find((c) => c.name === name)?.value;

describe("Google OAuth routes", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test_client_id";
    process.env.GOOGLE_CLIENT_SECRET = "test_client_secret";
    authUrlOptions = null;
    getTokenArgs = null;
    verifyArgs = null;
    upserted = [];
    resolveArgs = [];
    resolveRefusal = null;
    sessionTokenFor = null;
    tokenExchangeError = null;
    idTokenPayload = {
      sub: "123456789",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/photo.jpg",
    };
  });

  describe("starting the flow", () => {
    it("sets single-use state and PKCE-verifier cookies and binds both to the auth URL", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/login/google"](mkReq(), res);

      const state = cookieValue(res, "g_oauth_state");
      const verifier = cookieValue(res, "g_oauth_verifier");
      expect(state).toBeTruthy();
      expect(verifier).toBeTruthy();

      // The state in the URL is the state in the cookie — otherwise the callback
      // comparison can never succeed and login is simply broken.
      expect(authUrlOptions?.state).toBe(state);

      // PKCE: the challenge must be the S256 hash of the verifier we stored, not
      // the verifier itself (sending the verifier defeats the whole exchange).
      const expected = crypto.createHash("sha256").update(verifier!).digest("base64url");
      expect(authUrlOptions?.code_challenge).toBe(expected);
      expect(authUrlOptions?.code_challenge_method).toBe("S256");
      expect(authUrlOptions?.code_challenge).not.toBe(verifier);

      expect(res.statusCode).toBe(302);
      expect(res.redirectedTo).toContain("accounts.google.com");
    });

    it("expires the transaction cookies quickly and keeps them httpOnly", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/login/google"](mkReq(), res);

      for (const name of ["g_oauth_state", "g_oauth_verifier"]) {
        const c = res.cookies.find((x) => x.name === name)!;
        expect(c.options.httpOnly).toBe(true);
        expect(c.options.maxAge).toBe(10 * 60 * 1000);
      }
    });

    it("mints a fresh state per attempt", async () => {
      const r = await routes();
      const a = mkRes();
      const b = mkRes();
      await r["/api/auth/login/google"](mkReq(), a);
      await r["/api/auth/login/google"](mkReq(), b);
      expect(cookieValue(a, "g_oauth_state")).not.toBe(cookieValue(b, "g_oauth_state"));
      expect(cookieValue(a, "g_oauth_verifier")).not.toBe(cookieValue(b, "g_oauth_verifier"));
    });

    it("returns the same URL as JSON on the fetch entry point", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/login"](mkReq(), res);
      expect((res.jsonBody as { url: string }).url).toContain("accounts.google.com");
      expect(cookieValue(res, "g_oauth_state")).toBeTruthy();
    });
  });

  describe("callback CSRF guard", () => {
    it("rejects a callback whose state does not match the cookie", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](
        mkReq({ query: { code: "c", state: "forged" }, cookies: { g_oauth_state: "real" } }),
        res,
      );

      expect(res.redirectedTo).toBe("/login?error=state_mismatch");
      expect(getTokenArgs).toBeNull(); // the code was never exchanged
      expect(upserted).toHaveLength(0);
    });

    it("rejects a callback with no state cookie at all", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](mkReq({ query: { code: "c", state: "anything" } }), res);
      expect(res.redirectedTo).toBe("/login?error=state_mismatch");
      expect(getTokenArgs).toBeNull();
    });

    it("rejects a callback with a cookie but no returned state", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](
        mkReq({ query: { code: "c" }, cookies: { g_oauth_state: "real" } }),
        res,
      );
      expect(res.redirectedTo).toBe("/login?error=state_mismatch");
      expect(getTokenArgs).toBeNull();
    });

    it("clears both transaction cookies even when it rejects", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](
        mkReq({ query: { code: "c", state: "forged" }, cookies: { g_oauth_state: "real" } }),
        res,
      );
      // Single-use: leaving them set would let the same state be replayed.
      expect(res.cleared).toContain("g_oauth_state");
      expect(res.cleared).toContain("g_oauth_verifier");
    });

    it("redirects on a Google-side error without exchanging anything", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](mkReq({ query: { error: "access_denied" } }), res);
      expect(res.redirectedTo).toBe("/login?error=auth_failed");
      expect(getTokenArgs).toBeNull();
    });
  });

  describe("successful callback", () => {
    const ok = { query: { code: "the_code", state: "s1" }, cookies: { g_oauth_state: "s1", g_oauth_verifier: "v1" } };

    it("exchanges the code bound to the stored PKCE verifier", async () => {
      const r = await routes();
      await r["/api/auth/callback/google"](mkReq(ok), mkRes());
      expect(getTokenArgs).toEqual({ code: "the_code", codeVerifier: "v1" });
    });

    it("verifies the ID token against our own client id", async () => {
      const r = await routes();
      await r["/api/auth/callback/google"](mkReq(ok), mkRes());
      // Skipping the audience check would accept a token minted for another app.
      expect(verifyArgs).toEqual({ idToken: "mock_id_token", audience: "test_client_id" });
    });

    it("prefixes the Google subject with google_ so it cannot collide with a Manus openId", async () => {
      const r = await routes();
      await r["/api/auth/callback/google"](mkReq(ok), mkRes());
      expect(resolveArgs).toHaveLength(1);
      expect(resolveArgs[0].provider).toBe("google");
      expect(resolveArgs[0].subject).toBe("123456789");
      expect(sessionTokenFor).toBe("google_123456789");
    });

    it("sets the shared session cookie and lands on the dashboard", async () => {
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](mkReq(ok), res);

      const session = res.cookies.find((c) => c.name === "app_session_id");
      expect(session?.value).toBe("session_for_google_123456789");
      expect(session?.options.httpOnly).toBe(true);
      expect(res.redirectedTo).toBe("/dashboard");
    });

    it("falls back to the email local-part when Google sends no name", async () => {
      idTokenPayload = { sub: "42", email: "ola.nordmann@example.no" };
      const r = await routes();
      await r["/api/auth/callback/google"](mkReq(ok), mkRes());
      expect(sessionTokenFor).toBe("google_42");
    });

    /**
     * One account per email (migration 0100). The callback used to insert a new
     * row whenever `google_<sub>` was unseen, which is how three accounts ended
     * up sharing nexifyhub.no@gmail.com. It must now hand the decision to the
     * resolver and never upsert on its own.
     */
    it("delegates account resolution instead of creating a row itself", async () => {
      const r = await routes();
      await r["/api/auth/callback/google"](mkReq(ok), mkRes());
      expect(upserted).toHaveLength(0);
      expect(resolveArgs).toHaveLength(1);
    });

    /**
     * The `email_verified` claim is the only thing preventing account
     * pre-hijacking, so it must be forwarded exactly as Google sent it —
     * never defaulted to true for convenience.
     */
    it("forwards Google's email_verified claim verbatim", async () => {
      idTokenPayload = { sub: "42", email: "x@y.no", email_verified: true };
      let r = await routes();
      await r["/api/auth/callback/google"](mkReq(ok), mkRes());
      expect(resolveArgs[0].emailVerified).toBe(true);

      resolveArgs = [];
      idTokenPayload = { sub: "42", email: "x@y.no" }; // claim absent
      r = await routes();
      await r["/api/auth/callback/google"](mkReq(ok), mkRes());
      expect(resolveArgs[0].emailVerified).toBe(false);
    });

    it("issues no session when the resolver refuses the link", async () => {
      resolveRefusal = "email_taken_unverified_provider";
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](mkReq(ok), res);

      expect(sessionTokenFor).toBeNull();
      expect(res.cookies.find((c) => c.name === "app_session_id")).toBeUndefined();
      expect(res.redirectedTo).toContain("/login?error=");
    });

    it("creates no session when the token has no subject", async () => {
      idTokenPayload = { email: "x@y.no" }; // no `sub`
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](mkReq(ok), res);

      expect(upserted).toHaveLength(0);
      expect(sessionTokenFor).toBeNull();
      expect(res.cookies.find((c) => c.name === "app_session_id")).toBeUndefined();
      expect(res.redirectedTo).toBe("/login?error=auth_failed");
    });

    it("creates no session when the exchange fails", async () => {
      tokenExchangeError = new Error("invalid_grant");
      const r = await routes();
      const res = mkRes();
      await r["/api/auth/callback/google"](mkReq(ok), res);

      expect(upserted).toHaveLength(0);
      expect(res.cookies.find((c) => c.name === "app_session_id")).toBeUndefined();
      expect(res.redirectedTo).toBe("/login?error=auth_failed");
    });
  });
});
