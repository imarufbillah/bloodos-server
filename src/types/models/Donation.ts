import { ObjectId } from "mongodb";
import type { BloodGroup, District } from "../shared.js";

/**
 * Donation collection schema
 * Represents a verified or self-reported blood donation
 */
export interface Donation {
  _id: ObjectId;
  userId: ObjectId; // Donor (indexed)
  donationDate: Date; // (indexed)
  bloodGroup: BloodGroup;
  hospitalName: string;
  district: District;
  verified: boolean; // Default: false
  verifiedBy: ObjectId | null; // Admin who verified
  verifiedAt: Date | null;
  createdAt: Date;
}

/**
 * Input type for creating a new donation record (self-report)
 */
export interface CreateDonationInput {
  userId: ObjectId;
  donationDate: Date;
  bloodGroup: BloodGroup;
  hospitalName: string;
  district: District;
}

/**
 * Input type for verifying a donation (admin action)
 */
export interface VerifyDonationInput {
  verifiedBy: ObjectId;
  verifiedAt: Date;
}
