import { BrowserAuthError, InteractionRequiredAuthError, type PublicClientApplication } from '@azure/msal-browser'
import { isEntraConfigured, loginRequest } from '../config/msalConfig'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// Shared MSAL instance reference (set from App.tsx)
let msalInstance: PublicClientApplication | null = null
let redirecting = false

export function setMsalInstance(instance: PublicClientApplication) {
  msalInstance = instance
  redirecting = false
}

/**
 * Sends the browser to Entra to renew the session (it comes straight back while the Entra session lives).
 * A redirect, not a popup: this runs from request code with no user click, so a popup would be blocked.
 */
export function renewSession() {
  if (!msalInstance || redirecting || renewedRecently()) return
  redirecting = true
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
  msalInstance.acquireTokenRedirect({ ...loginRequest, account }).catch(() => {
    redirecting = false
  })
}

const RENEWED_AT_KEY = 'auth_renewed_at'
const RENEW_COOLDOWN_MS = 60_000

/** True when a renewal ran within the last minute, so a server that rejects even fresh tokens cannot cause a redirect loop. */
function renewedRecently(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RENEWED_AT_KEY))
    if (last && Date.now() - last < RENEW_COOLDOWN_MS) return true
    sessionStorage.setItem(RENEWED_AT_KEY, String(Date.now()))
  } catch {
    // Storage unavailable: allow the renewal.
  }
  return false
}

function needsInteraction(error: unknown): boolean {
  // A blocked or timed out hidden iframe means the same as an expired refresh token: the user must go to Entra.
  return (
    error instanceof InteractionRequiredAuthError ||
    (error instanceof BrowserAuthError && error.errorCode === 'monitor_window_timeout')
  )
}

/** "Bearer <token>" for the signed-in user (Entra through MSAL, or the dev token), or undefined. */
export async function authorizationHeader(options: { forceRefresh?: boolean } = {}): Promise<string | undefined> {
  if (isEntraConfigured() && msalInstance) {
    const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
    if (!account) return undefined
    try {
      const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account, forceRefresh: options.forceRefresh })
      return `Bearer ${response.accessToken}`
    } catch (error) {
      if (needsInteraction(error)) renewSession()
      return undefined
    }
  }
  // Dev mode: use token from localStorage
  const token = localStorage.getItem('auth_token')
  return token ? `Bearer ${token}` : undefined
}
