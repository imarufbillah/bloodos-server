/**
 * Pagination Utilities (Req 12.1-12.6)
 * Creates PaginatedResponse objects with correct metadata
 */

import type { PaginatedResponse } from "../types/shared.js";

/**
 * Build a paginated response with metadata (Req 12.1)
 * 
 * @param data - Array of data for current page
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param totalCount - Total number of items across all pages
 * @returns PaginatedResponse with full metadata
 * 
 * @example
 * ```typescript
 * const requests = await collection.find(filter).skip(skip).limit(limit).toArray();
 * const totalCount = await collection.countDocuments(filter);
 * 
 * return buildPaginatedResponse(requests, page, limit, totalCount);
 * ```
 */
export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  totalCount: number
): PaginatedResponse<T> {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  
  // Req 12.2-12.6 - Correct edge behavior for hasNextPage/hasPrevPage
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    page,
    limit,
    totalPages,
    totalCount,
    hasNextPage,
    hasPrevPage,
  };
}

/**
 * Calculate skip value for MongoDB pagination
 * 
 * @param page - Current page (1-indexed)
 * @param limit - Items per page
 * @returns Number of documents to skip
 */
export function calculateSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
