/**
 * Notifications Controller (Phase 5d)
 * Handles notification listing and mark-read functionality
 * 
 * Endpoints:
 * - GET /api/notifications - List user's notifications (Req 5, 9.13)
 * - PATCH /api/notifications/:id/read - Mark notification as read
 */

import type { Response } from "express";
import { ObjectId } from "mongodb";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { getNotificationsCollection } from "../db/collections.js";
import { buildPaginatedResponse, calculateSkip } from "../utils/pagination.js";
import {
  createNotFoundError,
  createForbiddenError,
} from "../middleware/error.middleware.js";
import type { Notification } from "../types/models/Notification.js";

/**
 * GET /api/notifications
 * List all notifications for the authenticated user (Req 5, 9.13)
 * 
 * Authentication required
 * Filtered to userId === sessionUser.id (ownership enforcement)
 * Sorted by createdAt descending (newest first)
 * Uses index: { userId: 1, createdAt: -1 } from Phase 1b
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * 
 * @returns PaginatedResponse<Notification>
 */
export const listNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.sessionUser._id;

  // Parse pagination params with fallbacks
  const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limitParam = req.query.limit
    ? parseInt(req.query.limit as string, 10)
    : 20;

  // Validate page and limit
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit =
    isNaN(limitParam) || limitParam < 1 || limitParam > 100 ? 20 : limitParam;

  const notificationsCollection = getNotificationsCollection();

  // Build query filter - only user's own notifications
  const filter = { userId };

  // Calculate pagination
  const skip = calculateSkip(page, limit);

  // Fetch notifications and total count
  // Sort by createdAt desc (newest first) using the { userId: 1, createdAt: -1 } index
  const [notifications, totalCount] = await Promise.all([
    notificationsCollection
      .find(filter)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .toArray(),
    notificationsCollection.countDocuments(filter),
  ]);

  // Build paginated response
  const response = buildPaginatedResponse(
    notifications,
    page,
    limit,
    totalCount
  );

  res.json(response);
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 * 
 * Authentication required
 * Ownership enforced: notification.userId must equal sessionUser.id
 * 
 * Sets isRead: true on the specified notification
 * 
 * @returns Updated notification
 */
export const markNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const notificationIdString = req.params.id;
  const userId = req.sessionUser._id;

  // Type guard - ensure it's a string
  if (typeof notificationIdString !== "string") {
    throw createNotFoundError("Notification", "invalid");
  }

  // Validate notification ID
  if (!ObjectId.isValid(notificationIdString)) {
    throw createNotFoundError("Notification", notificationIdString);
  }

  const notificationId = new ObjectId(notificationIdString);

  const notificationsCollection = getNotificationsCollection();

  // Find the notification first to enforce ownership
  const notification = await notificationsCollection.findOne({
    _id: notificationId,
  });

  if (!notification) {
    throw createNotFoundError("Notification", notificationIdString);
  }

  // Enforce ownership: notification.userId must equal sessionUser.id
  if (!notification.userId.equals(userId)) {
    throw createForbiddenError(
      "You do not have permission to modify this notification"
    );
  }

  // Mark as read
  const result = await notificationsCollection.findOneAndUpdate(
    { _id: notificationId },
    { $set: { isRead: true } },
    { returnDocument: "after" }
  );

  if (!result) {
    throw createNotFoundError("Notification", notificationIdString);
  }

  res.json({
    success: true,
    message: "Notification marked as read",
    data: result,
  });
};

/**
 * PATCH /api/notifications/read-all
 * Mark all user's notifications as read
 * 
 * Authentication required
 * Bulk update all notifications for the authenticated user
 * 
 * Sets isRead: true on all user's unread notifications
 * 
 * @returns Count of notifications updated
 */
export const markAllNotificationsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.sessionUser._id;
  const notificationsCollection = getNotificationsCollection();

  // Update all unread notifications for this user
  const result = await notificationsCollection.updateMany(
    { 
      userId, 
      isRead: false 
    },
    { 
      $set: { isRead: true } 
    }
  );

  res.json({
    success: true,
    message: `Marked ${result.modifiedCount} notification(s) as read`,
    count: result.modifiedCount,
  });
};
