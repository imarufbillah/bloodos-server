import type { Request, Response, NextFunction } from "express";
import type { ErrorResponse } from "../types/shared.js";

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Error Codes (Req 11.1)
 * Standard error codes used throughout the application
 */
export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: "validation_error",
  MALFORMED_INPUT: "malformed_input",
  LIMIT_EXCEEDED: "limit_exceeded",

  // Authentication errors (401)
  UNAUTHORIZED: "unauthorized",
  TOKEN_EXPIRED: "token_expired",
  INVALID_TOKEN: "invalid_token",

  // Authorization errors (403)
  FORBIDDEN: "forbidden",
  INSUFFICIENT_PERMISSIONS: "insufficient_permissions",

  // Resource errors (404)
  NOT_FOUND: "not_found",
  RESOURCE_NOT_FOUND: "resource_not_found",

  // Conflict errors (409)
  DUPLICATE_ENTRY: "duplicate_entry",
  RESOURCE_CONFLICT: "resource_conflict",

  // State errors (422)
  INVALID_STATE: "invalid_state",
  MAX_RESPONSES_REACHED: "max_responses_reached",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",

  // Server errors (500)
  INTERNAL_ERROR: "internal_error",
  DATABASE_ERROR: "database_error",
  SERVICE_ERROR: "service_error",
} as const;

/**
 * Custom Application Error Class (Req 11.1-11.8)
 *
 * Extends the native Error class with additional properties:
 * - code: Machine-readable error code
 * - httpStatus: HTTP status code to return
 * - details: Optional additional error details (e.g., field-level validation errors)
 * - isOperational: Whether this is an expected operational error vs programming error
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown> | null;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    httpStatus: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: Record<string, unknown> | null,
    isOperational: boolean = true,
  ) {
    super(message);

    // Maintains proper stack trace for where error was thrown (V8 only)
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details || null;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Ensures the name of this error is the same as the class name
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert error to ErrorResponse format (Req 11.1)
   */
  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details || null,
    };
  }
}

/**
 * Factory functions for common error types
 */

/**
 * Create a validation error (400)
 * Used when request data fails validation
 */
export const createValidationError = (
  message: string,
  details?: Record<string, unknown>,
): AppError => {
  return new AppError(
    ERROR_CODES.VALIDATION_ERROR,
    message,
    HTTP_STATUS.BAD_REQUEST,
    details,
  );
};

/**
 * Create an unauthorized error (401)
 * Used when authentication is required but missing or invalid
 */
export const createUnauthorizedError = (
  message: string = "Authentication required",
  code: string = ERROR_CODES.UNAUTHORIZED,
): AppError => {
  return new AppError(code, message, HTTP_STATUS.UNAUTHORIZED);
};

/**
 * Create a forbidden error (403)
 * Used when user is authenticated but lacks permission
 */
export const createForbiddenError = (
  message: string = "Access denied",
  details?: Record<string, unknown>,
): AppError => {
  return new AppError(
    ERROR_CODES.FORBIDDEN,
    message,
    HTTP_STATUS.FORBIDDEN,
    details,
  );
};

/**
 * Create a not found error (404)
 * Used when a requested resource doesn't exist
 */
export const createNotFoundError = (
  resource: string,
  identifier?: string | number,
): AppError => {
  const message = identifier
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`;

  return new AppError(ERROR_CODES.NOT_FOUND, message, HTTP_STATUS.NOT_FOUND);
};

/**
 * Create a conflict error (409)
 * Used when a request conflicts with existing data
 */
export const createConflictError = (
  message: string,
  details?: Record<string, unknown>,
): AppError => {
  return new AppError(
    ERROR_CODES.DUPLICATE_ENTRY,
    message,
    HTTP_STATUS.CONFLICT,
    details,
  );
};

/**
 * Create an invalid state error (422)
 * Used when a state transition or operation is not allowed
 */
export const createInvalidStateError = (
  message: string,
  details?: Record<string, unknown>,
): AppError => {
  return new AppError(
    ERROR_CODES.INVALID_STATE,
    message,
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    details,
  );
};

/**
 * Create a rate limit error (429)
 * Used when rate limit is exceeded
 */
export const createRateLimitError = (
  message: string = "Too many requests. Please try again later.",
  retryAfter?: number,
): AppError => {
  const details = retryAfter ? { retryAfter } : undefined;
  return new AppError(
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    message,
    HTTP_STATUS.TOO_MANY_REQUESTS,
    details,
  );
};

/**
 * Create an internal server error (500)
 * Used for unexpected server errors
 */
export const createInternalError = (
  message: string = "An unexpected error occurred",
  details?: Record<string, unknown>,
): AppError => {
  return new AppError(
    ERROR_CODES.INTERNAL_ERROR,
    message,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details,
    false, // Programming errors are not operational
  );
};

/**
 * Centralized Error Handler Middleware (Req 11.1-11.8)
 *
 * This middleware:
 * - Catches all errors thrown in the application
 * - Formats them consistently as ErrorResponse
 * - Logs errors appropriately based on environment
 * - Never leaks internal error details to clients in production (Req 11.8)
 *
 * Must be mounted as the LAST middleware in app.ts
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // Default to internal server error
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let errorResponse: ErrorResponse;

  // Check if this is our custom AppError
  if (error instanceof AppError) {
    statusCode = error.httpStatus;
    errorResponse = error.toJSON();

    // Log operational errors at warning level
    if (error.isOperational) {
      console.warn(`[${error.code}] ${error.message}`, {
        path: req.path,
        method: req.method,
        details: error.details,
      });
    } else {
      // Log programming errors at error level with stack trace
      console.error(`[${error.code}] ${error.message}`, {
        path: req.path,
        method: req.method,
        stack: error.stack,
        details: error.details,
      });
    }
  } else {
    // Handle unexpected errors
    console.error("Unexpected error:", {
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    // In production, never leak internal error details (Req 11.8)
    const isProduction = process.env.NODE_ENV === "production";

    errorResponse = {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: isProduction
        ? "An unexpected error occurred. Please try again later."
        : error.message,
      details: isProduction ? null : { stack: error.stack },
    };
  }

  // Set response status and send error
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found Handler
 * Handles requests to non-existent routes
 * Should be mounted AFTER all route handlers but BEFORE error handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const error = createNotFoundError("Route", req.path);
  next(error);
};

/**
 * Async Route Handler Wrapper (Req 11.3)
 *
 * Express 5.2.1 has built-in async error handling, but this wrapper
 * provides explicit error forwarding and type safety
 *
 * Usage:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsersFromDB();
 *   res.json(users);
 * }));
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
