import crypto from 'crypto';
import { AppError } from '../../middleware/error.middleware';
import type { StoredKey } from '../../models/ai-connection.model';

export type EncryptedKey = StoredKey;

/** The 32-byte secret from AI_KEY_SECRET (base64 or hex), or null when AI is not set up on this server. */
export function keySecret(): Buffer | null {
  const raw = process.env.AI_KEY_SECRET?.trim();
  if (!raw) return null;
  const secret = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return secret.length === 32 ? secret : null;
}

export function aiAvailable(): boolean {
  return keySecret() !== null;
}

function requireSecret(): Buffer {
  const secret = keySecret();
  if (!secret) throw new AppError('AI is not set up on this server', 503, { reason: 'AI_NOT_AVAILABLE' });
  return secret;
}

export function encryptKey(plain: string): EncryptedKey {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', requireSecret(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function decryptKey(stored: EncryptedKey): string {
  const secret = requireSecret();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret, Buffer.from(stored.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(stored.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(stored.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // The server secret changed since the key was stored.
    throw new AppError('The stored AI key cannot be read; connect again', 409, { reason: 'KEY_UNREADABLE' });
  }
}

export function keyHint(key: string): string {
  return key.slice(-4);
}
