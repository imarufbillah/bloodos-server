import redis, { isRedisReady } from "../config/redis.js";
import { logger } from "../utils/logger.js";

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
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
      logger.error("Cache get error", { key, error });
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = 120): Promise<void> {
    if (!isRedisReady()) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
    } catch (error) {
      logger.error("Cache set error", { key, error });
    }
  }

  static async delete(key: string): Promise<void> {
    if (!isRedisReady()) {
      return;
    }

    try {
      await redis.del(key);
    } catch (error) {
      logger.error("Cache delete error", { key, error });
    }
  }

  static async invalidate(pattern: string): Promise<void> {
    if (!isRedisReady()) {
      return;
    }

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
    if (!isRedisReady()) {
      return;
    }

    try {
      await Promise.all(patterns.map((pattern) => this.invalidate(pattern)));
    } catch (error) {
      logger.error("Cache invalidateMultiple error", { error });
    }
  }

  static async clear(): Promise<void> {
    if (!isRedisReady()) {
      return;
    }

    try {
      await redis.flushdb();
      logger.info("Cache cleared");
    } catch (error) {
      logger.error("Cache clear error", { error });
    }
  }

  static async exists(key: string): Promise<boolean> {
    if (!isRedisReady()) {
      return false;
    }

    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Cache exists error", { key, error });
      return false;
    }
  }

  static async ttl(key: string): Promise<number> {
    if (!isRedisReady()) {
      return -2;
    }

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
    if (!isRedisReady()) {
      return;
    }

    try {
      const pipeline = redis.pipeline();

      entries.forEach(({ key, value }) => {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      });

      await pipeline.exec();
    } catch (error) {
      logger.error("Cache setMany error", { error });
    }
  }

  static async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
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
      logger.error("Cache getMany error", { error });
      return keys.reduce(
        (acc, key) => {
          acc[key] = null;
          return acc;
        },
        {} as Record<string, T | null>,
      );
    }
  }

  static async increment(key: string, amount: number = 1): Promise<number> {
    if (!isRedisReady()) {
      return 0;
    }

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
