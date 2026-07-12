import { ObjectId } from "mongodb";
import type { ContactType } from "../shared.js";

/**
 * ContactAuditLog collection schema (Req 4.5)
 * Tracks every contact info reveal for audit purposes
 */
export interface ContactAuditLog {
  _id: ObjectId;
  requestorId: ObjectId; // User requesting contact
  donorId: ObjectId; // Donor whose info was accessed
  requestId: ObjectId | null; // Related request
  contactType: ContactType;
  timestamp: Date; // (indexed)
  ipAddress: string;
}

/**
 * Input type for creating a contact audit log entry
 */
export interface CreateContactAuditLogInput {
  requestorId: ObjectId;
  donorId: ObjectId;
  requestId?: ObjectId | null;
  contactType: ContactType;
  ipAddress: string;
}
