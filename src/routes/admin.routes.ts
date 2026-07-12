/**
 * Admin Routes (Req 18, 10)
 * 
 * All routes in this file require authentication + admin role
 * 
 * Endpoints:
 * - GET /api/admin/stats - Dashboard statistics (Req 18.3-18.8)
 * - GET /api/admin/requests - Moderation table (Req 18.9)
 * - PATCH /api/admin/requests/:id/approve - Approve request (inferred)
 * - PATCH /api/admin/requests/:id/reject - Reject request (inferred)
 * 
 * Note: User management endpoints (ban/unban/role change) will be
 * added in Phase 5f as per the implementation plan
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";
import {
  getAdminStats,
  getAdminRequests,
  approveRequest,
  rejectRequest,
} from "../controllers/admin.controller.js";

const router = Router();

// ============================================================================
// Apply authentication + admin role to all routes
// ============================================================================

router.use(requireAuth);
router.use(requireAdmin);

// ============================================================================
// Admin Dashboard Routes
// ============================================================================

/**
 * GET /api/admin/stats
 * Get comprehensive dashboard statistics
 * 
 * Returns:
 * - Total, active, and fulfilled request counts
 * - Total donor count
 * - Donations this month
 * - Requests by blood group (PieChart data)
 * - Requests by district (BarChart data)
 * - 30-day request trend (LineChart data)
 * 
 * @access Admin only
 * @see Req 18.3-18.8
 */
router.get("/stats", getAdminStats);

// ============================================================================
// Admin Request Moderation Routes
// ============================================================================

/**
 * GET /api/admin/requests
 * Get all requests for moderation table
 * 
 * Query params:
 * - status: Filter by status
 * - urgency: Filter by urgency
 * - bloodGroup: Filter by blood group
 * - district: Filter by district
 * - sort: Sort order (newest|oldest|urgent)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * 
 * Returns: PaginatedResponse<BloodRequest> with unmasked contact info
 * 
 * @access Admin only
 * @see Req 18.9
 */
router.get("/requests", getAdminRequests);

/**
 * PATCH /api/admin/requests/:id/approve
 * Approve a blood request
 * 
 * Body:
 * - reason: Optional approval reason
 * 
 * Re-opens cancelled requests or marks as approved
 * Logs action to Admin_Action_Log
 * 
 * @access Admin only
 * @see Req 10.2
 */
router.patch("/requests/:id/approve", approveRequest);

/**
 * PATCH /api/admin/requests/:id/reject
 * Reject a blood request
 * 
 * Body:
 * - reason: Required rejection reason
 * 
 * Marks request as cancelled with reason
 * Logs action to Admin_Action_Log
 * 
 * @access Admin only
 * @see Req 10.3
 */
router.patch("/requests/:id/reject", rejectRequest);

export default router;
