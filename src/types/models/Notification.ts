import { ObjectId } from "mongodb";
import type { NotificationType } from "../shared.js";

/**
 * Notification collection schema
 * Represents a notification sent to a user
 */
export interface Notification {
  _id: ObjectId;
  userId: ObjectId; // Recipient (indexed)
  type: NotificationType; // 8 types
  title: string;
  message: string;
  relatedRequestId: ObjectId | null;
  relatedUserId: ObjectId | null;
  isRead: boolean; // Default: false, (indexed)
  createdAt: Date;
}

/**
 * Input type for creating a new notification
 */
export interface CreateNotificationInput {
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedRequestId?: ObjectId | null;
  relatedUserId?: ObjectId | null;
}
