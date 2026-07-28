/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * The X connect flow.
 *
 * Everything asserted here corresponds to something that was wrong before:
 * a PKCE exchange with a constant verifier, an authorization URL built from an
 * empty client_id, a `state` the caller supplied, a token that expires in two
 * hours and was never refreshed, and a consent screen naming a scope the app
 * does not request.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { readFileSync } from "fs";

import { resolveXConfig, isXConfigured, X_CALLBACK_PATH } from "./services/xConfig";
import {
  createVerifier,
  challengeFor,
  rememberVerifier,
  consumeVerifier,
  __resetPkceMemory,
} from "./services/xPkce";
import { TwitterOAuth, X_SCOPES } from "./services/platformOAuthService";
import { signOAuthState, verifyOAuthState } from "./_core/oauthState";

const CONFIG = {
  clientId: "test-client",
  clientSecret: "test-secret",
  redirectUri: "https://penna.no/api/x/callback",
};

const ENV_KEYS = [
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "X_REDIRECT_URI",
  "TWITTER_CLIENT_ID",
  "TWITTER_CLIENT_SECRET",
  "TWITTER_REDIRECT_URI",
];

describe("X app configuration", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is null when unconfigured, rather than a config of empty strings", () => {
    // The old code did `process.env.TWITTER_CLIENT_ID || ""`, which produces a
    // valid-looking authorize URL with client_id= and sends the user to X to be
    // told the client is invalid.
    expect(resolveXConfig("penna.no")).toBeNull();
    expect(isXConfigured()).toBe(false);
  });

  it("is null when only one half of the credentials is present", () => {
    process.env.X_CLIENT_ID = "id-only";
    expect(resolveXConfig("penna.no")).toBeNull();

    delete process.env.X_CLIENT_ID;
    process.env.X_CLIENT_SECRET = "secret-only";
    expect(resolveXConfig("penna.no")).toBeNull();
  });

  it("derives the redirect URI from the request host so preview deploys work", () => {
    process.env.X_CLIENT_ID = "id";
    process.env.X_CLIENT_SECRET = "secret";
    expect(resolveXConfig("staging.penna.no")?.redirectUri).toBe(
      `https://staging.penna.no${X_CALLBACK_PATH}`,
    );
  });

  it("lets an explicit redirect URI win over the derived one", () => {
    process.env.X_CLIENT_ID = "id";
    process.env.X_CLIENT_SECRET = "secret";
    process.env.X_REDIRECT_URI = "https://penna.no/api/x/callback";
    expect(resolveXConfig("staging.penna.no")?.redirectUri).toBe("https://penna.no/api/x/callback");
  });

  it("still reads the legacy TWITTER_* names, so an existing deploy keeps working", () => {
    process.env.TWITTER_CLIENT_ID = "legacy-id";
    process.env.TWITTER_CLIENT_SECRET = "legacy-secret";
    const config = resolveXConfig("penna.no");
    expect(config?.clientId).toBe("legacy-id");
    expect(config?.clientSecret).toBe("legacy-secret");
  });

  it("prefers X_* over TWITTER_* when both are set", () => {
    process.env.TWITTER_CLIENT_ID = "legacy-id";
    process.env.TWITTER_CLIENT_SECRET = "legacy-secret";
    process.env.X_CLIENT_ID = "new-id";
    process.env.X_CLIENT_SECRET = "new-secret";
    expect(resolveXConfig("penna.no")?.clientId).toBe("new-id");
  });

  it("trims whitespace — a trailing newline in a dashboard paste is invisible and fatal", () => {
    process.env.X_CLIENT_ID = "  id\n";
    process.env.X_CLIENT_SECRET = "secret ";
    expect(resolveXConfig("penna.no")?.clientId).toBe("id");
  });
});

describe("PKCE", () => {
  beforeEach(() => __resetPkceMemory());

  it("produces a fresh verifier every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => createVerifier()));
    expect(seen.size).toBe(50);
  });

  it("produces a verifier of the length and alphabet RFC 7636 requires", () => {
    const verifier = createVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("computes a real S256 challenge", () => {
    // The load-bearing assertion. The previous implementation sent
    // code_challenge_method=plain with the literal string "challenge" and then
    // the same literal back as the verifier, which any interceptor of the
    // authorization code already knew.
    const verifier = createVerifier();
    const expected = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(challengeFor(verifier)).toBe(expected);
    expect(challengeFor(verifier)).not.toBe(verifier);
  });

  it("returns the verifier stored against a state", async () => {
    await rememberVerifier("state-a", "verifier-a");
    expect(await consumeVerifier("state-a")).toBe("verifier-a");
  });

  it("keeps verifiers separate per state", async () => {
    await rememberVerifier("state-a", "verifier-a");
    await rememberVerifier("state-b", "verifier-b");
    expect(await consumeVerifier("state-b")).toBe("verifier-b");
    expect(await consumeVerifier("state-a")).toBe("verifier-a");
  });

  it("consumes the verifier exactly once, so a code cannot be replayed", async () => {
    await rememberVerifier("state-a", "verifier-a");
    expect(await consumeVerifier("state-a")).toBe("verifier-a");
    expect(await consumeVerifier("state-a")).toBeNull();
  });

  it("returns null for a state it never saw", async () => {
    expect(await consumeVerifier("never-issued")).toBeNull();
  });

  it("expires a verifier after 15 minutes", async () => {
    vi.useFakeTimers();
    try {
      await rememberVerifier("state-a", "verifier-a");
      vi.advanceTimersByTime(15 * 60 * 1000 + 1);
      expect(await consumeVerifier("state-a")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("authorization URL", () => {
  it("sends S256, the challenge, and never the verifier", () => {
    const verifier = createVerifier();
    const challenge = challengeFor(verifier);
    const url = new URL(new TwitterOAuth(CONFIG).getAuthorizationUrl("signed-state", challenge));

    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);

    // The verifier must never appear anywhere in the URL — that is the whole point.
    expect(url.toString()).not.toContain(verifier);
    // Nor may the client secret.
    expect(url.toString()).not.toContain(CONFIG.clientSecret);
  });

  // These assert against the URL X actually receives, not against the X_SCOPES
  // constant. Asserting the constant proves only that the constant equals
  // itself: an adversarial review changed getAuthorizationUrl to send
  // scope="tweet.read" — dropping tweet.write, users.read and offline.access —
  // and every test in this file still passed.
  const scopeParam = () =>
    new URL(new TwitterOAuth(CONFIG).getAuthorizationUrl("s", "c"))
      .searchParams.get("scope")!
      .split(" ");

  it("requests offline.access, without which the connection dies in two hours", () => {
    expect(scopeParam()).toContain("offline.access");
  });

  it("requests write access, without which the connection cannot publish", () => {
    expect(scopeParam()).toContain("tweet.write");
  });

  it("requests users.read, without which we cannot show which handle is connected", () => {
    expect(scopeParam()).toContain("users.read");
  });

  it("sends exactly the four scopes the consent screen discloses, and no more", () => {
    // Widening this set is a decision, not a detail: it changes what the user is
    // shown on X's consent screen and what the consent dialog must disclose.
    expect(scopeParam().sort()).toEqual([
      "offline.access",
      "tweet.read",
      "tweet.write",
      "users.read",
    ]);
    // …and the constant the consent copy is checked against must agree with it.
    expect(scopeParam().sort()).toEqual(X_SCOPES.split(" ").sort());
  });
});

describe("token exchange", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockToken(body: any, ok = true, status = 200) {
    const spy = vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? "OK" : "Bad Request",
      json: async () => body,
    });
    global.fetch = spy as any;
    return spy;
  }

  it("sends the real verifier and the client_id in the body", async () => {
    const spy = mockToken({ access_token: "at", refresh_token: "rt", expires_in: 7200 });
    await new TwitterOAuth(CONFIG).exchangeCodeForToken("the-code", "the-verifier");

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://api.x.com/2/oauth2/token");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("code_verifier")).toBe("the-verifier");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("grant_type")).toBe("authorization_code");
    // X rejects the PKCE grant without client_id in the body, even though the
    // same id is already in the Basic header.
    expect(body.get("client_id")).toBe(CONFIG.clientId);
  });

  it("keeps the refresh token and an expiry", async () => {
    mockToken({ access_token: "at", refresh_token: "rt", expires_in: 7200, scope: X_SCOPES });
    const token = await new TwitterOAuth(CONFIG).exchangeCodeForToken("c", "v");
    expect(token.accessToken).toBe("at");
    expect(token.refreshToken).toBe("rt");
    expect(token.expiresAt).toBeInstanceOf(Date);
    expect(token.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws with X's own message when the body carries an error", async () => {
    mockToken({ error: "invalid_grant", error_description: "Value passed for the authorization code was invalid." }, false, 400);
    await expect(new TwitterOAuth(CONFIG).exchangeCodeForToken("c", "v")).rejects.toThrow(
      /authorization code was invalid/,
    );
  });

  it("throws when the response is 200 but carries no access_token", async () => {
    // Status alone is not a success test on this API.
    mockToken({ error: "unauthorized_client" }, true, 200);
    await expect(new TwitterOAuth(CONFIG).exchangeCodeForToken("c", "v")).rejects.toThrow(
      /unauthorized_client/,
    );
  });

  it("refreshes with grant_type=refresh_token and returns the rotated refresh token", async () => {
    const spy = mockToken({ access_token: "at2", refresh_token: "rt2", expires_in: 7200 });
    const token = await new TwitterOAuth(CONFIG).refreshAccessToken("rt1");

    const body = new URLSearchParams((spy.mock.calls[0][1] as any).body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt1");
    // X rotates: rt1 is dead after this call. A caller that persists only the
    // access token breaks on the NEXT refresh, not this one.
    expect(token.refreshToken).toBe("rt2");
  });

  it("reads the handle from api.x.com/2/users/me with a bearer token", async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: { id: "42", username: "penna_no", name: "Penna" } }),
    });
    global.fetch = spy as any;

    await expect(TwitterOAuth.fetchMe("at")).resolves.toEqual({
      id: "42",
      username: "penna_no",
      name: "Penna",
    });

    // Asserting only the resolved object passed even when the endpoint was
    // repointed at example.com — the mock answers whatever it is asked.
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://api.x.com/2/users/me");
    expect((init as any).headers.Authorization).toBe("Bearer at");
  });

  it("posts the token request to api.x.com, not the retired twitter.com host", async () => {
    const spy = mockToken({ access_token: "at", expires_in: 7200 });
    await new TwitterOAuth(CONFIG).exchangeCodeForToken("c", "v");
    expect(spy.mock.calls[0][0]).toBe("https://api.x.com/2/oauth2/token");
  });

  it("sends the user to x.com to authorize", () => {
    const url = new URL(new TwitterOAuth(CONFIG).getAuthorizationUrl("s", "c"));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
  });
});

describe("callback state", () => {
  it("rejects a state the app did not sign", () => {
    // The old getTwitterAuthUrl was a publicProcedure taking caller-supplied
    // state, so nothing came back that proved who started the flow.
    expect(verifyOAuthState("1.2.3.4")).toBeNull();
    expect(verifyOAuthState("not-a-state")).toBeNull();
  });

  it("round-trips the initiating user id", () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    expect(verifyOAuthState(signOAuthState(4242))).toBe(4242);
  });

  it("rejects a state whose user id was tampered with", () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    const state = signOAuthState(1);
    const [, ts, nonce, sig] = state.split(".");
    expect(verifyOAuthState(`999.${ts}.${nonce}.${sig}`)).toBeNull();
  });
});

describe("the X consent screen tells the truth", () => {
  const dialog = () => readFileSync("client/src/components/OAuthWarningDialog.tsx", "utf8");

  const twitterBlock = () => {
    const src = dialog();
    return src.slice(src.indexOf("  twitter: {"), src.indexOf("  instagram: {"));
  };

  it("does not claim access to followers, friends or a network", () => {
    // It used to say "Få tilgang til dine følgere" / "Access your followers".
    // No follower scope is requested, and none exists in X_SCOPES.
    const block = twitterBlock().toLowerCase();
    for (const overclaim of ["følgere", "followers", "venner", "friends", "nettverk", "network", "meldinger", "messages"]) {
      expect(block, `X consent copy claims "${overclaim}"`).not.toContain(overclaim);
    }
  });

  it("names publishing, reading own posts, the handle, and staying connected", () => {
    const block = twitterBlock();
    expect(block).toMatch(/Publisere innlegg på X/);
    expect(block).toMatch(/Publish posts on X/);
    expect(block).toMatch(/dine egne innlegg/);
    expect(block).toMatch(/your own posts/);
    expect(block).toMatch(/brukernavnet ditt/);
    expect(block).toMatch(/your username/);
  });

  it("calls the platform X, which is the name on the screen the user lands on", () => {
    const block = twitterBlock();
    expect(block).toContain("Koble til X");
    expect(block).toContain("Connect to X");
  });

  it("discloses one line per requested scope", () => {
    // If someone widens X_SCOPES without adding a line here, this fails.
    const block = twitterBlock();
    const noPermissions = block.slice(block.indexOf("no: {"), block.indexOf("en: {"));
    const lines = [...noPermissions.matchAll(/^\s{8}"/gm)].length;
    expect(lines).toBe(X_SCOPES.split(" ").length);
  });
});
