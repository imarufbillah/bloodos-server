/**
 * Donor Eligibility Service
 * Evaluates whether a donor is eligible to respond to a blood request
 * Based on Requirements 2.1-2.8
 */

import type { BloodGroup, IneligibilityReason } from "../types/shared.js";
import type { User } from "../types/models/UserExtension.js";
import { isBloodTypeCompatible } from "./compatibility.js";

// Constants from Bangladesh Red Crescent Standards
const MIN_AGE = 18;
const MAX_AGE = 60;
const MIN_WEIGHT_KG = 50;
const COOLDOWN_DAYS = 90;

/**
 * Result of an eligibility evaluation
 */
export interface EligibilityResult {
  eligible: boolean;
  reason?: IneligibilityReason;
  daysRemaining?: number;
}

/**
 * Input parameters for eligibility evaluation
 */
export interface EligibilityCheckInput {
  donor: Pick<
    User,
    "bloodGroup" | "lastDonationDate" | "isDonor"
  > & {
    age?: number; // Age in years
    weight?: number; // Weight in kg
  };
  requestedBloodGroup: BloodGroup;
}

/**
 * Evaluates if a donor is eligible to donate for a specific blood request
 * Checks are performed in order: age → weight → cooldown → compatibility
 * Returns the first failure encountered
 *
 * @param input - Donor information and requested blood group
 * @returns EligibilityResult indicating eligibility status and reason if ineligible
 */
export function evaluateEligibility(
  input: EligibilityCheckInput
): EligibilityResult {
  const { donor, requestedBloodGroup } = input;

  // Check 1: Age requirement (Req 2.1, 2.5)
  // Age must be between 18-60 years inclusive
  if (donor.age !== undefined) {
    if (donor.age < MIN_AGE || donor.age > MAX_AGE) {
      return {
        eligible: false,
        reason: "age_requirement",
      };
    }
  }

  // Check 2: Weight requirement (Req 2.2, 2.6)
  // Weight must be at least 50kg
  if (donor.weight !== undefined) {
    if (donor.weight < MIN_WEIGHT_KG) {
      return {
        eligible: false,
        reason: "weight_requirement",
      };
    }
  }

  // Check 3: Cooldown requirement (Req 2.3, 2.7)
  // Must be at least 90 days since last donation
  // Only checked if lastDonationDate is present
  if (donor.lastDonationDate) {
    const daysSinceLastDonation = calculateDaysSince(donor.lastDonationDate);

    if (daysSinceLastDonation < COOLDOWN_DAYS) {
      const daysRemaining = COOLDOWN_DAYS - daysSinceLastDonation;

      return {
        eligible: false,
        reason: "cooldown_requirement",
        daysRemaining,
      };
    }
  }

  // Check 4: Blood type compatibility (Req 2.4, 2.8)
  // Donor's blood group must be compatible with requested blood group
  if (!isBloodTypeCompatible(donor.bloodGroup, requestedBloodGroup)) {
    return {
      eligible: false,
      reason: "blood_type_incompatible",
    };
  }

  // All checks passed
  return {
    eligible: true,
  };
}

/**
 * Calculates the number of days between a past date and now
 * @param pastDate - The past date to calculate from
 * @returns Number of full days since the past date
 */
function calculateDaysSince(pastDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - pastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculates days remaining until a donor becomes eligible again
 * Returns 0 if already eligible
 *
 * @param lastDonationDate - Date of last donation
 * @returns Number of days remaining in cooldown period
 */
export function calculateCooldownDaysRemaining(
  lastDonationDate: Date | null
): number {
  if (!lastDonationDate) {
    return 0;
  }

  const daysSinceLastDonation = calculateDaysSince(lastDonationDate);
  const daysRemaining = COOLDOWN_DAYS - daysSinceLastDonation;

  return Math.max(0, daysRemaining);
}

/**
 * Gets a human-readable message for an ineligibility reason
 * @param reason - The ineligibility reason
 * @param daysRemaining - Optional days remaining for cooldown
 * @returns Human-readable error message
 */
export function getIneligibilityMessage(
  reason: IneligibilityReason,
  daysRemaining?: number
): string {
  switch (reason) {
    case "age_requirement":
      return `Donors must be between ${MIN_AGE} and ${MAX_AGE} years old.`;
    case "weight_requirement":
      return `Donors must weigh at least ${MIN_WEIGHT_KG}kg.`;
    case "cooldown_requirement":
      return daysRemaining
        ? `You must wait ${daysRemaining} more day(s) before donating again. Minimum ${COOLDOWN_DAYS} days required between donations.`
        : `Minimum ${COOLDOWN_DAYS} days required between donations.`;
    case "blood_type_incompatible":
      return "Your blood type is not compatible with this request.";
    default:
      return "You are not eligible to donate for this request.";
  }
}

/**
 * Export constants for use in other modules
 */
export const ELIGIBILITY_CONSTANTS = {
  MIN_AGE,
  MAX_AGE,
  MIN_WEIGHT_KG,
  COOLDOWN_DAYS,
} as const;
