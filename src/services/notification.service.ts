/**
 * Notification Service (Phase 4a)
 * Handles creation and management of all 8 notification types (Req 9.1-9.13)
 *
 * Notification Types:
 * 1. new_response - Someone responded to your request (9.4)
 * 2. response_status_change - Requester updated your response status (9.5)
 * 3. request_status_change - A request you responded to changed status (9.6)
 * 4. new_matching_request - New request matches your blood/district (9.1-9.3)
 * 5. donation_verified - Admin verified your donation (9.7)
 * 6. request_expiring_soon - Your request expires in 24h (9.8)
 * 7. system_announcement - Admin broadcast (9.10)
 * 8. contact_info_requested - Someone requested your contact info (9.9)
 */

import { ObjectId } from "mongodb";
import { getNotificationsCollection, getUsersCollection } from "../db/collections.js";
import type {
  Notification,
  CreateNotificationInput,
} from "../types/models/Notification.js";
import type { BloodRequest } from "../types/models/BloodRequest.js";
import type { User } from "../types/models/UserExtension.js";
import type { NotificationType, BloodGroup, District } from "../types/shared.js";
import { isBloodTypeCompatible } from "./compatibility.js";

// ============================================================================
// Core Notification Creation
// ============================================================================

/**
 * Create a notification for a user
 * All notifications start as unread with current timestamp (Req 9.13)
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  try {
    const notification: Notification = {
      _id: new ObjectId(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedRequestId: input.relatedRequestId ?? null,
      relatedUserId: input.relatedUserId ?? null,
      isRead: false, // Always starts unread (Req 9.13)
      createdAt: new Date(), // Current timestamp (Req 9.13)
    };

    await getNotificationsCollection().insertOne(notification);
  } catch (error) {
    // Log error and throw to bubble up to calling route (Req 9.11)
    console.error("Failed to create notification:", error);
    throw new Error("Failed to create notification");
  }
}

/**
 * Create multiple notifications in bulk (for efficiency when notifying many users)
 */
export async function createBulkNotifications(
  inputs: CreateNotificationInput[]
): Promise<void> {
  if (inputs.length === 0) return;

  try {
    const notifications: Notification[] = inputs.map((input) => ({
      _id: new ObjectId(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedRequestId: input.relatedRequestId ?? null,
      relatedUserId: input.relatedUserId ?? null,
      isRead: false,
      createdAt: new Date(),
    }));

    await getNotificationsCollection().insertMany(notifications);
  } catch (error) {
    console.error("Failed to create bulk notifications:", error);
    throw new Error("Failed to create bulk notifications");
  }
}

// ============================================================================
// Eligible Donor Finding (Req 9.1-9.3)
// ============================================================================

/**
 * Find all eligible donors for a blood request
 * Matches by blood compatibility AND district (Req 9.1, 9.3)
 * Returns empty array if no matches found (Req 9.2)
 */
export async function findEligibleDonorsForRequest(
  request: BloodRequest
): Promise<User[]> {
  try {
    const usersCollection = getUsersCollection();

    // Find donors who:
    // 1. Are registered as donors (isDonor: true)
    // 2. Have compatible blood type
    // 3. Are in the same district (Req 9.3)
    // 4. Are not banned

    // Get all compatible blood groups for the request
    const compatibleBloodGroups: BloodGroup[] = [];
    const allBloodGroups: BloodGroup[] = [
      "A+",
      "A-",
      "B+",
      "B-",
      "AB+",
      "AB-",
      "O+",
      "O-",
    ];

    for (const bloodGroup of allBloodGroups) {
      if (isBloodTypeCompatible(bloodGroup, request.bloodGroup)) {
        compatibleBloodGroups.push(bloodGroup);
      }
    }

    const eligibleDonors = await usersCollection
      .find({
        isDonor: true,
        bloodGroup: { $in: compatibleBloodGroups },
        district: request.district, // Same district (Req 9.3)
        banned: { $ne: true }, // Not banned
      })
      .toArray();

    // Filter out the requester themselves
    const filtered = eligibleDonors.filter(
      (donor) => !donor._id.equals(request.userId)
    );

    if (filtered.length === 0) {
      // No eligible donors found - log but don't throw (Req 9.2)
      console.log(
        `No eligible donors found for request ${request._id} (${request.bloodGroup} in ${request.district})`
      );
    }

    return filtered;
  } catch (error) {
    // Log error but return empty array rather than throwing (Req 9.2)
    console.error("Error finding eligible donors:", error);
    return [];
  }
}

// ============================================================================
// Notification Type Handlers
// ============================================================================

/**
 * 1. NEW_RESPONSE - Someone responded to your request (Req 9.4)
 * Notifies the request owner when a donor offers to help
 */
export async function notifyNewResponse(
  requestOwnerId: ObjectId,
  donorId: ObjectId,
  donorName: string,
  requestId: ObjectId
): Promise<void> {
  await createNotification({
    userId: requestOwnerId,
    type: "new_response",
    title: "New Response to Your Request",
    message: `${donorName} has offered to help with your blood request.`,
    relatedRequestId: requestId,
    relatedUserId: donorId,
  });
}

/**
 * 2. RESPONSE_STATUS_CHANGE - Requester updated your response status (Req 9.5)
 * Notifies the donor when the requester accepts/declines their offer
 */
export async function notifyResponseStatusChange(
  donorId: ObjectId,
  newStatus: "accepted" | "declined",
  requestId: ObjectId,
  patientName: string
): Promise<void> {
  const statusText = newStatus === "accepted" ? "accepted" : "declined";
  const title =
    newStatus === "accepted" ? "Response Accepted" : "Response Declined";
  const message = `Your offer to help ${patientName} has been ${statusText}.`;

  await createNotification({
    userId: donorId,
    type: "response_status_change",
    title,
    message,
    relatedRequestId: requestId,
  });
}

/**
 * 3. REQUEST_STATUS_CHANGE - A request you responded to changed status (Req 9.6)
 * Notifies all donors who responded when the request status changes
 */
export async function notifyRequestStatusChange(
  donorIds: ObjectId[],
  newStatus: string,
  requestId: ObjectId,
  patientName: string
): Promise<void> {
  const statusMessages: Record<string, { title: string; message: string }> = {
    fulfilled: {
      title: "Request Fulfilled",
      message: `The blood request for ${patientName} has been fulfilled. Thank you for your willingness to help!`,
    },
    cancelled: {
      title: "Request Cancelled",
      message: `The blood request for ${patientName} has been cancelled.`,
    },
    expired: {
      title: "Request Expired",
      message: `The blood request for ${patientName} has expired.`,
    },
    in_progress: {
      title: "Request In Progress",
      message: `The blood request for ${patientName} is now in progress.`,
    },
  };

  const notification = statusMessages[newStatus] || {
    title: "Request Status Updated",
    message: `The blood request for ${patientName} has been updated.`,
  };

  const inputs: CreateNotificationInput[] = donorIds.map((donorId) => ({
    userId: donorId,
    type: "request_status_change",
    title: notification.title,
    message: notification.message,
    relatedRequestId: requestId,
  }));

  if (inputs.length > 0) {
    await createBulkNotifications(inputs);
  }
}

/**
 * 4. NEW_MATCHING_REQUEST - New request matches your blood/district (Req 9.1-9.3)
 * Notifies all eligible donors when a new request is created
 */
export async function notifyNewMatchingRequest(
  request: BloodRequest
): Promise<void> {
  // Find all eligible donors
  const eligibleDonors = await findEligibleDonorsForRequest(request);

  if (eligibleDonors.length === 0) {
    // No eligible donors - already logged in findEligibleDonorsForRequest
    return;
  }

  // Create notifications for all eligible donors
  const inputs: CreateNotificationInput[] = eligibleDonors.map((donor) => ({
    userId: donor._id,
    type: "new_matching_request",
    title: "New Blood Request in Your Area",
    message: `A ${request.urgency} blood request for ${request.bloodGroup} has been posted in ${request.district}. ${request.patientName} needs help at ${request.hospitalName}.`,
    relatedRequestId: request._id,
    relatedUserId: request.userId,
  }));

  await createBulkNotifications(inputs);
}

/**
 * 5. DONATION_VERIFIED - Admin verified your donation (Req 9.7)
 * Notifies donor when their donation record is verified by admin
 */
export async function notifyDonationVerified(
  donorId: ObjectId,
  donationId: ObjectId,
  donationDate: Date
): Promise<void> {
  await createNotification({
    userId: donorId,
    type: "donation_verified",
    title: "Donation Verified",
    message: `Your donation from ${donationDate.toLocaleDateString()} has been verified by an administrator. Thank you for saving lives!`,
    relatedRequestId: null,
    relatedUserId: null,
  });
}

/**
 * 6. REQUEST_EXPIRING_SOON - Your request expires in 24h (Req 9.8)
 * Notifies request owner when their request is about to expire
 */
export async function notifyRequestExpiringSoon(
  requestOwnerId: ObjectId,
  requestId: ObjectId,
  patientName: string,
  expiryDate: Date
): Promise<void> {
  await createNotification({
    userId: requestOwnerId,
    type: "request_expiring_soon",
    title: "Request Expiring Soon",
    message: `Your blood request for ${patientName} will expire on ${expiryDate.toLocaleDateString()}. Please update the status if needed.`,
    relatedRequestId: requestId,
  });
}

/**
 * 7. SYSTEM_ANNOUNCEMENT - Admin broadcast (Req 9.10)
 * Sends a system-wide announcement to all users or a filtered subset
 */
export async function notifySystemAnnouncement(
  title: string,
  message: string,
  userFilter?: {
    bloodGroup?: BloodGroup;
    district?: District;
    isDonor?: boolean;
  }
): Promise<void> {
  const usersCollection = getUsersCollection();

  // Build query based on filter
  const query: any = {};
  if (userFilter) {
    if (userFilter.bloodGroup) query.bloodGroup = userFilter.bloodGroup;
    if (userFilter.district) query.district = userFilter.district;
    if (userFilter.isDonor !== undefined) query.isDonor = userFilter.isDonor;
  }

  // Get all matching users
  const users = await usersCollection.find(query).toArray();

  if (users.length === 0) {
    console.log("No users match the announcement filter");
    return;
  }

  // Create notifications for all users
  const inputs: CreateNotificationInput[] = users.map((user) => ({
    userId: user._id,
    type: "system_announcement",
    title,
    message,
  }));

  await createBulkNotifications(inputs);
}

/**
 * 8. CONTACT_INFO_REQUESTED - Someone requested your contact info (Req 9.9)
 * Notifies donor when someone requests their contact information
 */
export async function notifyContactInfoRequested(
  donorId: ObjectId,
  requestorId: ObjectId,
  requestorName: string,
  requestId?: ObjectId
): Promise<void> {
  const message = requestId
    ? `${requestorName} has requested your contact information regarding a blood request.`
    : `${requestorName} has requested your contact information.`;

  await createNotification({
    userId: donorId,
    type: "contact_info_requested",
    title: "Contact Information Requested",
    message,
    relatedRequestId: requestId ?? null,
    relatedUserId: requestorId,
  });
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Get all notifications for a user, sorted by creation date (newest first)
 * Supports pagination
 */
export async function getUserNotifications(
  userId: ObjectId,
  options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<{
  notifications: Notification[];
  total: number;
  unreadCount: number;
}> {
  const { page = 1, limit = 20, unreadOnly = false } = options;
  const skip = (page - 1) * limit;

  const query: any = { userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const notificationsCollection = getNotificationsCollection();

  const [notifications, total, unreadCount] = await Promise.all([
    notificationsCollection
      .find(query)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .toArray(),
    notificationsCollection.countDocuments(query),
    notificationsCollection.countDocuments({ userId, isRead: false }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
  };
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: ObjectId
): Promise<boolean> {
  const result = await getNotificationsCollection().updateOne(
    { _id: notificationId },
    { $set: { isRead: true } }
  );

  return result.modifiedCount > 0;
}

/**
 * Mark all notifications for a user as read
 */
export async function markAllNotificationsAsRead(
  userId: ObjectId
): Promise<number> {
  const result = await getNotificationsCollection().updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } }
  );

  return result.modifiedCount;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: ObjectId
): Promise<boolean> {
  const result = await getNotificationsCollection().deleteOne({
    _id: notificationId,
  });

  return result.deletedCount > 0;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(
  userId: ObjectId
): Promise<number> {
  return await getNotificationsCollection().countDocuments({
    userId,
    isRead: false,
  });
}

// ============================================================================
// Background Job Helpers (for scheduled tasks)
// ============================================================================

/**
 * Find all requests expiring in the next 24 hours and notify owners
 * This should be called by a scheduled job (cron)
 */
export async function notifyExpiringRequests(): Promise<void> {
  const { getBloodRequestsCollection } = await import("../db/collections.js");
  const requestsCollection = getBloodRequestsCollection();

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find requests that:
  // 1. Are still open or in_progress
  // 2. Have neededByDate within the next 24 hours
  const expiringRequests = await requestsCollection
    .find({
      status: { $in: ["open", "in_progress"] },
      neededByDate: {
        $gte: now,
        $lte: tomorrow,
      },
    })
    .toArray();

  console.log(
    `Found ${expiringRequests.length} requests expiring in the next 24 hours`
  );

  // Notify each request owner
  for (const request of expiringRequests) {
    try {
      await notifyRequestExpiringSoon(
        request.userId,
        request._id,
        request.patientName,
        request.neededByDate
      );
    } catch (error) {
      console.error(
        `Failed to notify expiring request ${request._id}:`,
        error
      );
      // Continue with other notifications even if one fails
    }
  }
}
