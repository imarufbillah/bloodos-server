/**
 * Donor API Validators (Phase 5c)
 * Zod schemas for donor directory and contact request endpoints
 */

import { z } from "zod";
import { BLOOD_GROUPS, DISTRICTS } from "../types/shared.js";

/**
 * Query parameters for GET /api/donors
 * Filters: bloodGroup, district
 * Pagination: page, limit
 */
export const listDonorsQuerySchema = z.object({
  query: z.object({
    bloodGroup: z.enum(BLOOD_GROUPS as [string, ...string[]]).optional(),
    district: z.enum(DISTRICTS as [string, ...string[]]).optional(),
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

export type ListDonorsQuery = z.infer<typeof listDonorsQuerySchema>["query"];

/**
 * Request params for POST /api/donors/:id/request-contact
 * Donor ID from URL params
 */
export const requestContactParamsSchema = z.object({
  params: z.object({
    id: z.string().length(24, "Invalid donor ID format"),
  }),
});

export type RequestContactParams = z.infer<typeof requestContactParamsSchema>["params"];
