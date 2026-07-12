/**
 * Donations Routes (Phase 5h)
 * API routes for donation creation
 * Requirements: Inferred from plan §0.A
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createDonationSchema } from "../validators/user.validator.js";
import { createDonation } from "../controllers/users.controller.js";

const router = Router();

// ============================================================================
// Donation Creation Route
// ============================================================================

/**
 * POST /api/donations
 * Self-report a blood donation (inferred from plan §0.A)
 * - Auth required
 * - Donor reports their own donation
 * - Creates unverified donation record
 * - Updates user's lastDonationDate
 */
router.post("/", requireAuth, validate(createDonationSchema), createDonation);

// ============================================================================
// Export Router
// ============================================================================

export default router;
