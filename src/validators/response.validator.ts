/**
 * Response Validators (Phase 5b)
 * Validates response creation and updates
 * Requirements: 6.1-6.11
 */

import { z } from "zod";
import { RESPONSE_STATUSES } from "../types/shared.js";

// ============================================================================
// Create Response Validator (Req 6.1-6.3)
// ============================================================================

export const createResponseSchema = z.object({
  body: z.object({
    message: z
      .string()
      .max(500, "Message must not exceed 500 characters")
      .trim()
      .optional(),
  }),
});

// ============================================================================
// Update Response Status Validator (Req 6.7)
// ============================================================================

export const updateResponseStatusSchema = z.object({
  body: z.object({
    status: z.enum(["accepted", "declined", "completed"] as const, {
      message: "Status must be one of: accepted, declined, completed",
    }),
    message: z
      .string()
      .max(500, "Message must not exceed 500 characters")
      .trim()
      .optional(),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateResponseInput = z.infer<typeof createResponseSchema>["body"];
export type UpdateResponseStatusInput = z.infer<
  typeof updateResponseStatusSchema
>["body"];
