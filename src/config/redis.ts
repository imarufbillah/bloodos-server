import { Redis } from "ioredis";
import { logger } from "../utils/logger.js";

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_ENABLED = REDIS_HOST && REDIS_HOST !== "localhost";

let redis: Redis | null = null;

function createRedisClient(): Redis {
  const client = new Redis({
    host: REDIS_HOST,
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.warn("Redis: max retries reached, giving up");
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  client.on("connect", () => {
    logger.info("Redis connected");
  });

  client.on("ready", () => {
    logger.info("Redis ready");
  });

  client.on("error", (err: Error) => {
    logger.warn("Redis connection error", { message: err.message });
  });

  return client;
}

export async function closeRedisConnection(): Promise<void> {
  if (!redis) return;
  try {
    await redis.quit();
    logger.info("Redis connection closed");
  } catch {
    redis.disconnect();
  }
}

export function isRedisReady(): boolean {
  return redis?.status === "ready";
}

export function getRedisStatus(): string {
  if (!REDIS_ENABLED) return "disabled (no REDIS_HOST)";
  return redis?.status ?? "not initialized";
}

export function getRedisClient(): Redis | null {
  if (!REDIS_ENABLED) return null;
  if (!redis) {
    redis = createRedisClient();
    redis.connect().catch(() => {});
  }
  return redis;
}
