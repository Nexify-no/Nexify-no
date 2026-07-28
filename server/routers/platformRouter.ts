/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  LinkedInOAuth,
  TwitterOAuth,
  FacebookOAuth,
  platformManager,
} from "../services/platformOAuthService";
import { publishingManager, type PublishContent } from "../services/publishingService";
import { createPost, recordPostAnalytics, markPostPublished } from "../db";

// OAuth configurations (should be in environment variables)
const linkedinConfig = {
  clientId: process.env.LINKEDIN_CLIENT_ID || "",
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
  redirectUri: process.env.LINKEDIN_REDIRECT_URI || "",
};

const twitterConfig = {
  clientId: process.env.TWITTER_CLIENT_ID || "",
  clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
  redirectUri: process.env.TWITTER_REDIRECT_URI || "",
};

export const platformRouter = router({
  // Get OAuth authorization URLs
  getLinkedInAuthUrl: publicProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }) => {
      const oauth = new LinkedInOAuth(linkedinConfig);
      return { authUrl: oauth.getAuthorizationUrl(input.state) };
    }),

  getTwitterAuthUrl: publicProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }) => {
      const oauth = new TwitterOAuth(twitterConfig);
      return { authUrl: oauth.getAuthorizationUrl(input.state) };
    }),

  /**
   * Start the Meta connect flow (Facebook Page + linked Instagram account).
   *
   * `protectedProcedure`, and the state is signed HERE rather than accepted from
   * the caller. The old `getFacebookAuthUrl` was public and took `state` as an
   * input string, which meant the state carried no proof of who started the flow
   * — any value round-tripped through Meta unchanged. The callback now verifies
   * an HMAC-signed state containing this user's id.
   */
  getMetaAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const { resolveMetaConfig } = await import("../services/metaConfig");
    // The SAME host the callback will derive from. Meta compares redirect_uri as
    // a string on both the authorize and the token call, so computing it without
    // the host here — while the callback computes it with — sent every
    // preview/staging user to the production callback, on a different database.
    const config = resolveMetaConfig(ctx.req.get("host"));
    if (!config) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Facebook er ikke satt opp på denne installasjonen ennå.",
      });
    }
    const { signOAuthState } = await import("../_core/oauthState");
    const oauth = new FacebookOAuth(config);
    return { authUrl: oauth.getAuthorizationUrl(signOAuthState(ctx.user.id)) };
  }),

  /**
   * The Pages this user administers, for the picker.
   *
   * Uses the stored long-lived USER token — the Page token cannot enumerate
   * Pages, only act on its own. `connected` marks which one is currently in use.
   */
  listMetaPages: protectedProcedure.query(async ({ ctx }) => {
    const connection = await platformManager.getPlatformConnection(ctx.user.id, "facebook");
    if (!connection) return { connected: false as const, pages: [] };
    if (!connection.refreshToken) {
      // A connection saved before the user token was kept. Publishing still works
      // with the Page token; switching Pages needs a reconnect.
      return {
        connected: true as const,
        pages: [],
        needsReconnectToSwitch: true,
        currentPageId: connection.accountId,
        currentPageName: connection.accountName,
      };
    }
    const { FacebookOAuth: FB } = await import("../services/platformOAuthService");
    const pages = await FB.listPages(connection.refreshToken);
    return {
      connected: true as const,
      currentPageId: connection.accountId,
      currentPageName: connection.accountName,
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        instagramUsername: p.instagram?.username ?? null,
        isCurrent: p.id === connection.accountId,
      })),
    };
  }),

  /** Switch which Page (and therefore which Instagram account) is published to. */
  selectMetaPage: protectedProcedure
    .input(z.object({ pageId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const connection = await platformManager.getPlatformConnection(ctx.user.id, "facebook");
      if (!connection?.refreshToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Koble til Facebook på nytt for å bytte side.",
        });
      }
      const { FacebookOAuth: FB } = await import("../services/platformOAuthService");
      const pages = await FB.listPages(connection.refreshToken);
      const page = pages.find((p) => p.id === input.pageId);
      if (!page) {
        // Not a 404 by accident: the list came from Meta a moment ago, so a miss
        // means the user lost admin rights on that Page, or is guessing an id.
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Du er ikke administrator for denne siden.",
        });
      }
      await platformManager.saveMetaConnection(ctx.user.id, page, {
        accessToken: connection.refreshToken,
        expiresAt: connection.expiresAt,
      });
      try {
        const { syncConnectionsForAccount } = await import("../services/socialDestinations");
        await syncConnectionsForAccount(ctx.user.id);
      } catch (error) {
        console.error("[Meta] Failed to mirror connection onto brands:", error);
      }
      return {
        success: true,
        pageName: page.name,
        instagramConnected: Boolean(page.instagram?.id),
      };
    }),

  // Handle OAuth callbacks
  handleLinkedInCallback: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const oauth = new LinkedInOAuth(linkedinConfig);
        const token = await oauth.exchangeCodeForToken(input.code);
        await platformManager.savePlatformToken(ctx.user.id, "linkedin", token);
        return { success: true, message: "LinkedIn connected successfully" };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  handleTwitterCallback: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const oauth = new TwitterOAuth(twitterConfig);
        const token = await oauth.exchangeCodeForToken(input.code);
        await platformManager.savePlatformToken(ctx.user.id, "twitter", token);
        return { success: true, message: "Twitter connected successfully" };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  // Get connected platforms
  getConnectedPlatforms: protectedProcedure.query(async ({ ctx }) => {
    const platforms = await platformManager.getUserPlatforms(ctx.user.id);
    return { platforms };
  }),

  // Disconnect platform
  disconnectPlatform: protectedProcedure
    .input(z.object({ platform: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await platformManager.disconnectPlatform(ctx.user.id, input.platform);
        return { success: true, message: `${input.platform} disconnected` };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  // Publish to all connected platforms
  publishToAll: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        title: z.string().optional(),
        imageUrl: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        link: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // PR #82: publishToAllConnectedPlatforms iterates EVERY token the account
      // owns — no brand, no destination, no duplicate check. That is exactly the
      // hole this PR exists to close, so with multi-brand on it is refused and
      // the caller must name its platforms and go through the guarded path.
      const { ENV } = await import("../_core/env");
      if (ENV.featureMultiBrand) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Velg hvilke kanaler innlegget skal publiseres til.",
        });
      }
      try {
        const publishContent: PublishContent = {
          content: input.content,
          title: input.title,
          imageUrl: input.imageUrl,
          hashtags: input.hashtags,
          link: input.link,
        };

        const results = await publishingManager.publishToAllConnectedPlatforms(
          ctx.user.id,
          publishContent
        );

        // Best-effort: record each successful publication as a published post + analytics
        // row so the "best time to post" pipeline has real engagement data to learn from.
        // Wrapped per-result so analytics bookkeeping never breaks publishing.
        for (const r of results) {
          if (!r.success) continue;
          try {
            const post = await createPost({
              userId: ctx.user.id,
              platform: r.platform as any,
              tone: "professional",
              rawInput: input.content,
              generatedContent: input.content,
              status: "published",
              publishedAt: new Date(),
            } as any);
            await recordPostAnalytics(
              ctx.user.id,
              post.id,
              r.platform as any,
              new Date(),
              r.postId ?? null
            );
          } catch (e) {
            console.warn("[analytics] record failed", (e as Error)?.message);
          }
        }

        return {
          success: true,
          results,
          successCount: results.filter((r) => r.success).length,
          failureCount: results.filter((r) => !r.success).length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  // Publish to specific platforms
  publishToSpecific: protectedProcedure
    .input(
      z.object({
        platforms: z.array(z.string()),
        content: z.string(),
        postId: z.number().optional(),
        title: z.string().optional(),
        imageUrl: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        link: z.string().optional(),
        /** Optional client key; the server dedupes regardless (PR #82). */
        idempotencyKey: z.string().trim().min(8).max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const publishContent: PublishContent = {
        content: input.content,
        title: input.title,
        imageUrl: input.imageUrl,
        hashtags: input.hashtags,
        link: input.link,
      };

      // ── PR #82: the guard this path never had ────────────────────────────────
      //
      // publishToSpecificPlatforms resolves its provider token from userId alone
      // — it has no idea brands exist. So a Penna post could go out through
      // Ballong's connected LinkedIn, and two clicks meant two live posts. The
      // brand guard and the duplicate guard lived only in linkedin.createPost.
      //
      // Deliberately OUTSIDE the try/catch below: that catch turns a throw into
      // `{ success: false, error }`, and the client reads only successCount /
      // failureCount — so a refusal in there resolved silently and the user saw
      // nothing at all after clicking Publiser.
      const {
        resolvePublishBrand, requireDestination, assertNotDuplicatePublish,
        claimPublication, settlePublication,
      } = await import("../services/publishGuard");

      const publishBrandId = await resolvePublishBrand(ctx.user.id, input.postId);

      // PR #83: an undocumented claim is refused before anything is sent.
      const { assertContentIsPublishable } = await import("../services/publishGuard");
      await assertContentIsPublishable({
        accountId: ctx.user.id, postId: input.postId, content: input.content, brandId: publishBrandId,
      });
      const claims = new Map<string, number | null>();
      const destinations = new Map<string, { destinationId: string | null; destinationType: string | null }>();

      // Check EVERY platform before claiming any of them, so a refusal on the
      // second platform cannot leave the first one claimed and locked out.
      const resolved: { platform: "linkedin" | "facebook" | "instagram" | "twitter"; destination: Awaited<ReturnType<typeof requireDestination>> }[] = [];
      for (const platform of input.platforms) {
        const p = platform as "linkedin" | "facebook" | "instagram" | "twitter";
        await assertNotDuplicatePublish(ctx.user.id, input.postId, p, input.content);
        resolved.push({ platform: p, destination: await requireDestination(ctx.user.id, publishBrandId, p, input.postId) });
      }
      for (const { platform: p, destination } of resolved) {
        if (destination) {
          destinations.set(p, { destinationId: destination.destinationId, destinationType: destination.destinationType });
        }
        claims.set(p, await claimPublication({
          accountId: ctx.user.id,
          brandId: publishBrandId,
          postId: input.postId,
          platform: p,
          destination,
          idempotencyKey: input.idempotencyKey ?? null,
          content: input.content,
        }));
      }

      try {
        const results = await publishingManager.publishToSpecificPlatforms(
          ctx.user.id,
          input.platforms,
          publishContent,
          // The destination must DRIVE the publish, not merely be validated —
          // otherwise the post still goes wherever the account-wide row points.
          destinations,
        );

        // Close every claim with what actually happened, so a failed attempt does
        // not sit as `pending` and block the user's next try for a full minute.
        for (const r of results) {
          await settlePublication(
            claims.get(r.platform) ?? null,
            r.success
              ? { status: "published", providerPostId: r.postId ?? null, providerResponse: r, postId: input.postId ?? null }
              : { status: "failed", errorMessage: r.error ?? "Ukjent feil" },
          );
        }

        // Best-effort: record each successful publication as a published post + analytics
        // row so the "best time to post" pipeline has real engagement data to learn from.
        // Wrapped per-result so analytics bookkeeping never breaks publishing.
        for (const r of results) {
          if (!r.success) continue;
          try {
            // If the caller published an existing post, flip THAT post to
            // published so it shows under "Publisert"; otherwise fall back to
            // creating a standalone analytics row (e.g. ad-hoc publishes).
            let pid = input.postId ?? null;
            if (pid) {
              await markPostPublished(pid, ctx.user.id);
            } else {
              const post = await createPost({
                userId: ctx.user.id,
                platform: r.platform as any,
                tone: "professional",
                rawInput: input.content,
                generatedContent: input.content,
                status: "published",
                publishedAt: new Date(),
              } as any);
              pid = post.id;
            }
            await recordPostAnalytics(
              ctx.user.id,
              pid,
              r.platform as any,
              new Date(),
              r.postId ?? null
            );
          } catch (e) {
            console.warn("[analytics] record failed", (e as Error)?.message);
          }
        }

        return {
          success: true,
          results,
          successCount: results.filter((r) => r.success).length,
          failureCount: results.filter((r) => !r.success).length,
        };
      } catch (error) {
        // PR #82: release every claim we made, or a transport failure locks the
        // user out of retrying for the rest of the duplicate window.
        for (const id of claims.values()) {
          await settlePublication(id, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          });
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});
