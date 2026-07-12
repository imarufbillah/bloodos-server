/**
 * User DTOs
 * Based on Requirements 1, 13
 */

import type { BloodGroup, District, UserRole } from "../shared.js";

// ============================================================================
// User Profile (Req 13.3)
// ============================================================================

export interface UserDto {
  _id: string;
  name: string;
  email: string;
  phone: string;
  district: District;
  bloodGroup: BloodGroup;
  role: UserRole;
  isDonor: boolean;
  lastDonationDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// Update User Profile (Req 13.5)
// ============================================================================

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  district?: District;
  bloodGroup?: BloodGroup;
  isDonor?: boolean;
  // Note: role cannot be updated via this endpoint (Req 1.10)
}

// ============================================================================
// User Registration Extension Fields (Req 1.8)
// ============================================================================

export interface UserRegistrationDto {
  name: string;
  email: string;
  password: string;
  phone: string;
  district: District;
  bloodGroup: BloodGroup;
  isDonor?: boolean;
  // role is set server-side to "user" by default
}

// ============================================================================
// User Session Data (from JWT)
// ============================================================================

export interface SessionUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  district: District;
  bloodGroup: BloodGroup;
  isDonor: boolean;
}

// ============================================================================
// Admin Update User Role (Req 10, inferred from plan §0.B)
// ============================================================================

export interface UpdateUserRoleDto {
  role: UserRole;
  reason?: string;
}

// ============================================================================
// Admin Ban/Unban User (Req 10.5, 10.6)
// ============================================================================

export interface BanUserDto {
  banned: boolean;
  reason: string;
}
