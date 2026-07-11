// Utility functions for the BloodOS backend

/**
 * Standardized error response builder
 */
export function createErrorResponse(code: string, message: string, details?: unknown) {
  const response: { code: string; message: string; details?: unknown } = {
    code,
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

/**
 * Masks phone number to show only last 4 digits
 * Format: ******XXXX where XXXX are the last 4 digits
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  return '******' + phone.slice(-4);
}

/**
 * Validates Bangladesh phone number format
 * Must be +880 followed by 11 digits (total 14 characters)
 */
export function isValidBangladeshPhone(phone: string): boolean {
  const regex = /^\+880\d{11}$/;
  return regex.test(phone);
}
