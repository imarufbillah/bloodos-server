import { Collection } from "mongodb";
import { getDB } from "../config/db.js";
import type {
  BloodRequest,
  Response,
  Donation,
  Notification,
  ContactAuditLog,
  AdminActionLog,
  User,
} from "../types/models/index.js";

/**
 * Collection names as constants
 */
export const COLLECTION_NAMES = {
  USERS: "user",
  BLOOD_REQUESTS: "blood_requests",
  RESPONSES: "responses",
  DONATIONS: "donations",
  NOTIFICATIONS: "notifications",
  CONTACT_AUDIT_LOGS: "contact_audit_logs",
  ADMIN_ACTION_LOGS: "admin_action_logs",
} as const;

/**
 * Get typed collection for Users
 * Note: User collection is managed by better-auth
 */
export const getUsersCollection = (): Collection<User> => {
  return getDB().collection<User>(COLLECTION_NAMES.USERS);
};

/**
 * Get typed collection for Blood Requests
 */
export const getBloodRequestsCollection = (): Collection<BloodRequest> => {
  return getDB().collection<BloodRequest>(COLLECTION_NAMES.BLOOD_REQUESTS);
};

/**
 * Get typed collection for Responses
 */
export const getResponsesCollection = (): Collection<Response> => {
  return getDB().collection<Response>(COLLECTION_NAMES.RESPONSES);
};

/**
 * Get typed collection for Donations
 */
export const getDonationsCollection = (): Collection<Donation> => {
  return getDB().collection<Donation>(COLLECTION_NAMES.DONATIONS);
};

/**
 * Get typed collection for Notifications
 */
export const getNotificationsCollection = (): Collection<Notification> => {
  return getDB().collection<Notification>(COLLECTION_NAMES.NOTIFICATIONS);
};

/**
 * Get typed collection for Contact Audit Logs
 */
export const getContactAuditLogsCollection =
  (): Collection<ContactAuditLog> => {
    return getDB().collection<ContactAuditLog>(
      COLLECTION_NAMES.CONTACT_AUDIT_LOGS,
    );
  };

/**
 * Get typed collection for Admin Action Logs
 */
export const getAdminActionLogsCollection = (): Collection<AdminActionLog> => {
  return getDB().collection<AdminActionLog>(COLLECTION_NAMES.ADMIN_ACTION_LOGS);
};
