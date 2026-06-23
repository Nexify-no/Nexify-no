/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Social Media Integration Router
 * Handles Telegram, Facebook, and other social media platform integrations
 */

import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getFacebookPages, postToFacebookPage, schedulePostToFacebook } from "../facebookService";
import { distributeContent, getDistributionSummary } from "../services/multiPlatformService";

export const socialMediaRouter = router({
  /**
   * Get connected Facebook pages
   */
  getFacebookPages: protectedProcedure
    .input(z.object({ userAccessToken: z.string() }))
    .query(async ({ input }) => {
      try {
        const pages = await getFacebookPages(input.userAccessToken);
        return {
          success: true,
          pages,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
          pages: [],
        };
      }
    }),

  /**
   * Post content to Facebook page
   */
  postToFacebook: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        pageAccessToken: z.string(),
        message: z.string(),
        link: z.string().optional(),
        picture: z.string().optional(),
        caption: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await postToFacebookPage(input.pageId, input.pageAccessToken, {
          message: input.message,
          link: input.link,
          picture: input.picture,
          caption: input.caption,
          description: input.description,
        });

        return result;
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Schedule a post to Facebook
   */
  schedulePostToFacebook: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        pageAccessToken: z.string(),
        message: z.string(),
        scheduledTime: z.date(),
        link: z.string().optional(),
        picture: z.string().optional(),
        caption: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await schedulePostToFacebook(
          input.pageId,
          input.pageAccessToken,
          {
            message: input.message,
            link: input.link,
            picture: input.picture,
            caption: input.caption,
            description: input.description,
          },
          input.scheduledTime
        );

        return result;
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Distribute content to multiple platforms
   */
  distributeContent: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        platforms: z.array(
          z.object({
            platform: z.enum(["facebook", "telegram", "twitter", "linkedin", "instagram"]),
            enabled: z.boolean(),
            config: z.record(z.string(), z.any()),
          })
        ),
        scheduledTime: z.date().optional(),
        metadata: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            imageUrl: z.string().optional(),
            linkUrl: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const results = await distributeContent({
          content: input.content,
          platforms: input.platforms,
          scheduledTime: input.scheduledTime,
          metadata: input.metadata,
        });

        const summary = getDistributionSummary(results);

        return {
          success: summary.failed === 0,
          results,
          summary,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
          results: [],
          summary: {
            total: 0,
            successful: 0,
            failed: 0,
            successRate: 0,
          },
        };
      }
    }),

  /**
   * Get distribution status
   */
  getDistributionStatus: protectedProcedure
    .input(z.object({ results: z.array(z.any()) }))
    .query(({ input }) => {
      const summary = getDistributionSummary(input.results);
      return summary;
    }),

  /**
   * Verify Telegram webhook
   */
  verifyTelegramWebhook: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${input.token}/getMe`
        );
        const data = await response.json();

        if (data.ok) {
          return {
            success: true,
            botInfo: data.result,
          };
        } else {
          return {
            success: false,
            error: data.description || "Invalid token",
          };
        }
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Get Telegram bot info
   */
  getTelegramBotInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${input.token}/getMe`
        );
        const data = await response.json();

        if (data.ok) {
          return {
            success: true,
            botInfo: {
              id: data.result.id,
              username: data.result.username,
              firstName: data.result.first_name,
              isBot: data.result.is_bot,
            },
          };
        } else {
          return {
            success: false,
            error: data.description || "Failed to get bot info",
          };
        }
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Test platform connection
   */
  testPlatformConnection: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["facebook", "telegram", "twitter", "linkedin", "instagram"]),
        config: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ input }) => {
      try {
        switch (input.platform) {
          case "facebook": {
            const userAccessToken = input.config.userAccessToken as string;
            const pages = await getFacebookPages(userAccessToken);
            return {
              success: pages.length > 0,
              message: pages.length > 0
                ? `Connected to ${pages.length} Facebook page(s)`
                : "No Facebook pages found",
            };
          }

          case "telegram": {
            const telegramToken = input.config.token as string;
            const response = await fetch(
              `https://api.telegram.org/bot${telegramToken}/getMe`
            );
            const data = await response.json();
            return {
              success: data.ok,
              message: data.ok
                ? `Telegram bot connected: @${data.result.username}`
                : data.description || "Failed to connect",
            };
          }

          default:
            return {
              success: false,
              message: `${input.platform} connection test not yet implemented`,
            };
        }
      } catch (error) {
        return {
          success: false,
          message: String(error),
        };
      }
    }),
});