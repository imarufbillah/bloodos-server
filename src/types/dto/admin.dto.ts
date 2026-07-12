/**
 * Admin DTOs
 * Based on Requirements 10, 18
 */

import type { AdminActionType, BloodGroup, District } from "../shared.js";

// ============================================================================
// Admin Dashboard Stats (Req 18.4)
// ============================================================================

export interface AdminStatsDto {
  totalRequests: number;
  activeRequests: number;
  fulfilledRequests: number;
  totalDonors: number;
  donationsThisMonth: number;
  requestsByBloodGroup: BloodGroupStat[];
  requestsByDistrict: DistrictStat[];
  requestTrend: TrendDataPoint[]; // 30-day rolling window (Req 18.7)
}

export interface BloodGroupStat {
  bloodGroup: BloodGroup;
  count: number;
}

export interface DistrictStat {
  district: District;
  count: number;
}

export interface TrendDataPoint {
  date: string; // ISO date string
  count: number;
}

// ============================================================================
// Admin Action Log (Req 10.1)
// ============================================================================

export interface AdminActionLogDto {
  _id: string;
  adminId: string;
  action: AdminActionType;
  targetType: "user" | "request" | "donation";
  targetId: string;
  details: {
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    reason?: string;
  };
  ipAddress: string;
  timestamp: Date | string;
}

// ============================================================================
// Create Admin Action Log (Internal service use)
// ============================================================================

export interface CreateAdminActionLogDto {
  adminId: string;
  action: AdminActionType;
  targetType: "user" | "request" | "donation";
  targetId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  ipAddress: string;
}

// ============================================================================
// Admin Moderation Actions
// ============================================================================

export interface ApproveRequestDto {
  reason?: string;
}

export interface RejectRequestDto {
  reason: string; // Required for rejection
}
