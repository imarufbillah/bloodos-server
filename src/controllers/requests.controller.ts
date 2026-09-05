import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
  getBloodRequestsCollection,
  getResponsesCollection,
} from "../db/collections.js";
import type { BloodRequest } from "../types/models/BloodRequest.js";
import type { User } from "../types/models/UserExtension.js";
import {
  createNotFoundError,
  createValidationError,
  createForbiddenError,
  HTTP_STATUS,
} from "../middleware/error.middleware.js";
import { requestStateMachine } from "../services/requestStateMachine.service.js";
import {
  logAdminAction,
  extractChangedFields,
} from "../services/adminActionLog.service.js";
import {
  notifyNewMatchingRequest,
  notifyRequestStatusChange,
} from "../services/notification.service.js";
import { maskPhone, shouldMaskPhone } from "../utils/maskPhone.js";
import { buildPaginatedResponse, calculateSkip } from "../utils/pagination.js";
import { CacheService, CacheKeys } from "../services/cache.service.js";
import { logger } from "../utils/logger.js";
import type {
  CreateBloodRequestInput,
  UpdateBloodRequestInput,
  UpdateRequestStatusInput,
  ListRequestsQuery,
} from "../validators/request.validator.js";
import type {
  CreateResponseInput,
  UpdateResponseStatusInput,
} from "../validators/response.validator.js";
import { RequestStatus, Urgency, ResponseStatus } from "../types/shared.js";
import {
  evaluateEligibility,
  getIneligibilityMessage,
} from "../services/eligibility.service.js";
import {
  notifyNewResponse,
  notifyResponseStatusChange,
} from "../services/notification.service.js";
import type { Response as DonorResponse } from "../types/models/Response.js";
import type { BloodGroup } from "../types/shared.js";

// Extend Express Request type to include validated data
declare module "express" {
  interface Request {
    sessionUser?: User;
  }
}

// ============================================================================
// Create Blood Request (POST /api/requests)
// ============================================================================

export async function createBloodRequest(
  req: Request<{}, {}, CreateBloodRequestInput>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const body = req.body;

  // Build the blood request document (Req 20.6-20.8)
  const now = new Date();
  const bloodRequest = {
    userId: new ObjectId(sessionUser.id),
    patientName: body.patientName,
    bloodGroup: body.bloodGroup as any, // Type validated by Zod
    unitsNeeded: body.unitsNeeded,
    hospitalName: body.hospitalName,
    hospitalAddress: body.hospitalAddress,
    district: body.district as any, // Type validated by Zod
    urgency: body.urgency as any, // Type validated by Zod
    status: RequestStatus.OPEN, // Always starts as "open" (Req 3.1, 20.7)
    neededByDate: new Date(body.neededByDate),
    contactPhone: body.contactPhone,
    additionalNotes: body.additionalNotes,
    createdAt: now, // Req 20.8
    updatedAt: now, // Req 20.8
  };

  try {
    const collection = getBloodRequestsCollection();
    const result = await collection.insertOne(bloodRequest as BloodRequest);

    const created: BloodRequest = {
      _id: result.insertedId,
      ...bloodRequest,
    } as BloodRequest;

    // Notify eligible donors asynchronously (Req 9.1-9.3)
    // Don't await - let it run in background
    notifyNewMatchingRequest(created).catch((error) => {
      logger.error("Failed to notify eligible donors:", error);
      // Don't fail the request creation if notification fails
    });

    // Invalidate relevant caches
    await CacheService.invalidateMultiple([
      CacheKeys.endpointPattern("/api/requests"),
      CacheKeys.endpointPattern("/api/admin/stats"),
      CacheKeys.endpointPattern("/api/users/me/analytics"),
    ]);

    res.status(HTTP_STATUS.CREATED).json({
      _id: created._id.toString(),
      userId: created.userId.toString(),
      patientName: created.patientName,
      bloodGroup: created.bloodGroup,
      unitsNeeded: created.unitsNeeded,
      hospitalName: created.hospitalName,
      hospitalAddress: created.hospitalAddress,
      district: created.district,
      urgency: created.urgency,
      status: created.status,
      neededByDate: created.neededByDate.toISOString(),
      contactPhone: created.contactPhone,
      additionalNotes: created.additionalNotes,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error("Error creating blood request:", error);
    throw error;
  }
}

// ============================================================================
// List Blood Requests (GET /api/requests)
// ============================================================================

export async function listBloodRequests(
  req: Request<{}, {}, {}, ListRequestsQuery>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser;
  const {
    bloodGroup,
    district,
    urgency,
    status,
    search,
    sort = "newest",
    page = 1,
    limit = 20,
  } = req.query;

  // Build MongoDB filter
  const filter: any = {};

  // By default, exclude cancelled, expired, and fulfilled requests from public browse
  // Only show these if explicitly filtered by status query param
  if (!status) {
    // Default: only show open and in_progress requests (active requests)
    filter.status = { $in: [RequestStatus.OPEN, RequestStatus.IN_PROGRESS] };
  } else {
    // If status is explicitly provided, use it
    filter.status = status;
  }

  if (bloodGroup) {
    filter.bloodGroup = bloodGroup;
  }

  if (district) {
    filter.district = district;
  }

  if (urgency) {
    filter.urgency = urgency;
  }

  // Search across multiple fields (Req 7.11)
  if (search) {
    filter.$or = [
      { patientName: { $regex: search, $options: "i" } },
      { hospitalName: { $regex: search, $options: "i" } },
      { hospitalAddress: { $regex: search, $options: "i" } },
      { additionalNotes: { $regex: search, $options: "i" } },
    ];
  }

  // Build sort order
  let sortOrder: any = { createdAt: -1 }; // Default: newest first

  if (sort === "oldest") {
    sortOrder = { createdAt: 1 };
  } else if (sort === "most_urgent" || sort === "critical_first") {
    // Sort by urgency tier then by date
    // Map urgency to numeric priority for sorting
    const urgencyMap: Record<string, number> = {
      critical: 1,
      urgent: 2,
      moderate: 3,
    };

    // This requires aggregation for complex sorting
    // For now, we'll do a simpler approach with post-fetch sorting
    // Or we can use aggregation pipeline
    sortOrder = { urgency: 1, neededByDate: 1 };
  }

  try {
    const collection = getBloodRequestsCollection();
    const skip = calculateSkip(page, limit);

    // Use aggregation pipeline for better performance
    // This gets requests with response count in a single query
    const pipeline: any[] = [
      // Stage 1: Match filters
      { $match: filter },

      // Stage 2: Lookup responses and count them
      {
        $lookup: {
          from: "responses",
          localField: "_id",
          foreignField: "requestId",
          as: "responses",
        },
      },

      // Stage 3: Add response count field
      {
        $addFields: {
          responseCount: { $size: "$responses" },
        },
      },

      // Stage 4: Remove the responses array (we only need the count)
      {
        $project: {
          responses: 0,
        },
      },

      // Stage 5: Sort
      { $sort: sortOrder },

      // Stage 6: Facet for pagination and total count
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await collection.aggregate(pipeline).toArray();
    if (!result) {
      throw new Error("Failed to fetch requests");
    }

    const requests = result.data || [];
    const totalCount = result.totalCount[0]?.count || 0;

    // Check if auto-expiration should occur for any requests (Req 3.5)
    const now = new Date();
    const requestsWithExpiration = requests.map((request: any) => {
      const expirationCheck = requestStateMachine.checkAutoExpiration(
        request,
        now,
      );
      if (expirationCheck.shouldExpire) {
        // Note: Actual expiration update would happen in a background job or on-demand
        // For now, we just flag it
        return { ...request, status: expirationCheck.newStatus! };
      }
      return request;
    });

    // Mask contact info for non-owners (Req 4.1-4.4)
    const maskedRequests = requestsWithExpiration.map((request: any) => {
      const isOwner =
        sessionUser && request.userId.toString() === sessionUser.id;
      const isAdmin = sessionUser?.role === "admin";
      const shouldMask = shouldMaskPhone(
        request.userId.toString(),
        sessionUser?.id,
        isAdmin,
      );

      return {
        _id: request._id.toString(),
        userId: request.userId.toString(),
        patientName: request.patientName,
        bloodGroup: request.bloodGroup,
        unitsNeeded: request.unitsNeeded,
        hospitalName: request.hospitalName,
        hospitalAddress: request.hospitalAddress,
        district: request.district,
        urgency: request.urgency,
        status: request.status,
        neededByDate: request.neededByDate.toISOString(),
        contactPhone: shouldMask
          ? maskPhone(request.contactPhone)
          : request.contactPhone,
        additionalNotes: request.additionalNotes,
        responseCount: request.responseCount || 0,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      };
    });

    // Build paginated response (Req 12.1)
    const paginatedResponse = buildPaginatedResponse(
      maskedRequests,
      page,
      limit,
      totalCount,
    );

    res.status(HTTP_STATUS.OK).json(paginatedResponse);
  } catch (error) {
    logger.error("Error listing blood requests:", error);
    throw error;
  }
}

// ============================================================================
// Get Single Blood Request (GET /api/requests/:id)
// ============================================================================

export async function getBloodRequestById(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser;
  const { id } = req.params;

  // Validate ObjectId
  if (!ObjectId.isValid(id)) {
    throw createValidationError("Invalid request ID format");
  }

  try {
    const collection = getBloodRequestsCollection();
    const request = await collection.findOne({ _id: new ObjectId(id) });

    if (!request) {
      throw createNotFoundError("Blood request", id);
    }

    // Check if auto-expiration should occur (Req 3.5)
    const expirationCheck = requestStateMachine.checkAutoExpiration(request);
    if (expirationCheck.shouldExpire) {
      // Auto-expire the request
      await collection.updateOne(
        { _id: request._id },
        {
          $set: {
            status: expirationCheck.newStatus!,
            updatedAt: new Date(),
          },
        },
      );
      request.status = expirationCheck.newStatus!;
    }

    // Mask contact info for non-owners (Req 4.1-4.4)
    const isAdmin = sessionUser?.role === "admin";
    const shouldMask = shouldMaskPhone(
      request.userId.toString(),
      sessionUser?.id,
      isAdmin,
    );

    const response = {
      _id: request._id.toString(),
      userId: request.userId.toString(),
      patientName: request.patientName,
      bloodGroup: request.bloodGroup,
      unitsNeeded: request.unitsNeeded,
      hospitalName: request.hospitalName,
      hospitalAddress: request.hospitalAddress,
      district: request.district,
      urgency: request.urgency,
      status: request.status,
      neededByDate: request.neededByDate.toISOString(),
      contactPhone: shouldMask
        ? maskPhone(request.contactPhone)
        : request.contactPhone,
      additionalNotes: request.additionalNotes,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };

    res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`Error fetching blood request ${id}:`, error);
    throw error;
  }
}

// ============================================================================
// Get User's Own Requests (GET /api/requests/mine)
// ============================================================================

/**
 * Get all blood requests created by the authenticated user (Req 20.18)
 * - Auth required
 * - Returns paginated response
 */
export async function getMyBloodRequests(
  req: Request<{}, {}, {}, { page?: string; limit?: string }>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const page = parseInt(req.query.page || "1", 10);
  const limit = parseInt(req.query.limit || "20", 10);

  try {
    const collection = getBloodRequestsCollection();
    const filter = { userId: new ObjectId(sessionUser.id) };
    const skip = calculateSkip(page, limit);

    const [requests, totalCount] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    const formattedRequests = requests.map((request) => ({
      _id: request._id.toString(),
      userId: request.userId.toString(),
      patientName: request.patientName,
      bloodGroup: request.bloodGroup,
      unitsNeeded: request.unitsNeeded,
      hospitalName: request.hospitalName,
      hospitalAddress: request.hospitalAddress,
      district: request.district,
      urgency: request.urgency,
      status: request.status,
      neededByDate: request.neededByDate.toISOString(),
      contactPhone: request.contactPhone, // Owner sees unmasked
      additionalNotes: request.additionalNotes,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    }));

    const paginatedResponse = buildPaginatedResponse(
      formattedRequests,
      page,
      limit,
      totalCount,
    );

    res.status(HTTP_STATUS.OK).json(paginatedResponse);
  } catch (error) {
    logger.error("Error fetching user's blood requests:", error);
    throw error;
  }
}

// ============================================================================
// Update Blood Request Details (PATCH /api/requests/:id)
// ============================================================================

/**
 * Update mutable details of a blood request
 * - Owner or Admin only
 * - Allows modifying patientName, hospitalName, hospitalAddress, district, urgency, neededByDate, contactPhone, additionalNotes, unitsNeeded
 */
export async function updateBloodRequest(
  req: Request<{ id: string }, {}, UpdateBloodRequestInput>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { id } = req.params;
  const body = req.body;

  if (!ObjectId.isValid(id)) {
    throw createValidationError("Invalid request ID format");
  }

  try {
    const collection = getBloodRequestsCollection();
    const request = await collection.findOne({ _id: new ObjectId(id) });

    if (!request) {
      throw createNotFoundError("Blood request", id);
    }

    const isAdmin = sessionUser.role === "admin";
    const isOwner = request.userId.toString() === sessionUser.id;

    if (!isOwner && !isAdmin) {
      throw createForbiddenError(
        "You do not have permission to update this request",
        { requestId: id },
      );
    }

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.patientName !== undefined) updateFields["patientName"] = body.patientName;
    if (body.bloodGroup !== undefined) updateFields["bloodGroup"] = body.bloodGroup;
    if (body.unitsNeeded !== undefined) updateFields["unitsNeeded"] = body.unitsNeeded;
    if (body.hospitalName !== undefined) updateFields["hospitalName"] = body.hospitalName;
    if (body.hospitalAddress !== undefined) updateFields["hospitalAddress"] = body.hospitalAddress;
    if (body.district !== undefined) updateFields["district"] = body.district;
    if (body.urgency !== undefined) updateFields["urgency"] = body.urgency;
    if (body.neededByDate !== undefined) updateFields["neededByDate"] = new Date(body.neededByDate);
    if (body.contactPhone !== undefined) updateFields["contactPhone"] = body.contactPhone;
    if (body.additionalNotes !== undefined) updateFields["additionalNotes"] = body.additionalNotes;

    await collection.updateOne(
      { _id: request._id },
      { $set: updateFields },
    );

    // Invalidate relevant caches
    await CacheService.invalidateMultiple([
      CacheKeys.endpointPattern("/api/requests"),
      CacheKeys.resource("request", id),
      CacheKeys.endpointPattern("/api/admin/stats"),
      CacheKeys.endpointPattern("/api/users/me/analytics"),
    ]);

    const updated = await collection.findOne({ _id: request._id });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Blood request updated successfully",
      data: updated,
    });
  } catch (error) {
    logger.error(`Error updating blood request ${id}:`, error);
    throw error;
  }
}

// ============================================================================
// Update Blood Request Status (PATCH /api/requests/:id/status)
// ============================================================================

/**
 * Update blood request status via state machine (Req 3.1-3.9, 20.19)
 * - Owner or Admin only
 * - Uses requestStateMachine for validation
 * - Logs admin actions
 * - Notifies relevant users
 */
export async function updateBloodRequestStatus(
  req: Request<{ id: string }, {}, UpdateRequestStatusInput>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { id } = req.params;
  const { status: targetStatus, reason } = req.body;

  // Validate ObjectId
  if (!ObjectId.isValid(id)) {
    throw createValidationError("Invalid request ID format");
  }

  try {
    const collection = getBloodRequestsCollection();
    const request = await collection.findOne({ _id: new ObjectId(id) });

    if (!request) {
      throw createNotFoundError("Blood request", id);
    }

    // Check authorization and validate transition via state machine (Req 3.7)
    const transitionResult = requestStateMachine.transition(
      request,
      targetStatus as any,
      {
        id: new ObjectId(sessionUser.id),
        role: sessionUser.role,
      },
    );

    if (!transitionResult.allowed) {
      throw transitionResult.error!;
    }

    const previousStatus = request.status;
    const newStatus = transitionResult.newStatus!;

    // Update the request
    const updateResult = await collection.updateOne(
      { _id: request._id },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw createNotFoundError("Blood request", id);
    }

    // Log admin action if admin is modifying someone else's request (Req 5.4-5.5)
    const isAdmin = sessionUser.role === "admin";
    const isOwner = request.userId.toString() === sessionUser.id;

    if (isAdmin && !isOwner) {
      await logAdminAction({
        adminId: new ObjectId(sessionUser.id),
        action: "modify_request",
        targetType: "request",
        targetId: request._id,
        previousState: { status: previousStatus },
        newState: { status: newStatus },
        reason: reason || "Status change",
        ipAddress: req.ip || "unknown",
      });
    }

    // Notify donors who responded to this request (Req 9.6)
    if (previousStatus !== newStatus) {
      const responsesCollection = getResponsesCollection();
      const responses = await responsesCollection
        .find({ requestId: request._id })
        .toArray();

      if (responses.length > 0) {
        const donorIds = responses.map((r) => r.userId);
        notifyRequestStatusChange(
          donorIds,
          newStatus,
          request._id,
          request.patientName,
        ).catch((error) => {
          logger.error("Failed to notify request status change:", error);
        });
      }
    }

    // Invalidate relevant caches
    await CacheService.invalidateMultiple([
      CacheKeys.endpointPattern("/api/requests"),
      CacheKeys.resource("request", id),
      CacheKeys.endpointPattern("/api/admin/stats"),
      CacheKeys.endpointPattern("/api/users/me/analytics"),
    ]);

    res.status(HTTP_STATUS.OK).json({
      _id: request._id.toString(),
      status: newStatus,
      previousStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error updating blood request status ${id}:`, error);
    throw error;
  }
}

// ============================================================================
// Delete Blood Request (DELETE /api/requests/:id)
// ============================================================================

/**
 * Delete a blood request (Req 20.19)
 * - Owner or Admin only
 * - Logs admin actions
 */
export async function deleteBloodRequest(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { id } = req.params;

  // Validate ObjectId
  if (!ObjectId.isValid(id)) {
    throw createValidationError("Invalid request ID format");
  }

  try {
    const collection = getBloodRequestsCollection();
    const request = await collection.findOne({ _id: new ObjectId(id) });

    if (!request) {
      throw createNotFoundError("Blood request", id);
    }

    // Check authorization (Req 5.4)
    const isAdmin = sessionUser.role === "admin";
    const isOwner = request.userId.toString() === sessionUser.id;

    if (!isOwner && !isAdmin) {
      throw createForbiddenError(
        "You do not have permission to delete this request",
        { requestId: id },
      );
    }

    // Delete the request
    const deleteResult = await collection.deleteOne({ _id: request._id });

    if (deleteResult.deletedCount === 0) {
      throw createNotFoundError("Blood request", id);
    }

    // Log admin action if admin is deleting someone else's request (Req 10.3)
    if (isAdmin && !isOwner) {
      await logAdminAction({
        adminId: new ObjectId(sessionUser.id),
        action: "modify_request", // Using modify_request as delete is a modification
        targetType: "request",
        targetId: request._id,
        previousState: {
          patientName: request.patientName,
          bloodGroup: request.bloodGroup,
          status: request.status,
        },
        newState: { deleted: true },
        reason: "Request deleted by admin",
        ipAddress: req.ip || "unknown",
      });
    }

    // Invalidate relevant caches
    await CacheService.invalidateMultiple([
      CacheKeys.endpointPattern("/api/requests"),
      CacheKeys.resource("request", id),
      CacheKeys.endpointPattern("/api/admin/stats"),
      CacheKeys.endpointPattern("/api/users/me/analytics"),
    ]);

    res.status(HTTP_STATUS.OK).json({
      message: "Blood request deleted successfully",
      _id: id,
    });
  } catch (error) {
    logger.error(`Error deleting blood request ${id}:`, error);
    throw error;
  }
}

// ============================================================================
// Phase 5b: Respond/Responses Workflow + Related Requests
// ============================================================================

// ============================================================================
// Respond to Blood Request (POST /api/requests/:id/respond)
// ============================================================================

/**
 * Donor responds to a blood request (Req 6.1-6.3, 6.10-6.11)
 * - Auth required, donor only
 * - Runs eligibility check first
 * - Auto-transitions request to "in_progress" on first response (Req 3.2)
 * - Notifies request owner (Req 9.4)
 * - Max 50 responses per request
 */
export async function respondToBloodRequest(
  req: Request<{ id: string }, {}, CreateResponseInput>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { id: requestId } = req.params;
  const { message } = req.body;

  // Validate ObjectId
  if (!ObjectId.isValid(requestId)) {
    throw createValidationError("Invalid request ID format");
  }

  try {
    const requestsCollection = getBloodRequestsCollection();
    const responsesCollection = getResponsesCollection();

    // Get the blood request
    const request = await requestsCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!request) {
      throw createNotFoundError("Blood request", requestId);
    }

    // Donor cannot respond to their own request
    if (request.userId.toString() === sessionUser.id) {
      throw createValidationError(
        "You cannot respond to your own blood request",
      );
    }

    // Only allow donors to respond
    if (!sessionUser.isDonor) {
      throw createForbiddenError(
        "Only registered donors can respond to blood requests. Please update your profile to register as a donor.",
        { userId: sessionUser.id },
      );
    }

    // Check if request is still open or in_progress
    if (
      request.status !== RequestStatus.OPEN &&
      request.status !== RequestStatus.IN_PROGRESS
    ) {
      throw createValidationError(
        `Cannot respond to a ${request.status} request. Only open or in-progress requests accept responses.`,
      );
    }

    // Check for duplicate response from same donor
    const existingResponse = await responsesCollection.findOne({
      requestId: request._id,
      userId: new ObjectId(sessionUser.id),
    });

    if (existingResponse) {
      throw createValidationError(
        "You have already responded to this blood request",
      );
    }

    // Check max responses limit (Req 6.10-6.11)
    const responseCount = await responsesCollection.countDocuments({
      requestId: request._id,
    });

    if (responseCount >= 50) {
      throw createValidationError(
        "This request has reached the maximum number of responses (50). No more responses can be accepted.",
      );
    }

    // Run eligibility check (Req 6.1)
    const eligibilityResult = evaluateEligibility({
      donor: {
        bloodGroup: sessionUser.bloodGroup,
        lastDonationDate: sessionUser.lastDonationDate,
        isDonor: sessionUser.isDonor,
        // Note: age and weight are not available in session user
        // Could be added if needed for strict validation
      },
      requestedBloodGroup: request.bloodGroup,
    });

    if (!eligibilityResult.eligible) {
      const errorMessage = getIneligibilityMessage(
        eligibilityResult.reason!,
        eligibilityResult.daysRemaining,
      );
      throw createValidationError(errorMessage, {
        reason: eligibilityResult.reason,
        daysRemaining: eligibilityResult.daysRemaining,
      });
    }

    // Create the response (Req 6.2-6.3)
    const now = new Date();
    const donorResponse: DonorResponse = {
      _id: new ObjectId(),
      requestId: request._id,
      userId: new ObjectId(sessionUser.id),
      status: ResponseStatus.OFFERED,
      ...(message && { message }), // Only include message if provided
      createdAt: now,
      updatedAt: now,
    };

    await responsesCollection.insertOne(donorResponse);

    // Auto-transition to IN_PROGRESS on first response (Req 3.2)
    const autoTransitionResult =
      requestStateMachine.autoTransitionOnFirstResponse(request);

    if (
      autoTransitionResult.shouldTransition &&
      autoTransitionResult.newStatus
    ) {
      await requestsCollection.updateOne(
        { _id: request._id },
        {
          $set: {
            status: autoTransitionResult.newStatus,
            updatedAt: now,
          },
        },
      );
    }

    // Notify request owner (Req 9.4)
    notifyNewResponse(
      request.userId,
      new ObjectId(sessionUser.id),
      sessionUser.name || "A donor",
      request._id,
    ).catch((error) => {
      logger.error("Failed to notify request owner:", error);
    });

    // Invalidate relevant caches
    await CacheService.invalidateMultiple([
      CacheKeys.endpointPattern("/api/requests"),
      CacheKeys.resource("request", requestId),
      CacheKeys.endpointPattern("/api/users/me/responses"),
    ]);

    res.status(HTTP_STATUS.CREATED).json({
      _id: donorResponse._id.toString(),
      requestId: donorResponse.requestId.toString(),
      userId: donorResponse.userId.toString(),
      status: donorResponse.status,
      message: donorResponse.message,
      createdAt: donorResponse.createdAt.toISOString(),
      updatedAt: donorResponse.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error(`Error responding to blood request ${requestId}:`, error);
    throw error;
  }
}

// ============================================================================
// Update Response Status (PATCH /api/requests/:id/responses/:responseId)
// ============================================================================

/**
 * Update response status (Req 6.7)
 * - Request owner only
 * - Can accept/decline/complete donor responses
 * - Notifies donor of status change (Req 9.5)
 */
export async function updateResponseStatus(
  req: Request<
    { id: string; responseId: string },
    {},
    UpdateResponseStatusInput
  >,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { id: requestId, responseId } = req.params;
  const { status: newStatus, message } = req.body;

  // Validate ObjectIds
  if (!ObjectId.isValid(requestId)) {
    throw createValidationError("Invalid request ID format");
  }
  if (!ObjectId.isValid(responseId)) {
    throw createValidationError("Invalid response ID format");
  }

  try {
    const requestsCollection = getBloodRequestsCollection();
    const responsesCollection = getResponsesCollection();

    // Get the blood request
    const request = await requestsCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!request) {
      throw createNotFoundError("Blood request", requestId);
    }

    // Check authorization - only request owner can update response status (Req 6.7)
    const isOwner = request.userId.toString() === sessionUser.id;
    const isAdmin = sessionUser.role === "admin";

    if (!isOwner && !isAdmin) {
      throw createForbiddenError(
        "Only the request owner can update response status",
        { requestId, responseId },
      );
    }

    // Get the response
    const response = await responsesCollection.findOne({
      _id: new ObjectId(responseId),
      requestId: request._id,
    });

    if (!response) {
      throw createNotFoundError("Response", responseId);
    }

    // Update the response
    const updateResult = await responsesCollection.updateOne(
      { _id: response._id },
      {
        $set: {
          status: newStatus as any,
          ...(message && { message }),
          updatedAt: new Date(),
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw createNotFoundError("Response", responseId);
    }

    // Notify donor of status change (Req 9.5)
    if (newStatus === "accepted" || newStatus === "declined") {
      notifyResponseStatusChange(
        response.userId,
        newStatus,
        request._id,
        request.patientName,
      ).catch((error) => {
        logger.error("Failed to notify response status change:", error);
      });
    }

    res.status(HTTP_STATUS.OK).json({
      _id: response._id.toString(),
      requestId: response.requestId.toString(),
      userId: response.userId.toString(),
      status: newStatus,
      message: message || response.message,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      `Error updating response status ${responseId} for request ${requestId}:`,
      error,
    );
    throw error;
  }
}

// ============================================================================
// Retract Response (DELETE /api/requests/:id/responses/:responseId)
// ============================================================================

/**
 * Donor retracts their own response (Req 6.8-6.9)
 * - Donor only (own response)
 * - Only allowed if status is "offered"
 */
export async function retractResponse(
  req: Request<{ id: string; responseId: string }>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { id: requestId, responseId } = req.params;

  // Validate ObjectIds
  if (!ObjectId.isValid(requestId)) {
    throw createValidationError("Invalid request ID format");
  }
  if (!ObjectId.isValid(responseId)) {
    throw createValidationError("Invalid response ID format");
  }

  try {
    const responsesCollection = getResponsesCollection();

    // Get the response
    const response = await responsesCollection.findOne({
      _id: new ObjectId(responseId),
      requestId: new ObjectId(requestId),
    });

    if (!response) {
      throw createNotFoundError("Response", responseId);
    }

    // Check authorization - donor can only retract their own response
    if (response.userId.toString() !== sessionUser.id) {
      throw createForbiddenError("You can only retract your own response", {
        responseId,
      });
    }

    // Can only retract if status is "offered" (Req 6.8-6.9)
    if (response.status !== ResponseStatus.OFFERED) {
      throw createValidationError(
        `Cannot retract a ${response.status} response. Only "offered" responses can be retracted.`,
      );
    }

    // Delete the response
    const deleteResult = await responsesCollection.deleteOne({
      _id: response._id,
    });

    if (deleteResult.deletedCount === 0) {
      throw createNotFoundError("Response", responseId);
    }

    res.status(HTTP_STATUS.OK).json({
      message: "Response retracted successfully",
      _id: responseId,
    });
  } catch (error) {
    logger.error(
      `Error retracting response ${responseId} for request ${requestId}:`,
      error,
    );
    throw error;
  }
}

// ============================================================================
// Get Responses for a Request (GET /api/requests/:id/responses)
// ============================================================================

/**
 * List all responses for a blood request
 * - Request owner or admin only
 * - Returns all responses with donor information
 */
export async function getRequestResponses(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser!;
  const { id: requestId } = req.params;

  // Validate ObjectId
  if (!ObjectId.isValid(requestId)) {
    throw createValidationError("Invalid request ID format");
  }

  try {
    const requestsCollection = getBloodRequestsCollection();
    const responsesCollection = getResponsesCollection();
    const { getUsersCollection } = await import("../db/collections.js");
    const usersCollection = getUsersCollection();

    // Get the blood request
    const request = await requestsCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!request) {
      throw createNotFoundError("Blood request", requestId);
    }

    // Check authorization - only request owner or admin
    const isOwner = request.userId.toString() === sessionUser.id;
    const isAdmin = sessionUser.role === "admin";

    if (!isOwner && !isAdmin) {
      throw createForbiddenError("Only the request owner can view responses", {
        requestId,
      });
    }

    // Get all responses
    const responses = await responsesCollection
      .find({ requestId: request._id })
      .sort({ createdAt: -1 })
      .toArray();

    // Get donor information for each response
    const responsesWithDonorInfo = await Promise.all(
      responses.map(async (response) => {
        const donor = await usersCollection.findOne({
          _id: response.userId,
        });

        return {
          _id: response._id.toString(),
          requestId: response.requestId.toString(),
          userId: response.userId.toString(),
          status: response.status,
          message: response.message,
          createdAt: response.createdAt.toISOString(),
          updatedAt: response.updatedAt.toISOString(),
          donor: donor
            ? {
                name: donor.name,
                bloodGroup: donor.bloodGroup,
                district: donor.district,
                lastDonationDate: donor.lastDonationDate?.toISOString() || null,
              }
            : null,
        };
      }),
    );

    res.status(HTTP_STATUS.OK).json({
      requestId,
      responses: responsesWithDonorInfo,
      total: responses.length,
    });
  } catch (error) {
    logger.error(`Error fetching responses for request ${requestId}:`, error);
    throw error;
  }
}

// ============================================================================
// Get Related Requests (GET /api/requests/related/:id)
// ============================================================================

/**
 * Find related blood requests (Req 14.1-14.6)
 * - Same bloodGroup AND district
 * - Excludes the current request
 * - Only open or in_progress requests
 * - Ranks by: critical > urgent > moderate, then neededByDate ascending
 * - Limit 6 results
 */
export async function getRelatedRequests(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const sessionUser = req.sessionUser;
  const { id: requestId } = req.params;

  // Validate ObjectId
  if (!ObjectId.isValid(requestId)) {
    throw createValidationError("Invalid request ID format");
  }

  try {
    const collection = getBloodRequestsCollection();

    // Get the source request
    const sourceRequest = await collection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!sourceRequest) {
      throw createNotFoundError("Blood request", requestId);
    }

    // Find related requests (Req 14.2-14.6)
    // - Same bloodGroup AND district (14.2)
    // - Only open/in_progress (14.3)
    // - Exclude self
    const relatedRequests = await collection
      .find({
        _id: { $ne: sourceRequest._id },
        bloodGroup: sourceRequest.bloodGroup,
        district: sourceRequest.district,
        status: { $in: [RequestStatus.OPEN, RequestStatus.IN_PROGRESS] },
      })
      .toArray();

    // Sort by urgency tier first, then by neededByDate (Req 14.4)
    // Critical > Urgent > Moderate, then earliest neededByDate
    const urgencyPriority: Record<string, number> = {
      critical: 1,
      urgent: 2,
      moderate: 3,
    };

    const sorted = relatedRequests.sort((a, b) => {
      const urgencyDiff =
        (urgencyPriority[a.urgency] ?? 4) - (urgencyPriority[b.urgency] ?? 4);
      if (urgencyDiff !== 0) return urgencyDiff;

      // If same urgency, sort by date (earlier first)
      return a.neededByDate.getTime() - b.neededByDate.getTime();
    });

    // Limit to 6 results (Req 14.5-14.6)
    const limited = sorted.slice(0, 6);

    // Mask contact info for non-owners (Req 4.1-4.4)
    const masked = limited.map((request) => {
      const isOwner =
        sessionUser && request.userId.toString() === sessionUser.id;
      const isAdmin = sessionUser?.role === "admin";
      const shouldMask = shouldMaskPhone(
        request.userId.toString(),
        sessionUser?.id,
        isAdmin,
      );

      return {
        _id: request._id.toString(),
        userId: request.userId.toString(),
        patientName: request.patientName,
        bloodGroup: request.bloodGroup,
        unitsNeeded: request.unitsNeeded,
        hospitalName: request.hospitalName,
        hospitalAddress: request.hospitalAddress,
        district: request.district,
        urgency: request.urgency,
        status: request.status,
        neededByDate: request.neededByDate.toISOString(),
        contactPhone: shouldMask
          ? maskPhone(request.contactPhone)
          : request.contactPhone,
        additionalNotes: request.additionalNotes,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      };
    });

    res.status(HTTP_STATUS.OK).json({
      requestId,
      relatedRequests: masked,
      total: masked.length,
    });
  } catch (error) {
    logger.error(`Error fetching related requests for ${requestId}:`, error);
    throw error;
  }
}
