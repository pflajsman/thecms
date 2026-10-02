import { isAxiosError } from 'axios'
import type { TFunction } from 'i18next'
import { apiErrorMessage } from '@/lib/api-error'

const KNOWN = [
  'AUTH',
  'RATE_LIMIT',
  'UNREACHABLE',
  'TOO_LONG',
  'TIMEOUT',
  'AI_DISABLED',
  'NOT_CONNECTED',
  'AI_NOT_AVAILABLE',
  'KEY_UNREADABLE',
  'KEY_REQUIRED',
  'AI_RATE_LIMIT',
  'BASE_URL',
  'NETWORK',
] as const
export type AiErrorKey = (typeof KNOWN)[number]

/** Codes with an explanation in the catalog; others are shown as the server sent them. */
export function aiErrorKey(code: string): AiErrorKey | null {
  return (KNOWN as readonly string[]).includes(code) ? (code as AiErrorKey) : null
}

/** Codes where the fix is on the AI assistant page. */
export const SETTINGS_CODES: AiErrorKey[] = ['AUTH', 'NOT_CONNECTED', 'KEY_UNREADABLE']

/** Message for a failed connection or settings request (axios error with a `reason`). */
export function aiErrorMessage(error: unknown, t: TFunction<'ai'>): string {
  const reason = isAxiosError(error) ? (error.response?.data as { reason?: unknown } | undefined)?.reason : undefined
  const key = typeof reason === 'string' ? aiErrorKey(reason) : null
  return key ? t(`errors.${key}`) : apiErrorMessage(error)
}
