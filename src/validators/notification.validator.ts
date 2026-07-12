/**
 * Notification API Validators (Phase 5d)
 * Zod schemas for notification list and mark-read endpoints
 */

import { z } from "zod";

/**
 * Query parameters for GET /api/notifications
 * Pagination: page, limit
 * Sorted by createdAt desc (implicit, no query param needed)
 */
export const listNotificationsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, { message: "Page must be greater than 0" }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val > 0 && val <= 100, {
        message: "Limit must be between 1 and 100",
      }),
  }),
});

export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>["query"];

/**
 * Request params for PATCH /api/notifications/:id/read
 * Notification ID from URL params
 */
export const markNotificationReadParamsSchema = z.object({
  params: z.object({
    id: z.string().length(24, "Invalid notification ID format"),
  }),
});

export type MarkNotificationReadParams = z.infer<
  typeof markNotificationReadParamsSchema
>["params"];
