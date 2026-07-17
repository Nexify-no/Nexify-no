/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { getDb } from "../db";
import { platformIntegrations, PlatformIntegration } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../_core/tokenCrypto";

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface PlatformConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// LinkedIn OAuth
export class LinkedInOAuth {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: "openid profile email w_member_social",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`LinkedIn OAuth failed: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }
}

// Twitter OAuth 2.0
export class TwitterOAuth {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: "tweet.read tweet.write users.read",
      state,
      code_challenge_method: "plain",
      code_challenge: "challenge",
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: "challenge",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Twitter OAuth failed: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }
}

// Instagram OAuth (via Facebook)
export class InstagramOAuth {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: "instagram_basic,instagram_content_publish",
      response_type: "code",
      state,
    });
    return `https://api.instagram.com/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    const response = await fetch("https://graph.instagram.com/v18.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
        code,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Instagram OAuth failed: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; user_id: string };
    return {
      accessToken: data.access_token,
    };
  }
}

// Facebook OAuth (complete: short-lived code -> long-lived user token -> non-expiring PAGE token)
export class FacebookOAuth {
  private config: PlatformConfig;
  private static readonly V = process.env.META_GRAPH_VERSION || "v21.0";

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      // pages_show_list is required to read /me/accounts; business_management is
      // needed when the Page is owned by a Business Manager (Nexify).
      scope: "pages_show_list,pages_manage_posts,pages_read_engagement,business_management",
      response_type: "code",
      state,
    });
    return `https://www.facebook.com/${FacebookOAuth.V}/dialog/oauth?${params}`;
  }

  /**
   * Exchanges the OAuth code and returns a connection ready to save:
   * a non-expiring PAGE token plus the page id/name. Publishing with a page
   * token never needs the /me/accounts lookup again and survives user-token expiry.
   */
  async exchangeCodeForToken(code: string): Promise<OAuthToken & { accountId: string; accountName: string }> {
    const V = FacebookOAuth.V;
    const short = (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?` + new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code,
    })).then((r) => r.json())) as { access_token?: string; error?: { message: string } };
    if (short.error || !short.access_token) throw new Error(`Facebook OAuth: ${short.error?.message ?? "no access token"}`);

    const longLived = (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?` + new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      fb_exchange_token: short.access_token,
    })).then((r) => r.json())) as { access_token?: string; error?: { message: string } };
    if (longLived.error || !longLived.access_token) throw new Error(`Facebook long-lived exchange: ${longLived.error?.message ?? "failed"}`);

    const pages = (await fetch(`https://graph.facebook.com/${V}/me/accounts?` + new URLSearchParams({
      fields: "id,name,access_token",
      access_token: longLived.access_token,
    })).then((r) => r.json())) as { data?: Array<{ id: string; name: string; access_token: string }>; error?: { message: string } };
    if (pages.error) throw new Error(`Facebook /me/accounts: ${pages.error.message}`);
    const page = pages.data?.[0]; // TODO: if the user admins multiple Pages, add a picker
    if (!page) throw new Error("Ingen Facebook-side funnet (du må være administrator for en side).");

    return {
      accessToken: page.access_token, // PAGE token — effectively non-expiring
      accountId: page.id,
      accountName: page.name,
      scope: "pages_show_list,pages_manage_posts,pages_read_engagement,business_management",
    };
  }
}

// Platform Integration Manager
export class PlatformIntegrationManager {
  async savePlatformToken(
    userId: number,
    platform: string,
    token: OAuthToken,
    accountId?: string,
    accountName?: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");

    await (db as any)
      .insert(platformIntegrations)
      .values({
        userId,
        platform,
        accessToken: encryptSecret(token.accessToken),
        refreshToken: token.refreshToken ? encryptSecret(token.refreshToken) : null,
        expiresAt: token.expiresAt || null,
        scope: token.scope || null,
        accountId: accountId || null,
        accountName: accountName || null,
      })
      .onConflictDoUpdate({
        target: [platformIntegrations.userId, platformIntegrations.platform],
        set: {
          accessToken: encryptSecret(token.accessToken),
          refreshToken: token.refreshToken ? encryptSecret(token.refreshToken) : null,
          expiresAt: token.expiresAt || null,
          scope: token.scope || null,
          accountId: accountId || null,
          accountName: accountName || null,
        },
      });
  }

  async getPlatformToken(userId: number, platform: string): Promise<OAuthToken | null> {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");

    const result = await (db as any)
      .select()
      .from(platformIntegrations)
      .where(
        and(
          eq(platformIntegrations.userId as any, userId),
          eq(platformIntegrations.platform as any, platform)
        )
      )
      .limit(1);

    if (!result || result.length === 0) return null;

    const integration = result[0] as PlatformIntegration;
    return {
      accessToken: decryptSecret(integration.accessToken) ?? "",
      refreshToken: decryptSecret(integration.refreshToken) ?? undefined,
      expiresAt: integration.expiresAt || undefined,
      scope: integration.scope || undefined,
    };
  }

  /** Like getPlatformToken, but also returns the connected account id/name (e.g. the FB Page). */
  async getPlatformConnection(
    userId: number,
    platform: string
  ): Promise<(OAuthToken & { accountId: string | null; accountName: string | null }) | null> {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");

    const result = await (db as any)
      .select()
      .from(platformIntegrations)
      .where(
        and(
          eq(platformIntegrations.userId as any, userId),
          eq(platformIntegrations.platform as any, platform)
        )
      )
      .limit(1);

    if (!result || result.length === 0) return null;
    const integration = result[0] as PlatformIntegration;
    return {
      accessToken: decryptSecret(integration.accessToken) ?? "",
      refreshToken: decryptSecret(integration.refreshToken) ?? undefined,
      expiresAt: integration.expiresAt || undefined,
      scope: integration.scope || undefined,
      accountId: integration.accountId ?? null,
      accountName: integration.accountName ?? null,
    };
  }

  async disconnectPlatform(userId: number, platform: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");

    await (db as any)
      .delete(platformIntegrations)
      .where(
        and(
          eq(platformIntegrations.userId as any, userId),
          eq(platformIntegrations.platform as any, platform)
        )
      );
  }

  async getUserPlatforms(userId: number): Promise<string[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");

    const results = await (db as any)
      .select({ platform: platformIntegrations.platform })
      .from(platformIntegrations)
      .where(eq(platformIntegrations.userId as any, userId));

    return results.map((r: any) => r.platform);
  }
}

export const platformManager = new PlatformIntegrationManager();