/**
 * Contact Form DTOs
 * Based on Requirement 19
 */

// ============================================================================
// Contact Form Submission (Req 19.7)
// ============================================================================

export interface CreateContactDto {
  name: string;
  email: string;
  subject: string;
  message: string; // Min 10 characters (Req 19.7)
}

// ============================================================================
// Contact Audit Log (Req 4.5)
// ============================================================================

export interface ContactAuditLogDto {
  _id: string;
  requestorId: string; // User requesting contact
  donorId: string; // Donor whose info was accessed
  requestId?: string | null; // Related request if any
  contactType: "phone" | "email";
  timestamp: Date | string;
  ipAddress: string;
}

// ============================================================================
// Create Contact Audit Log (Internal service use)
// ============================================================================

export interface CreateContactAuditLogDto {
  requestorId: string;
  donorId: string;
  requestId?: string;
  contactType: "phone" | "email";
  ipAddress: string;
}
