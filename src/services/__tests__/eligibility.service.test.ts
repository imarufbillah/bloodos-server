/**
 * Tests for Eligibility Service
 * Validates Requirements 2.1-2.8
 */

import { describe, it, expect } from "vitest";
import {
  evaluateEligibility,
  calculateCooldownDaysRemaining,
  getIneligibilityMessage,
  ELIGIBILITY_CONSTANTS,
  type EligibilityCheckInput,
} from "../eligibility.service.js";
import { BloodGroup } from "../../types/shared.js";

describe("Eligibility Service", () => {
  // Helper to create a valid donor
  const createDonor = (overrides = {}) => ({
    bloodGroup: BloodGroup.O_NEGATIVE,
    lastDonationDate: null,
    isDonor: true,
    age: 25,
    weight: 60,
    ...overrides,
  });

  describe("Age Requirement (Req 2.1, 2.5)", () => {
    it("should reject donors under 18 years old", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ age: 17 }),
        requestedBloodGroup: BloodGroup.A_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("age_requirement");
    });

    it("should reject donors over 60 years old", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ age: 61 }),
        requestedBloodGroup: BloodGroup.A_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("age_requirement");
    });

    it("should accept donors exactly 18 years old", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ age: 18 }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE, // O- can donate to AB+
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should accept donors exactly 60 years old", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ age: 60 }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should skip age check if age is undefined", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ age: undefined }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
    });
  });

  describe("Weight Requirement (Req 2.2, 2.6)", () => {
    it("should reject donors under 50kg", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ weight: 49 }),
        requestedBloodGroup: BloodGroup.A_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("weight_requirement");
    });

    it("should accept donors exactly 50kg", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ weight: 50 }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should accept donors over 50kg", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ weight: 70 }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
    });

    it("should skip weight check if weight is undefined", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ weight: undefined }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
    });
  });

  describe("Cooldown Requirement (Req 2.3, 2.7)", () => {
    it("should reject donors within 90-day cooldown", () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 30); // 30 days ago

      const input: EligibilityCheckInput = {
        donor: createDonor({ lastDonationDate: lastDonation }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("cooldown_requirement");
      expect(result.daysRemaining).toBe(60); // 90 - 30 = 60 days
    });

    it("should accept donors exactly 90 days after last donation", () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 90);

      const input: EligibilityCheckInput = {
        donor: createDonor({ lastDonationDate: lastDonation }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should accept donors more than 90 days after last donation", () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 120); // 4 months ago

      const input: EligibilityCheckInput = {
        donor: createDonor({ lastDonationDate: lastDonation }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
    });

    it("should skip cooldown check if lastDonationDate is null", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ lastDonationDate: null }),
        requestedBloodGroup: BloodGroup.AB_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(true);
    });
  });

  describe("Blood Type Compatibility (Req 2.4, 2.8)", () => {
    describe("A+ recipients", () => {
      it("should accept A+, A-, O+, O- donors", () => {
        const compatibleTypes = [
          BloodGroup.A_POSITIVE,
          BloodGroup.A_NEGATIVE,
          BloodGroup.O_POSITIVE,
          BloodGroup.O_NEGATIVE,
        ];

        compatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.A_POSITIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(true);
        });
      });

      it("should reject B+, B-, AB+, AB- donors", () => {
        const incompatibleTypes = [
          BloodGroup.B_POSITIVE,
          BloodGroup.B_NEGATIVE,
          BloodGroup.AB_POSITIVE,
          BloodGroup.AB_NEGATIVE,
        ];

        incompatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.A_POSITIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(false);
          expect(result.reason).toBe("blood_type_incompatible");
        });
      });
    });

    describe("A- recipients", () => {
      it("should accept only A- and O- donors", () => {
        const compatibleTypes = [BloodGroup.A_NEGATIVE, BloodGroup.O_NEGATIVE];

        compatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.A_NEGATIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(true);
        });
      });
    });

    describe("B+ recipients", () => {
      it("should accept B+, B-, O+, O- donors", () => {
        const compatibleTypes = [
          BloodGroup.B_POSITIVE,
          BloodGroup.B_NEGATIVE,
          BloodGroup.O_POSITIVE,
          BloodGroup.O_NEGATIVE,
        ];

        compatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.B_POSITIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(true);
        });
      });
    });

    describe("B- recipients", () => {
      it("should accept only B- and O- donors", () => {
        const compatibleTypes = [BloodGroup.B_NEGATIVE, BloodGroup.O_NEGATIVE];

        compatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.B_NEGATIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(true);
        });
      });
    });

    describe("AB+ recipients (universal receiver)", () => {
      it("should accept all blood types", () => {
        const allTypes = [
          BloodGroup.A_POSITIVE,
          BloodGroup.A_NEGATIVE,
          BloodGroup.B_POSITIVE,
          BloodGroup.B_NEGATIVE,
          BloodGroup.AB_POSITIVE,
          BloodGroup.AB_NEGATIVE,
          BloodGroup.O_POSITIVE,
          BloodGroup.O_NEGATIVE,
        ];

        allTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.AB_POSITIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(true);
        });
      });
    });

    describe("AB- recipients", () => {
      it("should accept A-, B-, AB-, O- donors", () => {
        const compatibleTypes = [
          BloodGroup.A_NEGATIVE,
          BloodGroup.B_NEGATIVE,
          BloodGroup.AB_NEGATIVE,
          BloodGroup.O_NEGATIVE,
        ];

        compatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.AB_NEGATIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(true);
        });
      });
    });

    describe("O+ recipients", () => {
      it("should accept only O+ and O- donors", () => {
        const compatibleTypes = [BloodGroup.O_POSITIVE, BloodGroup.O_NEGATIVE];

        compatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.O_POSITIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(true);
        });
      });
    });

    describe("O- recipients", () => {
      it("should accept only O- donors (universal donor)", () => {
        const input: EligibilityCheckInput = {
          donor: createDonor({ bloodGroup: BloodGroup.O_NEGATIVE }),
          requestedBloodGroup: BloodGroup.O_NEGATIVE,
        };

        const result = evaluateEligibility(input);
        expect(result.eligible).toBe(true);
      });

      it("should reject all other blood types", () => {
        const incompatibleTypes = [
          BloodGroup.A_POSITIVE,
          BloodGroup.A_NEGATIVE,
          BloodGroup.B_POSITIVE,
          BloodGroup.B_NEGATIVE,
          BloodGroup.AB_POSITIVE,
          BloodGroup.AB_NEGATIVE,
          BloodGroup.O_POSITIVE,
        ];

        incompatibleTypes.forEach((donorType) => {
          const input: EligibilityCheckInput = {
            donor: createDonor({ bloodGroup: donorType }),
            requestedBloodGroup: BloodGroup.O_NEGATIVE,
          };

          const result = evaluateEligibility(input);
          expect(result.eligible).toBe(false);
          expect(result.reason).toBe("blood_type_incompatible");
        });
      });
    });
  });

  describe("Check Order - Multiple Failures", () => {
    it("should return age requirement failure first when both age and weight fail", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ age: 17, weight: 45 }),
        requestedBloodGroup: BloodGroup.A_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("age_requirement");
    });

    it("should return weight requirement failure when age passes but weight fails", () => {
      const input: EligibilityCheckInput = {
        donor: createDonor({ age: 25, weight: 45 }),
        requestedBloodGroup: BloodGroup.A_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("weight_requirement");
    });

    it("should return cooldown failure when age/weight pass but cooldown fails", () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 30);

      const input: EligibilityCheckInput = {
        donor: createDonor({
          age: 25,
          weight: 60,
          lastDonationDate: lastDonation,
        }),
        requestedBloodGroup: BloodGroup.A_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("cooldown_requirement");
    });

    it("should return blood type incompatibility when all other checks pass", () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 120);

      const input: EligibilityCheckInput = {
        donor: createDonor({
          age: 25,
          weight: 60,
          lastDonationDate: lastDonation,
          bloodGroup: BloodGroup.B_POSITIVE,
        }),
        requestedBloodGroup: BloodGroup.A_POSITIVE,
      };

      const result = evaluateEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("blood_type_incompatible");
    });
  });

  describe("calculateCooldownDaysRemaining", () => {
    it("should return correct days remaining when in cooldown", () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 30);

      const daysRemaining = calculateCooldownDaysRemaining(lastDonation);

      expect(daysRemaining).toBe(60); // 90 - 30 = 60
    });

    it("should return 0 when cooldown is complete", () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 120);

      const daysRemaining = calculateCooldownDaysRemaining(lastDonation);

      expect(daysRemaining).toBe(0);
    });

    it("should return 0 when lastDonationDate is null", () => {
      const daysRemaining = calculateCooldownDaysRemaining(null);

      expect(daysRemaining).toBe(0);
    });
  });

  describe("getIneligibilityMessage", () => {
    it("should return correct message for age requirement", () => {
      const message = getIneligibilityMessage("age_requirement");

      expect(message).toContain("18");
      expect(message).toContain("60");
    });

    it("should return correct message for weight requirement", () => {
      const message = getIneligibilityMessage("weight_requirement");

      expect(message).toContain("50");
    });

    it("should return correct message for cooldown with days remaining", () => {
      const message = getIneligibilityMessage("cooldown_requirement", 45);

      expect(message).toContain("45");
      expect(message).toContain("90");
    });

    it("should return correct message for blood type incompatibility", () => {
      const message = getIneligibilityMessage("blood_type_incompatible");

      expect(message).toContain("not compatible");
    });
  });

  describe("Constants", () => {
    it("should export correct eligibility constants", () => {
      expect(ELIGIBILITY_CONSTANTS.MIN_AGE).toBe(18);
      expect(ELIGIBILITY_CONSTANTS.MAX_AGE).toBe(60);
      expect(ELIGIBILITY_CONSTANTS.MIN_WEIGHT_KG).toBe(50);
      expect(ELIGIBILITY_CONSTANTS.COOLDOWN_DAYS).toBe(90);
    });
  });
});
