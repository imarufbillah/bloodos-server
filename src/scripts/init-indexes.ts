import { config } from 'dotenv';
import { connectDatabase, closeDatabase } from '../config/database.js';

// Load environment variables
config();

/**
 * Initialize all database indexes as specified in requirements 8.1-8.8
 * This script should be run during deployment or database setup
 */
const initializeIndexes = async () => {
  console.log('Starting index initialization...\n');

  try {
    const db = await connectDatabase();

    // ==========================================
    // 1. bloodRequests collection indexes
    // ==========================================
    console.log('Creating indexes for bloodRequests collection...');
    const bloodRequestsCollection = db.collection('bloodRequests');

    // Compound index for filtered queries (bloodGroup, district, status)
    await bloodRequestsCollection.createIndex(
      { bloodGroup: 1, district: 1, status: 1 },
      { name: 'idx_bloodGroup_district_status' }
    );
    console.log('  ✓ Created compound index: { bloodGroup: 1, district: 1, status: 1 }');

    // Single index for user's own requests
    await bloodRequestsCollection.createIndex(
      { requesterId: 1 },
      { name: 'idx_requesterId' }
    );
    console.log('  ✓ Created single index: { requesterId: 1 }');

    // Compound index for expiry checks and urgency sorting
    await bloodRequestsCollection.createIndex(
      { neededByDate: 1, status: 1 },
      { name: 'idx_neededByDate_status' }
    );
    console.log('  ✓ Created compound index: { neededByDate: 1, status: 1 }');

    // ==========================================
    // 2. notifications collection indexes
    // ==========================================
    console.log('\nCreating indexes for notifications collection...');
    const notificationsCollection = db.collection('notifications');

    // Single index for user notifications
    await notificationsCollection.createIndex(
      { userId: 1 },
      { name: 'idx_userId' }
    );
    console.log('  ✓ Created single index: { userId: 1 }');

    // Compound index for unread-first queries with sorting
    await notificationsCollection.createIndex(
      { userId: 1, read: 1, createdAt: -1 },
      { name: 'idx_userId_read_createdAt' }
    );
    console.log('  ✓ Created compound index: { userId: 1, read: 1, createdAt: -1 }');

    // ==========================================
    // 3. donations collection indexes
    // ==========================================
    console.log('\nCreating indexes for donations collection...');
    const donationsCollection = db.collection('donations');

    // Single index for user's donation history
    await donationsCollection.createIndex(
      { donorId: 1 },
      { name: 'idx_donorId' }
    );
    console.log('  ✓ Created single index: { donorId: 1 }');

    // Compound index for sorted donation history queries
    await donationsCollection.createIndex(
      { donorId: 1, donationDate: -1 },
      { name: 'idx_donorId_donationDate' }
    );
    console.log('  ✓ Created compound index: { donorId: 1, donationDate: -1 }');

    // ==========================================
    // 4. users collection indexes (better-auth)
    // ==========================================
    console.log('\nCreating indexes for users collection...');
    const usersCollection = db.collection('user');

    // Compound index for donor matching queries
    await usersCollection.createIndex(
      { bloodGroup: 1, district: 1, isDonor: 1 },
      { name: 'idx_bloodGroup_district_isDonor' }
    );
    console.log('  ✓ Created compound index: { bloodGroup: 1, district: 1, isDonor: 1 }');

    // Note: better-auth creates default indexes on email and id automatically

    // ==========================================
    // 5. contactAuditLog collection indexes
    // ==========================================
    console.log('\nCreating indexes for contactAuditLog collection...');
    const contactAuditLogCollection = db.collection('contactAuditLog');

    // Track who is requesting contact info
    await contactAuditLogCollection.createIndex(
      { requesterId: 1 },
      { name: 'idx_requesterId' }
    );
    console.log('  ✓ Created single index: { requesterId: 1 }');

    // Track whose contact is being accessed
    await contactAuditLogCollection.createIndex(
      { donorId: 1 },
      { name: 'idx_donorId' }
    );
    console.log('  ✓ Created single index: { donorId: 1 }');

    // ==========================================
    // 6. adminActionLog collection indexes
    // ==========================================
    console.log('\nCreating indexes for adminActionLog collection...');
    const adminActionLogCollection = db.collection('adminActionLog');

    // Audit queries by admin with recency
    await adminActionLogCollection.createIndex(
      { adminId: 1, performedAt: -1 },
      { name: 'idx_adminId_performedAt' }
    );
    console.log('  ✓ Created compound index: { adminId: 1, performedAt: -1 }');

    // Audit trail for specific resources
    await adminActionLogCollection.createIndex(
      { targetType: 1, targetId: 1 },
      { name: 'idx_targetType_targetId' }
    );
    console.log('  ✓ Created compound index: { targetType: 1, targetId: 1 }');

    console.log('\n✓ All indexes created successfully!');
  } catch (error) {
    console.error('\n✗ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
};

// Run the script
initializeIndexes();
