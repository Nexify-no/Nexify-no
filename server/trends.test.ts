/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import GoogleTrendsApi from "@alkalisummer/google-trends-js";
import { getDb } from "./db";
import {
  getTrendingKeywords,
  clearCache,
  getCacheStatus,
} from "./services/googleTrends";

// NOTE: vitest.config sets mockReset/clearMocks/restoreMocks = true, so mock
// implementations are wiped before every test. We therefore (re)establish all
// implementations inside beforeEach, which runs AFTER that automatic reset.

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("@alkalisummer/google-trends-js", () => ({
  default: { dailyTrends: vi.fn() },
}));

const dailyTrends = (GoogleTrendsApi as unknown as { dailyTrends: ReturnType<typeof vi.fn> })
  .dailyTrends;

const SAMPLE = {
  data: [
    { title: { query: "Norge nyheter" }, relatedQueries: [{ query: "valg" }] },
    { title: { query: "Fotball" }, relatedQueries: [] },
  ],
};

describe("Google Trends Service", () => {
  beforeEach(() => {
    clearCache(); // module-level cache persists across tests; reset it

    // getDb() resolves to mockDb again (reset wiped the resolved value).
    (getDb as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

    // Chainable query builder: non-terminal calls return the builder, terminal
    // calls (.limit / .values) resolve.
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.values.mockResolvedValue(undefined);

    dailyTrends.mockResolvedValue(SAMPLE);
  });

  describe("getTrendingKeywords", () => {
    it("should fetch and transform trending keywords", async () => {
      const result = await getTrendingKeywords("NO");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(dailyTrends).toHaveBeenCalledWith({ geo: "NO" });
    });

    it("should return trends with the expected shape", async () => {
      const result = await getTrendingKeywords("NO");

      const trend = result[0];
      expect(trend).toHaveProperty("title", "Norge nyheter");
      expect(trend).toHaveProperty("category", "trending");
      expect(trend).toHaveProperty("source", "google_trends");
      expect(typeof trend.trendScore).toBe("number");
      expect(Array.isArray(trend.suggestedPlatforms)).toBe(true);
    });

    it("should request the geo it is given", async () => {
      await getTrendingKeywords("US");
      expect(dailyTrends).toHaveBeenCalledWith({ geo: "US" });
    });

    it("should fall back to the database (empty) when the API returns nothing", async () => {
      dailyTrends.mockResolvedValue({ data: [] });

      const result = await getTrendingKeywords("NO");

      // No keywords from API -> getTrendsFromDatabase() path, which the mock empties.
      expect(result).toEqual([]);
    });

    it("should persist fetched trends to the database", async () => {
      await getTrendingKeywords("NO");

      // Old trends marked inactive, then each new trend inserted.
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("caching", () => {
    it("should serve the second call from cache without re-fetching", async () => {
      await getTrendingKeywords("NO");
      await getTrendingKeywords("NO");

      // Second call hits the in-memory cache -> API queried only once.
      expect(dailyTrends).toHaveBeenCalledTimes(1);
      expect(getCacheStatus().isCached).toBe(true);
    });

    it("should re-fetch after clearCache()", async () => {
      await getTrendingKeywords("NO");
      clearCache();
      expect(getCacheStatus().isCached).toBe(false);

      await getTrendingKeywords("NO");
      expect(dailyTrends).toHaveBeenCalledTimes(2);
    });
  });
});