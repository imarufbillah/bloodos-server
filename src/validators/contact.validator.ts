/**
 * Contact Form Validators
 * Enforces Requirement 19.7 validation rules for contact form submission
 */

import { z } from "zod";

// ============================================================================
// Contact Form Submission Validator (Req 19.7)
// ============================================================================

export const submitContactFormSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must not exceed 100 characters")
      .trim(),

    email: z
      .string()
      .min(1, "Email is required")
      .email("Please provide a valid email address")
      .max(255, "Email must not exceed 255 characters")
      .trim()
      .toLowerCase(),

    subject: z
      .string()
      .min(1, "Subject is required")
      .max(200, "Subject must not exceed 200 characters")
      .trim(),

    // Req 19.7 - Message must be at least 10 characters
    message: z
      .string()
      .min(10, "Message must be at least 10 characters")
      .max(2000, "Message must not exceed 2000 characters")
      .trim(),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SubmitContactFormInput = z.infer<
  typeof submitContactFormSchema
>["body"];
