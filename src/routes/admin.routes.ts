import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { CacheStrategies } from "../middleware/cache.middleware.js";
import {
  getAdminStats,
  getAdminRequests,
  getAdminUsers,
  approveRequest,
  rejectRequest,
  banUser,
  unbanUser,
  changeUserRole,
  verifyDonation,
} from "../controllers/admin.controller.js";
import {
  banUserSchema,
  unbanUserSchema,
  changeUserRoleSchema,
  approveRequestSchema,
  rejectRequestSchema,
} from "../validators/admin.validator.js";
import { verifyDonationSchema } from "../validators/donation.validator.js";

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
 * Cached for 5 minutes (expensive aggregation query)
 *
 * @access Admin only
 * @see Req 18.3-18.8
 */
router.get("/stats", CacheStrategies.adminStats(), getAdminStats);

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
 * GET /api/admin/users
 * Get all users for user management table
 *
 * Query params:
 * - role: Filter by role (user|admin)
 * - isDonor: Filter by donor status (true|false)
 * - bloodGroup: Filter by blood group
 * - district: Filter by district
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * Returns: PaginatedResponse<User>
 *
 * @access Admin only
 * @see Req 5f, Plan §0.B
 */
router.get("/users", getAdminUsers);

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
router.patch(
  "/requests/:id/approve",
  validate(approveRequestSchema),
  approveRequest,
);

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
router.patch(
  "/requests/:id/reject",
  validate(rejectRequestSchema),
  rejectRequest,
);

// ============================================================================
// Admin User Management Routes (Phase 5f - Plan §0.B)
// ============================================================================

/**
 * PATCH /api/admin/users/:id/ban
 * Ban a user account
 *
 * Body:
 * - reason: Required ban reason (string)
 *
 * Prevents user from accessing protected routes. Admin cannot ban themselves.
 * Logs action to Admin_Action_Log
 *
 * @access Admin only
 * @see Req 10.5
 */
router.patch("/users/:id/ban", validate(banUserSchema), banUser);

/**
 * PATCH /api/admin/users/:id/unban
 * Unban a user account
 *
 * Body:
 * - reason: Optional unban reason
 *
 * Restores access to a previously banned user.
 * Logs action to Admin_Action_Log
 *
 * @access Admin only
 * @see Req 10.6
 */
router.patch("/users/:id/unban", validate(unbanUserSchema), unbanUser);

/**
 * PATCH /api/admin/users/:id/role
 * Change user role (user ↔ admin)
 *
 * Body:
 * - role: Required role value ("user" | "admin")
 *
 * Promotes/demotes users. Admin cannot demote themselves to prevent lockout.
 * Logs action to Admin_Action_Log
 *
 * @access Admin only
 * @see Req 1.10, AdminActionType.CHANGE_USER_ROLE
 */
router.patch("/users/:id/role", validate(changeUserRoleSchema), changeUserRole);

// ============================================================================
// Admin Donation Management Routes (Phase 5h)
// ============================================================================

/**
 * PATCH /api/admin/donations/:id/verify
 * Verify a self-reported blood donation
 *
 * Body:
 * - reason: Optional verification notes/reason
 *
 * Admin confirms donation actually occurred based on documentation.
 * Updates donation.verified to true, sets verifiedBy and verifiedAt.
 * Logs action to Admin_Action_Log
 *
 * @access Admin only
 * @see Req 10.4, Plan §5h
 */
router.patch(
  "/donations/:id/verify",
  validate(verifyDonationSchema),
  verifyDonation,
);

export default router;
