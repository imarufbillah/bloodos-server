/**
 * Blood Compatibility Utilities
 * Provides blood type compatibility checking based on the compatibility matrix (Req 2.4)
 */

import { BloodGroup, BLOOD_COMPATIBILITY } from "../types/shared.js";

/**
 * Checks if a donor's blood group is compatible with a recipient's blood group
 * @param donorBloodGroup - The blood group of the potential donor
 * @param recipientBloodGroup - The blood group needed for the request
 * @returns true if the donor can donate to the recipient, false otherwise
 */
export function isBloodTypeCompatible(
  donorBloodGroup: BloodGroup,
  recipientBloodGroup: BloodGroup,
): boolean {
  const compatibleDonors = BLOOD_COMPATIBILITY[recipientBloodGroup];
  return compatibleDonors.includes(donorBloodGroup);
}

/**
 * Gets all blood groups that can donate to a specific blood group
 * @param recipientBloodGroup - The blood group that needs donation
 * @returns Array of compatible donor blood groups
 */
export function getCompatibleDonors(
  recipientBloodGroup: BloodGroup,
): BloodGroup[] {
  return BLOOD_COMPATIBILITY[recipientBloodGroup];
}

/**
 * Gets all blood groups that a specific blood group can donate to
 * @param donorBloodGroup - The blood group of the potential donor
 * @returns Array of compatible recipient blood groups
 */
export function getCompatibleRecipients(
  donorBloodGroup: BloodGroup,
): BloodGroup[] {
  const recipients: BloodGroup[] = [];

  for (const [recipient, donors] of Object.entries(BLOOD_COMPATIBILITY)) {
    if (donors.includes(donorBloodGroup)) {
      recipients.push(recipient as BloodGroup);
    }
  }

  return recipients;
}
