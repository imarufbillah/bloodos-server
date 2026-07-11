import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * MongoDB connection configuration
 * Implements connection pooling for optimal performance
 */
export const connectDatabase = async (): Promise<Db> => {
  if (db && client) {
    // Return existing connection if available
    return db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    // Create MongoDB client with connection pooling options
    client = new MongoClient(uri, {
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 2, // Minimum number of connections to maintain
      maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
      serverSelectionTimeoutMS: 5000, // Timeout for server selection
      socketTimeoutMS: 45000, // Socket timeout
      retryWrites: true,
      retryReads: true,
    });

    // Connect to MongoDB
    await client.connect();

    // Get database name from URI or use default
    const dbName = new URL(uri).pathname.slice(1) || 'bloodos';
    db = client.db(dbName);

    console.log(`✓ Connected to MongoDB database: ${dbName}`);
    
    return db;
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    throw error;
  }
};

/**
 * Get the database instance
 * Throws error if not connected
 */
export const getDatabase = (): Db => {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
};

/**
 * Close database connection
 * Should be called during graceful shutdown
 */
export const closeDatabase = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('✓ MongoDB connection closed');
  }
};

/**
 * Check database connection status
 */
export const isDatabaseConnected = (): boolean => {
  return db !== null && client !== null;
};
