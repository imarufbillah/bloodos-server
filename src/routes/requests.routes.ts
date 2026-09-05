/**
 * Blood Requests Routes (Phase 5a + 5b)
 * API routes for blood request CRUD + status transitions + respond/responses workflow + related
 * Requirements: 20.5-20.9, 20.16-20.19, 7.1-7.12, 3.1-3.9, 5's table rows, 6.1-6.11, 14.1-14.6
 */

import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { CacheStrategies } from "../middleware/cache.middleware.js";
import {
  createBloodRequestSchema,
  updateBloodRequestSchema,
  updateRequestStatusSchema,
  listRequestsQuerySchema,
} from "../validators/request.validator.js";
import {
  createResponseSchema,
  updateResponseStatusSchema,
} from "../validators/response.validator.js";
import {
  createBloodRequest,
  listBloodRequests,
  getBloodRequestById,
  getMyBloodRequests,
  updateBloodRequest,
  updateBloodRequestStatus,
  deleteBloodRequest,
  respondToBloodRequest,
  updateResponseStatus,
  retractResponse,
  getRequestResponses,
  getRelatedRequests,
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
 * - Cached for 2 minutes (public cache)
 */
router.get(
  "/",
  optionalAuth, // Optional auth to enable contact masking based on ownership
  CacheStrategies.publicList(), // Cache public list requests
  validate(listRequestsQuerySchema),
  listBloodRequests as any, // Type compatibility with Express handler
);

/**
 * GET /api/requests/mine
 * Get all blood requests created by authenticated user (Req 20.18)
 * - Auth required
 * - Returns user's own requests (unmasked contact info)
 * - Supports pagination via query params: page, limit
 * - Cached per user for 1 minute
 *
 * IMPORTANT: This must come BEFORE /:id route to avoid treating "mine" as an ID
 */
router.get(
  "/mine",
  requireAuth,
  CacheStrategies.userSpecific(), // User-specific cache
  getMyBloodRequests,
);

/**
 * GET /api/requests/related/:id
 * Find related blood requests (Req 14.1-14.6)
 * - Public endpoint
 * - Same bloodGroup AND district
 * - Only open/in_progress requests
 * - Ranks by urgency then date
 * - Limit 6 results
 * - Cached for 2 minutes (public cache)
 *
 * IMPORTANT: This must come BEFORE /:id route to avoid route collision
 */
router.get(
  "/related/:id",
  optionalAuth,
  CacheStrategies.publicDetail(), // Cache related requests
  getRelatedRequests,
);

/**
 * GET /api/requests/:id
 * Get a single blood request by ID
 * - Public endpoint
 * - Contact info masked for non-owners (Req 4.1-4.4)
 * - Auto-expires if neededByDate has passed (Req 3.5)
 * - Cached for 2 minutes (public cache)
 */
router.get(
  "/:id",
  optionalAuth, // Optional auth to enable contact masking based on ownership
  CacheStrategies.publicDetail(), // Cache single request details
  getBloodRequestById,
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
  createBloodRequest,
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
  updateBloodRequestStatus,
);

/**
 * PATCH /api/requests/:id
 * Update mutable blood request details (hospital, notes, urgency, etc.)
 * - Auth required
 * - Owner or Admin only
 */
router.patch(
  "/:id",
  requireAuth,
  validate(updateBloodRequestSchema),
  updateBloodRequest,
);

/**
 * DELETE /api/requests/:id
 * Delete a blood request (Req 20.19)
 * - Auth required
 * - Owner or Admin only
 * - Logs admin deletions (Req 10.3)
 */
router.delete("/:id", requireAuth, deleteBloodRequest);

// ============================================================================
// Phase 5b: Respond/Responses Workflow Routes
// ============================================================================

/**
 * POST /api/requests/:id/respond
 * Donor responds to a blood request (Req 6.1-6.3)
 * - Auth required, donor only
 * - Runs eligibility check (Req 6.1)
 * - Auto-transitions to "in_progress" on first response (Req 3.2)
 * - Max 50 responses per request (Req 6.10-6.11)
 * - Notifies request owner (Req 9.4)
 */
router.post(
  "/:id/respond",
  requireAuth,
  validate(createResponseSchema),
  respondToBloodRequest,
);

/**
 * GET /api/requests/:id/responses
 * List all responses for a blood request
 * - Auth required
 * - Owner or Admin only
 * - Returns responses with donor information
 */
router.get("/:id/responses", requireAuth, getRequestResponses);

/**
 * PATCH /api/requests/:id/responses/:responseId
 * Update response status (Req 6.7)
 * - Auth required
 * - Owner only (can accept/decline/complete responses)
 * - Notifies donor of status change (Req 9.5)
 */
router.patch(
  "/:id/responses/:responseId",
  requireAuth,
  validate(updateResponseStatusSchema),
  updateResponseStatus,
);

/**
 * DELETE /api/requests/:id/responses/:responseId
 * Donor retracts their own response (Req 6.8-6.9)
 * - Auth required
 * - Donor only (own response)
 * - Only allowed if status is "offered"
 */
router.delete("/:id/responses/:responseId", requireAuth, retractResponse);

// ============================================================================
// Export Router
// ============================================================================

export default router;
