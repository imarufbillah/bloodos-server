/**
 * Services Index
 * Centralized exports for all BloodOS services
 */

// Eligibility Service
export {
  evaluateEligibility,
  calculateCooldownDaysRemaining,
  getIneligibilityMessage,
  ELIGIBILITY_CONSTANTS,
  type EligibilityResult,
  type EligibilityCheckInput,
} from "./eligibility.service.js";

// Compatibility Utilities
export {
  isBloodTypeCompatible,
  getCompatibleDonors,
  getCompatibleRecipients,
} from "./compatibility.js";
