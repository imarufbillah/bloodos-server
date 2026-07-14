/**
 * Request Validators
 * Enforces Requirement 7 validation rules for blood requests
 */

import { z } from "zod";
import {
  BLOOD_GROUPS,
  DISTRICTS,
  URGENCIES,
  REQUEST_STATUSES,
} from "../types/shared.js";

// ============================================================================
// Bangladesh Phone Number Validation (Req 7.1)
// Format: 01XXXXXXXXX (11 digits starting with 01)
// ============================================================================

const BANGLADESH_PHONE_REGEX = /^01\d{9}$/;

export const phoneSchema = z
  .string()
  .regex(
    BANGLADESH_PHONE_REGEX,
    "Phone must be 11 digits starting with 01 (e.g., 01712345678)"
  );

// ============================================================================
// Create Blood Request Validator (Req 20.3, 20.4)
// ============================================================================

export const createBloodRequestSchema = z.object({
  body: z.object({
    patientName: z
      .string()
      .min(1, "Patient name is required")
      .max(100, "Patient name must not exceed 100 characters")
      .trim(),

    // Req 7.5 - Blood group must be one of 8 valid types
    bloodGroup: z.enum(BLOOD_GROUPS as [string, ...string[]], {
      message: `Blood group must be one of: ${BLOOD_GROUPS.join(", ")}`,
    }),

    // Req 7.3 - Units needed must be 1-10
    unitsNeeded: z
      .number()
      .int("Units needed must be a whole number")
      .min(1, "At least 1 unit is required")
      .max(10, "Maximum 10 units can be requested"),

    hospitalName: z
      .string()
      .min(1, "Hospital name is required")
      .max(200, "Hospital name must not exceed 200 characters")
      .trim(),

    hospitalAddress: z
      .string()
      .min(1, "Hospital address is required")
      .max(500, "Hospital address must not exceed 500 characters")
      .trim(),

    // Req 7.2 - District must be one of 64 Bangladesh districts
    district: z.enum(DISTRICTS as [string, ...string[]], {
      message: "District must be a valid Bangladesh district",
    }),

    urgency: z.enum(URGENCIES as [string, ...string[]], {
      message: `Urgency must be one of: ${URGENCIES.join(", ")}`,
    }),

    // Req 7.4 - neededByDate must be today or in the future (not in the past)
    neededByDate: z
      .string()
      .or(z.date())
      .refine(
        (val) => {
          const date = typeof val === "string" ? new Date(val) : val;
          const today = new Date();
          // Set time to start of day for comparison (ignore time component)
          today.setHours(0, 0, 0, 0);
          const inputDate = new Date(date);
          inputDate.setHours(0, 0, 0, 0);
          return inputDate >= today;
        },
        {
          message: "Needed by date cannot be in the past",
        }
      ),

    // Req 7.1 - Bangladesh phone format
    contactPhone: phoneSchema,

    additionalNotes: z
      .string()
      .max(1000, "Additional notes must not exceed 1000 characters")
      .trim()
      .optional(),
  }),
});

// ============================================================================
// Update Blood Request Validator
// ============================================================================

export const updateBloodRequestSchema = z.object({
  body: z.object({
    patientName: z
      .string()
      .min(1, "Patient name cannot be empty")
      .max(100, "Patient name must not exceed 100 characters")
      .trim()
      .optional(),

    bloodGroup: z
      .enum(BLOOD_GROUPS as [string, ...string[]], {
        message: `Blood group must be one of: ${BLOOD_GROUPS.join(", ")}`,
      })
      .optional(),

    unitsNeeded: z
      .number()
      .int("Units needed must be a whole number")
      .min(1, "At least 1 unit is required")
      .max(10, "Maximum 10 units can be requested")
      .optional(),

    hospitalName: z
      .string()
      .min(1, "Hospital name cannot be empty")
      .max(200, "Hospital name must not exceed 200 characters")
      .trim()
      .optional(),

    hospitalAddress: z
      .string()
      .min(1, "Hospital address cannot be empty")
      .max(500, "Hospital address must not exceed 500 characters")
      .trim()
      .optional(),

    district: z
      .enum(DISTRICTS as [string, ...string[]], {
        message: "District must be a valid Bangladesh district",
      })
      .optional(),

    urgency: z
      .enum(URGENCIES as [string, ...string[]], {
        message: `Urgency must be one of: ${URGENCIES.join(", ")}`,
      })
      .optional(),

    neededByDate: z
      .string()
      .or(z.date())
      .refine(
        (val) => {
          const date = typeof val === "string" ? new Date(val) : val;
          const today = new Date();
          // Set time to start of day for comparison (ignore time component)
          today.setHours(0, 0, 0, 0);
          const inputDate = new Date(date);
          inputDate.setHours(0, 0, 0, 0);
          return inputDate >= today;
        },
        {
          message: "Needed by date cannot be in the past",
        }
      )
      .optional(),

    contactPhone: phoneSchema.optional(),

    additionalNotes: z
      .string()
      .max(1000, "Additional notes must not exceed 1000 characters")
      .trim()
      .optional(),
  }),
});

// ============================================================================
// Update Request Status Validator (Req 3)
// ============================================================================

export const updateRequestStatusSchema = z.object({
  body: z.object({
    status: z.enum(REQUEST_STATUSES as [string, ...string[]], {
      message: `Status must be one of: ${REQUEST_STATUSES.join(", ")}`,
    }),
    reason: z
      .string()
      .max(500, "Reason must not exceed 500 characters")
      .trim()
      .optional(),
  }),
});

// ============================================================================
// List Requests Query Validator (Req 7.8, 7.9, 7.11, 7.12)
// ============================================================================

export const listRequestsQuerySchema = z.object({
  query: z.object({
    // Filter by blood group
    bloodGroup: z
      .enum(BLOOD_GROUPS as [string, ...string[]])
      .optional()
      .catch(undefined), // Req 7.12 - ignore unrecognized params

    // Filter by district
    district: z
      .enum(DISTRICTS as [string, ...string[]])
      .optional()
      .catch(undefined),

    // Filter by urgency
    urgency: z
      .enum(URGENCIES as [string, ...string[]])
      .optional()
      .catch(undefined),

    // Filter by status
    status: z
      .enum(REQUEST_STATUSES as [string, ...string[]])
      .optional()
      .catch(undefined),

    // Req 7.11 - Search across multiple fields
    search: z.string().max(200).trim().optional().catch(undefined),

    // Sort options
    sort: z
      .enum(["newest", "oldest", "most_urgent", "critical_first"])
      .optional()
      .catch("newest"), // Default to newest

    // Req 7.8 - Page defaults to 1
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1))
      .catch(1),

    // Req 7.9 - Limit must not exceed 100, default 20
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(
        z
          .number()
          .int()
          .min(1)
          .max(100, "Limit cannot exceed 100") // Req 7.9
      )
      .catch(20),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateBloodRequestInput = z.infer<
  typeof createBloodRequestSchema
>["body"];
export type UpdateBloodRequestInput = z.infer<
  typeof updateBloodRequestSchema
>["body"];
export type UpdateRequestStatusInput = z.infer<
  typeof updateRequestStatusSchema
>["body"];
export type ListRequestsQuery = z.infer<
  typeof listRequestsQuerySchema
>["query"];
