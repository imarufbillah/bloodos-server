import type { Request, Response } from "express";
import {
  getBloodRequestsCollection,
  getUsersCollection,
  getDonationsCollection,
} from "../db/collections.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { RequestStatus } from "../types/shared.js";

// ============================================================================
// GET /api/stats - Public Homepage Statistics
// ============================================================================

export const getPublicStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const requestsCollection = getBloodRequestsCollection();
    const usersCollection = getUsersCollection();
    const donationsCollection = getDonationsCollection();

    // Get current date for time-based queries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel for efficiency
    const [activeRequests, totalDonors, fulfilledRequests, donationsThisMonth] =
      await Promise.all([
        // Active requests (open + in_progress)
        requestsCollection.countDocuments({
          status: { $in: [RequestStatus.OPEN, RequestStatus.IN_PROGRESS] },
        }),

        // Total registered donors (isDonor = true)
        usersCollection.countDocuments({
          isDonor: true,
        }),

        // Fulfilled requests (all time)
        requestsCollection.countDocuments({
          status: RequestStatus.FULFILLED,
        }),

        // Donations this month
        donationsCollection.countDocuments({
          donationDate: { $gte: startOfMonth },
        }),
      ]);

    // Build response
    const stats = {
      activeRequests,
      totalDonors,
      fulfilledRequests,
      donationsThisMonth,
    };

    res.status(200).json(stats);
  },
);
