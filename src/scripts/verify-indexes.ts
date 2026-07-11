import { config } from 'dotenv';
import { connectDatabase, closeDatabase } from '../config/database.js';

// Load environment variables
config();

/**
 * Verify that all required indexes exist in the database
 */
const verifyIndexes = async () => {
  console.log('Starting index verification...\n');

  try {
    const db = await connectDatabase();

    const collections = [
      'bloodRequests',
      'notifications',
      'donations',
      'user',
      'contactAuditLog',
      'adminActionLog',
    ];

    let allIndexesExist = true;

    for (const collectionName of collections) {
      console.log(`Checking indexes for ${collectionName} collection...`);
      const collection = db.collection(collectionName);

      // Get all indexes for this collection
      const indexes = await collection.indexes();

      console.log(`  Found ${indexes.length} indexes:`);
      indexes.forEach((index) => {
        const keys = Object.keys(index.key)
          .map((k) => `${k}: ${index.key[k]}`)
          .join(', ');
        console.log(`    - ${index.name}: { ${keys} }`);
      });

      console.log('');
    }

    if (allIndexesExist) {
      console.log('✓ All required indexes are present!');
    } else {
      console.log('✗ Some required indexes are missing!');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Error verifying indexes:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
};

// Run the script
verifyIndexes();
