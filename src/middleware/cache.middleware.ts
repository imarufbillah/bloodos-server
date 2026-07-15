/**
 * Cache Middleware
 *
 * Provides automatic response caching for GET requests.
 * Caches successful responses (200 status) and serves from cache on subsequent requests.
 */

import type { Request, Response, NextFunction } from "express";
import { CacheService, CacheKeys } from "../services/cache.service.js";

/**
 * Cache middleware factory
 * Creates middleware that caches GET responses
 *
 * @param ttl - Time to live in seconds (default: 120 seconds / 2 minutes)
 * @returns Express middleware
 *
 * @example
 * // Cache for 60 seconds
 * router.get('/api/requests', cacheMiddleware(60), listRequests);
 *
 * // Cache for default 120 seconds
 * router.get('/api/donors', cacheMiddleware(), listDonors);
 */
export function cacheMiddleware(ttl: number = 120) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Build cache key from method and full URL (including query string)
    const cacheKey = CacheKeys.endpoint(req.method, req.originalUrl);

    try {
      // Try to get cached response
      const cached = await CacheService.get<any>(cacheKey);

      if (cached) {
        // Cache hit - return cached response
        res.setHeader("X-Cache", "HIT");
        res.status(200).json(cached);
        return;
      }

      // Cache miss - continue to controller and cache the response
      res.setHeader("X-Cache", "MISS");

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to intercept and cache the response
      res.json = function (body: any): Response {
        // Only cache successful responses (status 200)
        if (res.statusCode === 200) {
          // Cache asynchronously (don't wait)
          CacheService.set(cacheKey, body, ttl).catch((error) => {
            console.error("Error caching response:", error);
          });
        }

        // Call original json method
        return originalJson(body);
      };

      next();
    } catch (error) {
      // If caching fails, continue without cache
      console.error("Cache middleware error:", error);
      next();
    }
  };
}

/**
 * Conditional cache middleware
 * Only caches if user is not authenticated (public requests)
 *
 * This is useful for endpoints that return different data for authenticated users
 *
 * @param ttl - Time to live in seconds
 * @returns Express middleware
 */
export function publicCacheMiddleware(ttl: number = 120) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Check if user is authenticated
    const sessionUser = (req as any).sessionUser;

    // Skip cache if authenticated
    if (sessionUser) {
      return next();
    }

    // Use regular cache middleware for public requests
    return cacheMiddleware(ttl)(req, res, next);
  };
}

/**
 * Cache middleware with user-specific keys
 * Caches responses per user (useful for authenticated endpoints)
 *
 * @param ttl - Time to live in seconds
 * @returns Express middleware
 */
export function userCacheMiddleware(ttl: number = 60) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const sessionUser = (req as any).sessionUser;

    // Skip if not authenticated
    if (!sessionUser) {
      return next();
    }

    // Build user-specific cache key
    const cacheKey = `${CacheKeys.endpoint(req.method, req.originalUrl)}:user:${sessionUser.id}`;

    try {
      // Try to get cached response
      const cached = await CacheService.get<any>(cacheKey);

      if (cached) {
        // Cache hit
        res.setHeader("X-Cache", "HIT");
        res.status(200).json(cached);
        return;
      }

      // Cache miss
      res.setHeader("X-Cache", "MISS");

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (body: any): Response {
        // Only cache successful responses
        if (res.statusCode === 200) {
          CacheService.set(cacheKey, body, ttl).catch((error) => {
            console.error("Error caching user-specific response:", error);
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error("User cache middleware error:", error);
      next();
    }
  };
}

/**
 * No-cache middleware
 * Explicitly disables caching for specific routes
 * Sets appropriate cache-control headers
 *
 * @returns Express middleware
 */
export function noCacheMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  };
}

/**
 * Cache warming utility
 * Preloads cache with data for frequently accessed endpoints
 *
 * @param endpoint - Endpoint URL to warm
 * @param data - Data to cache
 * @param ttl - Time to live in seconds
 */
export async function warmCache(
  endpoint: string,
  data: any,
  ttl: number = 120,
): Promise<void> {
  const cacheKey = CacheKeys.endpoint("GET", endpoint);
  await CacheService.set(cacheKey, data, ttl);
}

/**
 * Invalidate cache for specific endpoint patterns
 * Helper function to be called from controllers after mutations
 *
 * @param patterns - Array of URL patterns to invalidate
 *
 * @example
 * // After creating a blood request
 * await invalidateEndpointCache(['/api/requests*', '/api/admin/stats']);
 */
export async function invalidateEndpointCache(
  patterns: string[],
): Promise<void> {
  const cachePatterns = patterns.map((pattern) =>
    CacheKeys.endpointPattern(pattern),
  );
  await CacheService.invalidateMultiple(cachePatterns);
}

/**
 * Cache configuration for different endpoint types
 */
export const CacheTTL = {
  // Very short cache for frequently changing data
  SHORT: 30, // 30 seconds

  // Default cache for most endpoints
  MEDIUM: 120, // 2 minutes

  // Longer cache for stable data
  LONG: 300, // 5 minutes

  // Very long cache for rarely changing data
  VERY_LONG: 900, // 15 minutes

  // User-specific cached data
  USER_DATA: 60, // 1 minute
};

/**
 * Predefined cache strategies for common patterns
 */
export const CacheStrategies = {
  /**
   * Public list endpoint (e.g., browse requests, donor directory)
   * Medium TTL, public cache
   */
  publicList: () => publicCacheMiddleware(CacheTTL.MEDIUM),

  /**
   * Public detail endpoint (e.g., single request details)
   * Medium TTL, public cache
   */
  publicDetail: () => publicCacheMiddleware(CacheTTL.MEDIUM),

  /**
   * User-specific data (e.g., my requests, my profile)
   * Short TTL, user-specific cache
   */
  userSpecific: () => userCacheMiddleware(CacheTTL.USER_DATA),

  /**
   * Admin statistics and analytics
   * Longer TTL since it's expensive to compute
   */
  adminStats: () => cacheMiddleware(CacheTTL.LONG),

  /**
   * Reference data (rarely changes)
   * Very long TTL
   */
  referenceData: () => cacheMiddleware(CacheTTL.VERY_LONG),

  /**
   * Real-time data (should not be cached)
   * No cache
   */
  realTime: () => noCacheMiddleware(),
};
