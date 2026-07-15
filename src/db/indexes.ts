import { Db } from "mongodb";
import { COLLECTION_NAMES } from "./collections.js";

/**
 * Helper to create index with error handling
 * Handles case where index already exists with different name (code 85)
 */
const safeCreateIndex = async (
  collection: any,
  keys: any,
  options: any
): Promise<void> => {
  try {
    await collection.createIndex(keys, options);
  } catch (error: any) {
    // Index already exists with different name or same keys - this is okay
    if (error.code === 85 || error.code === 86) {
      console.log(`  ℹ Index ${options.name} already exists or has conflict - skipping`);
      return;
    }
    throw error;
  }
};

/**
 * Create all database indexes (Req 8.1-8.8)
 * This function is idempotent - safe to run on every boot
 */
export const createIndexes = async (db: Db): Promise<void> => {
  console.log("📑 Creating database indexes...");

  try {
    // ========================================================================
    // Blood Requests Indexes (Req 8.1)
    // ========================================================================
    const bloodRequestsCollection = db.collection(COLLECTION_NAMES.BLOOD_REQUESTS);

    // Compound index for filtering by blood group, district, and status
    await safeCreateIndex(
      bloodRequestsCollection,
      { bloodGroup: 1, district: 1, status: 1 },
      { name: "idx_blood_requests_filter" }
    );

    // Index for finding user's requests
    await safeCreateIndex(
      bloodRequestsCollection,
      { userId: 1 },
      { name: "idx_blood_requests_user" }
    );

    // Compound index for expiration checks and status queries
    await safeCreateIndex(
      bloodRequestsCollection,
      { neededByDate: 1, status: 1 },
      { name: "idx_blood_requests_expiration" }
    );

    // Compound index for user requests by status (aggregation optimization)
    await safeCreateIndex(
      bloodRequestsCollection,
      { userId: 1, status: 1 },
      { name: "idx_blood_requests_user_status" }
    );

    // Compound index for sorting by urgency and creation date
    await safeCreateIndex(
      bloodRequestsCollection,
      { urgency: 1, createdAt: -1 },
      { name: "idx_blood_requests_urgency_date" }
    );

    console.log("  ✓ Blood requests indexes created");

    // ========================================================================
    // Responses Indexes (Req 8.2)
    // ========================================================================
    const responsesCollection = db.collection(COLLECTION_NAMES.RESPONSES);

    // Index for finding responses to a request
    await safeCreateIndex(
      responsesCollection,
      { requestId: 1 },
      { name: "idx_responses_request" }
    );

    // Index for finding user's responses
    await safeCreateIndex(
      responsesCollection,
      { userId: 1 },
      { name: "idx_responses_user" }
    );

    // Compound unique index to prevent duplicate responses
    await safeCreateIndex(
      responsesCollection,
      { requestId: 1, userId: 1 },
      { name: "idx_responses_unique", unique: true }
    );

    // Compound index for user responses by status (aggregation optimization)
    await safeCreateIndex(
      responsesCollection,
      { userId: 1, status: 1 },
      { name: "idx_responses_user_status" }
    );

    console.log("  ✓ Responses indexes created");

    // ========================================================================
    // Donations Indexes (Req 8.3)
    // ========================================================================
    const donationsCollection = db.collection(COLLECTION_NAMES.DONATIONS);

    // Index for finding user's donations
    await safeCreateIndex(
      donationsCollection,
      { userId: 1 },
      { name: "idx_donations_user" }
    );

    // Compound index for donation history (most recent first)
    await safeCreateIndex(
      donationsCollection,
      { userId: 1, donationDate: -1 },
      { name: "idx_donations_history" }
    );

    console.log("  ✓ Donations indexes created");

    // ========================================================================
    // Users Indexes (Req 8.4)
    // ========================================================================
    const usersCollection = db.collection(COLLECTION_NAMES.USERS);

    // Compound index for finding eligible donors
    await safeCreateIndex(
      usersCollection,
      { bloodGroup: 1, district: 1, isDonor: 1 },
      { name: "idx_users_donors" }
    );

    console.log("  ✓ Users indexes created");

    // ========================================================================
    // Notifications Indexes (Req 8.5)
    // ========================================================================
    const notificationsCollection = db.collection(COLLECTION_NAMES.NOTIFICATIONS);

    // Index for finding user's notifications
    await safeCreateIndex(
      notificationsCollection,
      { userId: 1 },
      { name: "idx_notifications_user" }
    );

    // Compound index for unread notifications query (most recent first)
    await safeCreateIndex(
      notificationsCollection,
      { userId: 1, isRead: 1, createdAt: -1 },
      { name: "idx_notifications_unread" }
    );

    console.log("  ✓ Notifications indexes created");

    // ========================================================================
    // Contact Audit Logs Indexes (Req 8.6, 4.6)
    // ========================================================================
    const contactAuditLogsCollection = db.collection(COLLECTION_NAMES.CONTACT_AUDIT_LOGS);

    // Compound index for tracking contact reveals between users
    await safeCreateIndex(
      contactAuditLogsCollection,
      { requestorId: 1, donorId: 1 },
      { name: "idx_contact_audit_users" }
    );

    // Index for timestamp-based queries
    await safeCreateIndex(
      contactAuditLogsCollection,
      { timestamp: -1 },
      { name: "idx_contact_audit_timestamp" }
    );

    console.log("  ✓ Contact audit logs indexes created");

    // ========================================================================
    // Admin Action Logs Indexes (Req 8.7, 8.8)
    // ========================================================================
    const adminActionLogsCollection = db.collection(COLLECTION_NAMES.ADMIN_ACTION_LOGS);

    // Index for finding admin's actions
    await safeCreateIndex(
      adminActionLogsCollection,
      { adminId: 1 },
      { name: "idx_admin_actions_admin" }
    );

    // Index for timestamp-based queries (most recent first)
    await safeCreateIndex(
      adminActionLogsCollection,
      { timestamp: -1 },
      { name: "idx_admin_actions_timestamp" }
    );

    // Compound index for finding actions on specific targets
    await safeCreateIndex(
      adminActionLogsCollection,
      { targetType: 1, targetId: 1 },
      { name: "idx_admin_actions_target" }
    );

    console.log("  ✓ Admin action logs indexes created");

    console.log("✅ All database indexes created successfully");
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    throw error;
  }
};

/**
 * Verify that all required indexes exist
 * Useful for debugging and validation
 */
export const verifyIndexes = async (db: Db): Promise<boolean> => {
  console.log("🔍 Verifying database indexes...");

  try {
    const collections = [
      { name: COLLECTION_NAMES.BLOOD_REQUESTS, expectedCount: 5 },
      { name: COLLECTION_NAMES.RESPONSES, expectedCount: 4 },
      { name: COLLECTION_NAMES.DONATIONS, expectedCount: 2 },
      { name: COLLECTION_NAMES.USERS, expectedCount: 1 },
      { name: COLLECTION_NAMES.NOTIFICATIONS, expectedCount: 2 },
      { name: COLLECTION_NAMES.CONTACT_AUDIT_LOGS, expectedCount: 2 },
      { name: COLLECTION_NAMES.ADMIN_ACTION_LOGS, expectedCount: 3 },
    ];

    let allValid = true;

    for (const { name, expectedCount } of collections) {
      const collection = db.collection(name);
      const indexes = await collection.indexes();
      
      // Subtract 1 for the default _id index
      const customIndexCount = indexes.length - 1;

      if (customIndexCount >= expectedCount) {
        console.log(`  ✓ ${name}: ${customIndexCount} indexes found`);
      } else {
        console.warn(`  ⚠ ${name}: Expected ${expectedCount} indexes, found ${customIndexCount}`);
        allValid = false;
      }
    }

    if (allValid) {
      console.log("✅ All indexes verified successfully");
    } else {
      console.warn("⚠ Some indexes may be missing");
    }

    return allValid;
  } catch (error) {
    console.error("❌ Error verifying indexes:", error);
    return false;
  }
};
