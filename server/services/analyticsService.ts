/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Analytics Service
 * Handles all analytics calculations and data aggregation
 */

import { getDb } from "../db";
import { postAnalytics } from "../../drizzle/schema";
import { eq, gte, lte, and, sql } from "drizzle-orm";

export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  retweets: number;
  saves: number;
  totalEngagement: number;
  engagementRate: number;
}

export interface ReachMetrics {
  impressions: number;
  reach: number;
  uniqueViews: number;
}

export interface ConversionMetrics {
  clicks: number;
  conversions: number;
  conversionRate: number;
}

export interface PostPerformance extends EngagementMetrics, ReachMetrics, ConversionMetrics {
  postId: number;
  platform: string;
  publishedAt: Date;
}

export interface PlatformStats {
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  totalPosts: number;
  totalEngagement: number;
  totalReach: number;
  totalImpressions: number;
  avgEngagementRate: number;
  avgConversionRate: number;
  topPost?: {
    postId: number;
    engagement: number;
  };
}

/**
 * Calculate engagement rate
 */
export function calculateEngagementRate(
  engagement: number,
  reach: number
): number {
  if (reach === 0) return 0;
  return parseFloat(((engagement / reach) * 100).toFixed(2));
}

/**
 * Calculate conversion rate
 */
export function calculateConversionRate(
  conversions: number,
  clicks: number
): number {
  if (clicks === 0) return 0;
  return parseFloat(((conversions / clicks) * 100).toFixed(2));
}

/**
 * Get post analytics for a specific post
 */
export async function getPostAnalytics(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const analytics = await db
    .select()
    .from(postAnalytics)
    .where(
      and(
        eq(postAnalytics.postId, postId),
        eq(postAnalytics.userId, userId)
      )
    )
    .limit(1);

  if (analytics.length === 0) return null;

  const data = analytics[0];
  return {
    ...data,
    engagementRate: calculateEngagementRate(
      data.engagement || 0,
      data.impressions || 0
    ),
  };
}

/**
 * Get analytics for a date range
 */
export async function getAnalyticsByDateRange(
  userId: number,
  startDate: Date,
  endDate: Date,
  platform?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [
    eq(postAnalytics.userId, userId),
    gte(postAnalytics.publishedAt, startDate),
    lte(postAnalytics.publishedAt, endDate),
  ];

  if (platform) {
    conditions.push(eq(postAnalytics.platform, platform as any));
  }

  return await db
    .select()
    .from(postAnalytics)
    .where(and(...conditions));
}

/**
 * Get platform comparison stats
 */
export async function getPlatformStats(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<PlatformStats[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const platforms = ["linkedin", "twitter", "instagram", "facebook"] as const;
  const stats: PlatformStats[] = [];

  for (const platform of platforms) {
    const data = await db
      .select({
        totalPosts: sql<number>`COUNT(*)`,
        totalEngagement: sql<number>`SUM(COALESCE(${postAnalytics.engagement}, 0))`,
        totalImpressions: sql<number>`SUM(COALESCE(${postAnalytics.impressions}, 0))`,
      })
      .from(postAnalytics)
      .where(
        and(
          eq(postAnalytics.userId, userId),
          eq(postAnalytics.platform, platform),
          gte(postAnalytics.publishedAt, startDate),
          lte(postAnalytics.publishedAt, endDate)
        )
      );

    if (data.length > 0 && data[0].totalPosts > 0) {
      const row = data[0];
      const totalEngagement = row.totalEngagement || 0;
      const totalImpressions = row.totalImpressions || 0;

      stats.push({
        platform,
        totalPosts: row.totalPosts || 0,
        totalEngagement,
        totalReach: 0, // Not tracked in current schema
        totalImpressions,
        avgEngagementRate: calculateEngagementRate(totalEngagement, totalImpressions),
        avgConversionRate: 0, // Not tracked in current schema
      });
    }
  }

  return stats;
}

/**
 * Get top performing posts
 */
export async function getTopPosts(
  userId: number,
  startDate: Date,
  endDate: Date,
  limit: number = 5
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(postAnalytics)
    .where(
      and(
        eq(postAnalytics.userId, userId),
        gte(postAnalytics.publishedAt, startDate),
        lte(postAnalytics.publishedAt, endDate)
      )
    )
    .orderBy(sql`${postAnalytics.engagement} DESC`)
    .limit(limit);
}

/**
 * Get weekly summary
 */
export async function getWeeklySummary(userId: number, weekStartDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const data = await db
    .select({
      totalPosts: sql<number>`COUNT(*)`,
      totalEngagement: sql<number>`SUM(COALESCE(${postAnalytics.engagement}, 0))`,
      totalImpressions: sql<number>`SUM(COALESCE(${postAnalytics.impressions}, 0))`,
    })
    .from(postAnalytics)
    .where(
      and(
        eq(postAnalytics.userId, userId),
        gte(postAnalytics.publishedAt, weekStartDate),
        lte(postAnalytics.publishedAt, weekEndDate)
      )
    );

  if (data.length === 0 || !data[0].totalPosts) {
    return null;
  }

  const row = data[0];
  const totalEngagement = row.totalEngagement || 0;
  const totalImpressions = row.totalImpressions || 0;

  return {
    weekStartDate,
    weekEndDate,
    totalPosts: row.totalPosts || 0,
    totalEngagement,
    totalImpressions,
    avgEngagementRate: calculateEngagementRate(totalEngagement, totalImpressions),
  };
}

/**
 * Get monthly summary
 */
export async function getMonthlySummary(userId: number, month: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [year, monthNum] = month.split("-").map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0);

  const data = await db
    .select({
      totalPosts: sql<number>`COUNT(*)`,
      totalEngagement: sql<number>`SUM(COALESCE(${postAnalytics.engagement}, 0))`,
      totalImpressions: sql<number>`SUM(COALESCE(${postAnalytics.impressions}, 0))`,
    })
    .from(postAnalytics)
    .where(
      and(
        eq(postAnalytics.userId, userId),
        gte(postAnalytics.publishedAt, startDate),
        lte(postAnalytics.publishedAt, endDate)
      )
    );

  if (data.length === 0 || !data[0].totalPosts) {
    return null;
  }

  const row = data[0];
  const totalEngagement = row.totalEngagement || 0;
  const totalImpressions = row.totalImpressions || 0;

  return {
    month,
    totalPosts: row.totalPosts || 0,
    totalEngagement,
    totalImpressions,
    avgEngagementRate: calculateEngagementRate(totalEngagement, totalImpressions),
  };
}

/**
 * Get trending content (most engaging posts)
 */
export async function getTrendingContent(
  userId: number,
  days: number = 7,
  limit: number = 10
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await db
    .select()
    .from(postAnalytics)
    .where(
      and(
        eq(postAnalytics.userId, userId),
        gte(postAnalytics.publishedAt, startDate)
      )
    )
    .orderBy(sql`${postAnalytics.engagement} DESC`)
    .limit(limit);
}

/**
 * Update post analytics
 */
export async function updatePostAnalytics(
  postId: number,
  userId: number,
  metrics: Partial<typeof postAnalytics.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(postAnalytics)
    .set({
      ...metrics,
    })
    .where(
      and(
        eq(postAnalytics.postId, postId),
        eq(postAnalytics.userId, userId)
      )
    );
}