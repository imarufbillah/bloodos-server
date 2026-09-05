import type { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { config } from "../config/env.js";
import {
  createUnauthorizedError,
  ERROR_CODES,
  asyncHandler,
} from "./error.middleware.js";
import type { User } from "../types/models/UserExtension.js";
import { getUsersCollection } from "../db/collections.js";

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
  req: Request,
): req is AuthenticatedRequest => {
  return "sessionUser" in req && req.sessionUser !== undefined;
};

/**
 * Session data structure from better-auth
 */
interface BetterAuthSession {
  session: {
    id: string;
    userId: string;
    expiresAt: string;
    token: string;
    ipAddress?: string;
    userAgent?: string;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    createdAt: string;
    updatedAt: string;
    image?: string | null;
    // Extended fields
    role?: "user" | "admin";
    phone?: string;
    district?: string;
    bloodGroup?: string;
    isDonor?: boolean;
    lastDonationDate?: string | null;
    banned?: boolean;
    banReason?: string | null;
    banExpiresAt?: string | null;
  };
}

const verifySession = async (cookies: string): Promise<BetterAuthSession> => {
  try {
    const response = await fetch(
      `${config.auth.betterAuthUrl}/api/auth/get-session`,
      {
        method: "GET",
        headers: {
          Cookie: cookies,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw createUnauthorizedError(
        "Invalid or expired session",
        ERROR_CODES.INVALID_TOKEN,
      );
    }

    const sessionData = (await response.json()) as BetterAuthSession;

    if (!sessionData.user) {
      throw createUnauthorizedError(
        "Invalid session structure",
        ERROR_CODES.INVALID_TOKEN,
      );
    }

    return sessionData;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error;
    }

    throw createUnauthorizedError(
      "Session verification failed",
      ERROR_CODES.INVALID_TOKEN,
    );
  }
};

/**
 * Authentication Middleware (Req 1.1, 1.2, 5.2)
 *
 * This middleware:
 * 1. Extracts session cookie from request
 * 2. Verifies session by calling better-auth's session endpoint
 * 3. Checks current ban status from database
 * 4. Attaches user data to request as `req.sessionUser`
 * 5. Returns 401 if session is missing, invalid, expired, or user is banned
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
    // Extract cookies from request
    const cookies = req.headers.cookie;

    if (!cookies) {
      throw createUnauthorizedError(
        "Authentication required. Please log in.",
        ERROR_CODES.UNAUTHORIZED,
      );
    }

    // Verify session with better-auth
    const sessionData = await verifySession(cookies);

    // IMPORTANT: Check current ban status from database
    // Session data can be stale if user was banned after login
    const usersCollection = getUsersCollection();
    let currentUser = null;

    if (ObjectId.isValid(sessionData.user.id)) {
      currentUser = await usersCollection.findOne({
        $or: [
          { _id: new ObjectId(sessionData.user.id) },
          { id: sessionData.user.id },
        ],
      });
    } else {
      currentUser = await usersCollection.findOne({
        id: sessionData.user.id,
      });
    }

    if (!currentUser && sessionData.user.email) {
      currentUser = await usersCollection.findOne({
        email: sessionData.user.email,
      });
    }

    if (!currentUser) {
      throw createUnauthorizedError("User not found", ERROR_CODES.UNAUTHORIZED);
    }

    // Check if user is currently banned (from fresh database data)
    if (currentUser.banned) {
      const banMessage = currentUser.banReason ?? null;
      const message = banMessage
        ? `Your account has been suspended: ${banMessage}`
        : "Your account has been suspended";

      throw createUnauthorizedError(message, ERROR_CODES.FORBIDDEN);
    }

    // Attach fresh user data to request
    const freshUser: User = {
      id: currentUser._id.toString(),
      name: currentUser.name,
      email: currentUser.email,
      image: currentUser.image,
      role: currentUser.role,
      phone: currentUser.phone,
      district: currentUser.district,
      bloodGroup: currentUser.bloodGroup,
      isDonor: currentUser.isDonor,
      lastDonationDate: currentUser.lastDonationDate,
      banned: currentUser.banned || false,
      banReason: currentUser.banReason || null,
      banExpiresAt: currentUser.banExpiresAt || null,
      createdAt: currentUser.createdAt,
      updatedAt: currentUser.updatedAt,
      emailVerified: currentUser.emailVerified,
    };

    (req as AuthenticatedRequest).sessionUser = freshUser;

    next();
  },
);

/**
 * Optional Authentication Middleware
 *
 * Similar to requireAuth but doesn't throw if no cookies are present.
 * Attaches user to request if valid session exists, otherwise continues without user.
 * Also checks current ban status from database.
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
    const cookies = req.headers.cookie;

    // If no cookies, continue without authentication
    if (!cookies) {
      return next();
    }

    try {
      // Try to verify session
      const sessionData = await verifySession(cookies);

      // Check current ban status from database
      const usersCollection = getUsersCollection();
      let currentUser = null;

      if (ObjectId.isValid(sessionData.user.id)) {
        currentUser = await usersCollection.findOne({
          $or: [
            { _id: new ObjectId(sessionData.user.id) },
            { id: sessionData.user.id },
          ],
        });
      } else {
        currentUser = await usersCollection.findOne({
          id: sessionData.user.id,
        });
      }

      if (!currentUser && sessionData.user.email) {
        currentUser = await usersCollection.findOne({
          email: sessionData.user.email,
        });
      }

      // Skip if user not found or banned
      if (currentUser && !currentUser.banned) {
        const freshUser: User = {
          id: currentUser._id.toString(),
          name: currentUser.name,
          email: currentUser.email,
          image: currentUser.image,
          role: currentUser.role,
          phone: currentUser.phone,
          district: currentUser.district,
          bloodGroup: currentUser.bloodGroup,
          isDonor: currentUser.isDonor,
          lastDonationDate: currentUser.lastDonationDate,
          banned: currentUser.banned || false,
          banReason: currentUser.banReason || null,
          banExpiresAt: currentUser.banExpiresAt || null,
          createdAt: currentUser.createdAt,
          updatedAt: currentUser.updatedAt,
          emailVerified: currentUser.emailVerified,
        };

        (req as AuthenticatedRequest).sessionUser = freshUser;
      }
    } catch (error) {
      // Silently ignore invalid sessions in optional auth
      // This allows the request to continue as unauthenticated
    }

    next();
  },
);
