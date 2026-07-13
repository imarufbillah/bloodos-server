import express, { type Application } from "express";
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

/**
 * Create and configure Express application
 * 
 * @returns Configured Express application instance
 */
export const createApp = (): Application => {
  const app = express();

  // ============================================================================
  // Global Middleware
  // ============================================================================

  // CORS - Allow requests from client application
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Request logging in development
  if (config.nodeEnv === "development") {
    app.use((req, _res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  // ============================================================================
  // Health Check Route
  // ============================================================================

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  // ============================================================================
  // Rate Limiting (Req 15)
  // ============================================================================
  // Contact form rate limiter applied to prevent spam/abuse
  // Limit: 5 requests per 15 minutes per IP address

  // ============================================================================
  // API Routes
  // ============================================================================

  // Blood Requests Routes (Phase 5a)
  app.use("/api/requests", requestsRouter);

  // Donors Routes (Phase 5c)
  app.use("/api/donors", donorsRouter);

  // Notifications Routes (Phase 5d)
  app.use("/api/notifications", notificationsRouter);

  // Admin Routes (Phase 5e)
  app.use("/api/admin", adminRouter);

  // Contact Form Routes (Phase 5g) - WITH RATE LIMITING
  app.use("/api/contact", contactFormRateLimiter, contactRouter);

  // Users Routes (Phase 5h)
  app.use("/api/users", usersRouter);

  // Donations Routes (Phase 5h)
  app.use("/api/donations", donationsRouter);

  // ============================================================================
  // Error Handling Middleware
  // ============================================================================

  // 404 handler - must come AFTER all routes
  app.use(notFoundHandler);

  // Centralized error handler - must be the LAST middleware (Req 11.1-11.8)
  app.use(errorHandler);

  return app;
};
