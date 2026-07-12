import { ObjectId } from "mongodb";
import type { AdminActionType } from "../shared.js";

/**
 * AdminActionLog collection schema (Req 10.1)
 * Tracks all administrative actions for audit purposes
 */
export interface AdminActionLog {
  _id: ObjectId;
  adminId: ObjectId; // (indexed)
  action: AdminActionType; // 7 types
  targetType: "user" | "request" | "donation";
  targetId: ObjectId;
  details: Record<string, unknown>; // Contains previousState, newState, reason, etc.
  ipAddress: string;
  timestamp: Date; // (indexed)
}

/**
 * Input type for creating an admin action log entry
 */
export interface CreateAdminActionLogInput {
  adminId: ObjectId;
  action: AdminActionType;
  targetType: "user" | "request" | "donation";
  targetId: ObjectId;
  details: {
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    reason?: string;
    [key: string]: unknown;
  };
  ipAddress: string;
}
