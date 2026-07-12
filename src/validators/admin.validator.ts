/**
 * Admin Validators
 * Validation schemas for admin user management operations (Phase 5f)
 */

import { z } from "zod";
import { USER_ROLES } from "../types/shared.js";

// ============================================================================
// Ban User Validator (Req 10.5)
// ============================================================================

export const banUserSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(1, "Ban reason is required")
      .max(500, "Ban reason must not exceed 500 characters")
      .trim(),
  }),
});

// ============================================================================
// Unban User Validator (Req 10.6)
// ============================================================================

export const unbanUserSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .max(500, "Unban reason must not exceed 500 characters")
      .trim()
      .optional(),
  }),
});

// ============================================================================
// Change User Role Validator (Req 1.10)
// ============================================================================

export const changeUserRoleSchema = z.object({
  body: z.object({
    role: z.enum(USER_ROLES as [string, ...string[]], {
      message: `Role must be one of: ${USER_ROLES.join(", ")}`,
    }),
  }),
});

// ============================================================================
// Approve Request Validator (Inferred)
// ============================================================================

export const approveRequestSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .max(500, "Approval reason must not exceed 500 characters")
      .trim()
      .optional(),
  }),
});

// ============================================================================
// Reject Request Validator (Inferred)
// ============================================================================

export const rejectRequestSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(1, "Rejection reason is required")
      .max(500, "Rejection reason must not exceed 500 characters")
      .trim(),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type BanUserInput = z.infer<typeof banUserSchema>["body"];
export type UnbanUserInput = z.infer<typeof unbanUserSchema>["body"];
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>["body"];
export type ApproveRequestInput = z.infer<typeof approveRequestSchema>["body"];
export type RejectRequestInput = z.infer<typeof rejectRequestSchema>["body"];
