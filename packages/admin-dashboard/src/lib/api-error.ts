import { isAxiosError } from 'axios'

export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const serverMessage = (error.response?.data as { error?: unknown } | undefined)?.error
    if (typeof serverMessage === 'string' && serverMessage) return serverMessage
    if (!error.response) return 'Could not reach the server. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}
