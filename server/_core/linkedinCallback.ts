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
    try {
      const { code, state, error, error_description } = req.query;

      // Handle OAuth errors
      if (error) {
        console.error(`[LinkedIn OAuth] Error: ${error} - ${error_description}`);
        return res.redirect(`/?linkedin_error=${encodeURIComponent(error_description as string || error as string)}`);
      }

      if (!code || !state) {
        console.error("[LinkedIn OAuth] Missing code or state parameter");
        return res.redirect("/?linkedin_error=missing_parameters");
      }

      // Verify the HMAC-signed state (CSRF protection). A forged state with a
      // different userId, or an expired one, is rejected — we never trust a raw
      // userId embedded in the callback URL.
      const userId = verifyOAuthState(state as string);
      if (userId === null) {
        console.error("[LinkedIn OAuth] Invalid or expired state");
        return res.redirect("/?linkedin_error=invalid_state");
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
        return res.redirect("/?linkedin_error=no_credentials");
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

      // Redirect to settings page with success message
      return res.redirect("/innstillinger?linkedin_success=true");
    } catch (error: any) {
      console.error("[LinkedIn OAuth] Callback error:", error);
      return res.redirect(`/?linkedin_error=${encodeURIComponent(error.message || "unknown_error")}`);
    }
  });

  // Company-Page (organization) OAuth callback — separate LinkedIn app carrying
  // only the Community Management API. Stores an org-scoped token alongside the
  // user's existing personal connection.
  app.get("/api/linkedin/org/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;
      if (error) {
        console.error(`[LinkedIn Org OAuth] Error: ${error} - ${error_description}`);
        return res.redirect(`/innstillinger?linkedin_org_error=${encodeURIComponent((error_description as string) || (error as string))}`);
      }
      if (!code || !state) {
        return res.redirect("/innstillinger?linkedin_org_error=missing_parameters");
      }
      const userId = verifyOAuthState(state as string);
      if (userId === null) {
        return res.redirect("/innstillinger?linkedin_org_error=invalid_state");
      }
      const { resolveLinkedInOrgCredentials, exchangeCodeForToken, calculateExpirationDate } = await import("../linkedinService");
      const orgCreds = resolveLinkedInOrgCredentials();
      if (!orgCreds) {
        return res.redirect("/innstillinger?linkedin_org_error=org_app_not_configured");
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { linkedinConnections } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const redirectUri = process.env.LINKEDIN_ORG_REDIRECT_URI
        || `https://${req.get("host") || "penna.no"}/api/linkedin/org/callback`;
      const tokenResponse = await exchangeCodeForToken(orgCreds, code as string, redirectUri);
      const orgTokenExpiresAt = calculateExpirationDate(tokenResponse.expires_in);

      const existing = await db.select().from(linkedinConnections).where(eq(linkedinConnections.userId, userId)).limit(1);
      if (existing.length === 0) {
        // The org token attaches to an existing connection (personUrn is required).
        return res.redirect("/innstillinger?linkedin_org_error=connect_personal_first");
      }
      await db.update(linkedinConnections)
        .set({
          orgAccessToken: encryptSecret(tokenResponse.access_token),
          orgTokenExpiresAt,
        })
        .where(eq(linkedinConnections.userId, userId));

      console.log(`[LinkedIn Org OAuth] Stored org token for user ${userId}`);
      return res.redirect("/innstillinger?linkedin_org_success=true");
    } catch (error: any) {
      console.error("[LinkedIn Org OAuth] Callback error:", error);
      return res.redirect(`/innstillinger?linkedin_org_error=${encodeURIComponent(error.message || "unknown_error")}`);
    }
  });
}
