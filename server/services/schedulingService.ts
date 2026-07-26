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

/**
 * PR #79 — scheduled-post reads are scoped to the ACTIVE brand.
 *
 * `scheduled_posts.brand_id` is backfilled by migration 0092, but these list
 * and stats helpers still matched on `user_id` alone — so brand A's schedule
 * showed up while brand B was selected.
 */
async function brandScopedUser(userId: number) {
  const { activeBrandId, ownedBy } = await import("./brandScope");
  const brandId = await activeBrandId(userId);
  return ownedBy(scheduledPosts.userId, scheduledPosts.brandId, userId, brandId);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * The hour and weekday of an instant **as seen in `timeZone`** (PR #81).
 *
 * `Date.getHours()`/`getDay()` answer in the process's local zone, which on a
 * server is whatever the host is set to — usually UTC. Anything that compares a
 * user's chosen time against per-user optimal slots has to read it in the user's
 * own zone or the comparison is meaningless. Falls back to the server's local
 * values if the zone string is not one Intl recognises.
 */
export function localPartsInZone(
  when: Date,
  timeZone: string,
): { hour: number; dayOfWeek: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hour: "2-digit",
      weekday: "short",
    }).formatToParts(when);
    const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "";
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    // en-US hour12:false renders midnight as "24" in some ICU versions.
    const hour = Number(hourRaw) % 24;
    const dayOfWeek = WEEKDAY_INDEX[weekday];
    if (Number.isNaN(hour) || dayOfWeek === undefined) throw new Error("unparsable");
    return { hour, dayOfWeek };
  } catch {
    return { hour: when.getHours(), dayOfWeek: when.getDay() };
  }
}

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
  timezone: string = "UTC",
  tx?: any
) {
  // When a caller passes an active transaction (`tx`), run inside it so the
  // schedule row is created atomically with the caller's other writes.
  const db = tx ?? await getDb();
  if (!db) throw new Error("Database not available");

  // Tenant isolation: the post MUST belong to this user. Without this check a
  // caller could schedule someone else's postId and have the scheduler publish
  // another tenant's content to the caller's connected account.
  const [owned] = await db
    .select({ id: posts.id, brandId: posts.brandId })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);
  if (!owned) throw new Error("Post not found or unauthorized");

  // Calculate optimality score (0-100).
  // PR #81: read the hour and weekday in the USER's timezone. `getHours()` /
  // `getDay()` resolve in the SERVER's zone, so an Oslo user picking 09:00 —
  // LinkedIn's best slot — was scored as 07:00 on a UTC server, matched nothing,
  // and silently got the fallback 50. The `timezone` column was stored and never
  // read.
  const optimalTimes = await getOptimalPostingTimes(userId, platform);
  const { hour: scheduledHour, dayOfWeek: scheduledDay } = localPartsInZone(scheduledFor, timezone);

  let optimalityScore = 50; // Base score
  for (const optimalTime of optimalTimes) {
    if (optimalTime.hour === scheduledHour && optimalTime.dayOfWeek === scheduledDay) {
      optimalityScore = optimalTime.score;
      break;
    }
  }

  // ── PR #81: the calendar reads `posts`, not `scheduled_posts` ────────────
  //
  // This is the whole "scheduling doesn't stick" bug. We wrote a scheduled_posts
  // row and stopped there, but /kalender renders from posts.scheduledFor via
  // content.getScheduledPosts. So the new entry appeared only because the client
  // had optimistically drawn it, and vanished on the next refetch — the post was
  // still status='draft' with scheduledFor NULL.
  //
  // Re-scheduling the same post must also UPDATE rather than stack a second row:
  // two pending rows for one post make the worker publish it twice.
  //
  // The lookup is keyed by PLATFORM too. Without it, scheduling the same post to
  // a second platform rewrote the first row's platform instead of adding one, so
  // the first platform's publish was silently dropped.
  //
  // A row already claimed by the worker (`publishing`) is IN FLIGHT: the LinkedIn
  // call may be seconds from completing. Matching only `scheduled` meant a
  // reschedule during that window left the in-flight publish running AND
  // inserted a fresh pending row — the post went out twice. Refuse instead; the
  // reaper releases a genuinely stuck row after its timeout.
  const [inFlight] = await db
    .select({ id: scheduledPosts.id })
    .from(scheduledPosts)
    .where(and(
      eq(scheduledPosts.postId, postId),
      eq(scheduledPosts.userId, userId),
      eq(scheduledPosts.platform, platform),
      eq(scheduledPosts.status, "publishing"),
    ))
    .limit(1);
  if (inFlight) {
    throw new Error("Innlegget publiseres akkurat nå — vent til det er ferdig før du endrer tidspunktet.");
  }

  const [existing] = await db
    .select({ id: scheduledPosts.id })
    .from(scheduledPosts)
    .where(and(
      eq(scheduledPosts.postId, postId),
      eq(scheduledPosts.userId, userId),
      eq(scheduledPosts.platform, platform),
      eq(scheduledPosts.status, "scheduled"),
    ))
    .limit(1);

  let result;
  if (existing) {
    result = await db
      .update(scheduledPosts)
      .set({
        platform,
        scheduledFor,
        timezone,
        // PR #79: re-stamp the brand. A row left NULL by an earlier write stays
        // invisible to every brand-scoped read while /kalender still shows it.
        brandId: owned.brandId ?? null,
        optimalityScore: optimalityScore as any,
        engagementScore: (optimalityScore * 0.8) as any,
      })
      .where(and(eq(scheduledPosts.id, existing.id), eq(scheduledPosts.userId, userId)));
  } else {
    result = await db.insert(scheduledPosts).values({
      postId,
      userId,
      // PR #79: the schedule row inherits the post's brand, so the brand-scoped
      // calendar and stats can find it. Without this it is unowned and invisible.
      brandId: owned.brandId ?? null,
      platform,
      scheduledFor,
      timezone,
      status: "scheduled",
      optimalityScore: optimalityScore as any,
      engagementScore: (optimalityScore * 0.8) as any, // Slightly lower than optimality
    });
  }

  // Reflect the schedule on the post itself — this is what makes it show up in
  // /kalender and survive a page refresh. Scoped by (id, userId) so it can only
  // ever touch the caller's own post.
  await db
    .update(posts)
    .set({ status: "scheduled", scheduledFor, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

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

  const conditions = [await brandScopedUser(userId)];

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
        await brandScopedUser(userId),
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

  // PR #81: keep `posts` in sync — the calendar renders from posts.scheduledFor,
  // so a cancelled schedule that left the post at status='scheduled' kept
  // drawing a ghost entry the user could not remove.
  //
  // Only a row that is still PENDING may be cancelled. Cancelling an already
  // published row used to flip the post from 'published' back to 'draft' and null
  // its scheduledFor, so a post that had genuinely gone out vanished from the
  // calendar and from the Publisert count while publishedAt still said otherwise.
  const [row] = await db
    .select({ postId: scheduledPosts.postId })
    .from(scheduledPosts)
    .where(and(
      eq(scheduledPosts.id, scheduledPostId),
      eq(scheduledPosts.userId, userId),
      eq(scheduledPosts.status, "scheduled"),
    ))
    .limit(1);
  if (!row) throw new Error("Fant ingen planlagt publisering å avbryte.");

  const result = await db
    .update(scheduledPosts)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, scheduledPostId),
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, "scheduled")
      )
    );

  if (row.postId != null) {
    await db
      .update(posts)
      .set({ status: "draft", scheduledFor: null, updatedAt: new Date() })
      .where(and(
        eq(posts.id, row.postId),
        eq(posts.userId, userId),
        // Never rewrite a post that already went out.
        eq(posts.status, "scheduled"),
      ));
  }

  return result;
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

  // PR #81: only a PENDING row can move. Rescheduling a published, failed or
  // cancelled row used to set the post back to 'scheduled' with a future date
  // while no pending schedule row existed — the calendar showed a confident
  // "Planlagt" entry the worker would never pick up.
  const [row] = await db
    .select({ postId: scheduledPosts.postId })
    .from(scheduledPosts)
    .where(and(
      eq(scheduledPosts.id, scheduledPostId),
      eq(scheduledPosts.userId, userId),
      eq(scheduledPosts.status, "scheduled"),
    ))
    .limit(1);
  if (!row) throw new Error("Fant ingen planlagt publisering å flytte.");

  const result = await db
    .update(scheduledPosts)
    .set({
      scheduledFor: newScheduledFor,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, scheduledPostId),
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, "scheduled")
      )
    );

  // Same reason as cancel — move the date the calendar actually reads, otherwise
  // a drag-and-drop reschedule snapped back on the next refetch.
  if (row.postId != null) {
    await db
      .update(posts)
      .set({ status: "scheduled", scheduledFor: newScheduledFor, updatedAt: new Date() })
      .where(and(
        eq(posts.id, row.postId),
        eq(posts.userId, userId),
        eq(posts.status, "scheduled"),
      ));
  }

  return result;
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
        await brandScopedUser(userId),
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