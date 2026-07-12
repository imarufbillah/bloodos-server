import { ObjectId } from "mongodb";
import type { UserRole, BloodGroup, District } from "../shared.js";

/**
 * User extension fields (Req 1.8)
 * These fields extend the better-auth user schema
 * The full user document is managed by better-auth
 */
export interface User {
  _id: ObjectId;
  id: string; // better-auth's string ID
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Extended fields for BloodOS
  role: UserRole; // Default: "user"
  phone: string;
  district: District;
  bloodGroup: BloodGroup;
  isDonor: boolean; // Default: false
  lastDonationDate: Date | null;
  // Optional fields from better-auth
  banned?: boolean;
  banReason?: string | null;
  banExpiresAt?: Date | null;
}

/**
 * Input type for updating user profile
 */
export interface UpdateUserProfileInput {
  name?: string;
  phone?: string;
  district?: District;
  bloodGroup?: BloodGroup;
  isDonor?: boolean;
  lastDonationDate?: Date | null;
}

/**
 * Input type for admin user management
 */
export interface AdminUpdateUserInput {
  role?: UserRole;
  banned?: boolean;
  banReason?: string | null;
  banExpiresAt?: Date | null;
}
