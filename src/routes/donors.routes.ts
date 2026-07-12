/**
 * Donors Routes (Phase 5c)
 * Handles donor directory and contact request endpoints
 */

import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { listDonors, requestContact } from "../controllers/donors.controller.js";

const router = Router();

/**
 * GET /api/donors
 * List all registered donors with optional filtering
 * 
 * Public endpoint (optional auth for future personalization)
 * Query: bloodGroup, district, page, limit
 * 
 * Requirements:
 * - Req 17.3: Endpoint exists
 * - Req 17.4: Only isDonor:true users returned
 * - Req 17.5: Phone numbers masked in list view
 */
router.get(
  "/",
  optionalAuth, // Public but can use auth for future features
  listDonors as any // Type compatibility with Express handler
);

/**
 * POST /api/donors/:id/request-contact
 * Request full contact information for a specific donor
 * 
 * Authentication required
 * Creates audit log entry before revealing info
 * Notifies donor that contact was requested
 * 
 * Requirements:
 * - Req 4.5: Creates ContactAuditLog entry
 * - Req 4.6: Atomic - audit log must succeed before reveal
 * - Req 4.7: Returns unmasked contact info after audit
 * - Req 9.9: Notifies donor via contact_info_requested notification
 */
router.post(
  "/:id/request-contact",
  requireAuth, // Must be authenticated
  requestContact as any // Type compatibility with Express handler
);

export default router;
