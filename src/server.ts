import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { connectDB, closeDB } from "./config/db.js";
import { createIndexes } from "./db/indexes.js";

/**
 * Start the server
 * 
 * Process:
 * 1. Connect to MongoDB
 * 2. Create indexes (idempotent, safe to run on every boot)
 * 3. Start Express server
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    const db = await connectDB();
    console.log("✅ Database connection established");

    // Create indexes (Req 8 - must run before accepting traffic)
    await createIndexes(db);
    console.log("✅ Database indexes initialized");

    // Create Express app
    const app = createApp();

    // Start listening
    const server = app.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🩸 BloodOS Server                                        ║
║                                                            ║
║   Environment: ${config.nodeEnv.padEnd(43)}║
║   Port:        ${config.port.toString().padEnd(43)}║
║   Health:      http://localhost:${config.port}/health${' '.repeat(23)}║
║                                                            ║
║   Ready to accept requests                                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);
      
      server.close(async () => {
        console.log("🔌 HTTP server closed");
        await closeDB();
        console.log("👋 Shutdown complete");
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle unhandled rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      // In production, you might want to exit here
      if (config.isProduction) {
        gracefulShutdown("UNHANDLED_REJECTION");
      }
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
