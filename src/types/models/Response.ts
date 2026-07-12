import { ObjectId } from "mongodb";
import type { ResponseStatus } from "../shared.js";

/**
 * Response collection schema
 * Represents a donor's response to a blood request
 */
export interface Response {
  _id: ObjectId;
  requestId: ObjectId; // (indexed)
  userId: ObjectId; // Donor (indexed)
  status: ResponseStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input type for creating a new response
 */
export interface CreateResponseInput {
  requestId: ObjectId;
  userId: ObjectId;
  message?: string;
}

/**
 * Input type for updating a response
 */
export interface UpdateResponseInput {
  status?: ResponseStatus;
  message?: string;
}
