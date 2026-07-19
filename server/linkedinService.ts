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
/**
 * Company-Page (organization) posting is OFF by default. Requesting the
 * organization scopes before the LinkedIn app is approved for the Community
 * Management API makes LinkedIn reject the ENTIRE auth request
 * (unauthorized_scope_error) — which would break the shared connect flow for
 * every customer. So gate it behind an explicit env flag that the operator sets
 * only AFTER approval.
 */
export function isOrgPostingEnabled(): boolean {
  // Enabled only when the dedicated Company-Page app is configured. This also
  // keeps the personal connect flow untouched until the operator opts in.
  return !!(process.env.LINKEDIN_ORG_CLIENT_ID && process.env.LINKEDIN_ORG_CLIENT_SECRET);
}

export function getLinkedInAuthUrl(credentials: LinkedInCredentials, redirectUri: string, state: string): string {
  // Personal-app scopes only: OpenID identity + personal-feed posting.
  // Company-Page posting lives on a SEPARATE app/flow (getLinkedInOrgAuthUrl),
  // because LinkedIn requires the Community Management API to be the ONLY
  // product on its app — it cannot coexist with Sign In / Share here.
  const params = new URLSearchParams({
    response_type: "code",
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email w_member_social",
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/**
 * Company-Page (organization) publishing runs through a SECOND LinkedIn app that
 * carries ONLY the Community Management API (LinkedIn's own requirement). Its
 * credentials live in LINKEDIN_ORG_CLIENT_ID / LINKEDIN_ORG_CLIENT_SECRET.
 */
export function resolveLinkedInOrgCredentials(): LinkedInCredentials | null {
  const id = process.env.LINKEDIN_ORG_CLIENT_ID;
  const secret = process.env.LINKEDIN_ORG_CLIENT_SECRET;
  if (id && secret) return { clientId: id, clientSecret: secret };
  return null;
}

/** Authorization URL for the Company-Page app (organization scopes only). */
export function getLinkedInOrgAuthUrl(credentials: LinkedInCredentials, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    state,
    scope: "r_organization_social w_organization_social rw_organization_admin",
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

export interface LinkedInOrganization {
  urn: string; // urn:li:organization:12345
  id: string;  // 12345
  name: string;
}

/**
 * List the LinkedIn Company Pages (organizations) the connected member is an
 * ADMINISTRATOR of. Requires the rw_organization_admin scope (only granted when
 * org posting is enabled + the app is approved). Returns [] on any failure so
 * the caller can degrade gracefully.
 */
export async function getAdminOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": getLinkedInApiVersion(),
  };
  const aclRes = await fetch(
    "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
    { headers }
  );
  if (!aclRes.ok) {
    throw new Error(`LinkedIn org ACL fetch failed (${aclRes.status}): ${await aclRes.text()}`);
  }
  const aclJson: any = await aclRes.json();
  const elements: any[] = Array.isArray(aclJson?.elements) ? aclJson.elements : [];
  const orgs: LinkedInOrganization[] = [];
  for (const el of elements) {
    const orgUrn: string | undefined = el?.organization;
    if (!orgUrn) continue;
    const id = String(orgUrn).split(":").pop() || "";
    let name = orgUrn;
    try {
      const oRes = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, { headers });
      if (oRes.ok) {
        const o: any = await oRes.json();
        name = o?.localizedName || o?.name?.localized?.en_US || o?.vanityName || orgUrn;
      }
    } catch {
      // keep URN as the display name
    }
    orgs.push({ urn: orgUrn, id, name });
  }
  return orgs;
}

/**
 * Create a text post on LinkedIn using the versioned Posts API (/rest/posts),
 * which replaces the deprecated /v2/ugcPosts endpoint.
 */
/**
 * Upload an image to LinkedIn and return its image URN, so it can be attached to
 * a post. Three steps: initializeUpload -> PUT the bytes -> reference the URN.
 * `owner` is the post author (person or organization URN) and must match the
 * token. Returns null on any failure so posting degrades to text-only.
 */
export async function uploadLinkedInImage(
  accessToken: string,
  ownerUrn: string,
  imageUrl: string
): Promise<string | null> {
  try {
    const version = getLinkedInApiVersion();
    const jsonHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": version,
    };
    const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
    });
    if (!initRes.ok) {
      console.warn(`[LinkedIn image] init failed (${initRes.status}): ${await initRes.text()}`);
      return null;
    }
    const initJson: any = await initRes.json();
    const uploadUrl: string | undefined = initJson?.value?.uploadUrl;
    const imageUrn: string | undefined = initJson?.value?.image;
    if (!uploadUrl || !imageUrn) return null;

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn(`[LinkedIn image] source fetch failed (${imgRes.status})`);
      return null;
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const upRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: bytes,
    });
    if (!upRes.ok && upRes.status !== 201) {
      console.warn(`[LinkedIn image] byte upload failed (${upRes.status})`);
      return null;
    }
    return imageUrn;
  } catch (e) {
    console.warn("[LinkedIn image] upload error:", (e as Error).message);
    return null;
  }
}

export async function createLinkedInPost(
  accessToken: string,
  personUrn: string,
  content: string,
  authorOverride?: string | null,
  imageUrl?: string | null
): Promise<{ id: string; url: string }> {
  // Prefer an explicit author (e.g. a Company Page urn:li:organization:xxx) when
  // provided; otherwise post as the member. The stored personUrn is the OpenID
  // `sub`, normalised into a full person URN.
  const author = authorOverride
    ? authorOverride
    : personUrn.startsWith("urn:li:")
      ? personUrn
      : `urn:li:person:${personUrn}`;

  // Upload the image first (best-effort). A failure degrades to a text post
  // rather than blocking publishing.
  let imageUrn: string | null = null;
  if (imageUrl && /^https?:\/\//.test(imageUrl)) {
    imageUrn = await uploadLinkedInImage(accessToken, author, imageUrl);
  }

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
      ...(imageUrn ? { content: { media: { id: imageUrn } } } : {}),
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
