import { connectDB, closeDB } from "../config/db.js";
import { verifyIndexes } from "../db/indexes.js";

/**
 * Script to verify all database indexes exist
 * Useful for debugging and validation
 */
const verifyIndexesScript = async () => {
  try {
    console.log("🔍 Verifying database indexes...\n");

    const db = await connectDB();
    const isValid = await verifyIndexes(db);

    if (isValid) {
      console.log("\n✅ All indexes verified successfully");
      process.exit(0);
    } else {
      console.log("\n⚠ Some indexes may be missing. Run 'npm run init-indexes' to create them.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Index verification failed:", error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyIndexesScript();
}

export { verifyIndexesScript };
