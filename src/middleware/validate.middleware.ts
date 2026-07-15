/**
 * Validation Middleware
 * Wrapper for Zod schema validation with proper error formatting (Req 11.2)
 */

import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";
import { createValidationError, asyncHandler } from "./error.middleware.js";

/**
 * Validate request data against a Zod schema
 *
 * This middleware:
 * 1. Validates request body, query, and params against provided Zod schema
 * 2. Formats validation errors with field-level details (Req 11.2)
 * 3. Stores validated data in req.body, uses Object.defineProperty for query/params
 * 4. Throws AppError with validation_error code on failure
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.post(
 *   '/requests',
 *   validate(createBloodRequestSchema),
 *   createBloodRequest
 * );
 * ```
 */
export const validate = (schema: ZodSchema) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Validate and transform request data
        const validated = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });

        // Replace request data with validated/transformed data
        // Body can be directly assigned
        req.body = (validated as any).body;

        // Query and params need to use Object.defineProperty in Express 5.x
        // as they have read-only getters
        if ((validated as any).query !== undefined) {
          Object.defineProperty(req, "query", {
            value: (validated as any).query,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }

        if ((validated as any).params !== undefined) {
          Object.defineProperty(req, "params", {
            value: (validated as any).params,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }

        next();
      } catch (error) {
        if (error instanceof ZodError) {
          // Format Zod errors with field-level details (Req 11.2)
          const details: Record<string, unknown> = {};

          for (const issue of error.issues) {
            const path = issue.path.join(".");
            details[path] = {
              message: issue.message,
              code: issue.code,
              value: issue.path.reduce((obj: any, key: any) => {
                if (key === "body") return req.body;
                if (key === "query") return req.query;
                if (key === "params") return req.params;
                return obj?.[key];
              }, null as any),
            };
          }

          throw createValidationError(
            "Validation failed. Please check the provided data.",
            details,
          );
        }

        // Re-throw non-Zod errors
        throw error;
      }
    },
  );
};
