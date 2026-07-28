/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * The X OAuth callback route.
 *
 * This is the file that holds the CSRF check and the PKCE single-use guarantee,
 * and it had no test at all. Everything here fails if the redirect route stops
 * verifying the signed state, stops consuming the verifier, or starts trusting
 * a callback it cannot attribute to a user.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const consumeVerifier = vi.fn();
const exchangeCodeForToken = vi.fn();
const fetchMe = vi.fn();
const saveXConnection = vi.fn();
const syncConnectionsForAccount = vi.fn();
const resolveXConfig = vi.fn();

vi.mock("./services/xPkce", () => ({
  consumeVerifier: (...args: any[]) => consumeVerifier(...args),
}));

vi.mock("./services/platformOAuthService", () => ({
  TwitterOAuth: class {
    exchangeCodeForToken(...args: any[]) {
      return exchangeCodeForToken(...args);
    }
    static fetchMe(...args: any[]) {
      return fetchMe(...args);
    }
  },
  platformManager: {
    saveXConnection: (...args: any[]) => saveXConnection(...args),
  },
}));

vi.mock("./services/socialDestinations", () => ({
  syncConnectionsForAccount: (...args: any[]) => syncConnectionsForAccount(...args),
}));

vi.mock("./services/xConfig", () => ({
  X_CALLBACK_PATH: "/api/x/callback",
  resolveXConfig: (...args: any[]) => resolveXConfig(...args),
}));

import { registerXCallback } from "./_core/xCallback";
import { signOAuthState } from "./_core/oauthState";

/** Captures the handler registered on the app, plus the path it was bound to. */
function mountRoute() {
  let path = "";
  let handler: any = null;
  registerXCallback({
    get(p: string, h: any) {
      path = p;
      handler = h;
    },
  } as any);
  return { path, handler };
}

async function call(query: Record<string, string>) {
  const { handler } = mountRoute();
  const redirect = vi.fn();
  await handler({ query, get: () => "penna.no" }, { redirect });
  return redirect.mock.calls[0]?.[0] as string;
}

const VALID_TOKEN = { accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 7200_000) };
const VALID_PROFILE = { id: "42", username: "penna_no", name: "Penna" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  resolveXConfig.mockReturnValue({
    clientId: "id",
    clientSecret: "secret",
    redirectUri: "https://penna.no/api/x/callback",
  });
  consumeVerifier.mockResolvedValue("the-verifier");
  exchangeCodeForToken.mockResolvedValue(VALID_TOKEN);
  fetchMe.mockResolvedValue(VALID_PROFILE);
  saveXConnection.mockResolvedValue(undefined);
  syncConnectionsForAccount.mockResolvedValue(undefined);
});

describe("route registration", () => {
  it("binds the path X redirects to, taken from X_CALLBACK_PATH", () => {
    // Hardcoding the string here as well as in xConfig let the two drift: change
    // the constant and X is sent to a URL nothing listens on, while the test
    // asserting the derived redirect_uri stays green.
    expect(mountRoute().path).toBe("/api/x/callback");
  });
});

describe("rejecting callbacks it cannot attribute", () => {
  it("refuses a state it did not sign, before exchanging anything", async () => {
    const target = await call({ code: "c", state: "forged.1.2.3" });

    expect(target).toBe("/innstillinger?x_error=ugyldig_state");
    // The load-bearing part: nothing was exchanged and nothing was saved. A
    // callback that reaches the token exchange before checking the state lets an
    // attacker attach their X account to whoever opens the link.
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
    expect(saveXConnection).not.toHaveBeenCalled();
  });

  it("refuses when the verifier is missing — an expired flow, another instance, or a replay", async () => {
    consumeVerifier.mockResolvedValue(null);
    const target = await call({ code: "c", state: signOAuthState(7) });

    expect(target).toBe("/innstillinger?x_error=ugyldig_state");
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
    expect(saveXConnection).not.toHaveBeenCalled();
  });

  it("refuses a callback with no code", async () => {
    expect(await call({ state: signOAuthState(7) })).toBe("/innstillinger?x_error=mangler_parametere");
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("refuses a callback with no state", async () => {
    expect(await call({ code: "c" })).toBe("/innstillinger?x_error=mangler_parametere");
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("reports the app as unconfigured rather than exchanging against an empty client", async () => {
    resolveXConfig.mockReturnValue(null);
    expect(await call({ code: "c", state: signOAuthState(7) })).toBe(
      "/innstillinger?x_error=ikke_konfigurert",
    );
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });
});

describe("the user pressing Cancel on X", () => {
  it("redirects with the error CODE, which the client can translate", async () => {
    // Passing X's `error_description` through instead meant the client's
    // Norwegian lookup never matched and the user was shown English prose from a
    // third party.
    const target = await call({
      error: "access_denied",
      error_description: "The user denied the request.",
    });
    expect(target).toBe("/innstillinger?x_error=access_denied");
  });
});

describe("a successful connect", () => {
  it("exchanges the code with the consumed verifier and saves the profile", async () => {
    const state = signOAuthState(99);
    const target = await call({ code: "the-code", state });

    expect(consumeVerifier).toHaveBeenCalledWith(state);
    expect(exchangeCodeForToken).toHaveBeenCalledWith("the-code", "the-verifier");
    expect(fetchMe).toHaveBeenCalledWith("at");
    // The user id comes from the VERIFIED state, never from the query string.
    expect(saveXConnection).toHaveBeenCalledWith(99, VALID_TOKEN, VALID_PROFILE);
    expect(target).toBe("/innstillinger?x_success=true");
  });

  it("mirrors the connection onto the user's brands", async () => {
    await call({ code: "c", state: signOAuthState(99) });
    expect(syncConnectionsForAccount).toHaveBeenCalledWith(99);
  });

  it("still reports success when mirroring onto brands fails", async () => {
    // The connection IS saved at that point. Failing the whole connect would
    // make the user redo an OAuth round trip to fix a convenience step they can
    // redo from the channels screen.
    syncConnectionsForAccount.mockRejectedValue(new Error("db down"));
    expect(await call({ code: "c", state: signOAuthState(99) })).toBe("/innstillinger?x_success=true");
  });

  it("does not put the handle in the redirect URL", async () => {
    // Sentry records url.full on captured events and its redaction list covers
    // credentials, not identifiers — in an app that sets sendDefaultPii:false.
    const target = await call({ code: "c", state: signOAuthState(99) });
    expect(target).not.toContain("penna_no");
    expect(target).not.toContain("x_handle");
  });
});

describe("failures during the exchange", () => {
  it("redirects instead of throwing when the token exchange fails", async () => {
    exchangeCodeForToken.mockRejectedValue(new Error("invalid_grant"));
    const target = await call({ code: "c", state: signOAuthState(99) });
    expect(target).toMatch(/^\/innstillinger\?x_error=/);
    expect(saveXConnection).not.toHaveBeenCalled();
  });

  it("does not save a connection when the profile lookup fails", async () => {
    fetchMe.mockRejectedValue(new Error("X profile lookup failed"));
    await call({ code: "c", state: signOAuthState(99) });
    expect(saveXConnection).not.toHaveBeenCalled();
  });
});
