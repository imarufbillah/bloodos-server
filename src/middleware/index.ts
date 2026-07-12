/**
 * Middleware Index
 * 
 * Central export point for all middleware functions
 */

// Error handling middleware
export {
  AppError,
  HTTP_STATUS,
  ERROR_CODES,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createValidationError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
  createConflictError,
  createInvalidStateError,
  createRateLimitError,
  createInternalError,
} from "./error.middleware.js";

// Authentication middleware
export {
  requireAuth,
  optionalAuth,
  isAuthenticatedRequest,
  type AuthenticatedRequest,
} from "./auth.middleware.js";

// Role & ownership middleware
export {
  requireAdmin,
  requireDonor,
  requireOwnerOrAdmin,
  checkOwnership,
  isAdmin,
  isOwner,
  isOwnerOrAdmin,
  getAdminActionContext,
} from "./role.middleware.js";

// Rate limiting middleware (Req 15)
export {
  authRateLimiter,
  contactFormRateLimiter,
  generalApiRateLimiter,
  createCustomRateLimiter,
} from "./rateLimit.middleware.js";

// Re-export types
export type { AsyncRequestHandler } from "./error.middleware.js";
