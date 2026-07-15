import express, { type Application } from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { config } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { contactFormRateLimiter } from "./middleware/rateLimit.middleware.js";
import requestsRouter from "./routes/requests.routes.js";
import donorsRouter from "./routes/donors.routes.js";
import notificationsRouter from "./routes/notifications.routes.js";
import adminRouter from "./routes/admin.routes.js";
import contactRouter from "./routes/contact.routes.js";
import usersRouter from "./routes/users.routes.js";
import donationsRouter from "./routes/donations.routes.js";
import statsRouter from "./routes/stats.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = (): Application => {
  const app = express();

  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
    }),
  );

  app.use("/api/users", uploadRouter);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  if (config.isDevelopment) {
    app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  app.use("/api/stats", statsRouter);
  app.use("/api/requests", requestsRouter);
  app.use("/api/donors", donorsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/contact", contactFormRateLimiter, contactRouter);
  app.use("/api/users", usersRouter);
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
  app.use("/api/donations", donationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
