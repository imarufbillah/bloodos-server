import express, { type Application } from "express";
import cors from "cors";
import { config } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

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
  // API Routes
  // ============================================================================
  // TODO: Mount route handlers here in Phase 5
  // Example:
  // app.use('/api/requests', requestsRouter);
  // app.use('/api/donors', donorsRouter);
  // etc.

  // ============================================================================
  // Error Handling Middleware
  // ============================================================================

  // 404 handler - must come AFTER all routes
  app.use(notFoundHandler);

  // Centralized error handler - must be the LAST middleware (Req 11.1-11.8)
  app.use(errorHandler);

  return app;
};
