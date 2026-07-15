import { Redis } from "ioredis";
import { logger } from "../utils/logger.js";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB) || 0,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  lazyConnect: false,
});

redis.on("connect", () => {
  logger.debug("Redis connecting...");
});

redis.on("ready", () => {
  logger.info("Redis connected and ready");
});

redis.on("error", (err: Error) => {
  logger.error("Redis connection error", { message: err.message });
});

redis.on("close", () => {
  logger.debug("Redis connection closed");
});

redis.on("reconnecting", () => {
  logger.debug("Redis reconnecting...");
});

export async function closeRedisConnection(): Promise<void> {
  try {
    await redis.quit();
    logger.info("Redis connection closed gracefully");
  } catch (error) {
    logger.error("Error closing Redis connection", { error });
    redis.disconnect();
  }
}

export function isRedisReady(): boolean {
  return redis.status === "ready";
}

export function getRedisStatus(): string {
  return redis.status;
}

export default redis;
