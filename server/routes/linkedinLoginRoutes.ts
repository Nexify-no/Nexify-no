/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * "Sign in with LinkedIn" — OAuth LOGIN routes.
 *
 * Distinct from the connect-to-publish flow (/api/linkedin/callback): this signs
 * the user INTO Penna using LinkedIn as an identity provider, mirroring the Google
 * login flow (same session cookie + JWT). Uses the OpenID Connect identity scopes
 * only (openid profile email) — no posting scope.
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import {
  resolveLinkedInCredentials,
  exchangeCodeForToken,
  getLinkedInProfile,
} from "../linkedinService";

const STATE_COOKIE = "li_login_state";
const OAUTH_TX_MAX_AGE_MS = 10 * 60 * 1000;
const LOGIN_SCOPE = "openid profile email"; // identity only — no posting

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Absolute https callback. Must match the value registered in the LinkedIn app. */
function getLoginRedirectUri(req: Request): string {
  return (
    process.env.LINKEDIN_LOGIN_REDIRECT_URI ||
    `https://${(req.headers["x-forwarded-host"] as string) || req.headers.host || "penna.no"}/api/auth/callback/linkedin`
  );
}

function beginLinkedInLogin(req: Request, res: Response): string {
  const creds = resolveLinkedInCredentials(null);
  if (!creds) throw new Error("LinkedIn credentials not configured");
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    ...getSessionCookieOptions(req),
    maxAge: OAUTH_TX_MAX_AGE_MS,
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: getLoginRedirectUri(req),
    state,
    scope: LOGIN_SCOPE,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function registerLinkedInLoginRoutes(app: Express) {
  // GET /api/auth/login/linkedin → redirect to LinkedIn consent
  app.get("/api/auth/login/linkedin", (req: Request, res: Response) => {
    try {
      res.redirect(302, beginLinkedInLogin(req, res));
    } catch (e) {
      console.error("[LinkedIn Login] begin failed:", e);
      res.redirect(302, "/login?error=auth_failed");
    }
  });

  // GET /api/auth/callback/linkedin → exchange code, upsert user, set session
  app.get("/api/auth/callback/linkedin", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const returnedState = req.query.state as string | undefined;
    const stateCookie = req.cookies?.[STATE_COOKIE] as string | undefined;
    res.clearCookie(STATE_COOKIE, { path: "/" });

    if (error || !code) {
      console.error("[LinkedIn Login] callback error:", error || "missing code");
      return res.redirect(302, "/login?error=auth_failed");
    }
    if (!returnedState || !stateCookie || !timingSafeEqualStr(returnedState, stateCookie)) {
      console.error("[LinkedIn Login] state mismatch — rejecting (possible login CSRF)");
      return res.redirect(302, "/login?error=state_mismatch");
    }

    try {
      const creds = resolveLinkedInCredentials(null);
      if (!creds) throw new Error("LinkedIn credentials not configured");
      const token = await exchangeCodeForToken(creds, code, getLoginRedirectUri(req));
      const profile = await getLinkedInProfile(token.access_token);
      if (!profile?.sub) throw new Error("No profile sub from LinkedIn");

      const openId = `linkedin_${profile.sub}`;
      const name = profile.name || profile.email?.split("@")[0] || "User";
      await db.upsertUser({
        openId,
        name,
        email: profile.email ?? null,
        loginMethod: "linkedin",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      console.log(`[LinkedIn Login] User logged in: ${profile.email} (${openId})`);
      res.redirect(302, "/dashboard");
    } catch (e) {
      console.error("[LinkedIn Login] callback failed:", e);
      res.redirect(302, "/login?error=auth_failed");
    }
  });
}
