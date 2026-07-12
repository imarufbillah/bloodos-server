/**
 * Response DTOs (Donor responses to blood requests)
 * Based on Requirement 6
 */

import type { ResponseStatus } from "../shared.js";

// ============================================================================
// Create Response (Req 6.1-6.3)
// ============================================================================

export interface CreateResponseDto {
  requestId: string;
  message?: string;
}

// ============================================================================
// Response Data (Req 6.2)
// ============================================================================

export interface ResponseDto {
  _id: string;
  requestId: string;
  userId: string; // Donor's user ID
  status: ResponseStatus;
  message?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// Update Response Status (Req 6.7)
// ============================================================================

export interface UpdateResponseStatusDto {
  status: "accepted" | "declined" | "completed";
}

// ============================================================================
// Response with User Info (for request owners)
// ============================================================================

export interface ResponseWithUserDto extends ResponseDto {
  user: {
    id: string;
    name: string;
    bloodGroup: string;
    district: string;
    phone: string; // Masked unless contact requested
    lastDonationDate: Date | string | null;
  };
}
