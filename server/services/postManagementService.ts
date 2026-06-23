/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Post Management Service
 * Handles post storage, editing, deletion, versioning, and backups
 */

import { getDb } from "../db";
import {
  posts,
  postVersions,
  postBackups,
  deletedPosts,
  postAuditLog,
  backupSchedule,
} from "../../drizzle/schema";
import { eq, and, lte, desc } from "drizzle-orm";

/**
 * Create a new post
 */
export async function createPost(
  userId: number,
  platform: "linkedin" | "twitter" | "instagram" | "facebook",
  tone: string,
  rawInput: string,
  generatedContent: string,
  tags?: string[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(posts).values({
    userId,
    platform,
    tone,
    rawInput,
    generatedContent,
    tags: tags || [],
    status: "draft",
  });

  // Get the inserted post ID
  const insertedPost = await db
    .select()
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.platform, platform)))
    .orderBy(desc(posts.createdAt))
    .limit(1);

  const postId = insertedPost[0]?.id || 0;

  // Log the creation
  await logPostAction(userId, postId, "created", {
    platform,
    tone,
  });

  return result;
}

/**
 * Get a post by ID
 */
export async function getPost(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all posts for a user with pagination
 */
export async function getUserPosts(
  userId: number,
  limit: number = 20,
  offset: number = 0,
  status?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(posts.userId, userId)];
  if (status) {
    conditions.push(eq(posts.status, status as any));
  }

  const result = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  return result;
}

/**
 * Update post content
 */
export async function updatePost(
  postId: number,
  userId: number,
  updates: {
    generatedContent?: string;
    tone?: string;
    tags?: string[];
    status?: "draft" | "scheduled" | "published" | "failed";
  },
  changeDescription?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get current post
  const currentPost = await getPost(postId, userId);
  if (!currentPost) throw new Error("Post not found");

  // Create version before updating
  if (updates.generatedContent || updates.tone || updates.tags) {
    const versionCount = await db
      .select()
      .from(postVersions)
      .where(eq(postVersions.postId, postId));

    await db.insert(postVersions).values({
      postId,
      userId,
      generatedContent: currentPost.generatedContent,
      tone: currentPost.tone,
      tags: currentPost.tags,
      versionNumber: versionCount.length + 1,
      changeDescription: changeDescription || "Manual edit",
    });
  }

  // Update the post
  await db
    .update(posts)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

  // Log the update
  await logPostAction(userId, postId, "edited", {
    changes: Object.keys(updates),
    changeDescription,
  });
}

/**
 * Get post version history
 */
export async function getPostVersions(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(postVersions)
    .where(and(eq(postVersions.postId, postId), eq(postVersions.userId, userId)))
    .orderBy(desc(postVersions.versionNumber));
}

/**
 * Restore a post to a previous version
 */
export async function restorePostVersion(
  postId: number,
  userId: number,
  versionId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the version to restore (scoped to the caller — prevents cross-tenant disclosure)
  const version = await db
    .select()
    .from(postVersions)
    .where(and(eq(postVersions.id, versionId), eq(postVersions.userId, userId)))
    .limit(1);

  if (version.length === 0) throw new Error("Version not found");

  const versionData = version[0];

  // Update post with version data
  await db
    .update(posts)
    .set({
      generatedContent: versionData.generatedContent,
      tone: versionData.tone,
      tags: versionData.tags,
      updatedAt: new Date(),
    })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

  // Log the restoration
  await logPostAction(userId, postId, "restored", {
    restoredToVersion: versionData.versionNumber,
  });
}

/**
 * Create a backup of a post
 */
export async function backupPost(
  postId: number,
  userId: number,
  reason: "pre_deletion" | "pre_edit" | "scheduled" | "manual" = "manual"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const post = await getPost(postId, userId);
  if (!post) throw new Error("Post not found");

  // Calculate expiration date (90 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const result = await db.insert(postBackups).values({
    postId,
    userId,
    platform: post.platform,
    tone: post.tone,
    rawInput: post.rawInput,
    generatedContent: post.generatedContent,
    tags: post.tags,
    status: post.status,
    scheduledFor: post.scheduledFor,
    publishedAt: post.publishedAt,
    backupReason: reason,
    expiresAt,
  });

  // Log the backup
  await logPostAction(userId, postId, "backed_up", { reason });

  return result;
}

/**
 * Get post backups
 */
export async function getPostBackups(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(postBackups)
    .where(
      and(
        eq(postBackups.postId, postId),
        eq(postBackups.userId, userId),
        eq(postBackups.isRestorable, true)
      )
    )
    .orderBy(desc(postBackups.backedUpAt));
}

/**
 * Restore a post from backup
 */
export async function restoreFromBackup(
  backupId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the backup (scoped to the caller — prevents cross-tenant disclosure)
  const backup = await db
    .select()
    .from(postBackups)
    .where(and(eq(postBackups.id, backupId), eq(postBackups.userId, userId)))
    .limit(1);

  if (backup.length === 0) throw new Error("Backup not found");

  const backupData = backup[0];

  // Restore the post
  await db
    .update(posts)
    .set({
      generatedContent: backupData.generatedContent,
      tone: backupData.tone,
      tags: backupData.tags,
      status: backupData.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(posts.id, backupData.postId),
        eq(posts.userId, userId)
      )
    );

  // Log the restoration
  await logPostAction(userId, backupData.postId, "restored", {
    restoredFromBackup: backupId,
  });

  return backupData;
}

/**
 * Soft delete a post
 */
export async function softDeletePost(
  postId: number,
  userId: number,
  reason?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const post = await getPost(postId, userId);
  if (!post) throw new Error("Post not found");

  // Create a backup before deletion
  await backupPost(postId, userId, "pre_deletion");

  // Create restore deadline (30 days from now)
  const canRestoreUntil = new Date();
  canRestoreUntil.setDate(canRestoreUntil.getDate() + 30);

  // Record in deleted_posts
  await db.insert(deletedPosts).values({
    postId,
    userId,
    platform: post.platform,
    generatedContent: post.generatedContent,
    deletionReason: reason,
    permanentlyDeleted: false,
    canRestoreUntil,
  });

  // Update post status to deleted (soft delete)
  await db
    .update(posts)
    .set({
      status: "failed", // Use failed status to indicate deleted
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  // Log the deletion
  await logPostAction(userId, postId, "deleted", { reason });
}

/**
 * Restore a deleted post
 */
export async function restoreDeletedPost(
  postId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the deleted post record
  const deletedPost = await db
    .select()
    .from(deletedPosts)
    .where(
      and(
        eq(deletedPosts.postId, postId),
        eq(deletedPosts.userId, userId),
        eq(deletedPosts.permanentlyDeleted, false)
      )
    )
    .limit(1);

  if (deletedPost.length === 0) throw new Error("Deleted post not found or cannot be restored");

  // Restore the post
  await db
    .update(posts)
    .set({
      status: "draft",
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  // Mark as restored in deleted_posts
  await db
    .update(deletedPosts)
    .set({
      permanentlyDeleted: false,
    })
    .where(eq(deletedPosts.id, deletedPost[0].id));

  // Log the restoration
  await logPostAction(userId, postId, "restored", {
    restoredFromDelete: true,
  });
}

/**
 * Permanently delete a post
 */
export async function permanentlyDeletePost(
  postId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete from posts table
  await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

  // Mark as permanently deleted in deleted_posts
  await db
    .update(deletedPosts)
    .set({
      permanentlyDeleted: true,
      permanentlyDeletedAt: new Date(),
    })
    .where(
      and(
        eq(deletedPosts.postId, postId),
        eq(deletedPosts.userId, userId)
      )
    );

  // Log the permanent deletion
  await logPostAction(userId, postId, "deleted", {
    permanent: true,
  });
}

/**
 * Get deleted posts (for recovery)
 */
export async function getDeletedPosts(
  userId: number,
  limit: number = 20,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(deletedPosts)
    .where(
      and(
        eq(deletedPosts.userId, userId),
        eq(deletedPosts.permanentlyDeleted, false)
      )
    )
    .orderBy(desc(deletedPosts.deletedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Log post action for audit trail
 */
export async function logPostAction(
  userId: number,
  postId: number,
  action: "created" | "edited" | "deleted" | "published" | "scheduled" | "restored" | "backed_up",
  actionDetails?: Record<string, any>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(postAuditLog).values({
    postId,
    userId,
    action,
    actionDetails: actionDetails || {},
  });
}

/**
 * Get audit log for a post
 */
export async function getPostAuditLog(
  postId: number,
  userId: number,
  limit: number = 50
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(postAuditLog)
    .where(
      and(
        eq(postAuditLog.postId, postId),
        eq(postAuditLog.userId, userId)
      )
    )
    .orderBy(desc(postAuditLog.createdAt))
    .limit(limit);
}

/**
 * Get or create backup schedule for user
 */
export async function getOrCreateBackupSchedule(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let schedule = await db
    .select()
    .from(backupSchedule)
    .where(eq(backupSchedule.userId, userId))
    .limit(1);

  if (schedule.length === 0) {
    await db.insert(backupSchedule).values({
      userId,
      enableAutoBackup: true,
      backupFrequency: "daily",
      retentionDays: 90,
      maxBackupsPerPost: 10,
    });

    schedule = await db
      .select()
      .from(backupSchedule)
      .where(eq(backupSchedule.userId, userId))
      .limit(1);
  }

  return schedule[0];
}

/**
 * Update backup schedule
 */
export async function updateBackupSchedule(
  userId: number,
  updates: {
    enableAutoBackup?: boolean;
    backupFrequency?: "daily" | "weekly" | "monthly";
    retentionDays?: number;
    maxBackupsPerPost?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(backupSchedule)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(backupSchedule.userId, userId));
}

/**
 * Cleanup expired backups
 */
export async function cleanupExpiredBackups() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();

  // Delete expired backups
  await db
    .delete(postBackups)
    .where(lte(postBackups.expiresAt, now));

  // Delete permanently deleted posts older than 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  await db
    .delete(deletedPosts)
    .where(
      and(
        eq(deletedPosts.permanentlyDeleted, true),
        lte(deletedPosts.permanentlyDeletedAt, ninetyDaysAgo)
      )
    );
}

/**
 * Get storage statistics for user
 */
export async function getStorageStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId));

  const draftPosts = totalPosts.filter((p) => p.status === "draft");
  const scheduledPosts = totalPosts.filter((p) => p.status === "scheduled");
  const publishedPosts = totalPosts.filter((p) => p.status === "published");

  const versions = await db
    .select()
    .from(postVersions)
    .where(eq(postVersions.userId, userId));

  const backups = await db
    .select()
    .from(postBackups)
    .where(eq(postBackups.userId, userId));

  const deletedCount = await db
    .select()
    .from(deletedPosts)
    .where(
      and(
        eq(deletedPosts.userId, userId),
        eq(deletedPosts.permanentlyDeleted, false)
      )
    );

  return {
    totalPosts: totalPosts.length,
    draftPosts: draftPosts.length,
    scheduledPosts: scheduledPosts.length,
    publishedPosts: publishedPosts.length,
    totalVersions: versions.length,
    totalBackups: backups.length,
    deletedPostsRecoverable: deletedCount.length,
  };
}