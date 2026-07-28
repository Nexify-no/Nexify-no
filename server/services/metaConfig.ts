/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import type { PlatformConfig } from "./platformOAuthService";

export const META_CALLBACK_PATH = "/api/meta/callback";

/**
 * The Meta app credentials, or null when the app is not configured.
 *
 * Returning null rather than an object full of empty strings is the point. The
 * previous code did `process.env.FACEBOOK_CLIENT_ID || ""`, so a deploy with no
 * Meta app configured produced a perfectly well-formed authorization URL with an
 * empty client_id — the user was sent to Facebook, which showed them an
 * "Invalid App ID" error page. Missing configuration should be visible here, as
 * "Facebook er ikke satt opp", not as a Meta error screen.
 *
 * The redirect URI must byte-for-byte match the one registered in the Meta app;
 * Meta compares it as a string on both the authorize and the token call. It is
 * derived from the request host so preview deploys work, but an explicit
 * FACEBOOK_REDIRECT_URI always wins.
 */
export function resolveMetaConfig(host?: string | null): PlatformConfig | null {
  const clientId = process.env.FACEBOOK_CLIENT_ID?.trim();
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const redirectUri =
    process.env.FACEBOOK_REDIRECT_URI?.trim() ||
    `https://${host || "penna.no"}${META_CALLBACK_PATH}`;

  return { clientId, clientSecret, redirectUri };
}

export function isMetaConfigured(): boolean {
  return resolveMetaConfig() !== null;
}
