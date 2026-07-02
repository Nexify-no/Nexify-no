/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import type { Express } from "express";
import { verifyOAuthState } from "./oauthState";
import { encryptSecret } from "./tokenCrypto";

/**
 * Register LinkedIn OAuth callback route
 */
export function registerLinkedInCallback(app: Express) {
  app.get("/api/linkedin/callback", async (req, res) => {
    // The first-run wizard sets a short-lived `li_return_to` cookie before
    // starting OAuth so BOTH success and error/cancel land back mid-wizard
    // (a cancel on LinkedIn's consent screen must not strand the user on the
    // homepage). Only exact allowlisted same-site paths are honored — never an
    // arbitrary redirect target. Resolved up-front so every branch, including
    // the catch-all, uses it.
    const RETURN_ALLOWLIST = new Set(["/kom-i-gang", "/onboarding"]);
    const cookieHeader = req.headers.cookie || "";
    const returnToMatch = cookieHeader.match(/(?:^|;\s*)li_return_to=([^;]+)/);
    let requested = "";
    try {
      requested = returnToMatch ? decodeURIComponent(returnToMatch[1]) : "";
    } catch {
      requested = "";
    }
    const returnTo = RETURN_ALLOWLIST.has(requested) ? requested : null;
    res.setHeader("Set-Cookie", "li_return_to=; Path=/; Max-Age=0; SameSite=Lax");
    const errorTarget = returnTo ?? "/";
    try {
      const { code, state, error, error_description } = req.query;

      // Handle OAuth errors (incl. the user pressing Cancel on the consent screen)
      if (error) {
        console.error(`[LinkedIn OAuth] Error: ${error} - ${error_description}`);
        return res.redirect(`${errorTarget}?linkedin_error=${encodeURIComponent(error_description as string || error as string)}`);
      }

      if (!code || !state) {
        console.error("[LinkedIn OAuth] Missing code or state parameter");
        return res.redirect(`${errorTarget}?linkedin_error=missing_parameters`);
      }

      // Verify the HMAC-signed state (CSRF protection). A forged state with a
      // different userId, or an expired one, is rejected — we never trust a raw
      // userId embedded in the callback URL.
      const userId = verifyOAuthState(state as string);
      if (userId === null) {
        console.error("[LinkedIn OAuth] Invalid or expired state");
        return res.redirect(`${errorTarget}?linkedin_error=invalid_state`);
      }

      // Get app credentials
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { linkedinAppCredentials, linkedinConnections } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const credentials = await db.select().from(linkedinAppCredentials).limit(1);
      const { resolveLinkedInCredentials } = await import("../linkedinService");
      const appCreds = resolveLinkedInCredentials(credentials[0] ?? null);
      if (!appCreds) {
        console.error("[LinkedIn OAuth] No credentials configured");
        return res.redirect(`${errorTarget}?linkedin_error=no_credentials`);
      }

      // Exchange code for token
      const { exchangeCodeForToken, getLinkedInProfile, calculateExpirationDate } = await import("../linkedinService");
      // Must EXACTLY match the redirect_uri used in getAuthUrl (and the value
      // registered in the LinkedIn app). Prefer the env, else host + https.
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI
        || `https://${req.get("host") || "penna.no"}/api/linkedin/callback`;

      const tokenResponse = await exchangeCodeForToken(
        appCreds,
        code as string,
        redirectUri
      );

      // Get user profile
      const profile = await getLinkedInProfile(tokenResponse.access_token);

      // Save connection to database
      const expiresAt = calculateExpirationDate(tokenResponse.expires_in);

      const existingConnection = await db.select()
        .from(linkedinConnections)
        .where(eq(linkedinConnections.userId, userId))
        .limit(1);

      if (existingConnection.length > 0) {
        // Update existing connection
        await db.update(linkedinConnections)
          .set({
            accessToken: encryptSecret(tokenResponse.access_token),
            personUrn: profile.sub,
            profileName: profile.name,
            profileEmail: profile.email,
            expiresAt,
          })
          .where(eq(linkedinConnections.userId, userId));
      } else {
        // Insert new connection
        await db.insert(linkedinConnections).values({
          userId,
          accessToken: encryptSecret(tokenResponse.access_token),
          personUrn: profile.sub,
          profileName: profile.name,
          profileEmail: profile.email,
          expiresAt,
        });
      }

      console.log(`[LinkedIn OAuth] Successfully connected user ${userId} to LinkedIn`);

      // Success: resume the wizard when it initiated the flow, else settings.
      return res.redirect(`${returnTo ?? "/innstillinger"}?linkedin_success=true`);
    } catch (error: any) {
      console.error("[LinkedIn OAuth] Callback error:", error);
      return res.redirect(`${errorTarget}?linkedin_error=${encodeURIComponent(error.message || "unknown_error")}`);
    }
  });
}