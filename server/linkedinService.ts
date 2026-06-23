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

/**
 * Create a post on LinkedIn
 * Uses LinkedIn Share API v2
 */
export async function createLinkedInPost(
  accessToken: string,
  personUrn: string,
  content: string
): Promise<{ id: string; url: string }> {
  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn post creation failed: ${error}`);
  }

  const data = await response.json();
  
  // Extract post ID from response
  const postId = data.id;
  const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

  return { id: postId, url: postUrl };
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