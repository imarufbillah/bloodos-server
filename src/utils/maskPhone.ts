/**
 * Phone Number Masking Utilities (Req 4.1-4.4)
 * Bangladesh phone format: 01XXXXXXXXX (11 digits)
 * Masked format: 01XXX***XXX (first 5 visible, last 3 visible, middle 3 asterisks)
 */

/**
 * Mask a Bangladesh phone number for privacy (Req 4.1-4.3)
 * 
 * Format:
 * - Original: 01712345678
 * - Masked: 01712***678
 * 
 * @param phone - Phone number to mask (11 digits starting with 01)
 * @returns Masked phone number
 * 
 * @example
 * ```typescript
 * maskPhone("01712345678") // Returns: "01712***678"
 * ```
 */
export function maskPhone(phone: string): string {
  // Validate format
  if (!phone || phone.length !== 11 || !phone.startsWith("01")) {
    // If invalid format, mask more aggressively for safety
    return phone.slice(0, 2) + "***" + phone.slice(-2);
  }

  // First 5 digits (01XXX) + 3 asterisks + last 3 digits (XXX)
  const firstPart = phone.slice(0, 5); // "01712"
  const lastPart = phone.slice(-3); // "678"
  
  return `${firstPart}***${lastPart}`;
}

/**
 * Check if a phone number should be masked based on user permissions (Req 4.4)
 * 
 * Contact info is NOT masked for:
 * - Request owner viewing their own request
 * - Admin users
 * 
 * @param resourceOwnerId - ID of the resource owner
 * @param currentUserId - ID of the current user
 * @param isAdmin - Whether current user is an admin
 * @returns true if phone should be masked
 */
export function shouldMaskPhone(
  resourceOwnerId: string,
  currentUserId: string | undefined,
  isAdmin: boolean
): boolean {
  // Admin can see everything
  if (isAdmin) {
    return false;
  }

  // Owner can see their own contact info
  if (currentUserId && resourceOwnerId === currentUserId) {
    return false;
  }

  // Everyone else sees masked version
  return true;
}
