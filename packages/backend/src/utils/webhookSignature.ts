import crypto from 'crypto';

/**
 * Generate HMAC SHA256 signature for webhook payload
 * This signature allows webhook receivers to verify the payload came from our system
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}
