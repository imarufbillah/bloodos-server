/**
 * Notification DTOs
 * Based on Requirement 9
 */

import type { NotificationType } from "../shared.js";

// ============================================================================
// Notification Data (Req 9.13)
// ============================================================================

export interface NotificationDto {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedRequestId?: string | null;
  relatedUserId?: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

// ============================================================================
// Create Notification (Internal service use)
// ============================================================================

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedRequestId?: string;
  relatedUserId?: string;
}

// ============================================================================
// Mark Notification as Read
// ============================================================================

export interface MarkNotificationReadDto {
  notificationId: string;
}

// ============================================================================
// Notification Filters
// ============================================================================

export interface NotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
}
