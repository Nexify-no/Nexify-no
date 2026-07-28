/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Engagement Metrics Service — the REAL "best time to post" data pipeline.
 *
 * Fetches engagement/impression metrics for the user's OWN published posts from
 * each platform's API, stores them on post_analytics, then aggregates them into
 * posting_times_analytics (the personalized best-time signal).
 *
 * Everything here is best-effort and never throws out of its loops: if a token is
 * missing, an endpoint is restricted, or a request fails, we simply skip that row.
 * No numbers are ever fabricated — we only store what the platform actually returns.
 */

import { eq, and, gte, isNotNull } from "drizzle-orm";
import { platformManager } from "./platformOAuthService";
import { graphUrl } from "./metaGraph";

type Platform = "linkedin" | "twitter" | "instagram" | "facebook";

interface FetchedMetrics {
  engagement: number;
  impressions: number;
}

const FETCH_TIMEOUT_MS = 10_000;

/** Fetch with a hard 10s timeout via AbortController. Returns null on any failure. */
async function safeFetchJson(
  url: string,
  headers: Record<string, string>
): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Per-platform fetchers — return { engagement, impressions } or null on failure.
// ---------------------------------------------------------------------------

async function fetchLinkedInMetrics(
  platformPostId: string,
  accessToken: string
): Promise<FetchedMetrics | null> {
  const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(
    platformPostId
  )}`;
  const data = await safeFetchJson(url, {
    Authorization: `Bearer ${accessToken}`,
  });
  if (!data) return null;
  const likes = data?.likesSummary?.totalLikes ?? 0;
  const comments = data?.commentsSummary?.aggregatedTotalComments ?? 0;
  return { engagement: Number(likes) + Number(comments), impressions: 0 };
}

async function fetchTwitterMetrics(
  platformPostId: string,
  accessToken: string
): Promise<FetchedMetrics | null> {
  const url = `https://api.twitter.com/2/tweets/${encodeURIComponent(
    platformPostId
  )}?tweet.fields=public_metrics`;
  const data = await safeFetchJson(url, {
    Authorization: `Bearer ${accessToken}`,
  });
  const m = data?.data?.public_metrics;
  if (!m) return null;
  const engagement =
    Number(m.like_count ?? 0) +
    Number(m.reply_count ?? 0) +
    Number(m.retweet_count ?? 0) +
    Number(m.quote_count ?? 0);
  const impressions = Number(m.impression_count ?? 0);
  return { engagement, impressions };
}

async function fetchInstagramMetrics(
  platformPostId: string,
  accessToken: string
): Promise<FetchedMetrics | null> {
  // graph.facebook.com uses access_token as a query param (not a Bearer header).
  const base = graphUrl(encodeURIComponent(platformPostId));
  const data = await safeFetchJson(
    `${base}?fields=like_count,comments_count&access_token=${encodeURIComponent(
      accessToken
    )}`,
    {}
  );
  if (!data) return null;
  const engagement =
    Number(data.like_count ?? 0) + Number(data.comments_count ?? 0);

  let impressions = 0;
  const ins = await safeFetchJson(
    `${base}/insights?metric=impressions&access_token=${encodeURIComponent(
      accessToken
    )}`,
    {}
  );
  const val = ins?.data?.[0]?.values?.[0]?.value;
  if (typeof val === "number") impressions = val;

  return { engagement, impressions };
}

async function fetchFacebookMetrics(
  platformPostId: string,
  accessToken: string
): Promise<FetchedMetrics | null> {
  const base = graphUrl(encodeURIComponent(platformPostId));
  const data = await safeFetchJson(
    `${base}?fields=likes.summary(true),comments.summary(true),shares&access_token=${encodeURIComponent(
      accessToken
    )}`,
    {}
  );
  if (!data) return null;
  const likes = Number(data?.likes?.summary?.total_count ?? 0);
  const comments = Number(data?.comments?.summary?.total_count ?? 0);
  const shares = Number(data?.shares?.count ?? 0);
  const engagement = likes + comments + shares;

  let impressions = 0;
  const ins = await safeFetchJson(
    `${base}/insights?metric=post_impressions&access_token=${encodeURIComponent(
      accessToken
    )}`,
    {}
  );
  const val = ins?.data?.[0]?.values?.[0]?.value;
  if (typeof val === "number") impressions = val;

  return { engagement, impressions };
}

async function fetchPlatformMetrics(
  platform: Platform,
  platformPostId: string,
  accessToken: string
): Promise<FetchedMetrics | null> {
  switch (platform) {
    case "linkedin":
      return fetchLinkedInMetrics(platformPostId, accessToken);
    case "twitter":
      return fetchTwitterMetrics(platformPostId, accessToken);
    case "instagram":
      return fetchInstagramMetrics(platformPostId, accessToken);
    case "facebook":
      return fetchFacebookMetrics(platformPostId, accessToken);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch fresh engagement metrics for a user's recent published posts that carry a
 * platform post id, and store them on post_analytics. Never throws out of the loop.
 */
export async function fetchAndStoreMetrics(
  userId: number
): Promise<{ updated: number }> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return { updated: 0 };

  const { postAnalytics } = await import("../../drizzle/schema");

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // Rows with a platform post id, published within the last 60 days.
  const rows = await db
    .select()
    .from(postAnalytics)
    .where(
      and(
        eq(postAnalytics.userId, userId),
        isNotNull(postAnalytics.platformPostId),
        gte(postAnalytics.publishedAt, sixtyDaysAgo)
      )
    );

  // Cache decrypted tokens per platform so we hit the keystore once each.
  const tokenCache = new Map<string, string | null>();
  async function tokenFor(platform: Platform): Promise<string | null> {
    if (tokenCache.has(platform)) return tokenCache.get(platform)!;
    let token: string | null = null;
    try {
      const t = await platformManager.getPlatformToken(userId, platform);
      token = t?.accessToken ?? null;
    } catch {
      token = null;
    }
    tokenCache.set(platform, token);
    return token;
  }

  let updated = 0;
  for (const row of rows) {
    try {
      // Skip rows refreshed within the last 6 hours.
      if (row.metricsFetchedAt && row.metricsFetchedAt > sixHoursAgo) continue;
      if (!row.platformPostId) continue;

      const accessToken = await tokenFor(row.platform as Platform);
      if (!accessToken) continue;

      const metrics = await fetchPlatformMetrics(
        row.platform as Platform,
        row.platformPostId,
        accessToken
      );
      if (!metrics) continue;

      await db
        .update(postAnalytics)
        .set({
          engagement: metrics.engagement,
          impressions: metrics.impressions,
          metricsFetchedAt: new Date(),
        })
        .where(eq(postAnalytics.id, row.id));
      updated++;
    } catch (e) {
      console.warn(
        "[engagementMetrics] failed to update row",
        row.id,
        (e as Error)?.message
      );
    }
  }

  return { updated };
}

/**
 * Aggregate all of a user's post_analytics rows into posting_times_analytics,
 * grouped by (platform, dayOfWeek, hourOfDay). JS-side aggregation only — the DB
 * runs with only_full_group_by so we never GROUP BY for this.
 */
export async function aggregatePostingTimes(userId: number): Promise<void> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;

  const { postAnalytics, postingTimesAnalytics } = await import(
    "../../drizzle/schema"
  );

  const rows = await db
    .select()
    .from(postAnalytics)
    .where(eq(postAnalytics.userId, userId));

  if (rows.length === 0) return;

  interface Group {
    platform: Platform;
    dayOfWeek: number;
    hourOfDay: number;
    totalPosts: number;
    sumEngagement: number;
    sumImpressions: number;
  }

  const groups = new Map<string, Group>();
  const platformsSeen = new Set<Platform>();

  for (const r of rows) {
    const platform = r.platform as Platform;
    platformsSeen.add(platform);
    const key = `${platform}|${r.dayOfWeek}|${r.hourOfDay}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        platform,
        dayOfWeek: r.dayOfWeek,
        hourOfDay: r.hourOfDay,
        totalPosts: 0,
        sumEngagement: 0,
        sumImpressions: 0,
      };
      groups.set(key, g);
    }
    g.totalPosts++;
    g.sumEngagement += Number(r.engagement ?? 0);
    g.sumImpressions += Number(r.impressions ?? 0);
  }

  // Compute per-group averages.
  interface Computed extends Group {
    avgEngagement: number;
    avgImpressions: number;
    avgEngagementRate: number;
    performanceRank: number;
  }

  const computed: Computed[] = [];
  for (const g of groups.values()) {
    const avgEngagement = g.sumEngagement / g.totalPosts;
    const avgImpressions = Math.round(g.sumImpressions / g.totalPosts);
    const avgEngagementRate =
      avgImpressions > 0
        ? Math.round((avgEngagement / avgImpressions) * 100 * 100) / 100
        : 0;
    computed.push({
      ...g,
      avgEngagement,
      avgImpressions,
      avgEngagementRate,
      performanceRank: 5,
    });
  }

  // performanceRank within each platform: rank by avgEngagement desc → 1..10
  // (10 = best). Single-group platforms get 10.
  for (const platform of platformsSeen) {
    const platformGroups = computed
      .filter((c) => c.platform === platform)
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
    const n = platformGroups.length;
    platformGroups.forEach((c, idx) => {
      if (n === 1) {
        c.performanceRank = 10;
      } else {
        // idx 0 (best) → 10, last → 1
        c.performanceRank = Math.max(
          1,
          Math.round(10 - (idx / (n - 1)) * 9)
        );
      }
    });
  }

  // Replace rows per platform present.
  const { eq: eqOp, and: andOp } = await import("drizzle-orm");
  for (const platform of platformsSeen) {
    try {
      const toInsert = computed
        .filter((c) => c.platform === platform)
        .map((c) => ({
          userId,
          platform: c.platform,
          dayOfWeek: c.dayOfWeek,
          hourOfDay: c.hourOfDay,
          totalPosts: c.totalPosts,
          avgEngagement: c.avgEngagement.toFixed(2),
          avgReach: 0,
          avgImpressions: c.avgImpressions,
          avgEngagementRate: c.avgEngagementRate.toFixed(2),
          performanceRank: c.performanceRank,
        }));

      // Atomic replace: delete + re-insert in one transaction so a crash between
      // them can never leave this platform's analytics empty until the next run.
      await db.transaction(async (tx: any) => {
        await tx
          .delete(postingTimesAnalytics)
          .where(
            andOp(
              eqOp(postingTimesAnalytics.userId, userId),
              eqOp(postingTimesAnalytics.platform, platform)
            )
          );
        if (toInsert.length > 0) {
          await tx.insert(postingTimesAnalytics).values(toInsert);
        }
      });
    } catch (e) {
      console.warn(
        "[engagementMetrics] aggregate failed for",
        platform,
        (e as Error)?.message
      );
    }
  }
}

/**
 * Background refresh for ALL users that have at least one connected platform.
 * Each user is isolated in try/catch so one failure never stops the batch.
 */
export async function refreshAllUsers(): Promise<void> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;

  const { platformIntegrations } = await import("../../drizzle/schema");

  let userIds: number[] = [];
  try {
    const rows = await db
      .select({ userId: platformIntegrations.userId })
      .from(platformIntegrations);
    userIds = Array.from(new Set(rows.map((r) => r.userId)));
  } catch (e) {
    console.error(
      "[engagementMetrics] could not list users",
      (e as Error)?.message
    );
    return;
  }

  for (const userId of userIds) {
    try {
      await fetchAndStoreMetrics(userId);
      await aggregatePostingTimes(userId);
    } catch (e) {
      console.error(
        "[engagementMetrics] refresh failed for user",
        userId,
        (e as Error)?.message
      );
    }
  }
}
