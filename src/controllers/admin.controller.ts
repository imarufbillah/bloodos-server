/**
 * Admin Controller (Req 18, 10)
 * 
 * Handles:
 * - GET /api/admin/stats - Dashboard statistics (Req 18.3-18.9)
 * - GET /api/admin/requests - Moderation table data (Req 18.9)
 * - Admin actions automatically log via Admin_Action_Log service (Req 5.5, 10)
 * 
 * All endpoints require admin role via requireAdmin middleware
 */

import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
  getBloodRequestsCollection,
  getUsersCollection,
  getDonationsCollection,
} from "../db/collections.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { asyncHandler, createNotFoundError } from "../middleware/error.middleware.js";
import { logAdminAction } from "../services/adminActionLog.service.js";
import {
  RequestStatus,
  Urgency,
  BLOOD_GROUPS,
  DISTRICTS,
  AdminActionType,
  type BloodGroup,
  type District,
} from "../types/shared.js";
import type {
  AdminStatsDto,
  BloodGroupStat,
  DistrictStat,
  TrendDataPoint,
} from "../types/dto/admin.dto.js";
import type { BloodRequest } from "../types/models/BloodRequest.js";

// ============================================================================
// GET /api/admin/stats - Dashboard Statistics (Req 18.3-18.8)
// ============================================================================

/**
 * Get admin dashboard statistics
 * 
 * Returns comprehensive stats for the admin dashboard including:
 * - Total, active, and fulfilled request counts
 * - Total donor count
 * - Donations this month
 * - Requests by blood group (for PieChart)
 * - Requests by district (for BarChart)
 * - 30-day request trend (for LineChart)
 * 
 * Req 18.4: Exact field structure
 * Req 18.7: 30-day rolling window for trend
 * 
 * @route GET /api/admin/stats
 * @access Admin only
 */
export const getAdminStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const requestsCollection = getBloodRequestsCollection();
    const usersCollection = getUsersCollection();
    const donationsCollection = getDonationsCollection();

    // Get current date for time-based queries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Run all queries in parallel for efficiency
    const [
      totalRequests,
      activeRequests,
      fulfilledRequests,
      totalDonors,
      donationsThisMonth,
      requestsByBloodGroupData,
      requestsByDistrictData,
      requestTrendData,
    ] = await Promise.all([
      // Total requests (all time)
      requestsCollection.countDocuments({}),

      // Active requests (open + in_progress)
      requestsCollection.countDocuments({
        status: { $in: [RequestStatus.OPEN, RequestStatus.IN_PROGRESS] },
      }),

      // Fulfilled requests (all time)
      requestsCollection.countDocuments({
        status: RequestStatus.FULFILLED,
      }),

      // Total donors (isDonor = true)
      usersCollection.countDocuments({
        isDonor: true,
      }),

      // Donations this month
      donationsCollection.countDocuments({
        donationDate: { $gte: startOfMonth },
      }),

      // Requests grouped by blood group (for PieChart - Req 18.5)
      requestsCollection
        .aggregate<{ _id: BloodGroup; count: number }>([
          {
            $group: {
              _id: "$bloodGroup",
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ])
        .toArray(),

      // Requests grouped by district (for BarChart - Req 18.6)
      requestsCollection
        .aggregate<{ _id: District; count: number }>([
          {
            $group: {
              _id: "$district",
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ])
        .toArray(),

      // Request trend over last 30 days (for LineChart - Req 18.7)
      requestsCollection
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              createdAt: { $gte: thirtyDaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ])
        .toArray(),
    ]);

    // Transform blood group data to match DTO
    const requestsByBloodGroup: BloodGroupStat[] = requestsByBloodGroupData.map(
      (item) => ({
        bloodGroup: item._id,
        count: item.count,
      })
    );

    // Transform district data to match DTO
    const requestsByDistrict: DistrictStat[] = requestsByDistrictData.map(
      (item) => ({
        district: item._id,
        count: item.count,
      })
    );

    // Transform trend data and fill gaps (ensure all 30 days present)
    const requestTrend: TrendDataPoint[] = fillTrendGaps(
      requestTrendData.map((item) => ({
        date: item._id,
        count: item.count,
      })),
      thirtyDaysAgo,
      now
    );

    // Build response matching Req 18.4 exact structure
    const stats: AdminStatsDto = {
      totalRequests,
      activeRequests,
      fulfilledRequests,
      totalDonors,
      donationsThisMonth,
      requestsByBloodGroup,
      requestsByDistrict,
      requestTrend,
    };

    res.status(200).json(stats);
  }
);

// ============================================================================
// GET /api/admin/requests - Moderation Table Data (Req 18.9)
// ============================================================================

/**
 * Get all blood requests for admin moderation
 * 
 * Returns complete list of blood requests with all details for the
 * admin moderation table. Unlike the public endpoint, this includes
 * unmasked contact information and all statuses.
 * 
 * Supports filtering and sorting for the admin interface
 * 
 * @route GET /api/admin/requests
 * @query status - Filter by status (optional)
 * @query urgency - Filter by urgency (optional)
 * @query bloodGroup - Filter by blood group (optional)
 * @query district - Filter by district (optional)
 * @query sort - Sort order: newest|oldest|urgent (default: newest)
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20, max: 100)
 * @access Admin only
 */
export const getAdminRequests = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const requestsCollection = getBloodRequestsCollection();

    // Parse query parameters
    const {
      status,
      urgency,
      bloodGroup,
      district,
      sort = "newest",
      page = "1",
      limit = "20",
    } = req.query;

    // Build filter
    const filter: Record<string, unknown> = {};

    if (status && typeof status === "string") {
      filter.status = status;
    }

    if (urgency && typeof urgency === "string") {
      filter.urgency = urgency;
    }

    if (bloodGroup && typeof bloodGroup === "string") {
      filter.bloodGroup = bloodGroup;
    }

    if (district && typeof district === "string") {
      filter.district = district;
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Determine sort order
    let sortCriteria: Record<string, 1 | -1> = { createdAt: -1 }; // Default: newest

    if (sort === "oldest") {
      sortCriteria = { createdAt: 1 };
    } else if (sort === "urgent") {
      // Sort by urgency level first, then by neededByDate
      sortCriteria = { urgency: 1, neededByDate: 1 };
    }

    // Get total count and requests in parallel
    const [totalCount, requests] = await Promise.all([
      requestsCollection.countDocuments(filter),
      requestsCollection
        .find(filter)
        .sort(sortCriteria)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Transform to DTO (convert ObjectId to string)
    const requestsDto = requests.map((request) => ({
      ...request,
      _id: request._id.toString(),
      userId: request.userId.toString(),
    }));

    // Return paginated response
    res.status(200).json({
      data: requestsDto,
      page: pageNum,
      limit: limitNum,
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
    });
  }
);

// ============================================================================
// PATCH /api/admin/requests/:id/approve - Approve Request (Inferred)
// ============================================================================

/**
 * Approve a blood request (admin moderation action)
 * 
 * This marks a request as approved for display. While the main workflow
 * doesn't have an explicit "approval" status, this could be used for
 * pre-moderation or to unblock a flagged request.
 * 
 * Logs action via Admin_Action_Log (Req 10.2)
 * 
 * @route PATCH /api/admin/requests/:id/approve
 * @access Admin only
 */
export const approveRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    const sessionUser = (req as AuthenticatedRequest).sessionUser;
    const requestsCollection = getBloodRequestsCollection();

    // Validate id parameter
    if (!id || typeof id !== 'string') {
      throw createNotFoundError("Invalid request ID");
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      throw createNotFoundError("Blood request not found");
    }

    const requestId = new ObjectId(id);

    // Find the request
    const request = await requestsCollection.findOne({ _id: requestId });

    if (!request) {
      throw createNotFoundError("Blood request not found");
    }

    // Capture previous state
    const previousState = {
      status: request.status,
    };

    // If request is cancelled or rejected, we can re-open it
    // This is the "approve" action - making it active again
    let newStatus = request.status;
    if (request.status === RequestStatus.CANCELLED) {
      newStatus = RequestStatus.OPEN;
    }

    const newState = {
      status: newStatus,
      approvedBy: sessionUser.id,
      approvedAt: new Date(),
    };

    // Update request (even if status doesn't change, log the approval)
    await requestsCollection.updateOne(
      { _id: requestId },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
        },
      }
    );

    // Log admin action (Req 10.2)
    const logParams: {
      adminId: ObjectId;
      action: AdminActionType;
      targetType: "request";
      targetId: ObjectId;
      previousState: Record<string, unknown>;
      newState: Record<string, unknown>;
      reason?: string;
      ipAddress: string;
    } = {
      adminId: new ObjectId(sessionUser.id),
      action: AdminActionType.APPROVE_REQUEST,
      targetType: "request",
      targetId: requestId,
      previousState,
      newState,
      ipAddress: req.ip || "unknown",
    };

    if (typeof reason === 'string' && reason.trim().length > 0) {
      logParams.reason = reason;
    }

    await logAdminAction(logParams);

    // Fetch updated request
    const updatedRequest = await requestsCollection.findOne({ _id: requestId });

    res.status(200).json({
      message: "Blood request approved successfully",
      request: {
        ...updatedRequest,
        _id: updatedRequest!._id.toString(),
        userId: updatedRequest!.userId.toString(),
      },
    });
  }
);

// ============================================================================
// PATCH /api/admin/requests/:id/reject - Reject Request (Inferred)
// ============================================================================

/**
 * Reject a blood request (admin moderation action)
 * 
 * This marks a request as cancelled with a rejection reason.
 * Can be used for requests that violate policies or are spam.
 * 
 * Logs action via Admin_Action_Log (Req 10.3)
 * 
 * @route PATCH /api/admin/requests/:id/reject
 * @access Admin only
 */
export const rejectRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body; // Required
    const sessionUser = (req as AuthenticatedRequest).sessionUser;
    const requestsCollection = getBloodRequestsCollection();

    // Validate required fields
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      res.status(400).json({
        code: "validation_error",
        message: "Rejection reason is required",
        details: { field: "reason", rule: "required" },
      });
      return;
    }

    // Validate id parameter
    if (!id || typeof id !== 'string') {
      throw createNotFoundError("Invalid request ID");
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      throw createNotFoundError("Blood request not found");
    }

    const requestId = new ObjectId(id);

    // Find the request
    const request = await requestsCollection.findOne({ _id: requestId });

    if (!request) {
      throw createNotFoundError("Blood request not found");
    }

    // Capture previous state
    const previousState = {
      status: request.status,
    };

    const newState = {
      status: RequestStatus.CANCELLED,
      rejectedBy: sessionUser.id,
      rejectedAt: new Date(),
      rejectionReason: reason,
    };

    // Update request to cancelled
    await requestsCollection.updateOne(
      { _id: requestId },
      {
        $set: {
          status: RequestStatus.CANCELLED,
          updatedAt: new Date(),
        },
      }
    );

    // Log admin action (Req 10.3)
    await logAdminAction({
      adminId: new ObjectId(sessionUser.id),
      action: AdminActionType.REJECT_REQUEST,
      targetType: "request",
      targetId: requestId,
      previousState,
      newState,
      reason: reason,
      ipAddress: req.ip || "unknown",
    });

    // Fetch updated request
    const updatedRequest = await requestsCollection.findOne({ _id: requestId });

    res.status(200).json({
      message: "Blood request rejected successfully",
      request: {
        ...updatedRequest,
        _id: updatedRequest!._id.toString(),
        userId: updatedRequest!.userId.toString(),
      },
    });
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// PATCH /api/admin/users/:id/ban - Ban User (Req 10.5, Plan §5f)
// ============================================================================

/**
 * Ban a user account
 * 
 * Prevents the user from accessing protected routes and performing actions.
 * Requires a reason for the ban. Admins cannot ban themselves.
 * 
 * Logs action via Admin_Action_Log (Req 10.5)
 * 
 * @route PATCH /api/admin/users/:id/ban
 * @access Admin only
 */
export const banUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body; // Required
    const sessionUser = (req as AuthenticatedRequest).sessionUser;
    const usersCollection = getUsersCollection();

    // Validate required fields
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      res.status(400).json({
        code: "validation_error",
        message: "Ban reason is required",
        details: { field: "reason", rule: "required" },
      });
      return;
    }

    // Validate id parameter
    if (!id || typeof id !== 'string') {
      throw createNotFoundError("Invalid user ID");
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      throw createNotFoundError("User not found");
    }

    const userId = new ObjectId(id);

    // Prevent self-ban (even though not in requirements, critical safety feature)
    if (userId.toString() === sessionUser.id) {
      res.status(403).json({
        code: "forbidden",
        message: "Admins cannot ban themselves",
        details: null,
      });
      return;
    }

    // Find the user
    const user = await usersCollection.findOne({ _id: userId });

    if (!user) {
      throw createNotFoundError("User not found");
    }

    // Capture previous state
    const previousState = {
      banned: user.banned || false,
      banReason: user.banReason || null,
    };

    const newState = {
      banned: true,
      banReason: reason,
      bannedAt: new Date(),
      bannedBy: sessionUser.id,
    };

    // Update user to banned
    await usersCollection.updateOne(
      { _id: userId },
      {
        $set: {
          banned: true,
          banReason: reason,
          updatedAt: new Date(),
        },
      }
    );

    // Log admin action (Req 10.5)
    await logAdminAction({
      adminId: new ObjectId(sessionUser.id),
      action: AdminActionType.BAN_USER,
      targetType: "user",
      targetId: userId,
      previousState,
      newState,
      reason: reason,
      ipAddress: req.ip || "unknown",
    });

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: userId });

    res.status(200).json({
      message: "User banned successfully",
      user: {
        id: updatedUser!._id.toString(),
        email: updatedUser!.email,
        name: updatedUser!.name,
        banned: updatedUser!.banned,
        banReason: updatedUser!.banReason,
      },
    });
  }
);

// ============================================================================
// PATCH /api/admin/users/:id/unban - Unban User (Req 10.6, Plan §5f)
// ============================================================================

/**
 * Unban a user account
 * 
 * Restores access to a previously banned user.
 * 
 * Logs action via Admin_Action_Log (Req 10.6)
 * 
 * @route PATCH /api/admin/users/:id/unban
 * @access Admin only
 */
export const unbanUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body; // Optional - reason for unbanning
    const sessionUser = (req as AuthenticatedRequest).sessionUser;
    const usersCollection = getUsersCollection();

    // Validate id parameter
    if (!id || typeof id !== 'string') {
      throw createNotFoundError("Invalid user ID");
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      throw createNotFoundError("User not found");
    }

    const userId = new ObjectId(id);

    // Find the user
    const user = await usersCollection.findOne({ _id: userId });

    if (!user) {
      throw createNotFoundError("User not found");
    }

    // Check if user is actually banned
    if (!user.banned) {
      res.status(400).json({
        code: "validation_error",
        message: "User is not currently banned",
        details: null,
      });
      return;
    }

    // Capture previous state
    const previousState = {
      banned: user.banned,
      banReason: user.banReason || null,
    };

    const newState = {
      banned: false,
      banReason: null,
      unbannedAt: new Date(),
      unbannedBy: sessionUser.id,
    };

    // Update user to unbanned
    await usersCollection.updateOne(
      { _id: userId },
      {
        $set: {
          banned: false,
          banReason: null,
          banExpiresAt: null,
          updatedAt: new Date(),
        },
      }
    );

    // Log admin action (Req 10.6)
    const logParams: {
      adminId: ObjectId;
      action: AdminActionType;
      targetType: "user";
      targetId: ObjectId;
      previousState: Record<string, unknown>;
      newState: Record<string, unknown>;
      reason?: string;
      ipAddress: string;
    } = {
      adminId: new ObjectId(sessionUser.id),
      action: AdminActionType.UNBAN_USER,
      targetType: "user",
      targetId: userId,
      previousState,
      newState,
      ipAddress: req.ip || "unknown",
    };

    if (typeof reason === 'string' && reason.trim().length > 0) {
      logParams.reason = reason;
    }

    await logAdminAction(logParams);

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: userId });

    res.status(200).json({
      message: "User unbanned successfully",
      user: {
        id: updatedUser!._id.toString(),
        email: updatedUser!.email,
        name: updatedUser!.name,
        banned: updatedUser!.banned,
        banReason: updatedUser!.banReason,
      },
    });
  }
);

// ============================================================================
// PATCH /api/admin/users/:id/role - Change User Role (Req 1.10, Plan §5f)
// ============================================================================

/**
 * Change a user's role (user ↔ admin)
 * 
 * Allows admins to promote users to admin or demote admins to users.
 * Admins cannot demote themselves to prevent lockout.
 * 
 * Logs action via Admin_Action_Log (Req 10, extending for role changes)
 * 
 * @route PATCH /api/admin/users/:id/role
 * @access Admin only
 */
export const changeUserRole = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { role } = req.body; // Required: "user" or "admin"
    const sessionUser = (req as AuthenticatedRequest).sessionUser;
    const usersCollection = getUsersCollection();

    // Validate required fields
    if (!role || typeof role !== "string") {
      res.status(400).json({
        code: "validation_error",
        message: "Role is required",
        details: { field: "role", rule: "required" },
      });
      return;
    }

    // Validate role value
    if (role !== "user" && role !== "admin") {
      res.status(400).json({
        code: "validation_error",
        message: "Invalid role. Must be 'user' or 'admin'",
        details: { field: "role", rule: "enum", allowedValues: ["user", "admin"] },
      });
      return;
    }

    // Validate id parameter
    if (!id || typeof id !== 'string') {
      throw createNotFoundError("Invalid user ID");
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      throw createNotFoundError("User not found");
    }

    const userId = new ObjectId(id);

    // Prevent self-demotion (critical safety feature)
    if (userId.toString() === sessionUser.id && role === "user") {
      res.status(403).json({
        code: "forbidden",
        message: "Admins cannot demote themselves",
        details: null,
      });
      return;
    }

    // Find the user
    const user = await usersCollection.findOne({ _id: userId });

    if (!user) {
      throw createNotFoundError("User not found");
    }

    // Check if role is already set to the target value
    if (user.role === role) {
      res.status(400).json({
        code: "validation_error",
        message: `User is already a${role === "admin" ? "n" : ""} ${role}`,
        details: null,
      });
      return;
    }

    // Capture previous state
    const previousState = {
      role: user.role,
    };

    const newState = {
      role: role,
      roleChangedAt: new Date(),
      roleChangedBy: sessionUser.id,
    };

    // Update user role
    await usersCollection.updateOne(
      { _id: userId },
      {
        $set: {
          role: role,
          updatedAt: new Date(),
        },
      }
    );

    // Log admin action (using CHANGE_USER_ROLE from AdminActionType)
    await logAdminAction({
      adminId: new ObjectId(sessionUser.id),
      action: AdminActionType.CHANGE_USER_ROLE,
      targetType: "user",
      targetId: userId,
      previousState,
      newState,
      ipAddress: req.ip || "unknown",
    });

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: userId });

    res.status(200).json({
      message: "User role changed successfully",
      user: {
        id: updatedUser!._id.toString(),
        email: updatedUser!.email,
        name: updatedUser!.name,
        role: updatedUser!.role,
      },
    });
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fill gaps in trend data to ensure all 30 days are present
 * Even days with 0 requests should be shown
 * 
 * @param trendData - Sparse trend data from DB
 * @param startDate - Start of 30-day window
 * @param endDate - End of 30-day window
 * @returns Complete trend data with all days filled
 */
function fillTrendGaps(
  trendData: TrendDataPoint[],
  startDate: Date,
  endDate: Date
): TrendDataPoint[] {
  const result: TrendDataPoint[] = [];
  const dataMap = new Map(trendData.map((d) => [d.date, d.count]));

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    
    if (dateStr) {
      result.push({
        date: dateStr,
        count: dataMap.get(dateStr) || 0,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}
