/**
 * User Validators (Phase 5h)
 * Zod schemas for user profile and donation endpoints
 * Requirements: Req 13.5 (profile update), inferred donation creation
 */

import { z } from "zod";
import {
  BLOOD_GROUPS,
  DISTRICTS,
  BloodGroup,
  District,
} from "../types/shared.js";

// ============================================================================
// Profile Update Validator (Req 13.5)
// ============================================================================

/**
 * Schema for PATCH /api/users/me
 * Only allows updating whitelisted personal info fields
 * NEVER allows updating role (Req 13.5 requirement)
 */
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(1, "Name must not be empty")
        .max(100, "Name must not exceed 100 characters")
        .optional(),

      phone: z
        .string()
        .regex(
          /^01[3-9]\d{8}$/,
          "Phone must be valid Bangladesh format (01XXXXXXXXX)",
        )
        .optional(),

      district: z
        .enum(DISTRICTS as [District, ...District[]], {
          message: `District must be one of the 64 Bangladesh districts`,
        })
        .optional(),

      bloodGroup: z
        .enum(BLOOD_GROUPS as [BloodGroup, ...BloodGroup[]], {
          message: "Invalid blood group",
        })
        .optional(),

      isDonor: z.boolean().optional(),

      lastDonationDate: z
        .string()
        .datetime({ message: "Invalid date format. Use ISO 8601 format." })
        .transform((str) => new Date(str))
        .refine((date) => date <= new Date(), {
          message: "Last donation date cannot be in the future",
        })
        .nullable()
        .optional(),
    })
    .strict() // Reject any fields not defined above (including 'role')
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

// ============================================================================
// Donation Creation Validator (inferred - plan §0.A)
// ============================================================================

/**
 * Schema for POST /api/donations
 * Donor self-reports a blood donation
 * Creates unverified donation record
 */
export const createDonationSchema = z.object({
  body: z
    .object({
      donationDate: z
        .string()
        .datetime({ message: "Invalid date format. Use ISO 8601 format." })
        .transform((str) => new Date(str))
        .refine((date) => date <= new Date(), {
          message: "Donation date cannot be in the future",
        }),

      bloodGroup: z.enum(BLOOD_GROUPS as [BloodGroup, ...BloodGroup[]], {
        message: "Invalid blood group",
      }),

      hospitalName: z
        .string()
        .min(1, "Hospital name is required")
        .max(200, "Hospital name must not exceed 200 characters"),

      district: z.enum(DISTRICTS as [District, ...District[]], {
        message: `District must be one of the 64 Bangladesh districts`,
      }),
    })
    .strict(),
});

// ============================================================================
// Query Validators
// ============================================================================

/**
 * Schema for GET /api/users/me/donations query params
 * Supports pagination
 */
export const getDonationsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a positive integer")
      .optional()
      .default("1")
      .transform(Number)
      .refine((n) => n > 0, "Page must be greater than 0"),

    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive integer")
      .optional()
      .default("10")
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, "Limit must be between 1 and 100"),
  }),
});

/**
 * Schema for GET /api/users/me/responses query params
 * Supports pagination
 */
export const getResponsesQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a positive integer")
      .optional()
      .default("1")
      .transform(Number)
      .refine((n) => n > 0, "Page must be greater than 0"),

    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive integer")
      .optional()
      .default("20")
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, "Limit must be between 1 and 100"),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
export type CreateDonationInput = z.infer<typeof createDonationSchema>["body"];
export type GetDonationsQuery = z.infer<
  typeof getDonationsQuerySchema
>["query"];
export type GetResponsesQuery = z.infer<
  typeof getResponsesQuerySchema
>["query"];
