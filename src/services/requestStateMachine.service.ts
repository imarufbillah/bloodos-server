import { ObjectId } from "mongodb";
import type { BloodRequest } from "../types/models/BloodRequest.js";
import type { RequestStatus, UserRole } from "../types/shared.js";
import { RequestStatus as RequestStatusEnum } from "../types/shared.js";
import {
  AppError,
  createInvalidStateError,
  createForbiddenError,
} from "../middleware/error.middleware.js";

/**
 * Actor type for state transitions
 */
export interface StateTransitionActor {
  id: ObjectId;
  role: UserRole;
}

/**
 * Result of a state transition attempt
 */
export interface StateTransitionResult {
  allowed: boolean;
  newStatus?: RequestStatus;
  error?: AppError;
}

/**
 * Valid state transitions for BloodRequest
 * Implements Requirement 3.1-3.9
 */
const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatusEnum.OPEN]: [
    RequestStatusEnum.IN_PROGRESS,
    RequestStatusEnum.CANCELLED,
    RequestStatusEnum.EXPIRED,
  ],
  [RequestStatusEnum.IN_PROGRESS]: [
    RequestStatusEnum.FULFILLED,
    RequestStatusEnum.CANCELLED,
    RequestStatusEnum.EXPIRED,
  ],
  [RequestStatusEnum.FULFILLED]: [], // Terminal state (Req 3.8)
  [RequestStatusEnum.CANCELLED]: [], // Terminal state (Req 3.9) - admin can override
  [RequestStatusEnum.EXPIRED]: [RequestStatusEnum.OPEN], // Can be reopened by owner/admin (Req 3.6)
};

/**
 * BloodRequest State Machine Service (Req 3.1-3.9)
 *
 * Manages state transitions for blood requests with the following rules:
 *
 * 1. New requests always start as "open" (3.1)
 * 2. First "offered" response auto-transitions to "in_progress" (3.2)
 * 3. Only Owner/Admin can transition to "fulfilled" (3.3)
 * 4. Only Owner/Admin can transition to "cancelled" (3.4)
 * 5. Auto-expires when neededByDate passes (3.5)
 * 6. "expired" can be reopened to "open" by Owner/Admin (3.6)
 * 7. Non-owner, non-admin cannot change status (3.7)
 * 8. "fulfilled" is terminal - cannot transition (3.8)
 * 9. "cancelled" is terminal - only admin can revive (3.9)
 */
export class RequestStateMachineService {
  /**
   * Check if an actor is authorized to perform a state transition
   * Req 3.7 - Only Owner or Admin can change status
   */
  private isAuthorized(
    request: BloodRequest,
    actor: StateTransitionActor,
  ): boolean {
    // Admin can do anything
    if (actor.role === "admin") {
      return true;
    }

    // Owner can perform transitions on their own request
    return request.userId.equals(actor.id);
  }

  /**
   * Check if a state transition is valid based on current status
   */
  private isValidTransition(
    currentStatus: RequestStatus,
    targetStatus: RequestStatus,
    actor: StateTransitionActor,
  ): boolean {
    // Special case: admin can revive cancelled requests (Req 3.9)
    if (
      currentStatus === RequestStatusEnum.CANCELLED &&
      actor.role === "admin"
    ) {
      return true;
    }

    // Check if transition is in the allowed list
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(targetStatus);
  }

  /**
   * Get a human-readable error message for an invalid transition
   */
  private getTransitionErrorMessage(
    currentStatus: RequestStatus,
    targetStatus: RequestStatus,
    actor: StateTransitionActor,
  ): string {
    // Terminal state messages
    if (currentStatus === RequestStatusEnum.FULFILLED) {
      return "Cannot change status of a fulfilled request. The request has been completed.";
    }

    if (
      currentStatus === RequestStatusEnum.CANCELLED &&
      actor.role !== "admin"
    ) {
      return "Cannot change status of a cancelled request. Only administrators can revive cancelled requests.";
    }

    // Invalid transition messages
    return `Invalid state transition from "${currentStatus}" to "${targetStatus}". This transition is not allowed.`;
  }

  /**
   * Attempt a state transition
   *
   * @param request - The blood request to transition
   * @param targetStatus - The desired new status
   * @param actor - The user attempting the transition (with id and role)
   * @returns StateTransitionResult with allowed flag, new status if allowed, or error
   *
   * @example
   * ```typescript
   * const result = stateMachine.transition(
   *   request,
   *   RequestStatus.FULFILLED,
   *   { id: userId, role: 'user' }
   * );
   *
   * if (!result.allowed) {
   *   throw result.error;
   * }
   *
   * // Update request with result.newStatus
   * ```
   */
  public transition(
    request: BloodRequest,
    targetStatus: RequestStatus,
    actor: StateTransitionActor,
  ): StateTransitionResult {
    const currentStatus = request.status;

    // No-op if already in target status
    if (currentStatus === targetStatus) {
      return {
        allowed: true,
        newStatus: currentStatus,
      };
    }

    // Check authorization (Req 3.7)
    if (!this.isAuthorized(request, actor)) {
      return {
        allowed: false,
        error: createForbiddenError(
          "You do not have permission to change the status of this request. Only the request owner or an administrator can modify it.",
          {
            requestId: request._id.toString(),
            currentStatus,
            targetStatus,
            actorId: actor.id.toString(),
          },
        ),
      };
    }

    // Check if transition is valid
    if (!this.isValidTransition(currentStatus, targetStatus, actor)) {
      return {
        allowed: false,
        error: createInvalidStateError(
          this.getTransitionErrorMessage(currentStatus, targetStatus, actor),
          {
            requestId: request._id.toString(),
            currentStatus,
            targetStatus,
          },
        ),
      };
    }

    // Transition is allowed
    return {
      allowed: true,
      newStatus: targetStatus,
    };
  }

  /**
   * Auto-transition to IN_PROGRESS when first response is received
   * Req 3.2 - First "offered" response triggers automatic transition
   *
   * This method should be called when a new response with status "offered" is created
   * It only transitions if the current status is OPEN
   *
   * @param request - The blood request
   * @returns true if transition occurred, false if not needed
   */
  public autoTransitionOnFirstResponse(request: BloodRequest): {
    shouldTransition: boolean;
    newStatus?: RequestStatus;
  } {
    // Only auto-transition if status is currently OPEN
    if (request.status === RequestStatusEnum.OPEN) {
      return {
        shouldTransition: true,
        newStatus: RequestStatusEnum.IN_PROGRESS,
      };
    }

    return {
      shouldTransition: false,
    };
  }

  /**
   * Check if a request should be auto-expired based on neededByDate
   * Req 3.5 - Auto-expire when neededByDate passes
   *
   * @param request - The blood request to check
   * @param currentDate - Optional current date for testing (defaults to now)
   * @returns Object indicating if expiration should occur and the new status
   */
  public checkAutoExpiration(
    request: BloodRequest,
    currentDate: Date = new Date(),
  ): {
    shouldExpire: boolean;
    newStatus?: RequestStatus;
  } {
    // Only auto-expire OPEN or IN_PROGRESS requests
    if (
      request.status !== RequestStatusEnum.OPEN &&
      request.status !== RequestStatusEnum.IN_PROGRESS
    ) {
      return { shouldExpire: false };
    }

    // Check if neededByDate has passed
    if (request.neededByDate < currentDate) {
      return {
        shouldExpire: true,
        newStatus: RequestStatusEnum.EXPIRED,
      };
    }

    return { shouldExpire: false };
  }

  /**
   * Get all valid target statuses from the current status for a given actor
   * Useful for UI to show available actions
   *
   * @param currentStatus - Current request status
   * @param actor - The user who might perform the transition
   * @returns Array of valid target statuses
   */
  public getValidTransitions(
    currentStatus: RequestStatus,
    actor: StateTransitionActor,
  ): RequestStatus[] {
    // Admin can revive cancelled requests
    if (
      currentStatus === RequestStatusEnum.CANCELLED &&
      actor.role === "admin"
    ) {
      return [
        RequestStatusEnum.OPEN,
        RequestStatusEnum.IN_PROGRESS,
        RequestStatusEnum.FULFILLED,
      ];
    }

    return VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Check if a status is terminal (cannot transition to anything)
   * Useful for determining if a request is "final"
   *
   * @param status - The status to check
   * @param isAdmin - Whether the actor is an admin
   * @returns true if the status is terminal
   */
  public isTerminalStatus(status: RequestStatus, isAdmin: boolean): boolean {
    // Fulfilled is always terminal (Req 3.8)
    if (status === RequestStatusEnum.FULFILLED) {
      return true;
    }

    // Cancelled is terminal unless actor is admin (Req 3.9)
    if (status === RequestStatusEnum.CANCELLED) {
      return !isAdmin;
    }

    return false;
  }
}

// Export singleton instance
export const requestStateMachine = new RequestStateMachineService();
