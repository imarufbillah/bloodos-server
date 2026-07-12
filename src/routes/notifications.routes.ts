/**
 * Notifications Routes (Phase 5d)
 * Handles notification listing and mark-read endpoints
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  listNotifications,
  markNotificationRead,
} from "../controllers/notifications.controller.js";

const router = Router();

/**
 * GET /api/notifications
 * List all notifications for the authenticated user
 * 
 * Authentication required
 * Returns paginated list of user's notifications
 * Sorted by createdAt desc (newest first)
 * 
 * Query: page, limit
 * 
 * Requirements:
 * - Req 5: Endpoint authorization table (user can access own notifications)
 * - Req 9.13: Notifications sorted by createdAt, filtered by userId
 */
router.get(
  "/",
  requireAuth, // Must be authenticated to view notifications
  listNotifications as any // Type compatibility with Express handler
);

/**
 * PATCH /api/notifications/:id/read
 * Mark a specific notification as read
 * 
 * Authentication required
 * Ownership enforced: notification.userId must match sessionUser.id
 * 
 * Requirements:
 * - Req 5: Endpoint authorization (user can only mark own notifications)
 * - Sets isRead: true on the notification
 */
router.patch(
  "/:id/read",
  requireAuth, // Must be authenticated
  markNotificationRead as any // Type compatibility with Express handler
);

export default router;
