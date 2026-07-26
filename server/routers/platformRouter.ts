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
  InstagramOAuth,
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

const instagramConfig = {
  clientId: process.env.INSTAGRAM_CLIENT_ID || "",
  clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || "",
  redirectUri: process.env.INSTAGRAM_REDIRECT_URI || "",
};

const facebookConfig = {
  clientId: process.env.FACEBOOK_CLIENT_ID || "",
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
  redirectUri: process.env.FACEBOOK_REDIRECT_URI || "",
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

  getInstagramAuthUrl: publicProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }) => {
      const oauth = new InstagramOAuth(instagramConfig);
      return { authUrl: oauth.getAuthorizationUrl(input.state) };
    }),

  getFacebookAuthUrl: publicProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }) => {
      const oauth = new FacebookOAuth(facebookConfig);
      return { authUrl: oauth.getAuthorizationUrl(input.state) };
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

  handleInstagramCallback: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const oauth = new InstagramOAuth(instagramConfig);
        const token = await oauth.exchangeCodeForToken(input.code);
        await platformManager.savePlatformToken(ctx.user.id, "instagram", token);
        return { success: true, message: "Instagram connected successfully" };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  handleFacebookCallback: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const oauth = new FacebookOAuth(facebookConfig);
        const token = await oauth.exchangeCodeForToken(input.code);
        // token.accessToken is a PAGE token; store the page id/name with it so
        // publishing can post directly without a /me/accounts lookup.
        await platformManager.savePlatformToken(ctx.user.id, "facebook", token, token.accountId, token.accountName);
        return { success: true, message: "Facebook connected successfully" };
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
