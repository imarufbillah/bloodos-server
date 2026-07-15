/**
 * Rate Limiting Usage Examples
 *
 * This file demonstrates how to apply rate limiting middleware to routes.
 * Copy these patterns when implementing actual routes in Phase 5.
 */

import express, { type Router, type Request, type Response } from "express";
import {
  authRateLimiter,
  contactFormRateLimiter,
  generalApiRateLimiter,
  createCustomRateLimiter,
} from "./rateLimit.middleware.js";
import { asyncHandler } from "./error.middleware.js";

const exampleRouter: Router = express.Router();

// ============================================================================
// Example 1: Apply rate limiter to specific auth routes (Req 15.1-15.2)
// ============================================================================

/**
 * Login endpoint with rate limiting
 *
 * - 5 requests per 15 minutes per IP
 * - Returns 429 with "rate_limit_exceeded" after limit
 */
exampleRouter.post(
  "/auth/login",
  authRateLimiter, // Apply rate limiter first
  asyncHandler(async (req: Request, res: Response) => {
    // Your authentication logic here
    const { email, password } = req.body;

    // ... authenticate user ...

    res.json({
      success: true,
      message: "Login successful",
    });
  }),
);

/**
 * Register endpoint with rate limiting
 *
 * - 5 requests per 15 minutes per IP
 * - Prevents registration spam and brute-force account creation
 */
exampleRouter.post(
  "/auth/register",
  authRateLimiter, // Same limiter as login
  asyncHandler(async (req: Request, res: Response) => {
    // Your registration logic here
    const { email, password, name } = req.body;

    // ... create user ...

    res.status(201).json({
      success: true,
      message: "Registration successful",
    });
  }),
);

// ============================================================================
// Example 2: Apply rate limiter to contact form
// ============================================================================

/**
 * Contact form endpoint with rate limiting
 *
 * - 3 requests per 15 minutes per IP
 * - Prevents spam submissions
 */
exampleRouter.post(
  "/contact",
  contactFormRateLimiter, // Stricter limit for email submissions
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, subject, message } = req.body;

    // ... send email ...

    res.json({
      success: true,
      message: "Message sent successfully",
    });
  }),
);

// ============================================================================
// Example 3: Apply rate limiter to entire router
// ============================================================================

/**
 * Apply general rate limiting to all routes in this router
 *
 * - 100 requests per minute per IP
 * - Prevents abuse of any endpoint
 */
const protectedRouter: Router = express.Router();

// Apply to all routes in this router
protectedRouter.use(generalApiRateLimiter);

protectedRouter.get("/protected/data", (req: Request, res: Response) => {
  res.json({ data: "Protected data" });
});

protectedRouter.post("/protected/action", (req: Request, res: Response) => {
  res.json({ success: true });
});

// ============================================================================
// Example 4: Custom rate limiter for specific needs
// ============================================================================

/**
 * Create a custom rate limiter for specific endpoint
 *
 * Example: File upload endpoint with tighter limits
 * - 2 requests per 5 minutes per IP
 */
const uploadRateLimiter = createCustomRateLimiter(5, 2);

exampleRouter.post(
  "/upload",
  uploadRateLimiter, // Custom rate limiter
  asyncHandler(async (req: Request, res: Response) => {
    // ... handle file upload ...
    res.json({ success: true });
  }),
);

// ============================================================================
// Example 5: Multiple rate limiters (cascading limits)
// ============================================================================

/**
 * Apply multiple rate limiters for layered protection
 *
 * - First: General API limiter (100/min)
 * - Then: Specific auth limiter (5/15min)
 */
exampleRouter.post(
  "/auth/password-reset",
  generalApiRateLimiter, // Broad protection
  authRateLimiter, // Specific protection
  asyncHandler(async (req: Request, res: Response) => {
    // ... handle password reset ...
    res.json({ success: true });
  }),
);

// ============================================================================
// Example 6: Conditional rate limiting based on authentication
// ============================================================================

/**
 * Apply different rate limits based on user authentication
 *
 * Pattern: Authenticated users get higher limits
 */

// Authenticated user limiter (more lenient)
const authenticatedRateLimiter = createCustomRateLimiter(1, 50); // 50/min

// Unauthenticated user limiter (stricter)
const unauthenticatedRateLimiter = createCustomRateLimiter(1, 10); // 10/min

exampleRouter.post(
  "/api/action",
  (req: Request, res: Response, next) => {
    // Check if user is authenticated (simplified example)
    const isAuthenticated = req.headers.authorization !== undefined;

    // Apply appropriate rate limiter
    if (isAuthenticated) {
      authenticatedRateLimiter(req, res, next);
    } else {
      unauthenticatedRateLimiter(req, res, next);
    }
  },
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true });
  }),
);

// ============================================================================
// Example 7: Rate limiter with custom key generator
// ============================================================================

/**
 * Custom rate limiter that tracks by user ID instead of IP
 * Useful for authenticated endpoints where you want per-user limits
 */
import rateLimit from "express-rate-limit";
import { HTTP_STATUS } from "./error.middleware.js";

const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,

  // Use user ID from request instead of IP
  keyGenerator: (req: Request) => {
    // Assuming user ID is in req.user after authentication
    const userId = (req as any).user?.id;
    return userId || req.ip || "anonymous";
  },

  handler: (req: Request, res: Response) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      code: "rate_limit_exceeded",
      message: "You have exceeded your request limit for this time period.",
      details: { retryAfter: 900 },
    });
  },
});

exampleRouter.get(
  "/user/dashboard",
  userRateLimiter, // Per-user rate limit
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ data: "User dashboard data" });
  }),
);

// ============================================================================
// Integration with app.ts
// ============================================================================

/**
 * HOW TO USE IN app.ts:
 *
 * import { authRateLimiter, contactFormRateLimiter } from './middleware/rateLimit.middleware.js';
 * import authRouter from './routes/auth.routes.js';
 * import contactRouter from './routes/contact.routes.js';
 *
 * // Option 1: Apply at route level
 * app.post('/api/auth/login', authRateLimiter, authController.login);
 *
 * // Option 2: Apply in the route file itself (recommended)
 * // See examples above
 *
 * // Option 3: Apply to entire router
 * app.use('/api/auth', authRateLimiter, authRouter);
 */

export default exampleRouter;
