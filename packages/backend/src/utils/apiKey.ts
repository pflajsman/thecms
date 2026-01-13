import crypto from 'crypto';

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
  // Generate a 32-byte random key and encode as base64
  const key = crypto.randomBytes(32).toString('base64url');
  // Add a prefix for easy identification
  return `cms_${key}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Check if it starts with cms_ and has the correct length
  return apiKey.startsWith('cms_') && apiKey.length > 40;
}
