/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Google OAuth Routes
 * Uses the same session cookie (app_session_id) and JWT structure as Manus OAuth
 * so all existing code remains compatible.
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";

// CSRF/PKCE protection for the LOGIN flow. We mint a random `state` and a PKCE
// `code_verifier`, stash both in short-lived httpOnly cookies, and send `state` +
// the S256 challenge to Google. On callback we require the returned `state` to
// match the cookie (constant-time) before trusting the code, and exchange it with
// the verifier — so a forged/replayed callback (login CSRF / fixation) is rejected.
const STATE_COOKIE = "g_oauth_state";
const VERIFIER_COOKIE = "g_oauth_verifier";
const OAUTH_TX_MAX_AGE_MS = 10 * 60 * 1000;

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Build the Google auth URL and set the transient state + PKCE-verifier cookies on
 * `res`. Used by both the redirect and the JSON login entry points.
 */
function beginGoogleAuth(req: Request, res: Response): string {
  const redirectUri = getGoogleRedirectUri(req);
  const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  const cookieBase = { ...getSessionCookieOptions(req), maxAge: OAUTH_TX_MAX_AGE_MS };
  res.cookie(STATE_COOKIE, state, cookieBase);
  res.cookie(VERIFIER_COOKIE, codeVerifier, cookieBase);

  return googleClient.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    prompt: "consent",
    state,
    code_challenge_method: "S256" as any,
    code_challenge: codeChallenge,
  });
}

function getGoogleRedirectUri(req: Request): string {
  // Vercel production URL
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/auth/callback/google`;
  }
  
  // Fallback for development and other deployments
  const protocol = (req.headers["x-forwarded-proto"] as string) ?? req.protocol;
  let host = (req.headers["x-forwarded-host"] as string) ?? (req.headers.host as string) ?? "localhost:3000";
  
  // Ensure host doesn't have port in production
  if (process.env.NODE_ENV === "production" && typeof host === "string") {
    host = host.split(":")[0];
  }
  
  return `${protocol}://${host}/api/auth/callback/google`;
}

export function registerGoogleOAuthRoutes(app: Express) {
  /**
   * GET /api/auth/login/google
   * Redirects to Google OAuth consent screen
   */
  app.get("/api/auth/login/google", (req: Request, res: Response) => {
    try {
      res.redirect(302, beginGoogleAuth(req, res));
    } catch (error) {
      console.error("[Google OAuth] Failed to generate auth URL:", error);
      res.redirect(302, "/login?error=auth_failed");
    }
  });

  /**
   * GET /api/auth/login
   * Returns Google OAuth URL as JSON (for frontend fetch)
   */
  app.get("/api/auth/login", (req: Request, res: Response) => {
    try {
      res.json({ url: beginGoogleAuth(req, res) });
    } catch (error) {
      console.error("[Google OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: "Failed to generate login URL" });
    }
  });

  /**
   * GET /api/auth/callback/google
   * Handles Google OAuth callback, creates/updates user, sets session cookie
   */
  app.get("/api/auth/callback/google", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const returnedState = req.query.state as string | undefined;

    // Read + immediately clear the single-use transaction cookies.
    const stateCookie = req.cookies?.[STATE_COOKIE] as string | undefined;
    const codeVerifier = req.cookies?.[VERIFIER_COOKIE] as string | undefined;
    res.clearCookie(STATE_COOKIE, { path: "/" });
    res.clearCookie(VERIFIER_COOKIE, { path: "/" });

    if (error || !code) {
      console.error("[Google OAuth] Callback error:", error || "Missing code");
      return res.redirect(302, "/login?error=auth_failed");
    }

    // CSRF guard: the state returned by Google must match the one we set before
    // the redirect. A missing/mismatched state means a forged or replayed callback.
    if (!returnedState || !stateCookie || !timingSafeEqualStr(returnedState, stateCookie)) {
      console.error("[Google OAuth] state mismatch — rejecting (possible login CSRF)");
      return res.redirect(302, "/login?error=state_mismatch");
    }

    try {
      const redirectUri = getGoogleRedirectUri(req);
      const googleClient = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      // Exchange code for tokens, binding the PKCE verifier (codeVerifier is
      // optional on GetTokenOptions, so undefined is fine if it wasn't set).
      const { tokens } = await googleClient.getToken({ code, codeVerifier });

      if (!tokens.id_token) {
        throw new Error("No id_token received from Google");
      }

      // Verify and decode the ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        throw new Error("Invalid token payload from Google");
      }

      const { sub: googleId, email, name } = payload;

      // Use Google sub as openId (prefixed to avoid collision with Manus IDs)
      const openId = `google_${googleId}`;

      // Upsert user in database
      await db.upsertUser({
        openId,
        name: name || email?.split("@")[0] || "User",
        email: email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Create session token using existing SDK (same JWT structure)
      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || email?.split("@")[0] || "User",
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie (same cookie name and options as Manus OAuth)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      console.log(`[Google OAuth] User logged in: ${email} (${openId})`);
      res.redirect(302, "/dashboard");
    } catch (err) {
      console.error("[Google OAuth] Callback failed:", err);
      res.redirect(302, "/login?error=auth_failed");
    }
  });

  /**
   * GET /api/auth/session
   * Returns current session user info (for frontend)
   */
  app.get("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch {
      res.json({ user: null });
    }
  });
}