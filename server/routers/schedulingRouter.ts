/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getOptimalPostingTimes,
  getNextOptimalTime,
  getSchedulingRecommendations,
  schedulePost,
  getScheduledPosts,
  getUpcomingScheduledPosts,
  cancelScheduledPost,
  reschedulePost,
  markPostAsPublished,
  markPostAsFailed,
  updateSchedulingPreferences,
  getSchedulingStats,
  getOrCreateSchedulingPreferences,
} from "../services/schedulingService";

export const schedulingRouter = router({
  /**
   * Get optimal posting times for a platform
   */
  getOptimalTimes: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const optimalTimes = await getOptimalPostingTimes(ctx.user.id, input.platform);
      return {
        success: true,
        data: optimalTimes,
      };
    }),

  /**
   * Get next optimal posting time
   */
  getNextOptimalTime: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        startDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const nextTime = await getNextOptimalTime(
        ctx.user.id,
        input.platform,
        input.startDate
      );
      return {
        success: true,
        data: nextTime,
      };
    }),

  /**
   * Get scheduling recommendations for all platforms
   */
  getRecommendations: protectedProcedure.query(async ({ ctx }) => {
    const recommendations = await getSchedulingRecommendations(ctx.user.id);
    return {
      success: true,
      data: recommendations,
    };
  }),

  /**
   * Schedule a post
   */
  schedulePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        scheduledFor: z.date(),
        timezone: z.string().optional().default("UTC"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await schedulePost(
        input.postId,
        ctx.user.id,
        input.platform,
        input.scheduledFor,
        input.timezone
      );
      return {
        success: true,
        data: result,
      };
    }),

  /**
   * Get scheduled posts
   */
  getScheduledPosts: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["scheduled", "publishing", "published", "failed", "cancelled"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const posts = await getScheduledPosts(ctx.user.id, input.status);
      return {
        success: true,
        data: posts,
        count: posts.length,
      };
    }),

  /**
   * Get upcoming scheduled posts
   */
  getUpcomingPosts: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const posts = await getUpcomingScheduledPosts(ctx.user.id, input.limit);
      return {
        success: true,
        data: posts,
        count: posts.length,
      };
    }),

  /**
   * Cancel a scheduled post
   */
  cancelPost: protectedProcedure
    .input(z.object({ scheduledPostId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await cancelScheduledPost(input.scheduledPostId, ctx.user.id);
      return {
        success: true,
        message: "Post cancelled successfully",
      };
    }),

  /**
   * Reschedule a post
   */
  reschedulePost: protectedProcedure
    .input(
      z.object({
        scheduledPostId: z.number(),
        newScheduledFor: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await reschedulePost(
        input.scheduledPostId,
        ctx.user.id,
        input.newScheduledFor
      );
      return {
        success: true,
        message: "Post rescheduled successfully",
      };
    }),

  /**
   * Mark post as published
   */
  markAsPublished: protectedProcedure
    .input(z.object({ scheduledPostId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markPostAsPublished(input.scheduledPostId, ctx.user.id);
      return {
        success: true,
        message: "Post marked as published",
      };
    }),

  /**
   * Mark post as failed
   */
  markAsFailed: protectedProcedure
    .input(
      z.object({
        scheduledPostId: z.number(),
        failureReason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await markPostAsFailed(
        input.scheduledPostId,
        ctx.user.id,
        input.failureReason
      );
      return {
        success: true,
        message: "Post marked as failed",
      };
    }),

  /**
   * Update scheduling preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        timezone: z.string().optional(),
        enableAutoScheduling: z.boolean().optional(),
        enableNotifications: z.boolean().optional(),
        notificationMinutesBefore: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateSchedulingPreferences(ctx.user.id, input);
      return {
        success: true,
        message: "Preferences updated successfully",
      };
    }),

  /**
   * Get scheduling preferences
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await getOrCreateSchedulingPreferences(ctx.user.id);
    return {
      success: true,
      data: prefs,
    };
  }),

  /**
   * Get scheduling statistics
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getSchedulingStats(ctx.user.id);
    return {
      success: true,
      data: stats,
    };
  }),

  /**
   * Get dashboard overview
   */
  getDashboardOverview: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getSchedulingStats(ctx.user.id);
    const upcoming = await getUpcomingScheduledPosts(ctx.user.id, 5);
    const recommendations = await getSchedulingRecommendations(ctx.user.id);

    return {
      success: true,
      data: {
        stats,
        upcomingPosts: upcoming,
        recommendations,
      },
    };
  }),

  /**
   * Smart schedule a post (automatically find best time)
   */
  smartSchedulePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        daysAhead: z.number().min(0).max(30).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get next optimal time
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + input.daysAhead);

      const optimalTime = await getNextOptimalTime(
        ctx.user.id,
        input.platform,
        startDate
      );

      // Schedule the post
      const result = await schedulePost(
        input.postId,
        ctx.user.id,
        input.platform,
        optimalTime
      );

      return {
        success: true,
        data: {
          scheduledFor: optimalTime,
          result,
        },
        message: `Post scheduled for ${optimalTime.toLocaleString()}`,
      };
    }),
});