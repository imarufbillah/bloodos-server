import { ObjectId } from "mongodb";
import type { BloodGroup, District, Urgency, RequestStatus } from "../shared.js";

/**
 * BloodRequest collection schema
 * Represents a blood donation request posted by a user
 */
export interface BloodRequest {
  _id: ObjectId;
  userId: ObjectId; // Requester (indexed)
  patientName: string;
  bloodGroup: BloodGroup; // (indexed)
  unitsNeeded: number;
  hospitalName: string;
  hospitalAddress: string;
  district: District; // (indexed)
  urgency: Urgency; // (indexed)
  status: RequestStatus; // (indexed)
  neededByDate: Date; // (indexed)
  contactPhone: string;
  additionalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input type for creating a new blood request
 */
export interface CreateBloodRequestInput {
  userId: ObjectId;
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  hospitalName: string;
  hospitalAddress: string;
  district: District;
  urgency: Urgency;
  neededByDate: Date;
  contactPhone: string;
  additionalNotes?: string;
}

/**
 * Input type for updating a blood request
 */
export interface UpdateBloodRequestInput {
  patientName?: string;
  bloodGroup?: BloodGroup;
  unitsNeeded?: number;
  hospitalName?: string;
  hospitalAddress?: string;
  district?: District;
  urgency?: Urgency;
  neededByDate?: Date;
  contactPhone?: string;
  additionalNotes?: string;
  status?: RequestStatus;
}
