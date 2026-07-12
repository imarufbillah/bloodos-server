import { MongoClient, Db } from "mongodb";
import { config } from "./env.js";

/**
 * MongoDB client instance
 */
let client: MongoClient | null = null;

/**
 * Database instance
 */
let db: Db | null = null;

/**
 * Database name extracted from MongoDB URI
 */
const getDatabaseName = (uri: string): string => {
  try {
    // Extract database name from URI
    const url = new URL(uri);
    const dbName = url.pathname.slice(1).split("?")[0];
    return dbName || "bloodos";
  } catch {
    return "bloodos";
  }
};

/**
 * Connect to MongoDB
 * Creates a singleton connection that can be reused across the application
 */
export const connectDB = async (): Promise<Db> => {
  if (db) {
    return db;
  }

  try {
    console.log("📦 Connecting to MongoDB...");
    
    client = new MongoClient(config.mongodb.uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();

    // Ping to verify connection
    await client.db().admin().ping();

    const dbName = getDatabaseName(config.mongodb.uri);
    db = client.db(dbName);

    console.log(`✅ MongoDB connected successfully to database: ${dbName}`);

    return db;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

/**
 * Get the database instance
 * Throws if database is not connected
 */
export const getDB = (): Db => {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db;
};

/**
 * Close MongoDB connection
 * Should be called on application shutdown
 */
export const closeDB = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("🔌 MongoDB connection closed");
  }
};

/**
 * Handle graceful shutdown
 */
process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDB();
  process.exit(0);
});
