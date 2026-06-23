/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Smart Scheduling Service
 * Handles optimal posting time calculations and scheduling recommendations
 */

import { getDb } from "../db";
import { schedulingPreferences, scheduledPosts, postingTimesAnalytics, posts } from "../../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export interface OptimalTime {
  dayOfWeek: number;
  hour: number;
  score: number; // 0-100
  reason: string;
}

export interface SchedulingRecommendation {
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  optimalTimes: OptimalTime[];
  nextBestTime: Date;
  engagementPrediction: number; // 0-100
}

/**
 * Default optimal times for each platform (based on industry research)
 */
const DEFAULT_OPTIMAL_TIMES = {
  linkedin: {
    days: [1, 2, 3, 4, 5], // Mon-Fri
    hours: [8, 9, 12, 17, 18], // 8am, 9am, 12pm, 5pm, 6pm
  },
  twitter: {
    days: [1, 2, 3, 4, 5],
    hours: [9, 12, 17, 20],
  },
  instagram: {
    days: [0, 1, 2, 3, 4, 5, 6],
    hours: [8, 12, 18, 20, 21],
  },
  facebook: {
    days: [1, 2, 3, 4, 5],
    hours: [12, 13, 19, 20],
  },
};

/**
 * Get or create scheduling preferences for a user
 */
export async function getOrCreateSchedulingPreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let prefs = await db
    .select()
    .from(schedulingPreferences)
    .where(eq(schedulingPreferences.userId, userId))
    .limit(1);

  if (prefs.length === 0) {
    // Create default preferences
    const defaultPrefs = {
      userId,
      timezone: "UTC",
      linkedinBestDays: DEFAULT_OPTIMAL_TIMES.linkedin.days,
      linkedinBestHours: DEFAULT_OPTIMAL_TIMES.linkedin.hours,
      twitterBestDays: DEFAULT_OPTIMAL_TIMES.twitter.days,
      twitterBestHours: DEFAULT_OPTIMAL_TIMES.twitter.hours,
      instagramBestDays: DEFAULT_OPTIMAL_TIMES.instagram.days,
      instagramBestHours: DEFAULT_OPTIMAL_TIMES.instagram.hours,
      facebookBestDays: DEFAULT_OPTIMAL_TIMES.facebook.days,
      facebookBestHours: DEFAULT_OPTIMAL_TIMES.facebook.hours,
      enableAutoScheduling: true,
      enableNotifications: true,
      notificationMinutesBefore: 15,
    };

    await db.insert(schedulingPreferences).values(defaultPrefs);
    prefs = [defaultPrefs as any];
  }

  return prefs[0];
}

/**
 * Calculate optimal posting times for a platform
 */
export async function getOptimalPostingTimes(
  userId: number,
  platform: "linkedin" | "twitter" | "instagram" | "facebook"
): Promise<OptimalTime[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get user's analytics for this platform
  const analytics = await db
    .select()
    .from(postingTimesAnalytics)
    .where(
      and(
        eq(postingTimesAnalytics.userId, userId),
        eq(postingTimesAnalytics.platform, platform)
      )
    )
    .orderBy(desc(postingTimesAnalytics.avgEngagementRate));

  if (analytics.length === 0) {
    // Return default optimal times if no analytics available
    const defaultTimes = DEFAULT_OPTIMAL_TIMES[platform];
    const optimalTimes: OptimalTime[] = [];

    for (const hour of defaultTimes.hours) {
      optimalTimes.push({
        dayOfWeek: defaultTimes.days[0],
        hour,
        score: 75,
        reason: "Industry standard optimal time",
      });
    }

    return optimalTimes;
  }

  // Convert analytics to optimal times
  return analytics.slice(0, 5).map((analytic) => ({
    dayOfWeek: analytic.dayOfWeek,
    hour: analytic.hourOfDay,
    score: Math.round(Number(analytic.avgEngagementRate) * 10), // Convert to 0-100 scale
    reason: `Based on your ${analytic.totalPosts} posts at this time`,
  }));
}

/**
 * Get next optimal posting time
 */
export async function getNextOptimalTime(
  userId: number,
  platform: "linkedin" | "twitter" | "instagram" | "facebook",
  startDate: Date = new Date()
): Promise<Date> {
  const optimalTimes = await getOptimalPostingTimes(userId, platform);

  if (optimalTimes.length === 0) {
    // Default to next day at 9 AM
    const nextTime = new Date(startDate);
    nextTime.setDate(nextTime.getDate() + 1);
    nextTime.setHours(9, 0, 0, 0);
    return nextTime;
  }

  // Find the next optimal time
  const topTime = optimalTimes[0];
  const nextTime = new Date(startDate);

  // Set to the optimal hour
  nextTime.setHours(topTime.hour, 0, 0, 0);

  // If the time has already passed today, move to next occurrence
  if (nextTime <= startDate) {
    nextTime.setDate(nextTime.getDate() + 1);
  }

  // Adjust to the optimal day of week if needed
  while (nextTime.getDay() !== topTime.dayOfWeek) {
    nextTime.setDate(nextTime.getDate() + 1);
  }

  return nextTime;
}

/**
 * Get scheduling recommendations for all platforms
 */
export async function getSchedulingRecommendations(
  userId: number
): Promise<SchedulingRecommendation[]> {
  const platforms: Array<"linkedin" | "twitter" | "instagram" | "facebook"> = [
    "linkedin",
    "twitter",
    "instagram",
    "facebook",
  ];

  const recommendations: SchedulingRecommendation[] = [];

  for (const platform of platforms) {
    const optimalTimes = await getOptimalPostingTimes(userId, platform);
    const nextBestTime = await getNextOptimalTime(userId, platform);

    recommendations.push({
      platform,
      optimalTimes,
      nextBestTime,
      engagementPrediction: optimalTimes[0]?.score || 70,
    });
  }

  return recommendations;
}

/**
 * Schedule a post for later publishing
 */
export async function schedulePost(
  postId: number,
  userId: number,
  platform: "linkedin" | "twitter" | "instagram" | "facebook",
  scheduledFor: Date,
  timezone: string = "UTC"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Tenant isolation: the post MUST belong to this user. Without this check a
  // caller could schedule someone else's postId and have the scheduler publish
  // another tenant's content to the caller's connected account.
  const [owned] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);
  if (!owned) throw new Error("Post not found or unauthorized");

  // Calculate optimality score (0-100)
  const optimalTimes = await getOptimalPostingTimes(userId, platform);
  const scheduledHour = scheduledFor.getHours();
  const scheduledDay = scheduledFor.getDay();

  let optimalityScore = 50; // Base score
  for (const optimalTime of optimalTimes) {
    if (optimalTime.hour === scheduledHour && optimalTime.dayOfWeek === scheduledDay) {
      optimalityScore = optimalTime.score;
      break;
    }
  }

  // Create scheduled post
  const result = await db.insert(scheduledPosts).values({
    postId,
    userId,
    platform,
    scheduledFor,
    timezone,
    status: "scheduled",
    optimalityScore: optimalityScore as any,
    engagementScore: (optimalityScore * 0.8) as any, // Slightly lower than optimality
  });

  return result;
}

/**
 * Get scheduled posts for a user
 */
export async function getScheduledPosts(
  userId: number,
  status?: "scheduled" | "publishing" | "published" | "failed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(scheduledPosts.userId, userId)];

  if (status) {
    conditions.push(eq(scheduledPosts.status, status));
  }

  return await db
    .select()
    .from(scheduledPosts)
    .where(and(...conditions))
    .orderBy(desc(scheduledPosts.scheduledFor));
}

/**
 * Get upcoming scheduled posts
 */
export async function getUpcomingScheduledPosts(
  userId: number,
  limit: number = 10
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();

  return await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, "scheduled"),
        gte(scheduledPosts.scheduledFor, now)
      )
    )
    .orderBy(scheduledPosts.scheduledFor)
    .limit(limit);
}

/**
 * Cancel a scheduled post
 */
export async function cancelScheduledPost(scheduledPostId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(scheduledPosts)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, scheduledPostId),
        eq(scheduledPosts.userId, userId)
      )
    );
}

/**
 * Reschedule a post
 */
export async function reschedulePost(
  scheduledPostId: number,
  userId: number,
  newScheduledFor: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(scheduledPosts)
    .set({
      scheduledFor: newScheduledFor,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, scheduledPostId),
        eq(scheduledPosts.userId, userId)
      )
    );
}

/**
 * Mark post as published
 */
export async function markPostAsPublished(
  scheduledPostId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(scheduledPosts)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, scheduledPostId),
        eq(scheduledPosts.userId, userId)
      )
    );
}

/**
 * Mark post as failed
 */
export async function markPostAsFailed(
  scheduledPostId: number,
  userId: number,
  failureReason: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(scheduledPosts)
    .set({
      status: "failed",
      failureReason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, scheduledPostId),
        eq(scheduledPosts.userId, userId)
      )
    );
}

/**
 * Update scheduling preferences
 */
export async function updateSchedulingPreferences(
  userId: number,
  preferences: Partial<typeof schedulingPreferences.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(schedulingPreferences)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(schedulingPreferences.userId, userId));
}

/**
 * Get scheduling statistics
 */
export async function getSchedulingStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const scheduled = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, "scheduled")
      )
    );

  const published = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, "published")
      )
    );

  const failed = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, "failed")
      )
    );

  return {
    scheduled: scheduled.length,
    published: published.length,
    failed: failed.length,
    total: scheduled.length + published.length + failed.length,
  };
}