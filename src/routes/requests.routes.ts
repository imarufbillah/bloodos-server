/**
 * Blood Requests Routes (Phase 5a)
 * API routes for blood request CRUD + status transitions
 * Requirements: 20.5-20.9, 20.16-20.19, 7.1-7.12, 3.1-3.9, 5's table rows
 */

import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createBloodRequestSchema,
  updateRequestStatusSchema,
  listRequestsQuerySchema,
} from "../validators/request.validator.js";
import {
  createBloodRequest,
  listBloodRequests,
  getBloodRequestById,
  getMyBloodRequests,
  updateBloodRequestStatus,
  deleteBloodRequest,
} from "../controllers/requests.controller.js";

const router = Router();

// ============================================================================
// Public Routes
// ============================================================================

/**
 * GET /api/requests
 * List blood requests with filters, search, sort, pagination
 * - Public endpoint (no auth required)
 * - Supports query params: bloodGroup, district, urgency, status, search, sort, page, limit
 * - Contact info masked for non-owners (Req 4.1-4.4)
 * - Returns PaginatedResponse<BloodRequest> (Req 12.1)
 */
router.get(
  "/",
  optionalAuth, // Optional auth to enable contact masking based on ownership
  validate(listRequestsQuerySchema),
  listBloodRequests as any // Type compatibility with Express handler
);

/**
 * GET /api/requests/:id
 * Get a single blood request by ID
 * - Public endpoint
 * - Contact info masked for non-owners (Req 4.1-4.4)
 * - Auto-expires if neededByDate has passed (Req 3.5)
 */
router.get(
  "/:id",
  optionalAuth, // Optional auth to enable contact masking based on ownership
  getBloodRequestById
);

// ============================================================================
// Protected Routes (Auth Required)
// ============================================================================

/**
 * POST /api/requests
 * Create a new blood request (Req 20.5-20.8)
 * - Auth required
 * - Validates all fields per Req 7 rules
 * - Auto-sets status to "open" (Req 3.1)
 * - Notifies eligible donors (Req 9.1-9.3)
 */
router.post(
  "/",
  requireAuth,
  validate(createBloodRequestSchema),
  createBloodRequest
);

/**
 * GET /api/requests/mine
 * Get all blood requests created by authenticated user (Req 20.18)
 * - Auth required
 * - Returns user's own requests (unmasked contact info)
 * - Supports pagination via query params: page, limit
 */
router.get(
  "/mine",
  requireAuth,
  getMyBloodRequests
);

/**
 * PATCH /api/requests/:id/status
 * Update blood request status (Req 3.1-3.9, 20.19)
 * - Auth required
 * - Owner or Admin only
 * - Validates transitions via state machine
 * - Logs admin actions (Req 10.2-10.3)
 * - Notifies relevant users (Req 9.6)
 */
router.patch(
  "/:id/status",
  requireAuth,
  validate(updateRequestStatusSchema),
  updateBloodRequestStatus
);

/**
 * DELETE /api/requests/:id
 * Delete a blood request (Req 20.19)
 * - Auth required
 * - Owner or Admin only
 * - Logs admin deletions (Req 10.3)
 */
router.delete(
  "/:id",
  requireAuth,
  deleteBloodRequest
);

// ============================================================================
// Export Router
// ============================================================================

export default router;
