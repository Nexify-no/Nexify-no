/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */


/**
 * LinkedIn OAuth 2.0 Service
 * Handles authentication and API interactions with LinkedIn
 */

export interface LinkedInCredentials {
  clientId: string;
  clientSecret: string;
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number; // seconds (typically 5184000 = 60 days)
  scope: string;
}

export interface LinkedInProfile {
  sub: string; // person URN
  name: string;
  email: string;
  picture?: string;
}

/**
 * Resolve the LinkedIn app credentials. Prefers environment variables
 * (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET) — the recommended, more secure
 * source (a managed secret store, never written to the DB or shown in the UI) —
 * and falls back to credentials saved in the database via admin Settings.
 */
export function resolveLinkedInCredentials(
  dbCreds?: { clientId: string; clientSecret: string } | null
): { clientId: string; clientSecret: string } | null {
  const envId = process.env.LINKEDIN_CLIENT_ID;
  const envSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };
  if (dbCreds?.clientId && dbCreds?.clientSecret) {
    return { clientId: dbCreds.clientId, clientSecret: dbCreds.clientSecret };
  }
  return null;
}

/**
 * Generate LinkedIn OAuth authorization URL
 */
export function getLinkedInAuthUrl(credentials: LinkedInCredentials, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email w_member_social", // w_member_social for posting
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  credentials: LinkedInCredentials,
  code: string,
  redirectUri: string
): Promise<LinkedInTokenResponse> {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Get LinkedIn user profile using OpenID Connect
 */
export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn profile fetch failed: ${error}`);
  }

  return response.json();
}

/** Versioned LinkedIn API version (YYYYMM). Override with LINKEDIN_API_VERSION. */
export function getLinkedInApiVersion(): string {
  return process.env.LINKEDIN_API_VERSION || "202606";
}

/**
 * Escape text for the LinkedIn Posts API "little text" format. Reserved
 * characters must be backslash-escaped or the API rejects / mis-renders the post.
 * '#' is intentionally left unescaped so hashtags still render as hashtags.
 */
export function escapeLinkedInCommentary(text: string): string {
  return text.replace(/[\\<>{}()[\]@|~_*]/g, (c) => `\\${c}`);
}

/**
 * Create a text post on LinkedIn using the versioned Posts API (/rest/posts),
 * which replaces the deprecated /v2/ugcPosts endpoint.
 */
export async function createLinkedInPost(
  accessToken: string,
  personUrn: string,
  content: string
): Promise<{ id: string; url: string }> {
  // The stored identifier is the OpenID `sub`; normalise it into a full person URN.
  const author = personUrn.startsWith("urn:li:")
    ? personUrn
    : `urn:li:person:${personUrn}`;

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": getLinkedInApiVersion(),
    },
    body: JSON.stringify({
      author,
      commentary: escapeLinkedInCommentary(content),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn post creation failed (${response.status}): ${error}`);
  }

  // The Posts API returns the new post's URN in the `x-restli-id` response header
  // (201 Created) — NOT in the body. Headers.get() is case-insensitive.
  const postUrn = response.headers.get("x-restli-id") ?? "";
  const postUrl = postUrn
    ? `https://www.linkedin.com/feed/update/${postUrn}/`
    : "https://www.linkedin.com/feed/";

  return { id: postUrn, url: postUrl };
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() >= expiresAt;
}

/**
 * Calculate expiration date from expires_in seconds
 */
export function calculateExpirationDate(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}