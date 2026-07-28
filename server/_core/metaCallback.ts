/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import type { Express } from "express";
import { verifyOAuthState } from "./oauthState";

/**
 * Meta (Facebook + Instagram) OAuth callback.
 *
 * This route is the piece that did not exist. The app had a working code-for-token
 * exchange and a tRPC mutation to store the result, but nothing Meta could redirect
 * to — so `handleFacebookCallback` was unreachable, no Facebook row was ever
 * written, and the "Koble til Facebook" button in settings had nothing to do.
 *
 * The redirect URI registered in the Meta app must match this path exactly.
 */
export function registerMetaCallback(app: Express) {
  app.get("/api/meta/callback", async (req, res) => {
    const settings = "/innstillinger";
    try {
      const { code, state, error, error_description, error_reason } = req.query;

      // The user pressing "Avbryt" on Meta's consent screen arrives here as an
      // error, not as a missing code. Treat it as a normal outcome and say so.
      if (error) {
        const reason = (error_description as string) || (error_reason as string) || (error as string);
        console.warn(`[Meta OAuth] ${error}: ${reason}`);
        return res.redirect(`${settings}?meta_error=${encodeURIComponent(reason)}`);
      }

      if (!code || !state) {
        return res.redirect(`${settings}?meta_error=mangler_parametere`);
      }

      // CSRF. The state is HMAC-signed with the initiating user's id and a 15
      // minute expiry, so a forged callback cannot attach an attacker's Facebook
      // Page to somebody else's account — which is exactly what would have been
      // possible had this route been added without it, since the previous
      // `getFacebookAuthUrl` accepted any caller-supplied string as state.
      const userId = verifyOAuthState(state as string);
      if (userId === null) {
        console.error("[Meta OAuth] Invalid or expired state");
        return res.redirect(`${settings}?meta_error=ugyldig_state`);
      }

      const { FacebookOAuth, platformManager } = await import("../services/platformOAuthService");
      const { resolveMetaConfig } = await import("../services/metaConfig");

      const config = resolveMetaConfig(req.get("host"));
      if (!config) {
        console.error("[Meta OAuth] FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET are not configured");
        return res.redirect(`${settings}?meta_error=ikke_konfigurert`);
      }

      const oauth = new FacebookOAuth(config);
      const userToken = await oauth.exchangeCodeForUserToken(code as string);
      const pages = await FacebookOAuth.listPages(userToken.accessToken);

      if (pages.length === 0) {
        return res.redirect(`${settings}?meta_error=ingen_sider`);
      }

      // Which Page to (re)connect.
      //
      // Never blindly `pages[0]`. Meta does not promise a stable order, so a
      // RECONNECT — which is routine, since the user token expires after ~60 days
      // — would silently move publishing to a different Page than the one the
      // user chose, and, if that Page has no linked Instagram account, delete
      // their Instagram connection on the way past. The user finds out when a
      // brand's posts start appearing on the wrong Page.
      //
      // So: keep the existing choice whenever it is still one of the user's
      // Pages. Only a first-time connect falls back to the first Page, and even
      // then the picker is offered when there is more than one.
      const existing = await platformManager.getPlatformConnection(userId, "facebook");
      const chosen =
        (existing?.accountId && pages.find((p) => p.id === existing.accountId)) || pages[0];

      await platformManager.saveMetaConnection(userId, chosen, userToken);

      try {
        const { syncConnectionsForAccount } = await import("../services/socialDestinations");
        await syncConnectionsForAccount(userId);
      } catch (syncError) {
        // The connection is saved; mirroring it onto a brand is a convenience the
        // user can redo from the platforms screen. Do not fail the whole connect.
        console.error("[Meta OAuth] Failed to mirror connection onto brands:", syncError);
      }

      const params = new URLSearchParams({ meta_success: "true" });
      // Only offer the picker when the user has not already made a choice —
      // re-opening it on every reconnect would be nagging, not helpful.
      if (pages.length > 1 && !existing?.accountId) params.set("meta_pick", "1");
      if (chosen.instagram?.id) params.set("meta_instagram", "1");
      console.log(
        `[Meta OAuth] Connected user ${userId} to page ${chosen.id}` +
          (chosen.instagram ? ` (+ Instagram ${chosen.instagram.id})` : "") +
          (pages.length > 1 ? ` — ${pages.length} pages available` : ""),
      );
      return res.redirect(`${settings}?${params}`);
    } catch (err: any) {
      console.error("[Meta OAuth] Callback error:", err);
      return res.redirect(`${settings}?meta_error=${encodeURIComponent(err?.message || "ukjent_feil")}`);
    }
  });
}
