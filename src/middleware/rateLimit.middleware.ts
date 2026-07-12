import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import type { Request, Response } from "express";
import { createRateLimitError, HTTP_STATUS } from "./error.middleware.js";
import type { ErrorResponse } from "../types/shared.js";

/**
 * Rate Limiting Middleware (Req 15.1-15.6)
 * 
 * Protects authentication endpoints from brute-force attacks by limiting
 * the number of requests per IP address within a time window.
 */

/**
 * Custom handler for rate limit exceeded responses (Req 15.4-15.5)
 * 
 * Returns a consistent error response format with:
 * - HTTP 429 status
 * - code: "rate_limit_exceeded"
 * - Retry-After header (in seconds)
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  // Get retry-after time from rate limiter (in milliseconds)
  const retryAfterMs = req.rateLimit?.resetTime
    ? req.rateLimit.resetTime.getTime() - Date.now()
    : 15 * 60 * 1000; // Default to 15 minutes

  // Convert to seconds (round up)
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  // Create error using our standard error factory
  const error = createRateLimitError(
    "Too many requests from this IP. Please try again later.",
    retryAfterSeconds
  );

  // Build error response
  const errorResponse: ErrorResponse = {
    code: error.code,
    message: error.message,
    details: {
      retryAfter: retryAfterSeconds,
      retryAfterMs: retryAfterMs,
    },
  };

  // Set Retry-After header (Req 15.5)
  res.setHeader("Retry-After", retryAfterSeconds.toString());

  // Send 429 response (Req 15.4)
  res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(errorResponse);
};

/**
 * Skip function for rate limiting
 * Can be used to skip rate limiting for certain conditions (e.g., testing, trusted IPs)
 */
const skipRateLimit = (_req: Request): boolean => {
  // In future, could skip for:
  // - Trusted IP addresses
  // - Internal requests
  // - Health checks
  // For now, apply to all requests
  return false;
};

/**
 * Standard key generator - uses IP address
 * Falls back to connection remote address if X-Forwarded-For is not present
 */
const standardKeyGenerator = (req: Request): string => {
  return req.ip || req.socket.remoteAddress || "unknown";
};

/**
 * Auth Rate Limiter (Req 15.1-15.3)
 * 
 * Applied to authentication endpoints:
 * - POST /api/auth/login
 * - POST /api/auth/register
 * 
 * Configuration:
 * - 5 requests per 15 minutes per IP address (Req 15.3)
 * - Applies only to these specific auth endpoints (Req 15.6)
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  // Time window: 15 minutes (Req 15.3)
  windowMs: 15 * 60 * 1000,

  // Maximum requests per window: 5 (Req 15.3)
  limit: 5,

  // Use IP address as key
  keyGenerator: standardKeyGenerator,

  // Custom error handler
  handler: rateLimitHandler,

  // Skip conditions
  skip: skipRateLimit,

  // Standard headers (X-RateLimit-*)
  standardHeaders: true,

  // Disable legacy headers
  legacyHeaders: false,

  // Store: in-memory (default)
  // For production with multiple servers, consider Redis store
  // store: new RedisStore({ client: redisClient }),

  // Skip successful requests from count (false = count all requests)
  skipSuccessfulRequests: false,

  // Skip failed requests from count (false = count all requests)
  skipFailedRequests: false,

  // Message is handled by our custom handler
  message: undefined,
});

/**
 * Contact Form Rate Limiter
 * 
 * Applied to public contact form endpoint to prevent spam
 * More lenient than auth limiter since it's a less sensitive operation
 */
export const contactFormRateLimiter: RateLimitRequestHandler = rateLimit({
  // Time window: 15 minutes
  windowMs: 15 * 60 * 1000,

  // Maximum requests per window: 3 (stricter than auth since it sends emails)
  limit: 3,

  // Use IP address as key
  keyGenerator: standardKeyGenerator,

  // Custom error handler
  handler: rateLimitHandler,

  // Skip conditions
  skip: skipRateLimit,

  // Standard headers
  standardHeaders: true,
  legacyHeaders: false,

  // Count all requests
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * General API Rate Limiter (Optional)
 * 
 * Can be applied globally to prevent abuse of any API endpoint
 * Much more lenient than specific rate limiters
 */
export const generalApiRateLimiter: RateLimitRequestHandler = rateLimit({
  // Time window: 1 minute
  windowMs: 1 * 60 * 1000,

  // Maximum requests per window: 100
  limit: 100,

  // Use IP address as key
  keyGenerator: standardKeyGenerator,

  // Custom error handler
  handler: rateLimitHandler,

  // Skip conditions
  skip: skipRateLimit,

  // Standard headers
  standardHeaders: true,
  legacyHeaders: false,

  // Count all requests
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Create a custom rate limiter with specific configuration
 * 
 * @param windowMinutes - Time window in minutes
 * @param maxRequests - Maximum requests per window
 * @returns Configured rate limiter middleware
 */
export const createCustomRateLimiter = (
  windowMinutes: number,
  maxRequests: number
): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: maxRequests,
    keyGenerator: standardKeyGenerator,
    handler: rateLimitHandler,
    skip: skipRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });
};

/**
 * Type augmentation for Express Request
 * Adds rate limit info to request object
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime: Date;
      };
    }
  }
}
