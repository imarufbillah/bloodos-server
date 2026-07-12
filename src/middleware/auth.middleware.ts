import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config/env.js";
import {
  createUnauthorizedError,
  ERROR_CODES,
  asyncHandler,
} from "./error.middleware.js";
import type { User } from "../types/models/UserExtension.js";

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  sessionUser: User;
}

/**
 * Type guard to check if request has sessionUser
 */
export const isAuthenticatedRequest = (
  req: Request
): req is AuthenticatedRequest => {
  return "sessionUser" in req && req.sessionUser !== undefined;
};

/**
 * JWT Payload structure from better-auth
 * 
 * better-auth includes the full user object in the JWT payload
 */
interface JWTPayload {
  sub: string; // User ID
  iat: number; // Issued at
  exp: number; // Expiration time
  // better-auth includes the full session data
  session?: {
    userId: string;
    user: User;
  } | null;
}

/**
 * JWKS instance for JWT verification
 * Created once and reused for all verifications
 * 
 * This fetches the public keys from better-auth's JWKS endpoint
 * and caches them for efficient verification
 */
const JWKS = createRemoteJWKSet(new URL(config.auth.jwksUrl));

/**
 * Extract JWT token from Authorization header
 * 
 * Supports format: "Bearer <token>"
 * 
 * @param req - Express request
 * @returns JWT token string or null
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Check for Bearer token format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1] || null;
};

/**
 * Verify JWT token using better-auth's JWKS endpoint
 * 
 * This function:
 * 1. Verifies the token signature using JWKS
 * 2. Validates token expiration
 * 3. Extracts user data from the token payload
 * 
 * @param token - JWT token string
 * @returns User object from token payload
 * @throws AppError if token is invalid or expired
 */
const verifyToken = async (token: string): Promise<User> => {
  try {
    // Verify token signature and expiration using JWKS
    const { payload } = await jwtVerify<JWTPayload>(token, JWKS, {
      // Issuer validation (optional - better-auth doesn't set iss by default)
      // issuer: config.auth.betterAuthUrl,
    });

    // Extract user from payload
    // better-auth stores full session data in the token
    if (!payload.session?.user) {
      throw createUnauthorizedError(
        "Invalid token structure",
        ERROR_CODES.INVALID_TOKEN
      );
    }

    return payload.session.user;
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof Error) {
      // Token expired
      if (error.name === "JWTExpired") {
        throw createUnauthorizedError(
          "Token has expired",
          ERROR_CODES.TOKEN_EXPIRED
        );
      }

      // Invalid signature or other JWT errors
      if (
        error.name === "JWSSignatureVerificationFailed" ||
        error.name === "JWTInvalid"
      ) {
        throw createUnauthorizedError(
          "Invalid token",
          ERROR_CODES.INVALID_TOKEN
        );
      }
    }

    // Re-throw if it's already an AppError
    if (error instanceof Error && "code" in error) {
      throw error;
    }

    // Generic error
    throw createUnauthorizedError(
      "Token verification failed",
      ERROR_CODES.INVALID_TOKEN
    );
  }
};

/**
 * Authentication Middleware (Req 1.1, 1.2, 5.2)
 * 
 * This middleware:
 * 1. Extracts JWT token from Authorization header
 * 2. Verifies token using better-auth's JWKS endpoint (via jose library)
 * 3. Attaches user data to request as `req.sessionUser`
 * 4. Returns 401 if token is missing, invalid, or expired
 * 
 * Must be applied to all protected routes
 * 
 * @example
 * ```typescript
 * router.get('/profile', requireAuth, async (req, res) => {
 *   const user = req.sessionUser;
 *   res.json(user);
 * });
 * ```
 */
export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Extract token from Authorization header
    const token = extractToken(req);

    if (!token) {
      throw createUnauthorizedError(
        "Authentication required. Please provide a valid token.",
        ERROR_CODES.UNAUTHORIZED
      );
    }

    // Verify token and extract user
    const user = await verifyToken(token);

    // Check if user is banned
    if (user.banned) {
      const banMessage = user.banReason ?? null;
      const message = banMessage
        ? `Your account has been suspended: ${banMessage}`
        : "Your account has been suspended";

      throw createUnauthorizedError(message, ERROR_CODES.FORBIDDEN);
    }

    // Attach user to request
    (req as AuthenticatedRequest).sessionUser = user;

    next();
  }
);

/**
 * Optional Authentication Middleware
 * 
 * Similar to requireAuth but doesn't throw if no token is present.
 * Attaches user to request if valid token exists, otherwise continues without user.
 * 
 * Useful for routes that have different behavior for authenticated/unauthenticated users
 * 
 * @example
 * ```typescript
 * router.get('/requests', optionalAuth, async (req, res) => {
 *   if (isAuthenticatedRequest(req)) {
 *     // Show full contact info for owner
 *   } else {
 *     // Show masked contact info
 *   }
 * });
 * ```
 */
export const optionalAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractToken(req);

    // If no token, continue without authentication
    if (!token) {
      return next();
    }

    try {
      // Try to verify token
      const user = await verifyToken(token);

      // Skip banned users in optional auth
      if (!user.banned) {
        (req as AuthenticatedRequest).sessionUser = user;
      }
    } catch (error) {
      // Silently ignore invalid tokens in optional auth
      // This allows the request to continue as unauthenticated
    }

    next();
  }
);
