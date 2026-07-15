/**
 * Public Stats Routes
 *
 * Provides public statistics endpoints
 * No authentication required
 *
 * Endpoints:
 * - GET /api/stats - Public homepage statistics
 */

import { Router } from "express";
import { getPublicStats } from "../controllers/stats.controller.js";

const router = Router();

/**
 * GET /api/stats
 * Get public statistics for homepage display
 *
 * Returns:
 * - activeRequests: Count of open + in_progress requests
 * - totalDonors: Count of registered donors
 * - fulfilledRequests: Count of all-time fulfilled requests
 * - donationsThisMonth: Count of donations this month
 *
 * @access Public - no authentication required
 */
router.get("/", getPublicStats);

export default router;
