/**
 * Validation utilities for Udhaari Manager
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  cleaned?: string;
}

/**
 * Validates an Indian mobile number.
 * Accepts optional +91, 91, or leading 0.
 * Must be exactly 10 digits after prefix removal.
 * Must start with 6, 7, 8, or 9.
 * Rejects invalid dummy sequences (e.g. 1234567892, 0000000000, 9999999999).
 */
export function validateIndianMobile(raw?: string | null): ValidationResult {
  if (!raw || !raw.trim()) {
    return { isValid: true, cleaned: '' }; // Optional field when empty
  }

  let cleaned = raw.trim().replace(/[\s\-+()]/g, '');

  // Strip international / trunk prefix (+91, 91 with 12 digits, or 0 with 11 digits)
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Must only contain digits
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: 'Phone number must only contain numbers.' };
  }

  // Must be exactly 10 digits
  if (cleaned.length !== 10) {
    return {
      isValid: false,
      error: `Phone number must be exactly 10 digits (currently ${cleaned.length} digits).`,
    };
  }

  // Must start with 6, 7, 8, or 9 (standard Indian mobile operator series)
  if (!/^[6-9]/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Mobile number must start with 6, 7, 8, or 9 (e.g. 9876543210).',
    };
  }

  // Reject dummy repeating numbers like 9999999999, 8888888888
  if (/^(\d)\1{9}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }

  return { isValid: true, cleaned };
}
