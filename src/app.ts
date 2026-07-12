import express, { type Application } from "express";
import cors from "cors";
import { config } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import requestsRouter from "./routes/requests.routes.js";
import donorsRouter from "./routes/donors.routes.js";
import notificationsRouter from "./routes/notifications.routes.js";

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
  // Note: Rate limiters are defined in middleware/rateLimit.middleware.ts
  // They should be applied to specific routes:
  // - authRateLimiter: POST /api/auth/login, POST /api/auth/register
  // - contactFormRateLimiter: POST /api/contact
  // 
  // Current architecture: Better-auth handles authentication on the Next.js
  // client app at /api/auth/*. When backend auth routes are added, apply
  // rate limiters as follows:
  //
  // import { authRateLimiter, contactFormRateLimiter } from './middleware/rateLimit.middleware.js';
  // app.post('/api/auth/login', authRateLimiter, authController.login);
  // app.post('/api/auth/register', authRateLimiter, authController.register);
  // app.post('/api/contact', contactFormRateLimiter, contactController.submit);

  // ============================================================================
  // API Routes
  // ============================================================================

  // Blood Requests Routes (Phase 5a)
  app.use("/api/requests", requestsRouter);

  // Donors Routes (Phase 5c)
  app.use("/api/donors", donorsRouter);

  // Notifications Routes (Phase 5d)
  app.use("/api/notifications", notificationsRouter);

  // TODO: Mount additional route handlers here as they are implemented
  // app.use('/api/users', usersRouter);
  // app.use('/api/admin', adminRouter);
  // app.use('/api/contact', contactRouter);

  // ============================================================================
  // Error Handling Middleware
  // ============================================================================

  // 404 handler - must come AFTER all routes
  app.use(notFoundHandler);

  // Centralized error handler - must be the LAST middleware (Req 11.1-11.8)
  app.use(errorHandler);

  return app;
};
