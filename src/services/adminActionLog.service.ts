import { ObjectId } from "mongodb";
import { getAdminActionLogsCollection } from "../db/collections.js";
import { logger } from "../utils/logger.js";
import type {
  AdminActionLog,
  CreateAdminActionLogInput,
} from "../types/models/index.js";
import type { AdminActionType } from "../types/shared.js";

// ============================================================================
// Types
// ============================================================================

export interface LogAdminActionParams {
  adminId: ObjectId;
  action: AdminActionType;
  targetType: "user" | "request" | "donation";
  targetId: ObjectId;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  ipAddress: string;
  additionalDetails?: Record<string, unknown>;
}

// ============================================================================
// Core Service Function
// ============================================================================

export async function logAdminAction(
  params: LogAdminActionParams,
): Promise<AdminActionLog> {
  const {
    adminId,
    action,
    targetType,
    targetId,
    previousState,
    newState,
    reason,
    ipAddress,
    additionalDetails,
  } = params;

  // Build the details object with relevant fields (Req 10.8)
  // Only include changed fields, not full document dumps
  const details: Record<string, unknown> = {};

  if (previousState) {
    details.previousState = sanitizeState(previousState);
  }

  if (newState) {
    details.newState = sanitizeState(newState);
  }

  if (reason) {
    details.reason = reason;
  }

  // Merge any additional details
  if (additionalDetails) {
    Object.assign(details, additionalDetails);
  }

  // Create the log entry
  const logEntry: Omit<AdminActionLog, "_id"> = {
    adminId,
    action,
    targetType,
    targetId,
    details,
    ipAddress,
    timestamp: new Date(),
  };

  try {
    const collection = getAdminActionLogsCollection();
    const result = await collection.insertOne(logEntry as AdminActionLog);

    return {
      _id: result.insertedId,
      ...logEntry,
    } as AdminActionLog;
  } catch (error) {
    // Log the error but still throw - audit failures should be visible
    logger.error("Failed to create admin action log:", error);
    throw new Error("Failed to create audit log entry");
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitize state object by removing internal MongoDB fields and
 * ensuring only relevant changed fields are captured (Req 10.8)
 *
 * @param state - State object to sanitize
 * @returns Sanitized state with only relevant fields
 */
function sanitizeState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(state)) {
    // Skip internal MongoDB fields
    if (key === "_id" || key === "createdAt" || key === "updatedAt") {
      continue;
    }

    // Convert ObjectId to string for readability in logs
    if (value instanceof ObjectId) {
      sanitized[key] = value.toString();
      continue;
    }

    // Convert Date to ISO string for readability
    if (value instanceof Date) {
      sanitized[key] = value.toISOString();
      continue;
    }

    // Keep the value as-is
    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Extract only the changed fields between two states (Req 10.8)
 * This ensures we only log relevant changes, not the entire document
 *
 * @param previous - Previous state
 * @param current - Current state
 * @returns Object containing only previousState and newState with changed fields
 */
export function extractChangedFields(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): {
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
} {
  const previousState: Record<string, unknown> = {};
  const newState: Record<string, unknown> = {};

  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const key of allKeys) {
    // Skip internal MongoDB fields
    if (key === "_id" || key === "createdAt" || key === "updatedAt") {
      continue;
    }

    const prevValue = previous[key];
    const currValue = current[key];

    // Check if the value actually changed
    if (!isEqual(prevValue, currValue)) {
      previousState[key] = prevValue;
      newState[key] = currValue;
    }
  }

  return { previousState, newState };
}

/**
 * Simple equality check for common types
 * Handles primitives, Dates, and ObjectIds
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if values are equal
 */
function isEqual(a: unknown, b: unknown): boolean {
  // Same reference or both null/undefined
  if (a === b) return true;

  // One is null/undefined, the other isn't
  if (a == null || b == null) return false;

  // Both are Dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Both are ObjectIds
  if (a instanceof ObjectId && b instanceof ObjectId) {
    return a.equals(b);
  }

  // For objects and arrays, do a simple JSON comparison
  // (not perfect but sufficient for our audit needs)
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

// ============================================================================
// Query Helpers (for future admin dashboard views)
// ============================================================================

/**
 * Get admin action logs for a specific admin user
 * Useful for admin activity reports
 *
 * @param adminId - Admin user ID
 * @param limit - Maximum number of logs to return
 * @returns Array of admin action logs
 */
export async function getAdminActionsByAdmin(
  adminId: ObjectId,
  limit: number = 100,
): Promise<AdminActionLog[]> {
  const collection = getAdminActionLogsCollection();

  return collection
    .find({ adminId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get admin action logs for a specific target resource
 * Useful for viewing audit history of a specific request/user/donation
 *
 * @param targetType - Type of target (user/request/donation)
 * @param targetId - Target resource ID
 * @param limit - Maximum number of logs to return
 * @returns Array of admin action logs
 */
export async function getAdminActionsByTarget(
  targetType: "user" | "request" | "donation",
  targetId: ObjectId,
  limit: number = 100,
): Promise<AdminActionLog[]> {
  const collection = getAdminActionLogsCollection();

  return collection
    .find({ targetType, targetId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get recent admin actions across the platform
 * Useful for admin dashboard overview
 *
 * @param limit - Maximum number of logs to return
 * @returns Array of admin action logs
 */
export async function getRecentAdminActions(
  limit: number = 50,
): Promise<AdminActionLog[]> {
  const collection = getAdminActionLogsCollection();

  return collection.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
}
