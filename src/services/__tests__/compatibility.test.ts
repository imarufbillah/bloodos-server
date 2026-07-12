/**
 * Tests for Blood Compatibility Utilities
 * Validates the blood compatibility matrix (Req 2.4)
 */

import { describe, it, expect } from "vitest";
import {
  isBloodTypeCompatible,
  getCompatibleDonors,
  getCompatibleRecipients,
} from "../compatibility.js";
import { BloodGroup } from "../../types/shared.js";

describe("Blood Compatibility Utilities", () => {
  describe("isBloodTypeCompatible", () => {
    describe("A+ recipients", () => {
      it("should accept compatible donors", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.A_POSITIVE, BloodGroup.A_POSITIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.A_NEGATIVE, BloodGroup.A_POSITIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_POSITIVE, BloodGroup.A_POSITIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_NEGATIVE, BloodGroup.A_POSITIVE)
        ).toBe(true);
      });

      it("should reject incompatible donors", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.B_POSITIVE, BloodGroup.A_POSITIVE)
        ).toBe(false);
        expect(
          isBloodTypeCompatible(BloodGroup.B_NEGATIVE, BloodGroup.A_POSITIVE)
        ).toBe(false);
        expect(
          isBloodTypeCompatible(BloodGroup.AB_POSITIVE, BloodGroup.A_POSITIVE)
        ).toBe(false);
        expect(
          isBloodTypeCompatible(BloodGroup.AB_NEGATIVE, BloodGroup.A_POSITIVE)
        ).toBe(false);
      });
    });

    describe("A- recipients", () => {
      it("should accept only A- and O-", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.A_NEGATIVE, BloodGroup.A_NEGATIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_NEGATIVE, BloodGroup.A_NEGATIVE)
        ).toBe(true);
      });

      it("should reject all positive blood types", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.A_POSITIVE, BloodGroup.A_NEGATIVE)
        ).toBe(false);
        expect(
          isBloodTypeCompatible(BloodGroup.O_POSITIVE, BloodGroup.A_NEGATIVE)
        ).toBe(false);
      });
    });

    describe("B+ recipients", () => {
      it("should accept compatible donors", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.B_POSITIVE, BloodGroup.B_POSITIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.B_NEGATIVE, BloodGroup.B_POSITIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_POSITIVE, BloodGroup.B_POSITIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_NEGATIVE, BloodGroup.B_POSITIVE)
        ).toBe(true);
      });
    });

    describe("B- recipients", () => {
      it("should accept only B- and O-", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.B_NEGATIVE, BloodGroup.B_NEGATIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_NEGATIVE, BloodGroup.B_NEGATIVE)
        ).toBe(true);
      });
    });

    describe("AB+ recipients (universal receiver)", () => {
      it("should accept all blood types", () => {
        const allBloodGroups = [
          BloodGroup.A_POSITIVE,
          BloodGroup.A_NEGATIVE,
          BloodGroup.B_POSITIVE,
          BloodGroup.B_NEGATIVE,
          BloodGroup.AB_POSITIVE,
          BloodGroup.AB_NEGATIVE,
          BloodGroup.O_POSITIVE,
          BloodGroup.O_NEGATIVE,
        ];

        allBloodGroups.forEach((donorType) => {
          expect(isBloodTypeCompatible(donorType, BloodGroup.AB_POSITIVE)).toBe(
            true
          );
        });
      });
    });

    describe("AB- recipients", () => {
      it("should accept all negative blood types", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.A_NEGATIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.B_NEGATIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.AB_NEGATIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_NEGATIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(true);
      });

      it("should reject all positive blood types", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.A_POSITIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(false);
        expect(
          isBloodTypeCompatible(BloodGroup.B_POSITIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(false);
        expect(
          isBloodTypeCompatible(BloodGroup.AB_POSITIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(false);
        expect(
          isBloodTypeCompatible(BloodGroup.O_POSITIVE, BloodGroup.AB_NEGATIVE)
        ).toBe(false);
      });
    });

    describe("O+ recipients", () => {
      it("should accept only O+ and O-", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.O_POSITIVE, BloodGroup.O_POSITIVE)
        ).toBe(true);
        expect(
          isBloodTypeCompatible(BloodGroup.O_NEGATIVE, BloodGroup.O_POSITIVE)
        ).toBe(true);
      });
    });

    describe("O- recipients", () => {
      it("should accept only O- (most restrictive)", () => {
        expect(
          isBloodTypeCompatible(BloodGroup.O_NEGATIVE, BloodGroup.O_NEGATIVE)
        ).toBe(true);
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
          expect(isBloodTypeCompatible(donorType, BloodGroup.O_NEGATIVE)).toBe(
            false
          );
        });
      });
    });
  });

  describe("getCompatibleDonors", () => {
    it("should return correct compatible donors for A+", () => {
      const compatible = getCompatibleDonors(BloodGroup.A_POSITIVE);
      expect(compatible).toHaveLength(4);
      expect(compatible).toContain(BloodGroup.A_POSITIVE);
      expect(compatible).toContain(BloodGroup.A_NEGATIVE);
      expect(compatible).toContain(BloodGroup.O_POSITIVE);
      expect(compatible).toContain(BloodGroup.O_NEGATIVE);
    });

    it("should return correct compatible donors for A-", () => {
      const compatible = getCompatibleDonors(BloodGroup.A_NEGATIVE);
      expect(compatible).toHaveLength(2);
      expect(compatible).toContain(BloodGroup.A_NEGATIVE);
      expect(compatible).toContain(BloodGroup.O_NEGATIVE);
    });

    it("should return all blood types for AB+ (universal receiver)", () => {
      const compatible = getCompatibleDonors(BloodGroup.AB_POSITIVE);
      expect(compatible).toHaveLength(8);
    });

    it("should return only O- for O- recipient", () => {
      const compatible = getCompatibleDonors(BloodGroup.O_NEGATIVE);
      expect(compatible).toHaveLength(1);
      expect(compatible).toContain(BloodGroup.O_NEGATIVE);
    });
  });

  describe("getCompatibleRecipients", () => {
    it("should return all blood types for O- donor (universal donor)", () => {
      const recipients = getCompatibleRecipients(BloodGroup.O_NEGATIVE);
      expect(recipients).toHaveLength(8);
      expect(recipients).toContain(BloodGroup.A_POSITIVE);
      expect(recipients).toContain(BloodGroup.A_NEGATIVE);
      expect(recipients).toContain(BloodGroup.B_POSITIVE);
      expect(recipients).toContain(BloodGroup.B_NEGATIVE);
      expect(recipients).toContain(BloodGroup.AB_POSITIVE);
      expect(recipients).toContain(BloodGroup.AB_NEGATIVE);
      expect(recipients).toContain(BloodGroup.O_POSITIVE);
      expect(recipients).toContain(BloodGroup.O_NEGATIVE);
    });

    it("should return limited recipients for AB+ donor", () => {
      const recipients = getCompatibleRecipients(BloodGroup.AB_POSITIVE);
      expect(recipients).toHaveLength(1);
      expect(recipients).toContain(BloodGroup.AB_POSITIVE);
      // AB+ can only donate to AB+ (most restrictive as donor)
    });

    it("should return correct recipients for A+ donor", () => {
      const recipients = getCompatibleRecipients(BloodGroup.A_POSITIVE);
      expect(recipients).toContain(BloodGroup.A_POSITIVE);
      expect(recipients).toContain(BloodGroup.AB_POSITIVE);
    });

    it("should return correct recipients for O+ donor", () => {
      const recipients = getCompatibleRecipients(BloodGroup.O_POSITIVE);
      expect(recipients).toContain(BloodGroup.O_POSITIVE);
      expect(recipients).toContain(BloodGroup.A_POSITIVE);
      expect(recipients).toContain(BloodGroup.B_POSITIVE);
      expect(recipients).toContain(BloodGroup.AB_POSITIVE);
    });
  });
});
