/**
 * Contact Form Routes (Phase 5g)
 * Handles contact form submission endpoint
 * Requirements: 19.7-19.10
 */

import { Router } from "express";
import { submitContactForm } from "../controllers/contact.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { submitContactFormSchema } from "../validators/contact.validator.js";
import { contactFormRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

/**
 * POST /api/contact
 * Submit contact form to platform admins
 * 
 * Public endpoint (no authentication required)
 * Rate limited to prevent spam (3 requests per 15 minutes per IP)
 * Validates form data against Zod schema
 * Sends email to platform admin address
 * 
 * Requirements:
 * - Req 19.7: Validates name, email, subject, message (min 10 chars)
 * - Req 19.8: Inline validation errors block submission
 * - Req 19.9: Submits to POST /api/contact
 * - Req 19.10: Sends email to platform admin address
 * - Rate limiting: 3 requests per 15 minutes per IP to prevent spam
 * 
 * Request Body:
 * {
 *   name: string (required, max 100 chars)
 *   email: string (required, valid email format, max 255 chars)
 *   subject: string (required, max 200 chars)
 *   message: string (required, min 10 chars, max 2000 chars)
 * }
 * 
 * Success Response (200):
 * {
 *   message: "Message sent successfully. We'll get back to you soon!",
 *   timestamp: "2024-01-15T10:30:00.000Z"
 * }
 * 
 * Error Responses:
 * - 400: Validation error (invalid/missing fields)
 * - 429: Rate limit exceeded (too many requests)
 * - 500: Email delivery failure
 */
router.post(
  "/",
  contactFormRateLimiter, // Apply rate limiting first (3 req/15min)
  validate(submitContactFormSchema), // Validate request body (Req 19.7)
  submitContactForm as any // Type compatibility with Express handler
);

export default router;
