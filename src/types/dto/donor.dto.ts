/**
 * Donor DTOs
 * Based on Requirement 17
 */

import type { BloodGroup, District } from "../shared.js";

// ============================================================================
// Donor Profile (Req 17.8)
// ============================================================================

export interface DonorDto {
  _id: string;
  name: string;
  bloodGroup: BloodGroup;
  district: District;
  phone: string; // Masked by default (Req 17.5)
  email?: string; // Masked by default
  lastDonationDate: Date | string | null;
  isDonor: boolean;
  createdAt: Date | string;
}

// ============================================================================
// Donor Filters (Req 17.3, 17.6)
// ============================================================================

export interface DonorFilters {
  bloodGroup?: BloodGroup;
  district?: District;
  page?: number;
  limit?: number;
}

// ============================================================================
// Request Contact Info (Req 4.5)
// ============================================================================

export interface RequestContactDto {
  donorId: string;
  requestId?: string; // Optional - may request contact outside of a specific request
}

// ============================================================================
// Donor with Unmasked Contact (returned after audit logging)
// ============================================================================

export interface DonorWithContactDto extends DonorDto {
  phone: string; // Unmasked
  email?: string; // Unmasked
}

// ============================================================================
// Donor Eligibility Check (Req 2)
// ============================================================================

export interface DonorEligibilityDto {
  eligible: boolean;
  reason?:
    | "age_requirement"
    | "weight_requirement"
    | "cooldown_requirement"
    | "blood_type_incompatible";
  daysRemaining?: number; // For cooldown_requirement
}
