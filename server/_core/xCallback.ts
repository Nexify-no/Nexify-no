/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import type { Express } from "express";
import { verifyOAuthState } from "./oauthState";
import { X_CALLBACK_PATH } from "../services/xConfig";

/**
 * X (formerly Twitter) OAuth callback.
 *
 * Same gap Meta had: the code-for-token exchange existed and a tRPC mutation to
 * store the result existed, but there was no route X could redirect to, so
 * neither was reachable and "Koble til Twitter" led to a toast saying the
 * platform was not available. This is the missing half.
 *
 * The URL registered in the X developer portal must match X_CALLBACK_PATH exactly.
 */
export function registerXCallback(app: Express) {
  // The path comes from X_CALLBACK_PATH so the route and the redirect_uri
  // resolveXConfig sends to X can never drift apart. Hardcoding it here — which
  // is what this did — meant changing the constant would point X at a URL
  // nothing listens on, and the test asserting the derived URI would stay green.
  app.get(X_CALLBACK_PATH, async (req, res) => {
    const settings = "/innstillinger";
    try {
      const { code, state, error, error_description } = req.query;

      // Pressing "Cancel" on X's consent screen arrives here as an error rather
      // than a missing code. It is a normal outcome, not a fault.
      if (error) {
        // The CODE, not X's prose. The client maps codes to Norwegian; passing
        // `error_description` through meant the mapping never matched and the
        // user was shown untranslated English from a third party. The prose is
        // still worth having — in our log, where it helps.
        console.warn(`[X OAuth] ${error}: ${error_description || "(no description)"}`);
        return res.redirect(`${settings}?x_error=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        return res.redirect(`${settings}?x_error=mangler_parametere`);
      }

      // CSRF: the state is HMAC-signed with the initiating user's id and expires
      // after 15 minutes, so a forged callback cannot attach an attacker's X
      // account to somebody else's Penna account.
      const userId = verifyOAuthState(state as string);
      if (userId === null) {
        console.error("[X OAuth] Invalid or expired state");
        return res.redirect(`${settings}?x_error=ugyldig_state`);
      }

      const { consumeVerifier } = await import("../services/xPkce");
      const verifier = await consumeVerifier(state as string);
      if (!verifier) {
        // Signed state but no verifier: the flow was started on another instance
        // without shared Redis, the verifier expired, or this callback is a
        // replay of one already redeemed. All three mean: start again.
        console.error("[X OAuth] No PKCE verifier for this state");
        return res.redirect(`${settings}?x_error=ugyldig_state`);
      }

      const { TwitterOAuth, platformManager } = await import("../services/platformOAuthService");
      const { resolveXConfig } = await import("../services/xConfig");

      const config = resolveXConfig(req.get("host"));
      if (!config) {
        console.error("[X OAuth] X_CLIENT_ID / X_CLIENT_SECRET are not configured");
        return res.redirect(`${settings}?x_error=ikke_konfigurert`);
      }

      const oauth = new TwitterOAuth(config);
      const token = await oauth.exchangeCodeForToken(code as string, verifier);
      const profile = await TwitterOAuth.fetchMe(token.accessToken);

      await platformManager.saveXConnection(userId, token, profile);

      try {
        const { syncConnectionsForAccount } = await import("../services/socialDestinations");
        await syncConnectionsForAccount(userId);
      } catch (syncError) {
        // The connection is saved; mirroring it onto a brand is a convenience the
        // user can redo from the channels screen. Do not fail the whole connect.
        console.error("[X OAuth] Failed to mirror connection onto brands:", syncError);
      }

      console.log(`[X OAuth] Connected user ${userId} to @${profile.username}`);
      // The handle deliberately does NOT travel in the query string. Sentry
      // records `url.full` on every captured event and its redaction list covers
      // credentials, not identifiers — an app that sets sendDefaultPii:false
      // should not leak a social handle through its own success redirect. The
      // settings screen reads the handle from the connection row instead.
      return res.redirect(`${settings}?x_success=true`);
    } catch (err: any) {
      console.error("[X OAuth] Callback error:", err);
      return res.redirect(`${settings}?x_error=${encodeURIComponent(err?.message || "ukjent_feil")}`);
    }
  });
}
