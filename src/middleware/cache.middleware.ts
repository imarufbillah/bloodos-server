import type { Request, Response, NextFunction } from "express";
import { CacheService, CacheKeys } from "../services/cache.service.js";
import { logger } from "../utils/logger.js";

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
        res.setHeader("X-Cache", "HIT");
        res.status(200).json(cached);
        return;
      }

      res.setHeader("X-Cache", "MISS");

      const originalJson = res.json.bind(res);

      res.json = function (body: any): Response {
        if (res.statusCode === 200) {
          CacheService.set(cacheKey, body, ttl).catch((error) => {
            logger.error("Error caching response", { error });
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error("Cache middleware error", { error });
      next();
    }
  };
}

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
        res.setHeader("X-Cache", "HIT");
        res.status(200).json(cached);
        return;
      }

      res.setHeader("X-Cache", "MISS");

      const originalJson = res.json.bind(res);

      res.json = function (body: any): Response {
        if (res.statusCode === 200) {
          CacheService.set(cacheKey, body, ttl).catch((error) => {
            logger.error("Error caching user-specific response", { error });
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error("User cache middleware error", { error });
      next();
    }
  };
}

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

export async function warmCache(
  endpoint: string,
  data: any,
  ttl: number = 120,
): Promise<void> {
  const cacheKey = CacheKeys.endpoint("GET", endpoint);
  await CacheService.set(cacheKey, data, ttl);
}

export async function invalidateEndpointCache(
  patterns: string[],
): Promise<void> {
  const cachePatterns = patterns.map((pattern) =>
    CacheKeys.endpointPattern(pattern),
  );
  await CacheService.invalidateMultiple(cachePatterns);
}

export const CacheTTL = {
  SHORT: 30,
  MEDIUM: 120,
  LONG: 300,
  VERY_LONG: 900,
  USER_DATA: 60,
};

export const CacheStrategies = {
  publicList: () => publicCacheMiddleware(CacheTTL.MEDIUM),
  publicDetail: () => publicCacheMiddleware(CacheTTL.MEDIUM),
  userSpecific: () => userCacheMiddleware(CacheTTL.USER_DATA),
  adminStats: () => cacheMiddleware(CacheTTL.LONG),
  referenceData: () => cacheMiddleware(CacheTTL.VERY_LONG),
  realTime: () => noCacheMiddleware(),
};
