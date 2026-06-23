/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getPost,
  getUserPosts,
  updatePost,
  getPostVersions,
  restorePostVersion,
  backupPost,
  getPostBackups,
  restoreFromBackup,
  softDeletePost,
  restoreDeletedPost,
  permanentlyDeletePost,
  getDeletedPosts,
  getPostAuditLog,
  getOrCreateBackupSchedule,
  updateBackupSchedule,
  getStorageStats,
} from "../services/postManagementService";

export const postManagementRouter = router({
  /**
   * Get all posts for user with pagination
   */
  getPosts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        status: z
          .enum(["draft", "scheduled", "published", "failed"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userPosts = await getUserPosts(
        ctx.user.id,
        input.limit,
        input.offset,
        input.status
      );
      return {
        success: true,
        data: userPosts,
        count: userPosts.length,
      };
    }),

  /**
   * Get a single post
   */
  getPost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const post = await getPost(input.postId, ctx.user.id);
      if (!post) {
        throw new Error("Post not found");
      }
      return {
        success: true,
        data: post,
      };
    }),

  /**
   * Update post content
   */
  updatePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        generatedContent: z.string().optional(),
        tone: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z
          .enum(["draft", "scheduled", "published", "failed"])
          .optional(),
        changeDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { postId, changeDescription, ...updates } = input;

      await updatePost(postId, ctx.user.id, updates, changeDescription);

      return {
        success: true,
        message: "Post updated successfully",
      };
    }),

  /**
   * Get post version history
   */
  getVersions: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const versions = await getPostVersions(input.postId, ctx.user.id);
      return {
        success: true,
        data: versions,
        count: versions.length,
      };
    }),

  /**
   * Restore post to a previous version
   */
  restoreVersion: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        versionId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await restorePostVersion(input.postId, ctx.user.id, input.versionId);
      return {
        success: true,
        message: "Post restored to previous version",
      };
    }),

  /**
   * Create a backup of a post
   */
  createBackup: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        reason: z
          .enum(["pre_deletion", "pre_edit", "scheduled", "manual"])
          .default("manual"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await backupPost(input.postId, ctx.user.id, input.reason);
      return {
        success: true,
        message: "Post backed up successfully",
      };
    }),

  /**
   * Get post backups
   */
  getBackups: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const backups = await getPostBackups(input.postId, ctx.user.id);
      return {
        success: true,
        data: backups,
        count: backups.length,
      };
    }),

  /**
   * Restore post from backup
   */
  restoreFromBackup: protectedProcedure
    .input(z.object({ backupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const restored = await restoreFromBackup(input.backupId, ctx.user.id);
      return {
        success: true,
        message: "Post restored from backup",
        data: restored,
      };
    }),

  /**
   * Soft delete a post
   */
  deletePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await softDeletePost(input.postId, ctx.user.id, input.reason);
      return {
        success: true,
        message: "Post deleted (can be restored within 30 days)",
      };
    }),

  /**
   * Get deleted posts
   */
  getDeletedPosts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const deletedPosts = await getDeletedPosts(
        ctx.user.id,
        input.limit,
        input.offset
      );
      return {
        success: true,
        data: deletedPosts,
        count: deletedPosts.length,
      };
    }),

  /**
   * Restore a deleted post
   */
  restoreDeletedPost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await restoreDeletedPost(input.postId, ctx.user.id);
      return {
        success: true,
        message: "Post restored successfully",
      };
    }),

  /**
   * Permanently delete a post
   */
  permanentlyDeletePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await permanentlyDeletePost(input.postId, ctx.user.id);
      return {
        success: true,
        message: "Post permanently deleted",
      };
    }),

  /**
   * Get post audit log
   */
  getAuditLog: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const auditLog = await getPostAuditLog(
        input.postId,
        ctx.user.id,
        input.limit
      );
      return {
        success: true,
        data: auditLog,
        count: auditLog.length,
      };
    }),

  /**
   * Get backup schedule
   */
  getBackupSchedule: protectedProcedure.query(async ({ ctx }) => {
    const schedule = await getOrCreateBackupSchedule(ctx.user.id);
    return {
      success: true,
      data: schedule,
    };
  }),

  /**
   * Update backup schedule
   */
  updateBackupSchedule: protectedProcedure
    .input(
      z.object({
        enableAutoBackup: z.boolean().optional(),
        backupFrequency: z
          .enum(["daily", "weekly", "monthly"])
          .optional(),
        retentionDays: z.number().min(1).max(365).optional(),
        maxBackupsPerPost: z.number().min(1).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateBackupSchedule(ctx.user.id, input);
      return {
        success: true,
        message: "Backup schedule updated",
      };
    }),

  /**
   * Get storage statistics
   */
  getStorageStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getStorageStats(ctx.user.id);
    return {
      success: true,
      data: stats,
    };
  }),

  /**
   * Dashboard overview
   */
  getDashboardOverview: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getStorageStats(ctx.user.id);
    const recentPosts = await getUserPosts(ctx.user.id, 5, 0);
    const deletedPosts = await getDeletedPosts(ctx.user.id, 5, 0);

    return {
      success: true,
      data: {
        stats,
        recentPosts,
        deletedPosts,
      },
    };
  }),
});