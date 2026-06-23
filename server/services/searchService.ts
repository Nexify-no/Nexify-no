/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Search & Filtering Service
 * Provides comprehensive search and filtering capabilities for posts
 */

import { getDb } from "../db";
import { posts } from "../../drizzle/schema";
import { eq, and, or, like, gte, lte, inArray, desc } from "drizzle-orm";

/**
 * Search filters interface
 */
export interface SearchFilters {
  query?: string; // Full-text search query
  platforms?: ("linkedin" | "twitter" | "instagram" | "facebook")[];
  statuses?: ("draft" | "scheduled" | "published" | "failed")[];
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "engagement";
  sortOrder?: "asc" | "desc";
}

/**
 * Search result interface
 */
export interface SearchResult {
  id: number;
  platform: string;
  tone: string;
  rawInput: string;
  generatedContent: string;
  status: string;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  matchScore?: number; // Relevance score for search results
}

/**
 * Search results with metadata
 */
export interface SearchResults {
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Search posts with comprehensive filtering
 */
export async function searchPosts(
  userId: number,
  filters: SearchFilters
): Promise<SearchResults> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const {
    query,
    platforms,
    statuses,
    startDate,
    endDate,
    tags,
    limit = 20,
    offset = 0,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  // Build WHERE conditions
  const conditions: any[] = [eq(posts.userId, userId)];

  // Full-text search
  if (query) {
    conditions.push(
      or(
        like(posts.generatedContent, `%${query}%`),
        like(posts.rawInput, `%${query}%`),
        like(posts.tone, `%${query}%`)
      )
    );
  }

  // Platform filter
  if (platforms && platforms.length > 0) {
    conditions.push(inArray(posts.platform, platforms));
  }

  // Status filter
  if (statuses && statuses.length > 0) {
    conditions.push(inArray(posts.status, statuses));
  }

  // Date range filter
  if (startDate) {
    conditions.push(gte(posts.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(posts.createdAt, endDate));
  }

  // Tags filter (if post contains any of the tags)
  if (tags && tags.length > 0) {
    // This is a simplified filter - in production, you might want to use JSON_CONTAINS
    // For now, we'll filter in memory
  }

  // Build query with sorting
  const baseQuery = db
    .select()
    .from(posts)
    .where(and(...conditions));

  // Add sorting - cast to any to avoid type issues
  let queryBuilder: any = baseQuery;
  if (sortBy === "createdAt") {
    queryBuilder = baseQuery.orderBy(
      sortOrder === "desc" ? desc(posts.createdAt) : posts.createdAt
    );
  } else if (sortBy === "updatedAt") {
    queryBuilder = baseQuery.orderBy(
      sortOrder === "desc" ? desc(posts.updatedAt) : posts.updatedAt
    );
  } else {
    queryBuilder = baseQuery.orderBy(desc(posts.createdAt));
  }

  // Get total count
  const countResult = await db
    .select()
    .from(posts)
    .where(and(...conditions));
  const total = countResult.length;

  // Get paginated results
  const results = await queryBuilder.limit(limit).offset(offset);

  // Filter by tags in memory if needed
  let filteredResults: SearchResult[] = results;
  if (tags && tags.length > 0) {
    filteredResults = results.filter((post: SearchResult) => {
      const postTags: string[] = Array.isArray(post.tags) ? post.tags : [];
      return tags.some((tag: string) =>
        postTags.some((postTag: string) =>
          postTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
    });
  }

  return {
    results: filteredResults,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

/**
 * Search by platform
 */
export async function searchByPlatform(
  userId: number,
  platform: "linkedin" | "twitter" | "instagram" | "facebook",
  query?: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResults> {
  return searchPosts(userId, {
    query,
    platforms: [platform],
    limit,
    offset,
  });
}

/**
 * Search by status
 */
export async function searchByStatus(
  userId: number,
  status: "draft" | "scheduled" | "published" | "failed",
  query?: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResults> {
  return searchPosts(userId, {
    query,
    statuses: [status],
    limit,
    offset,
  });
}

/**
 * Search by date range
 */
export async function searchByDateRange(
  userId: number,
  startDate: Date,
  endDate: Date,
  query?: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResults> {
  return searchPosts(userId, {
    query,
    startDate,
    endDate,
    limit,
    offset,
  });
}

/**
 * Get posts by multiple filters
 */
export async function getFilteredPosts(
  userId: number,
  platforms?: ("linkedin" | "twitter" | "instagram" | "facebook")[],
  statuses?: ("draft" | "scheduled" | "published" | "failed")[],
  startDate?: Date,
  endDate?: Date,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResults> {
  return searchPosts(userId, {
    platforms,
    statuses,
    startDate,
    endDate,
    limit,
    offset,
  });
}

/**
 * Get trending search terms
 */
export async function getTrendingSearchTerms(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all posts for the user
  const userPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId));

  // Extract and count keywords
  const keywordMap = new Map<string, number>();

  for (const post of userPosts) {
    // Extract words from content
    const words = post.generatedContent
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3); // Only words longer than 3 chars

    for (const word of words) {
      // Remove punctuation
      const cleanWord = word.replace(/[^\w]/g, "");
      if (cleanWord.length > 3) {
        keywordMap.set(cleanWord, (keywordMap.get(cleanWord) || 0) + 1);
      }
    }
  }

  // Sort by frequency and return top terms
  const trendingTerms = Array.from(keywordMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({
      term,
      count,
      frequency: count / userPosts.length,
    }));

  return trendingTerms;
}

/**
 * Get search suggestions based on user's posts
 */
export async function getSearchSuggestions(
  userId: number,
  query: string,
  limit: number = 5
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get posts that match the query
  const matchingPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        or(
          like(posts.generatedContent, `%${query}%`),
          like(posts.rawInput, `%${query}%`),
          like(posts.tone, `%${query}%`)
        )
      )
    )
    .limit(limit);

  // Extract unique tones and tags
  const suggestions = {
    tones: Array.from(new Set(matchingPosts.map((p) => p.tone))),
    tags: Array.from(
      new Set(
        matchingPosts
          .flatMap((p) => (Array.isArray(p.tags) ? p.tags : []))
          .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      )
    ),
    platforms: Array.from(new Set(matchingPosts.map((p) => p.platform))),
  };

  return suggestions;
}

/**
 * Get filter options for UI
 */
export async function getFilterOptions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId));

  // Get unique values for each filter
  const platforms = Array.from(new Set(userPosts.map((p) => p.platform)));
  const statuses = Array.from(new Set(userPosts.map((p) => p.status)));
  const tones = Array.from(new Set(userPosts.map((p) => p.tone)));
  const tags = Array.from(
    new Set(userPosts.flatMap((p) => (Array.isArray(p.tags) ? p.tags : [])))
  );

  // Get date range
  const dates = userPosts.map((p) => p.createdAt).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  return {
    platforms,
    statuses,
    tones,
    tags,
    dateRange: {
      min: minDate,
      max: maxDate,
    },
  };
}

/**
 * Advanced search with scoring
 */
export async function advancedSearch(
  userId: number,
  query: string,
  filters: Partial<SearchFilters>
): Promise<SearchResults> {
  const results = await searchPosts(userId, {
    ...filters,
    query,
  });

  // Score results based on relevance
  const scoredResults = results.results.map((result) => {
    let score = 0;

    // Exact match in content
    if (result.generatedContent.includes(query)) {
      score += 100;
    }

    // Partial match
    if (result.generatedContent.toLowerCase().includes(query.toLowerCase())) {
      score += 50;
    }

    // Match in raw input
    if (result.rawInput.toLowerCase().includes(query.toLowerCase())) {
      score += 25;
    }

    // Match in tone
    if (result.tone.toLowerCase().includes(query.toLowerCase())) {
      score += 10;
    }

    return {
      ...result,
      matchScore: score,
    };
  });

  // Sort by score
  scoredResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  return {
    ...results,
    results: scoredResults,
  };
}

/**
 * Get posts statistics for filters
 */
export async function getPostStatistics(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId));

  // Count by status
  const statusCounts = {
    draft: userPosts.filter((p) => p.status === "draft").length,
    scheduled: userPosts.filter((p) => p.status === "scheduled").length,
    published: userPosts.filter((p) => p.status === "published").length,
    failed: userPosts.filter((p) => p.status === "failed").length,
  };

  // Count by platform
  const platformCounts = {
    linkedin: userPosts.filter((p) => p.platform === "linkedin").length,
    twitter: userPosts.filter((p) => p.platform === "twitter").length,
    instagram: userPosts.filter((p) => p.platform === "instagram").length,
    facebook: userPosts.filter((p) => p.platform === "facebook").length,
  };

  // Count by tone
  const toneCounts: Record<string, number> = {};
  for (const post of userPosts) {
    toneCounts[post.tone] = (toneCounts[post.tone] || 0) + 1;
  }

  // Date statistics
  const today = new Date();
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayCount = userPosts.filter(
    (p) =>
      p.createdAt.toDateString() === today.toDateString()
  ).length;

  const thisWeekCount = userPosts.filter(
    (p) => p.createdAt >= thisWeekStart
  ).length;

  const thisMonthCount = userPosts.filter(
    (p) => p.createdAt >= thisMonthStart
  ).length;

  return {
    total: userPosts.length,
    statusCounts,
    platformCounts,
    toneCounts,
    dateStatistics: {
      today: todayCount,
      thisWeek: thisWeekCount,
      thisMonth: thisMonthCount,
    },
  };
}