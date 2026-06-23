/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { SettingsService } from "../services/settingsService";

export const settingsRouter = router({
  /**
   * Get all settings for current user
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await SettingsService.getAllSettings(ctx.user.id);
  }),

  /**
   * Get account settings
   */
  getAccountSettings: protectedProcedure.query(async ({ ctx }) => {
    return await SettingsService.getAccountSettings(ctx.user.id);
  }),

  /**
   * Update account settings
   */
  updateAccountSettings: protectedProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        bio: z.string().optional(),
        profileImage: z.string().optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        theme: z.enum(["light", "dark"]).optional(),
        twoFactorEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await SettingsService.updateAccountSettings(ctx.user.id, input);
    }),

  /**
   * Get notification settings
   */
  getNotificationSettings: protectedProcedure.query(async ({ ctx }) => {
    return await SettingsService.getNotificationSettings(ctx.user.id);
  }),

  /**
   * Update notification settings
   */
  updateNotificationSettings: protectedProcedure
    .input(
      z.object({
        emailNotifications: z.boolean().optional(),
        emailFrequency: z.enum(["immediate", "daily", "weekly", "never"]).optional(),
        pushNotifications: z.boolean().optional(),
        pushFrequency: z.enum(["immediate", "daily", "weekly", "never"]).optional(),
        notifyOnNewTrends: z.boolean().optional(),
        notifyOnScheduledPosts: z.boolean().optional(),
        notifyOnPublishedPosts: z.boolean().optional(),
        notifyOnEngagementMilestones: z.boolean().optional(),
        notifyOnFailedPosts: z.boolean().optional(),
        notifyOnAnalyticsUpdates: z.boolean().optional(),
        weeklyReportEnabled: z.boolean().optional(),
        monthlyReportEnabled: z.boolean().optional(),
        quietHoursEnabled: z.boolean().optional(),
        quietHoursStart: z.string().optional(),
        quietHoursEnd: z.string().optional(),
        engagementThreshold: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await SettingsService.updateNotificationSettings(ctx.user.id, input);
    }),

  /**
   * Get all platform integrations
   */
  getPlatformIntegrations: protectedProcedure.query(async ({ ctx }) => {
    return await SettingsService.getPlatformIntegrations(ctx.user.id);
  }),

  /**
   * Get specific platform integration
   */
  getPlatformIntegration: protectedProcedure
    .input(z.object({ platform: z.string() }))
    .query(async ({ ctx, input }) => {
      return await SettingsService.getPlatformIntegration(ctx.user.id, input.platform);
    }),

  /**
   * Connect platform
   */
  connectPlatform: protectedProcedure
    .input(
      z.object({
        platform: z.string(),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        expiresAt: z.date().optional(),
        accountName: z.string().optional(),
        accountId: z.string().optional(),
        accountEmail: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await SettingsService.upsertPlatformIntegration(ctx.user.id, input.platform, {
        isConnected: true,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
        accountName: input.accountName,
        accountId: input.accountId,
        accountEmail: input.accountEmail,
      });
    }),

  /**
   * Disconnect platform
   */
  disconnectPlatform: protectedProcedure
    .input(z.object({ platform: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await SettingsService.disconnectPlatform(ctx.user.id, input.platform);
    }),

  /**
   * Update platform posting settings
   */
  updatePlatformSettings: protectedProcedure
    .input(
      z.object({
        platform: z.string(),
        autoPost: z.boolean().optional(),
        autoSchedule: z.boolean().optional(),
        postingHours: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await SettingsService.upsertPlatformIntegration(
        ctx.user.id,
        input.platform,
        {
          autoPost: input.autoPost,
          autoSchedule: input.autoSchedule,
          postingHours: input.postingHours ? JSON.stringify(input.postingHours) : undefined,
        }
      );
    }),

  /**
   * Get connected platforms
   */
  getConnectedPlatforms: protectedProcedure.query(async ({ ctx }) => {
    return await SettingsService.getConnectedPlatforms(ctx.user.id);
  }),

  /**
   * Check if platform is connected
   */
  isPlatformConnected: protectedProcedure
    .input(z.object({ platform: z.string() }))
    .query(async ({ ctx, input }) => {
      return await SettingsService.isPlatformConnected(ctx.user.id, input.platform);
    }),

  /**
   * Get content preferences
   */
  getContentPreferences: protectedProcedure.query(async ({ ctx }) => {
    return await SettingsService.getContentPreferences(ctx.user.id);
  }),

  /**
   * Update content preferences
   */
  updateContentPreferences: protectedProcedure
    .input(
      z.object({
        defaultTone: z.string().optional(),
        defaultPlatform: z.string().optional(),
        contentLength: z.enum(["short", "medium", "long"]).optional(),
        hashtagStyle: z.enum(["minimal", "moderate", "aggressive"]).optional(),
        ctaStyle: z.enum(["casual", "professional", "urgent"]).optional(),
        emojiUsage: z.enum(["none", "minimal", "moderate", "heavy"]).optional(),
        autoSaveDrafts: z.boolean().optional(),
        analyticsView: z.enum(["overview", "detailed", "minimal"]).optional(),
        showOnboarding: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await SettingsService.updateContentPreferences(ctx.user.id, input);
    }),
});