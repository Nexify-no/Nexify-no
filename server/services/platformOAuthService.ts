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

/**
 * The X account behind a connection — what the settings screen shows the user so
 * they can tell which handle they authorised.
 */
export interface XProfile {
  id: string;
  username: string;
  name: string | null;
}

/**
 * Scopes requested from X.
 *
 * `offline.access` is not optional here. X access tokens live about two hours;
 * without a refresh token every connection would be dead by the time the user
 * scheduled anything, and the failure would look like a bug rather than an
 * expiry. `users.read` is what turns an anonymous token into a handle we can
 * display.
 */
export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"].join(" ");

/** A minute of headroom: a token that expires mid-request is an expired token. */
const X_EXPIRY_SKEW_MS = 60_000;

/** userId -> in-flight refresh, so concurrent callers share one rotation. */
const X_REFRESHES = new Map<number, Promise<OAuthToken | null>>();

// X (formerly Twitter) OAuth 2.0 with PKCE.
export class TwitterOAuth {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    this.config = config;
  }

  /**
   * `codeChallenge` is required. It used to be a hardcoded literal shared by
   * every user, which made the PKCE exchange decorative — see server/services/xPkce.ts.
   */
  getAuthorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: X_SCOPES,
      state,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
    });
    return `https://x.com/i/oauth2/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<OAuthToken> {
    return this.tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    });
  }

  /**
   * Trade a refresh token for a new access token.
   *
   * X rotates refresh tokens: the response carries a NEW one and the old is
   * dead. Callers must persist what comes back, not just the access token, or
   * the connection breaks on the following refresh instead of this one.
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthToken> {
    return this.tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  private async tokenRequest(fields: Record<string, string>): Promise<OAuthToken> {
    const response = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
      },
      // client_id in the body as well as in the Basic header: X requires it for
      // the PKCE grant even on a confidential client, and rejects the request
      // with an opaque 400 when it is missing.
      body: new URLSearchParams({ client_id: this.config.clientId, ...fields }).toString(),
    });

    const body = (await response.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; error?: string; error_description?: string }
      | null;

    // X answers 400 with a JSON error body far more often than it answers a
    // clean status, so read the body before trusting the status code.
    if (!response.ok || !body?.access_token) {
      const detail = body?.error_description || body?.error || response.statusText || "ukjent feil";
      throw new Error(`X OAuth failed: ${detail}`);
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + (body.expires_in ?? 7200) * 1000),
      scope: body.scope ?? X_SCOPES,
    };
  }

  /** The authenticated account, for display. Requires the `users.read` scope. */
  static async fetchMe(accessToken: string): Promise<XProfile> {
    const response = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = (await response.json().catch(() => null)) as
      | { data?: { id: string; username: string; name?: string }; detail?: string; title?: string }
      | null;
    if (!response.ok || !body?.data?.id) {
      throw new Error(`X profile lookup failed: ${body?.detail || body?.title || response.statusText}`);
    }
    return { id: body.data.id, username: body.data.username, name: body.data.name ?? null };
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
    const token: OAuthToken = {
      accessToken: decryptSecret(integration.accessToken) ?? "",
      refreshToken: decryptSecret(integration.refreshToken) ?? undefined,
      expiresAt: integration.expiresAt || undefined,
      scope: integration.scope || undefined,
    };

    // X access tokens last about two hours. Every other platform here hands out
    // a token measured in weeks, so returning the stored value unconditionally —
    // which is what this method did — means an X connection is dead almost as
    // soon as it is made, and a scheduled post fires against an expired token
    // with no way to recover. Refresh transparently instead.
    if (platform === "twitter") {
      const expiresAt = integration.expiresAt ? new Date(integration.expiresAt).getTime() : null;
      if (expiresAt !== null && expiresAt - X_EXPIRY_SKEW_MS <= Date.now()) {
        const refreshed = await this.refreshXTokenIfExpired(userId, integration, token);
        // Null means the refresh failed for good — the user revoked Penna in
        // x.com, or the refresh token was already rotated away. Returning the
        // EXPIRED token here (which is what `?? token` would do) buys a
        // guaranteed 401 from X and an error message quoting X's JSON at the
        // user. Reporting "not connected" is both true and actionable.
        return refreshed;
      }
    }

    return token;
  }

  /**
   * Returns a live X token, refreshing and persisting it when the stored one is
   * spent. Null when it cannot be refreshed, so the caller reports the connection
   * as gone rather than making a request that is certain to 401.
   *
   * Refreshes are de-duplicated per user. X rotates the refresh token on every
   * use — the response carries a new one and the old dies immediately — so two
   * concurrent refreshes race: both read `rt1`, one persists `rt2`, the other
   * either fails or overwrites it with a token minted from an already-dead
   * parent. The connection is then bricked until the user reconnects, and the
   * symptom is an opaque 401 hours later. This is not theoretical here: the
   * nightly engagement-metrics sweep calls getPlatformToken for every user with
   * X analytics, and overlaps any interactive publish.
   */
  private async refreshXTokenIfExpired(
    userId: number,
    integration: PlatformIntegration,
    token: OAuthToken,
  ): Promise<OAuthToken | null> {
    const inFlight = X_REFRESHES.get(userId);
    if (inFlight) return inFlight;

    const attempt = this.performXRefresh(userId, integration, token).finally(() => {
      X_REFRESHES.delete(userId);
    });
    X_REFRESHES.set(userId, attempt);
    return attempt;
  }

  private async performXRefresh(
    userId: number,
    integration: PlatformIntegration,
    token: OAuthToken,
  ): Promise<OAuthToken | null> {
    if (!token.refreshToken) {
      console.warn(
        `[X] Token for user ${userId} has expired and there is no refresh token — reconnect required.`,
      );
      return null;
    }

    try {
      const { resolveXConfig } = await import("./xConfig");
      const config = resolveXConfig();
      if (!config) {
        console.error("[X] Cannot refresh: X_CLIENT_ID / X_CLIENT_SECRET are not configured.");
        return null;
      }
      const refreshed = await new TwitterOAuth(config).refreshAccessToken(token.refreshToken);
      // Persist the ROTATED refresh token, not just the access token. Keeping the
      // old one means this refresh succeeds and the next one fails.
      await this.savePlatformToken(
        userId,
        "twitter",
        { ...refreshed, refreshToken: refreshed.refreshToken ?? token.refreshToken },
        integration.accountId ?? undefined,
        integration.accountName ?? undefined,
      );
      return refreshed;
    } catch (error) {
      console.error(`[X] Failed to refresh token for user ${userId}:`, error);
      return null;
    }
  }

  /** Store an X connection together with the handle it belongs to. */
  async saveXConnection(userId: number, token: OAuthToken, profile: XProfile): Promise<void> {
    await this.savePlatformToken(
      userId,
      "twitter",
      { ...token, scope: token.scope ?? X_SCOPES },
      profile.id,
      // The handle, not the display name: it is what the user recognises and
      // what they can check against x.com to confirm they authorised the right
      // account.
      `@${profile.username}`,
    );
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

    const platforms: string[] = results.map((r: any) => r.platform);

    // LinkedIn does not live in platform_integrations.
    //
    // It is connected through the dedicated "Koble til LinkedIn" flow, which
    // writes to linkedin_connections. `getPlatformToken` already bridges the two
    // stores — this one did not, so the settings screen asked "which platforms
    // are connected", got an answer with no LinkedIn in it, and rendered a
    // "Koble til LinkedIn" button to a user whose LinkedIn was connected and
    // publishing. Clicking it sent them through a whole OAuth round trip to
    // reach the state they were already in.
    if (!platforms.includes("linkedin")) {
      try {
        const { linkedinConnections } = await import("../../drizzle/schema");
        const conn = await (db as any)
          .select({ id: linkedinConnections.id })
          .from(linkedinConnections)
          .where(eq(linkedinConnections.userId as any, userId))
          .limit(1);
        if (conn && conn.length > 0) platforms.push("linkedin");
      } catch (error) {
        // A missing LinkedIn row is not a reason to fail the whole screen.
        console.error("[Platforms] Could not read linkedin_connections:", error);
      }
    }

    return platforms;
  }
}

export const platformManager = new PlatformIntegrationManager();
