/**
 * Users Controller (Phase 5h)
 * Implements user profile, donation history, and response history endpoints
 * Requirements: Req 13.5 (profile update), Req 13.8-13.9 (donations), Req 13.10 (responses)
 * Inferred: POST /api/donations (plan §0.A), GET /api/users/me/responses (plan §0.E)
 */

import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
  getUsersCollection,
  getDonationsCollection,
  getResponsesCollection,
  getBloodRequestsCollection,
} from "../db/collections.js";
import type { User } from "../types/models/UserExtension.js";
import type { Donation } from "../types/models/Donation.js";
import type { Response as DonorResponse } from "../types/models/Response.js";
import type { BloodRequest } from "../types/models/BloodRequest.js";
import {
  createNotFoundError,
  createValidationError,
  HTTP_STATUS,
} from "../middleware/error.middleware.js";
import { buildPaginatedResponse, calculateSkip } from "../utils/pagination.js";
import { CacheService, CacheKeys } from "../services/cache.service.js";
import type { UpdateProfileInput } from "../validators/user.validator.js";
import type { CreateDonationInput } from "../validators/user.validator.js";
import type { GetDonationsQuery, GetResponsesQuery } from "../validators/user.validator.js";
import type {
  UserDto,
  UserDonationHistoryDto,
  UserResponseHistoryDto,
} from "../types/dto/user.dto.ts";
import type { PaginatedResponse } from "../types/shared.js";

// Extend Express Request type to include validated data
declare module "express" {
  interface Request {
    sessionUser?: User;
  }
}

// ============================================================================
// Get Current User Profile (GET /api/users/me)
// ============================================================================

/**
 * Get authenticated user's profile (Req 13.2-13.3)
 * - Returns all personal information fields
 * - Auth required
 */
export async function getCurrentUser(
  req: Request,
  res: Response
): Promise<void> {
  const sessionUser = req.sessionUser!;

  // Fetch fresh user data from database
  const collection = getUsersCollection();
  const user = await collection.findOne({ _id: new ObjectId(sessionUser.id) });

  if (!user) {
    throw createNotFoundError("User not found");
  }

  // Map to DTO (Req 13.3)
  const userDto: UserDto = {
    _id: user._id.toString(),
    name: user.name || "",
    email: user.email,
    phone: user.phone,
    district: user.district,
    bloodGroup: user.bloodGroup,
    role: user.role,
    isDonor: user.isDonor,
    lastDonationDate: user.lastDonationDate
      ? user.lastDonationDate.toISOString()
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  res.status(HTTP_STATUS.OK).json(userDto);
}

// ============================================================================
// Update User Profile (PATCH /api/users/me)
// ============================================================================

/**
 * Update authenticated user's profile (Req 13.4-13.5)
 * - Allows updating whitelisted personal info fields only
 * - NEVER allows updating role (enforced by validator)
 * - Auth required
 */
export async function updateUserProfile(
  req: Request<{}, {}, UpdateProfileInput>,
  res: Response
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const updates = req.body;

  const collection = getUsersCollection();

  // Build update document with only provided fields
  const updateDoc: Record<string, any> = {
    updatedAt: new Date(),
  };

  // Only add fields that are actually present in the updates object
  if (updates.name !== undefined) updateDoc.name = updates.name;
  if (updates.phone !== undefined) updateDoc.phone = updates.phone;
  if (updates.district !== undefined) updateDoc.district = updates.district;
  if (updates.bloodGroup !== undefined) updateDoc.bloodGroup = updates.bloodGroup;
  if (updates.isDonor !== undefined) updateDoc.isDonor = updates.isDonor;
  if (updates.lastDonationDate !== undefined) updateDoc.lastDonationDate = updates.lastDonationDate;

  // Update user
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(sessionUser.id) },
    { $set: updateDoc },
    { returnDocument: "after" }
  );

  if (!result) {
    throw createNotFoundError("User not found");
  }

  // Invalidate user-specific caches
  await CacheService.invalidateMultiple([
    CacheKeys.endpointPattern(`/api/users/me:user:${sessionUser.id}`),
    CacheKeys.endpointPattern('/api/donors'), // If donor status changed
  ]);

  // Map to DTO
  const userDto: UserDto = {
    _id: result._id.toString(),
    name: result.name || "",
    email: result.email,
    phone: result.phone,
    district: result.district,
    bloodGroup: result.bloodGroup,
    role: result.role,
    isDonor: result.isDonor,
    lastDonationDate: result.lastDonationDate
      ? result.lastDonationDate.toISOString()
      : null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };

  res.status(HTTP_STATUS.OK).json(userDto);
}

// ============================================================================
// Get User Donation History (GET /api/users/me/donations)
// ============================================================================

/**
 * Get authenticated user's donation history (Req 13.8-13.9)
 * - Returns paginated list of donations (paginated if >10 per Req 13.9)
 * - Sorted by donation date descending (reverse chronological per Req 13.8)
 * - Shows verified status (Req 13.9)
 * - Auth required
 */
export async function getUserDonations(
  req: Request<{}, {}, {}, GetDonationsQuery>,
  res: Response
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { page, limit } = req.query;

  const collection = getDonationsCollection();

  // Count total donations
  const totalCount = await collection.countDocuments({
    userId: new ObjectId(sessionUser.id),
  });

  // Fetch paginated donations sorted by date descending (Req 13.8)
  const donations = await collection
    .find({ userId: new ObjectId(sessionUser.id) })
    .sort({ donationDate: -1 }) // Reverse chronological
    .skip(calculateSkip(page, limit))
    .limit(limit)
    .toArray();

  // Map to DTOs
  const donationDtos: UserDonationHistoryDto[] = donations.map((donation) => ({
    _id: donation._id.toString(),
    donationDate: donation.donationDate.toISOString(),
    bloodGroup: donation.bloodGroup,
    hospitalName: donation.hospitalName,
    district: donation.district,
    verified: donation.verified,
    verifiedBy: donation.verifiedBy ? donation.verifiedBy.toString() : null,
    verifiedAt: donation.verifiedAt ? donation.verifiedAt.toISOString() : null,
    createdAt: donation.createdAt.toISOString(),
  }));

  // Build paginated response (Req 13.9)
  const paginatedResponse: PaginatedResponse<UserDonationHistoryDto> =
    buildPaginatedResponse(donationDtos, page, limit, totalCount);

  res.status(HTTP_STATUS.OK).json(paginatedResponse);
}

// ============================================================================
// Create Donation (POST /api/donations)
// ============================================================================

/**
 * Self-report a blood donation (inferred from plan §0.A)
 * - Donor reports their own donation
 * - Creates unverified donation record
 * - Updates user's lastDonationDate
 * - Auth required
 */
export async function createDonation(
  req: Request<{}, {}, CreateDonationInput>,
  res: Response
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const body = req.body;

  const now = new Date();

  // Build donation document
  const donation: Omit<Donation, "_id"> = {
    userId: new ObjectId(sessionUser.id),
    donationDate: new Date(body.donationDate),
    bloodGroup: body.bloodGroup,
    hospitalName: body.hospitalName,
    district: body.district,
    verified: false, // Default: unverified
    verifiedBy: null,
    verifiedAt: null,
    createdAt: now,
  };

  const collection = getDonationsCollection();
  const result = await collection.insertOne(donation as Donation);

  const created: Donation = {
    _id: result.insertedId,
    ...donation,
  } as Donation;

  // Update user's lastDonationDate if this is their most recent donation
  const userCollection = getUsersCollection();
  const user = await userCollection.findOne({
    _id: new ObjectId(sessionUser.id),
  });

  if (
    user &&
    (!user.lastDonationDate ||
      new Date(body.donationDate) > user.lastDonationDate)
  ) {
    await userCollection.updateOne(
      { _id: new ObjectId(sessionUser.id) },
      {
        $set: {
          lastDonationDate: new Date(body.donationDate),
          updatedAt: now,
        },
      }
    );
  }

  // Invalidate user-specific caches
  await CacheService.invalidateMultiple([
    CacheKeys.endpointPattern(`/api/users/me/donations:user:${sessionUser.id}`),
    CacheKeys.endpointPattern(`/api/users/me/analytics:user:${sessionUser.id}`),
  ]);

  // Map to DTO
  const donationDto: UserDonationHistoryDto = {
    _id: created._id.toString(),
    donationDate: created.donationDate.toISOString(),
    bloodGroup: created.bloodGroup,
    hospitalName: created.hospitalName,
    district: created.district,
    verified: created.verified,
    verifiedBy: created.verifiedBy ? created.verifiedBy.toString() : null,
    verifiedAt: created.verifiedAt ? created.verifiedAt.toISOString() : null,
    createdAt: created.createdAt.toISOString(),
  };

  res.status(HTTP_STATUS.CREATED).json(donationDto);
}

// ============================================================================
// Get User Analytics (GET /api/users/me/analytics)
// ============================================================================

/**
 * Get comprehensive user analytics and statistics
 * - Uses single aggregation query for optimal performance
 * - Returns requests created, responses given, donations, fulfillment rates
 * - Auth required
 */
export async function getUserAnalytics(
  req: Request,
  res: Response
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const userId = new ObjectId(sessionUser.id);

  try {
    const requestsCollection = getBloodRequestsCollection();
    const responsesCollection = getResponsesCollection();
    const donationsCollection = getDonationsCollection();

    // Single aggregation query for comprehensive stats
    const analyticsResult = await requestsCollection.aggregate([
      {
        $facet: {
          // Requests created by user with status breakdown
          requestsCreated: [
            { $match: { userId } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          
          // Total requests count
          totalRequests: [
            { $match: { userId } },
            { $count: 'total' }
          ],
          
          // Responses received on user's requests
          responsesReceived: [
            { $match: { userId } },
            {
              $lookup: {
                from: 'responses',
                localField: '_id',
                foreignField: 'requestId',
                as: 'responses'
              }
            },
            { $unwind: { path: '$responses', preserveNullAndEmptyArrays: false } },
            { $count: 'total' }
          ],
          
          // Activity timeline (last 6 months)
          activityTimeline: [
            {
              $match: {
                userId,
                createdAt: {
                  $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
                }
              }
            },
            {
              $group: {
                _id: {
                  month: { $month: '$createdAt' },
                  year: { $year: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            {
              $project: {
                month: '$_id.month',
                year: '$_id.year',
                count: 1,
                _id: 0
              }
            }
          ]
        }
      }
    ]).toArray();

    // Get responses given by user as donor with separate aggregation
    const responsesGivenResult = await responsesCollection.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Get total responses given
    const totalResponsesGiven = await responsesCollection.countDocuments({ userId });

    // Get verified donations count
    const verifiedDonations = await donationsCollection.countDocuments({
      userId,
      verified: true
    });

    // Get total donations count
    const totalDonations = await donationsCollection.countDocuments({ userId });

    // Process the results
    const analytics = analyticsResult[0];
    if (!analytics) {
      throw new Error('Failed to fetch analytics');
    }
    
    // Calculate request status breakdown
    const requestsByStatus: Record<string, number> = {};
    analytics.requestsCreated.forEach((item: any) => {
      requestsByStatus[item._id] = item.count;
    });

    // Calculate responses given by status
    const responsesByStatus: Record<string, number> = {};
    responsesGivenResult.forEach((item: any) => {
      responsesByStatus[item._id] = item.count;
    });

    // Calculate fulfillment rate
    const totalRequestsCount = analytics.totalRequests[0]?.total || 0;
    const fulfilledCount = requestsByStatus['fulfilled'] || 0;
    const fulfillmentRate = totalRequestsCount > 0
      ? Math.round((fulfilledCount / totalRequestsCount) * 100)
      : 0;

    // Calculate success rate for responses
    const completedResponses = responsesByStatus['completed'] || 0;
    const responseSuccessRate = totalResponsesGiven > 0
      ? Math.round((completedResponses / totalResponsesGiven) * 100)
      : 0;

    const responsesReceivedCount = analytics.responsesReceived[0]?.total || 0;

    res.status(HTTP_STATUS.OK).json({
      // Request statistics
      totalRequests: totalRequestsCount,
      requestsByStatus,
      fulfillmentRate,
      responsesReceived: responsesReceivedCount,

      // Response statistics (as donor)
      totalResponses: totalResponsesGiven,
      responsesByStatus,
      responseSuccessRate,

      // Donation statistics
      totalDonations,
      verifiedDonations,
      livesSaved: verifiedDonations, // Verified donations = lives saved

      // Timeline data
      activityTimeline: analytics.activityTimeline,

      // Impact summary
      impact: {
        requestsCreated: totalRequestsCount,
        requestsFulfilled: fulfilledCount,
        responsesGiven: totalResponsesGiven,
        donationsCompleted: completedResponses,
        livesSaved: verifiedDonations
      }
    });
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    throw error;
  }
}

// ============================================================================
// Get User Response History (GET /api/users/me/responses)
// ============================================================================

/**
 * Get authenticated user's response history (inferred from plan §0.E)
 * - Returns paginated list of user's responses to blood requests
 * - Includes parent request summary for context
 * - Auth required
 */
export async function getUserResponses(
  req: Request<{}, {}, {}, GetResponsesQuery>,
  res: Response
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { page, limit } = req.query;

  const responsesCollection = getResponsesCollection();

  // Count total responses
  const totalCount = await responsesCollection.countDocuments({
    userId: new ObjectId(sessionUser.id),
  });

  // Fetch paginated responses sorted by date descending
  const responses = await responsesCollection
    .find({ userId: new ObjectId(sessionUser.id) })
    .sort({ createdAt: -1 }) // Most recent first
    .skip(calculateSkip(page, limit))
    .limit(limit)
    .toArray();

  // Fetch related request data for each response
  const requestIds = responses.map((r) => r.requestId);
  const requestsCollection = getBloodRequestsCollection();
  const requests = await requestsCollection
    .find({ _id: { $in: requestIds } })
    .toArray();

  // Create a map for quick lookup
  const requestsMap = new Map<string, BloodRequest>();
  requests.forEach((req) => {
    requestsMap.set(req._id.toString(), req);
  });

  // Map to DTOs with request context
  const responseDtos: UserResponseHistoryDto[] = responses.map((response) => {
    const request = requestsMap.get(response.requestId.toString());

    const dto: UserResponseHistoryDto = {
      _id: response._id.toString(),
      requestId: response.requestId.toString(),
      status: response.status,
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
      // Parent request summary (enough context to render without second round-trip)
      request: request
        ? {
            _id: request._id.toString(),
            patientName: request.patientName,
            bloodGroup: request.bloodGroup,
            hospitalName: request.hospitalName,
            district: request.district,
            urgency: request.urgency,
            status: request.status,
            neededByDate: request.neededByDate.toISOString(),
          }
        : {
            // Fallback if request was deleted
            _id: response.requestId.toString(),
            patientName: "Unknown",
            bloodGroup: "Unknown",
            hospitalName: "Unknown",
            district: "Unknown",
            urgency: "moderate",
            status: "cancelled",
            neededByDate: new Date().toISOString(),
          },
    };

    // Only add message if it exists (exactOptionalPropertyTypes compliance)
    if (response.message) {
      dto.message = response.message;
    }

    return dto;
  });

  // Build paginated response
  const paginatedResponse: PaginatedResponse<UserResponseHistoryDto> =
    buildPaginatedResponse(responseDtos, page, limit, totalCount);

  res.status(HTTP_STATUS.OK).json(paginatedResponse);
}
