import type { Response, Request } from "express";
import { ObjectId } from "mongodb";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getUsersCollection,
  getContactAuditLogsCollection,
} from "../db/collections.js";
import { maskPhone } from "../utils/maskPhone.js";
import { buildPaginatedResponse, calculateSkip } from "../utils/pagination.js";
import {
  createNotFoundError,
  createInternalError,
} from "../middleware/error.middleware.js";
import { notifyContactInfoRequested } from "../services/notification.service.js";
import { logger } from "../utils/logger.js";
import type {
  ListDonorsQuery,
  RequestContactParams,
} from "../validators/donor.validator.js";
import type { User } from "../types/models/UserExtension.js";
import type { ContactAuditLog } from "../types/models/ContactAuditLog.js";

export const listDonors = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Manual query param extraction and validation
  const bloodGroupParam = req.query.bloodGroup as string | undefined;
  const districtParam = req.query.district as string | undefined;
  const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limitParam = req.query.limit
    ? parseInt(req.query.limit as string, 10)
    : 20;

  // Validate page and limit
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit =
    isNaN(limitParam) || limitParam < 1 || limitParam > 100 ? 20 : limitParam;

  const bloodGroup = bloodGroupParam;
  const district = districtParam;

  // Build query filter - only isDonor: true users (Req 17.4)
  const filter: any = {
    isDonor: true,
    banned: { $ne: true }, // Exclude banned users
  };

  if (bloodGroup) {
    filter.bloodGroup = bloodGroup;
  }

  if (district) {
    filter.district = district;
  }

  const usersCollection = getUsersCollection();

  // Calculate pagination
  const skip = calculateSkip(page, limit);

  // Fetch donors and total count
  const [donors, totalCount] = await Promise.all([
    usersCollection
      .find(filter)
      .sort({ name: 1 }) // Alphabetical by name
      .skip(skip)
      .limit(limit)
      .toArray(),
    usersCollection.countDocuments(filter),
  ]);

  // Mask phone numbers for all donors in list view (Req 17.5)
  const maskedDonors = donors.map((donor) => ({
    ...donor,
    phone: maskPhone(donor.phone),
    // Don't include email in list view for privacy
    email: undefined,
  }));

  // Build paginated response
  const response = buildPaginatedResponse(
    maskedDonors,
    page,
    limit,
    totalCount,
  );

  res.json(response);
};

export const requestContact = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const donorIdString = req.params.id;

  // Type guard - ensure it's a string
  if (typeof donorIdString !== "string") {
    throw createNotFoundError("Donor", "invalid");
  }

  const requestorId = new ObjectId(req.sessionUser.id);
  const requestorName = req.sessionUser.name || "A user";

  // Validate and parse donor ID
  if (!ObjectId.isValid(donorIdString)) {
    throw createNotFoundError("Donor", donorIdString);
  }

  const donorId = new ObjectId(donorIdString);

  // Find the donor
  const usersCollection = getUsersCollection();
  const donor = await usersCollection.findOne({ _id: donorId, isDonor: true });

  if (!donor) {
    throw createNotFoundError("Donor", donorIdString);
  }

  // Extract IP address for audit log
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  // Create contact audit log entry (Req 4.5)
  // This MUST succeed before revealing contact info (Req 4.6 - atomicity requirement)
  try {
    const auditLog: ContactAuditLog = {
      _id: new ObjectId(),
      requestorId,
      donorId,
      requestId: null, // No specific request context in this endpoint
      contactType: "phone", // Primary contact type being revealed
      timestamp: new Date(),
      ipAddress,
    };

    const contactAuditLogsCollection = getContactAuditLogsCollection();
    await contactAuditLogsCollection.insertOne(auditLog);
  } catch (error) {
    // If audit log fails, do NOT reveal contact info (Req 4.6)
    logger.error("Failed to create contact audit log:", error);
    throw createInternalError(
      "Failed to log contact request. Contact information not revealed for security.",
    );
  }

  // Notify the donor that their contact was requested (Req 9.9)
  try {
    await notifyContactInfoRequested(donorId, requestorId, requestorName);
  } catch (error) {
    // Log notification failure but don't block the contact reveal
    // The audit log succeeded, so the reveal proceeds
    logger.error("Failed to notify donor of contact request:", error);
  }

  // Return full unmasked contact information (Req 4.7)
  const contactInfo = {
    id: donor.id,
    name: donor.name,
    email: donor.email,
    phone: donor.phone, // UNMASKED
    bloodGroup: donor.bloodGroup,
    district: donor.district,
    lastDonationDate: donor.lastDonationDate,
  };

  res.json({
    success: true,
    message: "Contact information retrieved successfully",
    data: contactInfo,
  });
};
