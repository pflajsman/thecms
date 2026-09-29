import { isAxiosError } from 'axios'

export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown; details?: { message?: unknown }[] } | undefined
    const serverMessage = data?.error
    const detail = Array.isArray(data?.details) ? data.details[0]?.message : undefined
    if (typeof serverMessage === 'string' && serverMessage) {
      return typeof detail === 'string' && detail ? `${serverMessage}: ${detail}` : serverMessage
    }
    if (!error.response) return 'Could not reach the server. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}
