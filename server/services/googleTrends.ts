/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import GoogleTrendsApi from "@alkalisummer/google-trends-js";
import { getDb } from "../db";
import { trendingTopics, TrendingTopic } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * Google Trends Service
 * Fetches trending keywords from Google Trends API with caching
 */

interface CachedTrend {
  title: string;
  description?: string;
  category: string;
  source: string;
  sourceUrl?: string;
  trendScore: number;
  region: string;
  suggestedPlatforms: string[];
  expiresAt: Date;
}

interface TrendingKeyword {
  keyword: string;
  trendScore: number;
  growth: string; // "up", "down", "stable"
  searchVolume: number;
  relatedKeywords: string[];
}

// In-memory cache for trends data
const cache = {
  trends: null as CachedTrend[] | null,
  lastUpdated: null as Date | null,
  cacheExpiry: 1000 * 60 * 60, // 1 hour in milliseconds
};

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  if (!cache.lastUpdated || !cache.trends) return false;
  const now = new Date();
  const timeSinceUpdate = now.getTime() - cache.lastUpdated.getTime();
  return timeSinceUpdate < cache.cacheExpiry;
}

/**
 * Fetch trending keywords from Google Trends
 */
async function fetchFromGoogleTrends(
  region: string = "NO"
): Promise<TrendingKeyword[]> {
  try {
    // The package's default export is double-wrapped under CJS/ESM interop
    // (`import GoogleTrendsApi from ...` yields `{ default: <instance> }`), so the
    // real singleton — with dailyTrends() — lives on `.default`. Without this the
    // call throws "dailyTrends is not a function" and trends silently come back empty.
    const api = (GoogleTrendsApi as any).default ?? GoogleTrendsApi;
    const response = await api.dailyTrends({
      geo: region,
    });

    if (!response || !response.data) {
      console.warn("No trends data received from Google Trends");
      return [];
    }

    const trends = Array.isArray(response.data) ? response.data : [];

    return trends.slice(0, 10).map((trend: Record<string, any>) => ({
      // v0.3 of the lib returns { keyword, traffic, trafficGrowthRate, relatedKeywords }.
      // Keep the old { title.query, relatedQueries } shape as a fallback.
      keyword: trend.keyword || trend.title?.query || trend.title || "Unknown",
      trendScore: 80 + Math.random() * 20, // Lib has no 0-100 score — keep a synthetic one
      growth:
        typeof trend.trafficGrowthRate === "number" && trend.trafficGrowthRate < 0
          ? "down"
          : "up",
      searchVolume: trend.traffic ?? Math.floor(Math.random() * 100000) + 10000,
      relatedKeywords:
        trend.relatedKeywords ||
        trend.relatedQueries?.map((q: Record<string, any>) => q.query) ||
        [],
    }));
  } catch (error) {
    console.error("Error fetching from Google Trends:", error);
    return [];
  }
}

/**
 * Transform Google Trends data to database format
 */
function transformToTrendingTopics(
  keywords: TrendingKeyword[]
): CachedTrend[] {
  return keywords.map((keyword) => ({
    title: keyword.keyword,
    description: `Trending keyword with ${keyword.searchVolume.toLocaleString()} searches`,
    category: "trending",
    source: "google_trends",
    trendScore: Math.round(keyword.trendScore),
    region: "NO",
    suggestedPlatforms: ["linkedin", "twitter", "instagram"],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
  }));
}

/**
 * Save trends to database
 */
async function saveTrendsToDatabase(trends: CachedTrend[]): Promise<void> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Mark old trends as inactive
    await db
      .update(trendingTopics)
      .set({ active: 0 })
      .where(eq(trendingTopics.source, "google_trends"));

    // Insert new trends
    for (const trend of trends) {
      await db.insert(trendingTopics).values({
        title: trend.title,
        description: trend.description,
        category: trend.category,
        source: trend.source,
        trendScore: trend.trendScore,
        region: trend.region,
        suggestedPlatforms: JSON.stringify(trend.suggestedPlatforms),
        expiresAt: trend.expiresAt,
        active: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(`Successfully saved ${trends.length} trends to database`);
  } catch (error) {
    console.error("Error saving trends to database:", error);
    throw error;
  }
}

/**
 * Get trending keywords from cache or fetch fresh data
 */
export async function getTrendingKeywords(
  region: string = "NO"
): Promise<CachedTrend[]> {
  // Return cached data if valid
  if (isCacheValid() && cache.trends) {
    console.log("Returning cached trends");
    return cache.trends;
  }

  console.log("Fetching fresh trends from Google Trends");

  try {
    // Fetch from Google Trends API
    const keywords = await fetchFromGoogleTrends(region);

    if (keywords.length === 0) {
      // Fallback to database if API fails
      return await getTrendsFromDatabase();
    }

    // Transform and save to database
    const trends = transformToTrendingTopics(keywords);
    await saveTrendsToDatabase(trends);

    // Update cache
    cache.trends = trends;
    cache.lastUpdated = new Date();

    return trends;
  } catch (error) {
    console.error("Error in getTrendingKeywords:", error);
    // Fallback to database
    return await getTrendsFromDatabase();
  }
}

/**
 * Get trends from database (fallback)
 */
export async function getTrendsFromDatabase(): Promise<CachedTrend[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const dbTrends = await db
      .select()
      .from(trendingTopics)
      .where(
        and(
          eq(trendingTopics.active, 1),
          gt(trendingTopics.expiresAt, new Date())
        )
      )
      .limit(10);

    return dbTrends.map((trend: TrendingTopic) => ({
      title: trend.title,
      description: trend.description || undefined,
      category: trend.category,
      source: trend.source || "google_trends",
      sourceUrl: trend.sourceUrl || undefined,
      trendScore: trend.trendScore,
      region: trend.region,
      suggestedPlatforms: trend.suggestedPlatforms
        ? (() => { try { return JSON.parse(trend.suggestedPlatforms!) as string[]; } catch { return []; } })()
        : [],
      expiresAt: trend.expiresAt || new Date(),
    }));
  } catch (error) {
    console.error("Error fetching trends from database:", error);
    return [];
  }
}

/**
 * Get trending keywords by category
 */
export async function getTrendsByCategory(
  category: string
): Promise<CachedTrend[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const trends = await db
      .select()
      .from(trendingTopics)
      .where(
        and(
          eq(trendingTopics.category, category),
          eq(trendingTopics.active, 1),
          gt(trendingTopics.expiresAt, new Date())
        )
      )
      .limit(10);

    return trends.map((trend: TrendingTopic) => ({
      title: trend.title,
      description: trend.description || undefined,
      category: trend.category,
      source: trend.source || "google_trends",
      sourceUrl: trend.sourceUrl || undefined,
      trendScore: trend.trendScore,
      region: trend.region,
      suggestedPlatforms: trend.suggestedPlatforms
        ? (() => { try { return JSON.parse(trend.suggestedPlatforms!) as string[]; } catch { return []; } })()
        : [],
      expiresAt: trend.expiresAt || new Date(),
    }));
  } catch (error) {
    console.error("Error fetching trends by category:", error);
    return [];
  }
}

/**
 * Get trend history (last 7 days)
 */
export async function getTrendHistory(): Promise<CachedTrend[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trends = await db
      .select()
      .from(trendingTopics)
      .where(
        and(
          eq(trendingTopics.source, "google_trends"),
          gt(trendingTopics.createdAt, sevenDaysAgo)
        )
      )
      .limit(50);

    return trends.map((trend: TrendingTopic) => ({
      title: trend.title,
      description: trend.description || undefined,
      category: trend.category,
      source: trend.source || "google_trends",
      sourceUrl: trend.sourceUrl || undefined,
      trendScore: trend.trendScore,
      region: trend.region,
      suggestedPlatforms: trend.suggestedPlatforms
       ? (() => { try { return JSON.parse(trend.suggestedPlatforms!) as string[]; } catch { return []; } })()
        : [],
      expiresAt: trend.expiresAt || new Date(),
    }));
  } catch (error) {
    console.error("Error fetching trending topics:", error);    return [];
  }
}

/**
 * Clear cache (useful for testing or manual refresh)
 */
export function clearCache(): void {
  cache.trends = null;
  cache.lastUpdated = null;
  console.log("Cache cleared");
}

/**
 * Get cache status
 */
export function getCacheStatus(): {
  isCached: boolean;
  lastUpdated: Date | null;
  cacheExpiry: number;
} {
  return {
    isCached: isCacheValid(),
    lastUpdated: cache.lastUpdated,
    cacheExpiry: cache.cacheExpiry,
  };
}