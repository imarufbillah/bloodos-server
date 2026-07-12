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

// Request State Machine Service
export {
  requestStateMachine,
  RequestStateMachineService,
  type StateTransitionActor,
  type StateTransitionResult,
} from "./requestStateMachine.service.js";

// Admin Action Log Service
export {
  logAdminAction,
  extractChangedFields,
  getAdminActionsByAdmin,
  getAdminActionsByTarget,
  getRecentAdminActions,
  type LogAdminActionParams,
} from "./adminActionLog.service.js";
