import { connectDB, closeDB } from "../config/db.js";
import { createIndexes } from "../db/indexes.js";

/**
 * Script to initialize all database indexes
 * Run this after setting up a new database
 */
const initIndexes = async () => {
  try {
    console.log("🚀 Initializing database indexes...\n");

    const db = await connectDB();
    await createIndexes(db);

    console.log("\n✅ Index initialization completed successfully");
  } catch (error) {
    console.error("\n❌ Index initialization failed:", error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initIndexes();
}

export { initIndexes };
