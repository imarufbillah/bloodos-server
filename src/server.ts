import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { connectDB, closeDB } from "./config/db.js";
import { createIndexes } from "./db/indexes.js";
import {
  closeRedisConnection,
  isRedisReady,
  getRedisStatus,
} from "./config/redis.js";
import { logger } from "./utils/logger.js";

const startServer = async (): Promise<void> => {
  try {
    const db = await connectDB();

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const redisStatus = getRedisStatus();
    if (isRedisReady()) {
      logger.info("Redis cache layer ready");
    } else {
      logger.warn(
        `Redis status: ${redisStatus} (server will continue without cache)`,
      );
    }

    await createIndexes(db);

    const app = createApp();

    const server = app.listen(config.port, () => {
      logger.info("BloodOS Server started", {
        environment: config.nodeEnv,
        port: config.port,
        cache: isRedisReady() ? "Redis (enabled)" : "Disabled",
      });
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info("HTTP server closed");

        await closeRedisConnection();
        await closeDB();

        logger.info("Shutdown complete");
        process.exit(0);
      });

      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection", { reason, promise });
      if (config.isProduction) {
        gracefulShutdown("UNHANDLED_REJECTION");
      }
    });

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception", { error });
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
};

startServer();
