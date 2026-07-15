/**
 * Redis Configuration
 * 
 * Sets up Redis client for caching layer with proper error handling
 * and connection management.
 */

import { Redis } from 'ioredis';

/**
 * Redis client instance
 * Configured with retry strategy and error handling
 */
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB) || 0,
  
  // Retry strategy: exponential backoff with max 2 seconds
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Connection timeout
  connectTimeout: 10000,
  
  // Max retry attempts
  maxRetriesPerRequest: 3,
  
  // Enable offline queue to buffer commands when disconnected
  enableOfflineQueue: true,
  
  // Lazy connect - don't connect until first command
  lazyConnect: false,
});

/**
 * Connection event handlers
 */
redis.on('connect', () => {
  console.log('📦 Redis: Connecting...');
});

redis.on('ready', () => {
  console.log('✅ Redis: Connected and ready');
});

redis.on('error', (err: Error) => {
  console.error('❌ Redis connection error:', err.message);
  // Don't throw - allow application to continue without cache
});

redis.on('close', () => {
  console.log('🔌 Redis: Connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis: Reconnecting...');
});

/**
 * Graceful shutdown handler
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    await redis.quit();
    console.log('✅ Redis connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error);
    // Force close if graceful shutdown fails
    redis.disconnect();
  }
}

/**
 * Check if Redis is connected and ready
 */
export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): string {
  return redis.status;
}

export default redis;
