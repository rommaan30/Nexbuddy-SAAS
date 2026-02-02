import crypto from "crypto";

/**
 * Generate a secure, random verification token
 * Returns a URL-safe base64 encoded token
 */
export function generateVerificationToken(): string {
  // Generate 32 random bytes (256 bits of entropy)
  const randomBytes = crypto.randomBytes(32);
  // Convert to URL-safe base64 string
  return randomBytes.toString("base64url");
}

/**
 * Calculate token expiry time (default: 24 hours from now)
 */
export function getTokenExpiry(hours: number = 24): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}
