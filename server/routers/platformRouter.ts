/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const publishContent: PublishContent = {
          content: input.content,
          title: input.title,
          imageUrl: input.imageUrl,
          hashtags: input.hashtags,
          link: input.link,
        };

        const results = await publishingManager.publishToSpecificPlatforms(
          ctx.user.id,
          input.platforms,
          publishContent
        );

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
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});
