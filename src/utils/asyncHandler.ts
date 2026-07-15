import type { Request, Response, NextFunction } from "express";

/**
 * Async Request Handler Type
 * Represents an Express route handler that returns a Promise
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

/**
 * Async Handler Wrapper
 *
 * Wraps async Express route handlers to automatically catch errors
 * and forward them to the error middleware.
 *
 * Note: Express 5.2.1 has built-in async error handling, but this
 * wrapper provides explicit error forwarding and better type safety.
 *
 * @param fn - Async route handler function
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsersFromDB();
 *   res.json(users);
 * }));
 * ```
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
