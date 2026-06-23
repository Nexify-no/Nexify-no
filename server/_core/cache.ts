/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Simple In-Memory Cache Implementation
 * Used for caching frequently accessed data to reduce database queries
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class Cache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.startCleanupInterval();
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get or set value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const value = await fetcher();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let removed = 0;

      this.store.forEach((entry, key) => {
        if (entry.expiresAt < now) {
          this.store.delete(key);
          removed++;
        }
      });

      if (removed > 0) {
        console.log(`[Cache] Cleaned up ${removed} expired entries`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const cache = new Cache();

/**
 * Cache key generators for consistent naming
 */
export const cacheKeys = {
  userSubscription: (userId: number) => `user:${userId}:subscription`,
  userPreferences: (userId: number) => `user:${userId}:preferences`,
  userPosts: (userId: number) => `user:${userId}:posts`,
  trendingTopics: () => `trending:topics`,
  trendingHashtags: () => `trending:hashtags`,
  supportTickets: (userId: number) => `support:tickets:${userId}`,
  supportTicketDetail: (ticketId: number) => `support:ticket:${ticketId}`,
};

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  userSubscription: (userId: number) => cache.delete(cacheKeys.userSubscription(userId)),
  userPreferences: (userId: number) => cache.delete(cacheKeys.userPreferences(userId)),
  userPosts: (userId: number) => cache.delete(cacheKeys.userPosts(userId)),
  trendingTopics: () => cache.delete(cacheKeys.trendingTopics()),
  trendingHashtags: () => cache.delete(cacheKeys.trendingHashtags()),
  supportTickets: (userId: number) => cache.delete(cacheKeys.supportTickets(userId)),
  supportTicketDetail: (ticketId: number) => cache.delete(cacheKeys.supportTicketDetail(ticketId)),
  allUserData: (userId: number) => {
    cache.delete(cacheKeys.userSubscription(userId));
    cache.delete(cacheKeys.userPreferences(userId));
    cache.delete(cacheKeys.userPosts(userId));
  },
};