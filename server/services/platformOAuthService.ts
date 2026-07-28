/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { getDb } from "../db";
import { platformIntegrations, PlatformIntegration } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../_core/tokenCrypto";
import { GRAPH_VERSION, META_SCOPES, graphFetch, graphUrl } from "./metaGraph";

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  // LinkedIn-only: lets the generic publish path post to a Company Page.
  personUrn?: string;
  publishTarget?: string; // 'person' | 'organization'
  organizationUrn?: string | null;
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

/**
 * A Facebook Page the signed-in user administers, plus the Instagram
 * Professional account linked to it (if any).
 *
 * Instagram is not a separate login. Meta retired that path: an Instagram
 * Professional account is reached through the Facebook Page it is connected to,
 * with the PAGE token, on graph.facebook.com. The old `api.instagram.com` /
 * `graph.instagram.com` Basic Display flow this file used to implement cannot
 * publish at all, which is why Instagram never worked here.
 */
export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  instagram?: { id: string; username: string | null } | null;
}

// Facebook + Instagram OAuth: code -> long-lived user token -> per-Page tokens.
export class FacebookOAuth {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: META_SCOPES,
      response_type: "code",
      state,
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
  }

  /**
   * Code -> long-lived USER token.
   *
   * Kept separate from the Page lookup on purpose. The user token is what can
   * enumerate Pages, so it has to outlive the callback: a user who admins three
   * Pages picks one afterwards, and switching later must not force a whole new
   * consent round-trip.
   */
  async exchangeCodeForUserToken(code: string): Promise<{ accessToken: string; expiresAt?: Date }> {
    const short = await graphFetch<{ access_token?: string }>(
      "Facebook-innlogging",
      graphUrl("oauth/access_token", {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code,
      }),
    );
    if (!short.access_token) throw new Error("Facebook-innlogging: ingen tilgangsnøkkel returnert");

    const longLived = await graphFetch<{ access_token?: string; expires_in?: number }>(
      "Facebook langtidsnøkkel",
      graphUrl("oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        fb_exchange_token: short.access_token,
      }),
    );
    if (!longLived.access_token) throw new Error("Facebook langtidsnøkkel: ingen tilgangsnøkkel returnert");

    return {
      accessToken: longLived.access_token,
      // ~60 days. Page tokens derived from it do not expire, but this one does,
      // and it is what the Page picker needs later.
      expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
    };
  }

  /**
   * Every Page the user administers, with its Page token and linked Instagram
   * Professional account. Asking for `instagram_business_account` here means the
   * Instagram connection costs no extra round trip.
   */
  static async listPages(userAccessToken: string): Promise<MetaPage[]> {
    const pages = await graphFetch<{
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string; username?: string };
      }>;
    }>(
      "Facebook-sider",
      graphUrl("me/accounts", {
        fields: "id,name,access_token,instagram_business_account{id,username}",
        access_token: userAccessToken,
      }),
    );

    return (pages.data ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      instagram: page.instagram_business_account
        ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username ?? null }
        : null,
    }));
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

    // `onDuplicateKeyUpdate`, not `onConflictDoUpdate`.
    //
    // The latter is drizzle's Postgres/SQLite API and does not exist on the MySQL
    // builder at all — calling it threw `TypeError: ... is not a function`. It
    // never showed up because the `(db as any)` cast hides it from the type
    // checker, and because nothing could reach this code: there was no OAuth
    // callback route. The moment a working callback was added, every single
    // connect attempt would have died here.
    //
    // The conflict target is the unique key added in migration 0098. Before it
    // the table had only `id`, so even a correct upsert would have inserted a
    // duplicate row on every reconnect.
    const values = {
      accessToken: encryptSecret(token.accessToken),
      refreshToken: token.refreshToken ? encryptSecret(token.refreshToken) : null,
      expiresAt: token.expiresAt || null,
      scope: token.scope || null,
      accountId: accountId || null,
      accountName: accountName || null,
    };

    await (db as any)
      .insert(platformIntegrations)
      .values({ userId, platform, ...values })
      .onDuplicateKeyUpdate({ set: values });
  }

  /**
   * Store a chosen Facebook Page — and its Instagram account, when the Page has
   * one — as the account's Meta connection.
   *
   * Two tokens are kept, and the split matters:
   *
   *  - `accessToken` is the PAGE token. It does not expire, and it is what both
   *    Facebook publishing and Instagram publishing use.
   *  - `refreshToken` holds the long-lived USER token. Facebook has no refresh
   *    tokens, so the column was dead weight for this platform; a user token is
   *    the only thing that can call /me/accounts, and without keeping it the
   *    "switch to another Page" screen would have to send the user back through
   *    the whole consent dialog. It is encrypted by the same code path as the
   *    Page token.
   *
   * Instagram is written as its own row so the rest of the app — destinations,
   * scheduling, analytics — can treat it as the separate channel it is.
   */
  async saveMetaConnection(
    userId: number,
    page: { id: string; name: string; accessToken: string; instagram?: { id: string; username: string | null } | null },
    userToken: { accessToken: string; expiresAt?: Date },
  ): Promise<{ facebook: true; instagram: boolean }> {
    await this.savePlatformToken(
      userId,
      "facebook",
      {
        accessToken: page.accessToken,
        refreshToken: userToken.accessToken,
        expiresAt: userToken.expiresAt,
        scope: META_SCOPES,
      },
      page.id,
      page.name,
    );

    if (page.instagram?.id) {
      await this.savePlatformToken(
        userId,
        "instagram",
        {
          // The PAGE token, deliberately. Instagram Content Publishing is called
          // on graph.facebook.com with the Page token — there is no separate
          // Instagram token in this flow.
          accessToken: page.accessToken,
          refreshToken: userToken.accessToken,
          expiresAt: userToken.expiresAt,
          scope: META_SCOPES,
        },
        page.instagram.id,
        page.instagram.username ?? page.name,
      );
    } else {
      // Switching to a Page without a linked Instagram account must not leave the
      // previous Page's Instagram row behind, publishing to an account the user
      // no longer means to use.
      await this.disconnectPlatform(userId, "instagram");
    }

    return { facebook: true, instagram: Boolean(page.instagram?.id) };
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
      // Newest first. Migration 0098 collapses the duplicates that the broken
      // upsert created, but LIMIT 1 with no ORDER BY was returning whichever row
      // MySQL felt like — in practice the oldest, so a user who reconnected to
      // replace a dead token kept getting the dead one back.
      .orderBy(desc(platformIntegrations.id as any))
      .limit(1);

    if (!result || result.length === 0) {
      // LinkedIn is connected through the dedicated `linkedin_connections` store
      // (the "Koble til LinkedIn" flow / linkedinRouter), NOT platformIntegrations.
      // Bridge it so the generic publish path (publishToSpecific) finds the token
      // instead of reporting "Platform not connected".
      if (platform === "linkedin") {
        const { linkedinConnections } = await import("../../drizzle/schema");
        const conn = await (db as any)
          .select()
          .from(linkedinConnections)
          .where(eq(linkedinConnections.userId as any, userId))
          .limit(1);
        if (conn && conn.length > 0) {
          const toOrg = conn[0].publishTarget === "organization" && conn[0].organizationUrn;
          // Company-Page posting uses the separate org token; personal posting
          // uses the member token. The generic "Publiser" dialog goes through here.
          const activeToken = toOrg && conn[0].orgAccessToken
            ? decryptSecret(conn[0].orgAccessToken) ?? ""
            : decryptSecret(conn[0].accessToken) ?? "";
          return {
            accessToken: activeToken,
            expiresAt: conn[0].expiresAt || undefined,
            scope: "openid profile email w_member_social",
            personUrn: conn[0].personUrn,
            publishTarget: conn[0].publishTarget || "person",
            organizationUrn: conn[0].organizationUrn || null,
          };
        }
      }
      return null;
    }

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
      // Newest first. Migration 0098 collapses the duplicates that the broken
      // upsert created, but LIMIT 1 with no ORDER BY was returning whichever row
      // MySQL felt like — in practice the oldest, so a user who reconnected to
      // replace a dead token kept getting the dead one back.
      .orderBy(desc(platformIntegrations.id as any))
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

    // Instagram publishes with the Facebook PAGE token. Leaving its row behind
    // when Facebook is disconnected means the app keeps posting to Instagram
    // after the user believes they have revoked access — the disconnect button
    // would be telling them something untrue.
    if (platform === "facebook") {
      await (db as any)
        .delete(platformIntegrations)
        .where(
          and(
            eq(platformIntegrations.userId as any, userId),
            eq(platformIntegrations.platform as any, "instagram")
          )
        );
    }

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
