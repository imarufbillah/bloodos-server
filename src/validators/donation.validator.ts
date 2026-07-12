/**
 * Donation Validators (Phase 5h)
 * Zod schemas for admin donation verification
 * Requirements: Req 10.4 (verify_donation action), inferred from plan §0.A
 */

import { z } from "zod";

// ============================================================================
// Admin Donation Verification Validator
// ============================================================================

/**
 * Schema for PATCH /api/admin/donations/:id/verify
 * Admin verifies a self-reported donation
 * Logs to Admin_Action_Log (Req 10.4)
 */
export const verifyDonationSchema = z.object({
  body: z
    .object({
      reason: z
        .string()
        .min(1, "Verification reason is required")
        .max(500, "Reason must not exceed 500 characters")
        .optional(),
    })
    .strict()
    .optional()
    .default({}),

  params: z.object({
    id: z
      .string()
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Invalid donation ID format. Must be a valid MongoDB ObjectId."
      ),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type VerifyDonationInput = z.infer<typeof verifyDonationSchema>["body"];
export type VerifyDonationParams = z.infer<
  typeof verifyDonationSchema
>["params"];
