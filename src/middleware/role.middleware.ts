import type { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import {
  createForbiddenError,
  createUnauthorizedError,
  asyncHandler,
} from "./error.middleware.js";
import type { AuthenticatedRequest, isAuthenticatedRequest } from "./auth.middleware.js";
import { UserRole } from "../types/shared.js";

/**
 * Require Admin Role Middleware (Req 1.3, 1.10, 5.3)
 * 
 * This middleware:
 * 1. Checks if user is authenticated (must use after requireAuth)
 * 2. Checks if user has admin role
 * 3. Returns 403 if user is not an admin
 * 
 * Must be applied after requireAuth middleware
 * 
 * @example
 * ```typescript
 * router.get('/admin/stats', requireAuth, requireAdmin, async (req, res) => {
 *   // Only admins can access this
 * });
 * ```
 */
export const requireAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Type guard - this should never happen if used after requireAuth
    if (!("sessionUser" in req) || !req.sessionUser) {
      throw createUnauthorizedError("Authentication required");
    }

    const user = (req as AuthenticatedRequest).sessionUser;

    // Check admin role
    if (user.role !== UserRole.ADMIN) {
      throw createForbiddenError(
        "Access denied. Admin privileges required.",
        {
          requiredRole: UserRole.ADMIN,
          userRole: user.role,
        }
      );
    }

    next();
  }
);

/**
 * Require Donor Status Middleware
 * 
 * This middleware:
 * 1. Checks if user is authenticated
 * 2. Checks if user has isDonor set to true
 * 3. Returns 403 if user is not a donor
 * 
 * Used for donor-only actions like responding to requests
 * 
 * @example
 * ```typescript
 * router.post('/requests/:id/respond', requireAuth, requireDonor, async (req, res) => {
 *   // Only donors can respond to requests
 * });
 * ```
 */
export const requireDonor = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Type guard
    if (!("sessionUser" in req) || !req.sessionUser) {
      throw createUnauthorizedError("Authentication required");
    }

    const user = (req as AuthenticatedRequest).sessionUser;

    // Check donor status
    if (!user.isDonor) {
      throw createForbiddenError(
        "Access denied. Only registered donors can perform this action.",
        { isDonor: false }
      );
    }

    next();
  }
);

/**
 * Check if user is the owner of a resource or an admin
 * 
 * Implements the ownership rules from Req 5.4, 5.5:
 * - Users can only access/modify their own resources
 * - Admins can access/modify any resource
 * 
 * @param userId - The ID of the current user (from req.sessionUser)
 * @param resourceUserId - The user ID who owns the resource
 * @param userRole - The role of the current user
 * @returns true if user is owner or admin
 */
export const isOwnerOrAdmin = (
  userId: string | ObjectId,
  resourceUserId: string | ObjectId,
  userRole: string
): boolean => {
  // Admin can access any resource (Req 5.5)
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Convert to strings for comparison
  const userIdStr = userId.toString();
  const resourceUserIdStr = resourceUserId.toString();

  // Check ownership
  return userIdStr === resourceUserIdStr;
};

/**
 * Require Ownership or Admin Middleware Factory
 * 
 * Creates a middleware that checks if the authenticated user owns
 * a resource or is an admin.
 * 
 * This is a factory function that takes a function to extract the
 * resource owner ID from the request.
 * 
 * @param getResourceUserId - Function to extract resource owner ID from request
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * // For URL param-based ownership
 * router.patch(
 *   '/requests/:id',
 *   requireAuth,
 *   requireOwnerOrAdmin(async (req) => {
 *     const request = await getRequestById(req.params.id);
 *     return request.userId;
 *   }),
 *   async (req, res) => {
 *     // Only request owner or admin can access
 *   }
 * );
 * ```
 */
export const requireOwnerOrAdmin = (
  getResourceUserId: (req: Request) => Promise<string | ObjectId | null>
) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Type guard
      if (!("sessionUser" in req) || !req.sessionUser) {
        throw createUnauthorizedError("Authentication required");
      }

      const user = (req as AuthenticatedRequest).sessionUser;

      // Get resource owner ID
      const resourceUserId = await getResourceUserId(req);

      if (!resourceUserId) {
        throw createForbiddenError("Resource not found or access denied");
      }

      // Check ownership or admin
      if (!isOwnerOrAdmin(user.id, resourceUserId, user.role)) {
        throw createForbiddenError(
          "Access denied. You can only access your own resources.",
          {
            action: "ownership_check",
            resourceOwner: resourceUserId.toString(),
          }
        );
      }

      next();
    }
  );
};

/**
 * Simple ownership check for resources that include userId in the request
 * 
 * Simpler alternative to requireOwnerOrAdmin when the resource owner ID
 * is directly available in the request (e.g., filtering user's own data)
 * 
 * @example
 * ```typescript
 * router.get('/users/me/requests', requireAuth, checkOwnership('userId'), async (req, res) => {
 *   // User can only see their own requests
 * });
 * ```
 */
export const checkOwnership = (userIdField: string = "userId") => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Type guard
      if (!("sessionUser" in req) || !req.sessionUser) {
        throw createUnauthorizedError("Authentication required");
      }

      const user = (req as AuthenticatedRequest).sessionUser;

      // Get resource user ID from params, body, or query
      const resourceUserId =
        req.params[userIdField] ||
        req.body[userIdField] ||
        req.query[userIdField];

      if (!resourceUserId) {
        throw createForbiddenError("Resource owner not specified");
      }

      // Check ownership or admin
      if (!isOwnerOrAdmin(user.id, resourceUserId, user.role)) {
        throw createForbiddenError(
          "Access denied. You can only access your own resources."
        );
      }

      next();
    }
  );
};

/**
 * Check if current user is an admin
 * Helper function for use in controllers
 * 
 * @param req - Express request (must be AuthenticatedRequest)
 * @returns true if user is admin
 */
export const isAdmin = (req: Request): boolean => {
  if (!("sessionUser" in req) || !req.sessionUser) {
    return false;
  }

  const user = (req as AuthenticatedRequest).sessionUser;
  return user.role === UserRole.ADMIN;
};

/**
 * Check if current user owns a resource
 * Helper function for use in controllers
 * 
 * @param req - Express request (must be AuthenticatedRequest)
 * @param resourceUserId - The user ID who owns the resource
 * @returns true if user owns the resource
 */
export const isOwner = (
  req: Request,
  resourceUserId: string | ObjectId
): boolean => {
  if (!("sessionUser" in req) || !req.sessionUser) {
    return false;
  }

  const user = (req as AuthenticatedRequest).sessionUser;
  return user.id === resourceUserId.toString();
};

/**
 * Get admin action details for logging
 * 
 * When an admin performs an action on a non-owned resource,
 * this should be logged via Admin_Action_Log (Req 5.5)
 * 
 * @param req - Express request (must be AuthenticatedRequest)
 * @param resourceUserId - The user ID who owns the resource
 * @returns Object with isAdminAction flag and admin details
 */
export const getAdminActionContext = (
  req: Request,
  resourceUserId: string | ObjectId
): {
  isAdminAction: boolean;
  adminId?: string | undefined;
  performedByAdmin?: boolean | undefined;
} => {
  if (!("sessionUser" in req) || !req.sessionUser) {
    return { isAdminAction: false };
  }

  const user = (req as AuthenticatedRequest).sessionUser;

  // Check if this is an admin acting on someone else's resource
  const isAdminOverride =
    user.role === UserRole.ADMIN && user.id !== resourceUserId.toString();

  return {
    isAdminAction: isAdminOverride,
    adminId: isAdminOverride ? user.id : undefined,
    performedByAdmin: user.role === UserRole.ADMIN,
  };
};
