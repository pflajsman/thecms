import { isAxiosError } from 'axios'
import { i18n } from '@/i18n'

export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown; details?: { message?: unknown }[] } | undefined
    const serverMessage = data?.error
    const detail = Array.isArray(data?.details) ? data.details[0]?.message : undefined
    if (typeof serverMessage === 'string' && serverMessage) {
      return typeof detail === 'string' && detail ? `${serverMessage}: ${detail}` : serverMessage
    }
    if (!error.response) return i18n.t('errors.network')
  }
  // Server messages above are shown as sent; these fallbacks are ours, so they follow the admin language.
  return i18n.t('errors.generic')
}
