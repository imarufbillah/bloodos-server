/**
 * Donation DTOs
 * Based on Requirements 8, 13 (inferred from plan §0.A)
 */

import type { BloodGroup, District } from "../shared.js";

// ============================================================================
// Donation Record (Req 13.8)
// ============================================================================

export interface DonationDto {
  _id: string;
  userId: string; // Donor
  donationDate: Date | string;
  bloodGroup: BloodGroup;
  hospitalName: string;
  district: District;
  verified: boolean;
  verifiedBy?: string | null; // Admin ID who verified
  verifiedAt?: Date | string | null;
  createdAt: Date | string;
}

// ============================================================================
// Self-Report Donation (Req 13.8, inferred)
// ============================================================================

export interface CreateDonationDto {
  donationDate: Date | string;
  bloodGroup: BloodGroup;
  hospitalName: string;
  district: District;
}

// ============================================================================
// Admin Verify Donation (Req 10.4)
// ============================================================================

export interface VerifyDonationDto {
  verified: boolean;
  reason?: string; // Optional reason for admin action
}

// ============================================================================
// Donation with User Info (for admin view)
// ============================================================================

export interface DonationWithUserDto extends DonationDto {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}
