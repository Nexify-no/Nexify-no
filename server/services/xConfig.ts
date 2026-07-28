/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import type { PlatformConfig } from "./platformOAuthService";

export const X_CALLBACK_PATH = "/api/x/callback";

/**
 * X (formerly Twitter) app credentials, or null when the app is not configured.
 *
 * Null rather than an object of empty strings, for the same reason `metaConfig`
 * does it: `process.env.TWITTER_CLIENT_ID || ""` — which is what
 * `platformRouter` did — produces a perfectly well-formed authorization URL with
 * an empty `client_id`, so an unconfigured deploy sends the user to X to be told
 * the client is invalid. Missing configuration belongs here, as "X er ikke satt
 * opp", not on X's error page.
 *
 * `X_*` is the current name; `TWITTER_*` is still read so an existing deploy
 * keeps working. The platform value in the database stays `twitter` — that is
 * the enum every table already uses, and renaming it is a migration with no user
 * -visible benefit.
 */
export function resolveXConfig(host?: string | null): PlatformConfig | null {
  const clientId = (process.env.X_CLIENT_ID ?? process.env.TWITTER_CLIENT_ID)?.trim();
  const clientSecret = (process.env.X_CLIENT_SECRET ?? process.env.TWITTER_CLIENT_SECRET)?.trim();
  if (!clientId || !clientSecret) return null;

  // Must match the callback URL registered in the X developer portal byte for
  // byte — X compares it as a string on both the authorize and the token call.
  // Derived from the request host so preview deploys work against their own
  // callback, but an explicit override always wins.
  const redirectUri =
    (process.env.X_REDIRECT_URI ?? process.env.TWITTER_REDIRECT_URI)?.trim() ||
    `https://${host || "penna.no"}${X_CALLBACK_PATH}`;

  return { clientId, clientSecret, redirectUri };
}

export function isXConfigured(): boolean {
  return resolveXConfig() !== null;
}
