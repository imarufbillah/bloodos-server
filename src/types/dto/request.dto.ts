/**
 * Blood Request DTOs
 * Based on Requirements 20 and 7
 */

import type {
  BloodGroup,
  District,
  Urgency,
  RequestStatus,
} from "../shared.js";

// ============================================================================
// Create Blood Request (Req 20.3)
// ============================================================================

export interface CreateBloodRequestDto {
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  hospitalName: string;
  hospitalAddress: string;
  district: District;
  urgency: Urgency;
  neededByDate: Date | string; // ISO string from client
  contactPhone: string;
  additionalNotes?: string;
}

// ============================================================================
// Update Blood Request
// ============================================================================

export interface UpdateBloodRequestDto {
  patientName?: string;
  bloodGroup?: BloodGroup;
  unitsNeeded?: number;
  hospitalName?: string;
  hospitalAddress?: string;
  district?: District;
  urgency?: Urgency;
  neededByDate?: Date | string;
  contactPhone?: string;
  additionalNotes?: string;
}

// ============================================================================
// Blood Request Response (Req 20.6-20.8)
// ============================================================================

export interface BloodRequestDto {
  _id: string;
  userId: string;
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  hospitalName: string;
  hospitalAddress: string;
  district: District;
  urgency: Urgency;
  status: RequestStatus;
  neededByDate: Date | string;
  contactPhone: string; // May be masked based on permissions
  additionalNotes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// Blood Request Filters (Req 7.11, 20.16)
// ============================================================================

export interface BloodRequestFilters {
  bloodGroup?: BloodGroup;
  district?: District;
  urgency?: Urgency;
  status?: RequestStatus;
  search?: string; // Searches patientName, hospitalName, hospitalAddress, additionalNotes
  sort?: "newest" | "oldest" | "most_urgent" | "critical_first";
  page?: number;
  limit?: number;
}

// ============================================================================
// Update Request Status (Req 3)
// ============================================================================

export interface UpdateRequestStatusDto {
  status: RequestStatus;
  reason?: string; // Optional reason for admin actions
}
