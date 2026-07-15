import { getRedisClient, isRedisReady } from "../config/redis.js";
import { logger } from "../utils/logger.js";

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
      const cached = await redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error("Cache get error", { key, error });
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = 120): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error("Cache set error", { key, error });
    }
  }

  static async delete(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      await redis.del(key);
    } catch (error) {
      logger.error("Cache delete error", { key, error });
    }
  }

  static async invalidate(pattern: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      const keys: string[] = [];
      let cursor = "0";

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

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug("Cache keys invalidated", { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error("Cache invalidate error", { pattern, error });
    }
  }

  static async invalidateMultiple(patterns: string[]): Promise<void> {
    if (!isRedisReady()) return;
    await Promise.all(patterns.map((pattern) => this.invalidate(pattern)));
  }

  static async clear(): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      await redis.flushdb();
      logger.info("Cache cleared");
    } catch (error) {
      logger.error("Cache clear error", { error });
    }
  }

  static async exists(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
      return (await redis.exists(key)) === 1;
    } catch (error) {
      logger.error("Cache exists error", { key, error });
      return false;
    }
  }

  static async ttl(key: string): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return -2;

    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error("Cache TTL error", { key, error });
      return -2;
    }
  }

  static async setMany(
    entries: Array<{ key: string; value: any }>,
    ttl: number = 120,
  ): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      const pipeline = redis.pipeline();
      entries.forEach(({ key, value }) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
    } catch (error) {
      logger.error("Cache setMany error", { error });
    }
  }

  static async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const redis = getRedisClient();
    const nullResult = keys.reduce(
      (acc, key) => ({ ...acc, [key]: null }),
      {} as Record<string, T | null>,
    );
    if (!redis) return nullResult;

    try {
      const values = await redis.mget(...keys);
      const result: Record<string, T | null> = {};
      keys.forEach((key, i) => {
        result[key] = values[i] ? JSON.parse(values[i]!) : null;
      });
      return result;
    } catch (error) {
      logger.error("Cache getMany error", { error });
      return nullResult;
    }
  }

  static async increment(key: string, amount: number = 1): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return 0;

    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      logger.error("Cache increment error", { key, error });
      return 0;
    }
  }

  static async getStats(): Promise<{
    connected: boolean;
    status: string;
    keyCount: number;
    usedMemory: string | null;
  }> {
    const redis = getRedisClient();
    if (!redis) {
      return { connected: false, status: "disconnected", keyCount: 0, usedMemory: null };
    }

    try {
      const info = await redis.info("stats");
      const dbSize = await redis.dbsize();

      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const usedMemory = memoryMatch?.[1]?.trim() || null;

      return {
        connected: true,
        status: "ready",
        keyCount: dbSize,
        usedMemory,
      };
    } catch (error) {
      logger.error("Cache getStats error", { error });
      return {
        connected: true,
        status: "error",
        keyCount: 0,
        usedMemory: null,
      };
    }
  }
}

export const CacheKeys = {
  endpoint: (method: string, url: string): string => {
    return `cache:${method}:${url}`;
  },

  resource: (resource: string, id: string): string => {
    return `cache:${resource}:${id}`;
  },

  endpointPattern: (path: string): string => {
    return `cache:*:${path}*`;
  },

  resourcePattern: (resource: string): string => {
    return `cache:${resource}:*`;
  },
};
