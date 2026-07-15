/**
 * Users Routes (Phase 5h)
 * API routes for user profile, donation history, and response history
 * Requirements: Req 13.5 (profile update), Req 13.8-13.9 (donations), Req 13.10 (responses)
 * Inferred: POST /api/donations (plan §0.A), GET /api/users/me/responses (plan §0.E)
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { CacheStrategies } from "../middleware/cache.middleware.js";
import {
  updateProfileSchema,
  createDonationSchema,
  getDonationsQuerySchema,
  getResponsesQuerySchema,
} from "../validators/user.validator.js";
import {
  getCurrentUser,
  updateUserProfile,
  getUserDonations,
  createDonation,
  getUserResponses,
  getUserAnalytics,
} from "../controllers/users.controller.js";

const router = Router();

// ============================================================================
// User Profile Routes
// ============================================================================

/**
 * GET /api/users/me
 * Get authenticated user's profile (Req 13.2-13.3)
 * - Auth required
 * - Returns all personal information fields
 * - Cached per user for 1 minute
 */
router.get("/me", requireAuth, CacheStrategies.userSpecific(), getCurrentUser);

/**
 * GET /api/users/me/analytics
 * Get comprehensive user analytics and statistics
 * - Auth required
 * - Returns requests, responses, donations statistics with aggregation
 * - Cached per user for 1 minute
 */
router.get("/me/analytics", requireAuth, CacheStrategies.userSpecific(), getUserAnalytics);

/**
 * PATCH /api/users/me
 * Update authenticated user's profile (Req 13.4-13.5)
 * - Auth required
 * - Only updates whitelisted fields
 * - NEVER allows updating role (enforced by validator)
 */
router.patch("/me", requireAuth, validate(updateProfileSchema), updateUserProfile);

// ============================================================================
// Donation History Routes
// ============================================================================

/**
 * GET /api/users/me/donations
 * Get authenticated user's donation history (Req 13.8-13.9)
 * - Auth required
 * - Returns paginated list of donations
 * - Sorted by donation date descending (reverse chronological)
 * - Shows verified status
 * - Cached per user for 1 minute
 */
router.get(
  "/me/donations",
  requireAuth,
  CacheStrategies.userSpecific(),
  validate(getDonationsQuerySchema),
  getUserDonations as any
);

// ============================================================================
// Response History Routes
// ============================================================================

/**
 * GET /api/users/me/responses
 * Get authenticated user's response history (inferred from plan §0.E)
 * - Auth required
 * - Returns paginated list of user's responses to blood requests
 * - Includes parent request summary for context
 * - Cached per user for 1 minute
 */
router.get(
  "/me/responses",
  requireAuth,
  CacheStrategies.userSpecific(),
  validate(getResponsesQuerySchema),
  getUserResponses as any
);

// ============================================================================
// Export Router
// ============================================================================

export default router;
