/**
 * Cache Service
 *
 * Provides abstraction layer over Redis for caching operations.
 * Handles serialization, TTL management, and pattern-based invalidation.
 * Gracefully degrades if Redis is unavailable.
 */

import redis, { isRedisReady } from "../config/redis.js";

/**
 * Cache Service
 * All methods are safe to call even if Redis is unavailable
 */
export class CacheService {
  /**
   * Get a value from cache
   *
   * @param key - Cache key
   * @returns Parsed value or null if not found/error
   */
  static async get<T>(key: string): Promise<T | null> {
    // If Redis is not ready, skip cache
    if (!isRedisReady()) {
      return null;
    }

    try {
      const cached = await redis.get(key);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   *
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   * @param ttl - Time to live in seconds (default: 120)
   */
  static async set(key: string, value: any, ttl: number = 120): Promise<void> {
    // If Redis is not ready, skip cache
    if (!isRedisReady()) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      // Don't throw - cache failures shouldn't break the app
    }
  }

  /**
   * Delete a specific key from cache
   *
   * @param key - Cache key to delete
   */
  static async delete(key: string): Promise<void> {
    // If Redis is not ready, skip
    if (!isRedisReady()) {
      return;
    }

    try {
      await redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Invalidate cache keys matching a pattern
   * Uses SCAN for safe iteration (no KEYS command in production)
   *
   * @param pattern - Pattern to match (e.g., 'cache:GET:/api/requests*')
   */
  static async invalidate(pattern: string): Promise<void> {
    // If Redis is not ready, skip
    if (!isRedisReady()) {
      return;
    }

    try {
      const keys: string[] = [];
      let cursor = "0";

      // Use SCAN to find matching keys (safe for production)
      do {
        const [nextCursor, foundKeys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
      } while (cursor !== "0");

      // Delete all found keys
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(
          `🗑️  Invalidated ${keys.length} cache keys matching: ${pattern}`,
        );
      }
    } catch (error) {
      console.error(`Cache invalidate error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Invalidate multiple cache patterns at once
   *
   * @param patterns - Array of patterns to invalidate
   */
  static async invalidateMultiple(patterns: string[]): Promise<void> {
    // If Redis is not ready, skip
    if (!isRedisReady()) {
      return;
    }

    try {
      // Invalidate all patterns in parallel
      await Promise.all(patterns.map((pattern) => this.invalidate(pattern)));
    } catch (error) {
      console.error("Cache invalidateMultiple error:", error);
    }
  }

  /**
   * Clear all cache keys (use with caution!)
   * Only clears keys in the configured database
   */
  static async clear(): Promise<void> {
    // If Redis is not ready, skip
    if (!isRedisReady()) {
      return;
    }

    try {
      await redis.flushdb();
      console.log("🗑️  Cache cleared");
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  /**
   * Check if a key exists in cache
   *
   * @param key - Cache key
   * @returns true if key exists, false otherwise
   */
  static async exists(key: string): Promise<boolean> {
    // If Redis is not ready, return false
    if (!isRedisReady()) {
      return false;
    }

    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   *
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  static async ttl(key: string): Promise<number> {
    // If Redis is not ready, return -2 (key doesn't exist)
    if (!isRedisReady()) {
      return -2;
    }

    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Set multiple key-value pairs at once
   * All keys will have the same TTL
   *
   * @param entries - Array of { key, value } objects
   * @param ttl - Time to live in seconds (default: 120)
   */
  static async setMany(
    entries: Array<{ key: string; value: any }>,
    ttl: number = 120,
  ): Promise<void> {
    // If Redis is not ready, skip
    if (!isRedisReady()) {
      return;
    }

    try {
      // Use pipeline for better performance
      const pipeline = redis.pipeline();

      entries.forEach(({ key, value }) => {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      });

      await pipeline.exec();
    } catch (error) {
      console.error("Cache setMany error:", error);
    }
  }

  /**
   * Get multiple keys at once
   *
   * @param keys - Array of cache keys
   * @returns Object mapping keys to values (null if not found)
   */
  static async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    // If Redis is not ready, return all nulls
    if (!isRedisReady()) {
      return keys.reduce(
        (acc, key) => {
          acc[key] = null;
          return acc;
        },
        {} as Record<string, T | null>,
      );
    }

    try {
      const values = await redis.mget(...keys);

      const result: Record<string, T | null> = {};
      keys.forEach((key, index) => {
        const value = values[index];
        result[key] = value ? JSON.parse(value) : null;
      });

      return result;
    } catch (error) {
      console.error("Cache getMany error:", error);
      return keys.reduce(
        (acc, key) => {
          acc[key] = null;
          return acc;
        },
        {} as Record<string, T | null>,
      );
    }
  }

  /**
   * Increment a numeric value in cache
   * Creates the key with value 1 if it doesn't exist
   *
   * @param key - Cache key
   * @param amount - Amount to increment by (default: 1)
   * @returns New value after increment
   */
  static async increment(key: string, amount: number = 1): Promise<number> {
    // If Redis is not ready, return 0
    if (!isRedisReady()) {
      return 0;
    }

    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Object with cache stats
   */
  static async getStats(): Promise<{
    connected: boolean;
    status: string;
    keyCount: number;
    usedMemory: string | null;
  }> {
    const connected = isRedisReady();

    if (!connected) {
      return {
        connected: false,
        status: "disconnected",
        keyCount: 0,
        usedMemory: null,
      };
    }

    try {
      const info = await redis.info("stats");
      const dbSize = await redis.dbsize();

      // Parse used memory from info string
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const usedMemory = memoryMatch?.[1]?.trim() || null;

      return {
        connected: true,
        status: "ready",
        keyCount: dbSize,
        usedMemory,
      };
    } catch (error) {
      console.error("Cache getStats error:", error);
      return {
        connected: true,
        status: "error",
        keyCount: 0,
        usedMemory: null,
      };
    }
  }
}

/**
 * Cache key builders for consistent naming
 */
export const CacheKeys = {
  /**
   * Build cache key for GET endpoint
   * Format: cache:GET:/api/path?query
   */
  endpoint: (method: string, url: string): string => {
    return `cache:${method}:${url}`;
  },

  /**
   * Build cache key for specific resource
   * Format: cache:resource:id
   */
  resource: (resource: string, id: string): string => {
    return `cache:${resource}:${id}`;
  },

  /**
   * Build pattern for invalidating endpoint caches
   * Format: cache:*:/api/path*
   */
  endpointPattern: (path: string): string => {
    return `cache:*:${path}*`;
  },

  /**
   * Build pattern for invalidating resource caches
   * Format: cache:resource:*
   */
  resourcePattern: (resource: string): string => {
    return `cache:${resource}:*`;
  },
};
