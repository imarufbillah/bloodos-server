import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { RequestStateMachineService } from "../requestStateMachine.service.js";
import type { BloodRequest } from "../../types/models/BloodRequest.js";
import { RequestStatus } from "../../types/shared.js";
import { BloodGroup, District, Urgency } from "../../types/shared.js";
import type { StateTransitionActor } from "../requestStateMachine.service.js";

describe("RequestStateMachineService", () => {
  let stateMachine: RequestStateMachineService;
  let mockRequest: BloodRequest;
  let ownerActor: StateTransitionActor;
  let adminActor: StateTransitionActor;
  let otherUserActor: StateTransitionActor;

  beforeEach(() => {
    stateMachine = new RequestStateMachineService();

    const ownerId = new ObjectId();
    const otherId = new ObjectId();
    const adminId = new ObjectId();

    // Create a mock blood request
    mockRequest = {
      _id: new ObjectId(),
      userId: ownerId,
      patientName: "John Doe",
      bloodGroup: BloodGroup.A_POSITIVE,
      unitsNeeded: 2,
      hospitalName: "General Hospital",
      hospitalAddress: "123 Main St",
      district: District.DHAKA,
      urgency: Urgency.URGENT,
      status: RequestStatus.OPEN,
      neededByDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      contactPhone: "01712345678",
      additionalNotes: "Urgent case",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    ownerActor = { id: ownerId, role: "user" };
    adminActor = { id: adminId, role: "admin" };
    otherUserActor = { id: otherId, role: "user" };
  });

  describe("Authorization (Req 3.7)", () => {
    it("should allow owner to transition their own request", () => {
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.CANCELLED,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
      expect(result.error).toBeUndefined();
    });

    it("should allow admin to transition any request", () => {
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.CANCELLED,
        adminActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
      expect(result.error).toBeUndefined();
    });

    it("should deny non-owner, non-admin from transitioning request", () => {
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.CANCELLED,
        otherUserActor
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.httpStatus).toBe(403);
      expect(result.error?.code).toBe("forbidden");
    });
  });

  describe("Valid Transitions", () => {
    it("should allow OPEN → IN_PROGRESS", () => {
      mockRequest.status = RequestStatus.OPEN;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.IN_PROGRESS,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.IN_PROGRESS);
    });

    it("should allow OPEN → CANCELLED", () => {
      mockRequest.status = RequestStatus.OPEN;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.CANCELLED,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
    });

    it("should allow OPEN → EXPIRED", () => {
      mockRequest.status = RequestStatus.OPEN;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.EXPIRED,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.EXPIRED);
    });

    it("should allow IN_PROGRESS → FULFILLED", () => {
      mockRequest.status = RequestStatus.IN_PROGRESS;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.FULFILLED,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.FULFILLED);
    });

    it("should allow IN_PROGRESS → CANCELLED", () => {
      mockRequest.status = RequestStatus.IN_PROGRESS;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.CANCELLED,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.CANCELLED);
    });

    it("should allow IN_PROGRESS → EXPIRED", () => {
      mockRequest.status = RequestStatus.IN_PROGRESS;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.EXPIRED,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.EXPIRED);
    });

    it("should allow EXPIRED → OPEN (Req 3.6)", () => {
      mockRequest.status = RequestStatus.EXPIRED;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.OPEN,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.OPEN);
    });
  });

  describe("Invalid Transitions", () => {
    it("should block OPEN → FULFILLED (must go through IN_PROGRESS)", () => {
      mockRequest.status = RequestStatus.OPEN;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.FULFILLED,
        ownerActor
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.httpStatus).toBe(422);
      expect(result.error?.code).toBe("invalid_state");
    });

    it("should block EXPIRED → IN_PROGRESS", () => {
      mockRequest.status = RequestStatus.EXPIRED;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.IN_PROGRESS,
        ownerActor
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should block EXPIRED → FULFILLED", () => {
      mockRequest.status = RequestStatus.EXPIRED;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.FULFILLED,
        ownerActor
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Terminal States", () => {
    describe("FULFILLED is terminal (Req 3.8)", () => {
      it("should block all transitions from FULFILLED", () => {
        mockRequest.status = RequestStatus.FULFILLED;

        const statuses = [
          RequestStatus.OPEN,
          RequestStatus.IN_PROGRESS,
          RequestStatus.CANCELLED,
          RequestStatus.EXPIRED,
        ];

        for (const targetStatus of statuses) {
          const result = stateMachine.transition(
            mockRequest,
            targetStatus,
            ownerActor
          );

          expect(result.allowed).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error?.message).toContain("fulfilled");
        }
      });

      it("should block admin from transitioning fulfilled requests", () => {
        mockRequest.status = RequestStatus.FULFILLED;
        const result = stateMachine.transition(
          mockRequest,
          RequestStatus.OPEN,
          adminActor
        );

        expect(result.allowed).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("CANCELLED is terminal for non-admin (Req 3.9)", () => {
      it("should block owner from transitioning cancelled request", () => {
        mockRequest.status = RequestStatus.CANCELLED;
        const result = stateMachine.transition(
          mockRequest,
          RequestStatus.OPEN,
          ownerActor
        );

        expect(result.allowed).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain("cancelled");
        expect(result.error?.message).toContain("administrator");
      });

      it("should allow admin to revive cancelled request", () => {
        mockRequest.status = RequestStatus.CANCELLED;
        const result = stateMachine.transition(
          mockRequest,
          RequestStatus.OPEN,
          adminActor
        );

        expect(result.allowed).toBe(true);
        expect(result.newStatus).toBe(RequestStatus.OPEN);
      });

      it("should allow admin to transition cancelled to any status", () => {
        mockRequest.status = RequestStatus.CANCELLED;

        const statuses = [
          RequestStatus.OPEN,
          RequestStatus.IN_PROGRESS,
          RequestStatus.FULFILLED,
        ];

        for (const targetStatus of statuses) {
          const result = stateMachine.transition(
            mockRequest,
            targetStatus,
            adminActor
          );

          expect(result.allowed).toBe(true);
          expect(result.newStatus).toBe(targetStatus);
        }
      });
    });
  });

  describe("Auto-transition on First Response (Req 3.2)", () => {
    it("should indicate transition needed when status is OPEN", () => {
      mockRequest.status = RequestStatus.OPEN;
      const result = stateMachine.autoTransitionOnFirstResponse(mockRequest);

      expect(result.shouldTransition).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.IN_PROGRESS);
    });

    it("should not transition if status is already IN_PROGRESS", () => {
      mockRequest.status = RequestStatus.IN_PROGRESS;
      const result = stateMachine.autoTransitionOnFirstResponse(mockRequest);

      expect(result.shouldTransition).toBe(false);
      expect(result.newStatus).toBeUndefined();
    });

    it("should not transition if status is FULFILLED", () => {
      mockRequest.status = RequestStatus.FULFILLED;
      const result = stateMachine.autoTransitionOnFirstResponse(mockRequest);

      expect(result.shouldTransition).toBe(false);
    });

    it("should not transition if status is CANCELLED", () => {
      mockRequest.status = RequestStatus.CANCELLED;
      const result = stateMachine.autoTransitionOnFirstResponse(mockRequest);

      expect(result.shouldTransition).toBe(false);
    });

    it("should not transition if status is EXPIRED", () => {
      mockRequest.status = RequestStatus.EXPIRED;
      const result = stateMachine.autoTransitionOnFirstResponse(mockRequest);

      expect(result.shouldTransition).toBe(false);
    });
  });

  describe("Auto-expiration (Req 3.5)", () => {
    it("should expire OPEN request when neededByDate has passed", () => {
      mockRequest.status = RequestStatus.OPEN;
      mockRequest.neededByDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const result = stateMachine.checkAutoExpiration(mockRequest);

      expect(result.shouldExpire).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.EXPIRED);
    });

    it("should expire IN_PROGRESS request when neededByDate has passed", () => {
      mockRequest.status = RequestStatus.IN_PROGRESS;
      mockRequest.neededByDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = stateMachine.checkAutoExpiration(mockRequest);

      expect(result.shouldExpire).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.EXPIRED);
    });

    it("should not expire if neededByDate is in the future", () => {
      mockRequest.status = RequestStatus.OPEN;
      mockRequest.neededByDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const result = stateMachine.checkAutoExpiration(mockRequest);

      expect(result.shouldExpire).toBe(false);
    });

    it("should not expire FULFILLED requests", () => {
      mockRequest.status = RequestStatus.FULFILLED;
      mockRequest.neededByDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = stateMachine.checkAutoExpiration(mockRequest);

      expect(result.shouldExpire).toBe(false);
    });

    it("should not expire CANCELLED requests", () => {
      mockRequest.status = RequestStatus.CANCELLED;
      mockRequest.neededByDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = stateMachine.checkAutoExpiration(mockRequest);

      expect(result.shouldExpire).toBe(false);
    });

    it("should not expire already EXPIRED requests", () => {
      mockRequest.status = RequestStatus.EXPIRED;
      mockRequest.neededByDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = stateMachine.checkAutoExpiration(mockRequest);

      expect(result.shouldExpire).toBe(false);
    });

    it("should accept custom currentDate for testing", () => {
      mockRequest.status = RequestStatus.OPEN;
      mockRequest.neededByDate = new Date("2025-01-15");

      const pastDate = new Date("2025-01-20"); // After neededByDate
      const result = stateMachine.checkAutoExpiration(mockRequest, pastDate);

      expect(result.shouldExpire).toBe(true);
    });
  });

  describe("No-op Transitions", () => {
    it("should allow transition to same status (no-op)", () => {
      mockRequest.status = RequestStatus.OPEN;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.OPEN,
        ownerActor
      );

      expect(result.allowed).toBe(true);
      expect(result.newStatus).toBe(RequestStatus.OPEN);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Utility Methods", () => {
    describe("getValidTransitions", () => {
      it("should return valid transitions for OPEN status", () => {
        const transitions = stateMachine.getValidTransitions(
          RequestStatus.OPEN,
          ownerActor
        );

        expect(transitions).toContain(RequestStatus.IN_PROGRESS);
        expect(transitions).toContain(RequestStatus.CANCELLED);
        expect(transitions).toContain(RequestStatus.EXPIRED);
        expect(transitions).not.toContain(RequestStatus.FULFILLED);
      });

      it("should return valid transitions for IN_PROGRESS status", () => {
        const transitions = stateMachine.getValidTransitions(
          RequestStatus.IN_PROGRESS,
          ownerActor
        );

        expect(transitions).toContain(RequestStatus.FULFILLED);
        expect(transitions).toContain(RequestStatus.CANCELLED);
        expect(transitions).toContain(RequestStatus.EXPIRED);
      });

      it("should return empty array for FULFILLED status", () => {
        const transitions = stateMachine.getValidTransitions(
          RequestStatus.FULFILLED,
          ownerActor
        );

        expect(transitions).toEqual([]);
      });

      it("should return empty array for CANCELLED status (non-admin)", () => {
        const transitions = stateMachine.getValidTransitions(
          RequestStatus.CANCELLED,
          ownerActor
        );

        expect(transitions).toEqual([]);
      });

      it("should return revival options for CANCELLED status (admin)", () => {
        const transitions = stateMachine.getValidTransitions(
          RequestStatus.CANCELLED,
          adminActor
        );

        expect(transitions).toContain(RequestStatus.OPEN);
        expect(transitions).toContain(RequestStatus.IN_PROGRESS);
        expect(transitions).toContain(RequestStatus.FULFILLED);
      });

      it("should return OPEN for EXPIRED status", () => {
        const transitions = stateMachine.getValidTransitions(
          RequestStatus.EXPIRED,
          ownerActor
        );

        expect(transitions).toContain(RequestStatus.OPEN);
        expect(transitions.length).toBe(1);
      });
    });

    describe("isTerminalStatus", () => {
      it("should mark FULFILLED as terminal for anyone", () => {
        expect(
          stateMachine.isTerminalStatus(RequestStatus.FULFILLED, false)
        ).toBe(true);
        expect(
          stateMachine.isTerminalStatus(RequestStatus.FULFILLED, true)
        ).toBe(true);
      });

      it("should mark CANCELLED as terminal for non-admin", () => {
        expect(
          stateMachine.isTerminalStatus(RequestStatus.CANCELLED, false)
        ).toBe(true);
      });

      it("should not mark CANCELLED as terminal for admin", () => {
        expect(
          stateMachine.isTerminalStatus(RequestStatus.CANCELLED, true)
        ).toBe(false);
      });

      it("should not mark other statuses as terminal", () => {
        expect(stateMachine.isTerminalStatus(RequestStatus.OPEN, false)).toBe(
          false
        );
        expect(
          stateMachine.isTerminalStatus(RequestStatus.IN_PROGRESS, false)
        ).toBe(false);
        expect(
          stateMachine.isTerminalStatus(RequestStatus.EXPIRED, false)
        ).toBe(false);
      });
    });
  });

  describe("Error Messages", () => {
    it("should provide clear error message for unauthorized access", () => {
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.CANCELLED,
        otherUserActor
      );

      expect(result.error?.message).toContain("permission");
      expect(result.error?.message).toContain("owner");
      expect(result.error?.message).toContain("administrator");
    });

    it("should provide clear error message for fulfilled terminal state", () => {
      mockRequest.status = RequestStatus.FULFILLED;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.OPEN,
        ownerActor
      );

      expect(result.error?.message).toContain("fulfilled");
      expect(result.error?.message).toContain("completed");
    });

    it("should provide clear error message for cancelled terminal state", () => {
      mockRequest.status = RequestStatus.CANCELLED;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.OPEN,
        ownerActor
      );

      expect(result.error?.message).toContain("cancelled");
      expect(result.error?.message).toContain("administrator");
    });

    it("should provide clear error message for invalid transitions", () => {
      mockRequest.status = RequestStatus.OPEN;
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.FULFILLED,
        ownerActor
      );

      expect(result.error?.message).toContain("Invalid state transition");
      expect(result.error?.message).toContain("open");
      expect(result.error?.message).toContain("fulfilled");
    });

    it("should include request details in error", () => {
      const result = stateMachine.transition(
        mockRequest,
        RequestStatus.FULFILLED, // Invalid from OPEN
        ownerActor
      );

      expect(result.error?.details).toBeDefined();
      expect(result.error?.details?.requestId).toBe(mockRequest._id.toString());
      expect(result.error?.details?.currentStatus).toBe(RequestStatus.OPEN);
      expect(result.error?.details?.targetStatus).toBe(RequestStatus.FULFILLED);
    });
  });
});
