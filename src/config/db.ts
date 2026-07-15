import { MongoClient, Db } from "mongodb";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

let client: MongoClient | null = null;
let db: Db | null = null;

const getDatabaseName = (uri: string): string => {
  try {
    const url = new URL(uri);
    const dbName = url.pathname.slice(1).split("?")[0];
    return dbName || "bloodos";
  } catch {
    return "bloodos";
  }
};

export const connectDB = async (): Promise<Db> => {
  if (db) {
    return db;
  }

  try {
    logger.info("Connecting to MongoDB...");

    client = new MongoClient(config.mongodb.uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    await client.db().admin().ping();

    const dbName = getDatabaseName(config.mongodb.uri);
    db = client.db(dbName);

    logger.info("MongoDB connected", { database: dbName });

    return db;
  } catch (error) {
    logger.error("MongoDB connection failed", { error });
    throw error;
  }
};

export const getDB = (): Db => {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db;
};

export const closeDB = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info("MongoDB connection closed");
  }
};

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDB();
  process.exit(0);
});
