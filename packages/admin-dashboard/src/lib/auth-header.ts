import { InteractionRequiredAuthError, type PublicClientApplication } from '@azure/msal-browser'
import { isEntraConfigured, loginRequest } from '../config/msalConfig'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// Shared MSAL instance reference (set from App.tsx)
let msalInstance: PublicClientApplication | null = null

export function setMsalInstance(instance: PublicClientApplication) {
  msalInstance = instance
}

/** "Bearer <token>" for the signed-in user (Entra through MSAL, or the dev token), or undefined. */
export async function authorizationHeader(): Promise<string | undefined> {
  if (isEntraConfigured() && msalInstance) {
    const accounts = msalInstance.getAllAccounts()
    if (accounts.length === 0) return undefined
    try {
      const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] })
      return `Bearer ${response.accessToken}`
    } catch (error) {
      // If silent fails due to interaction required, try popup
      if (!(error instanceof InteractionRequiredAuthError)) return undefined
      try {
        const response = await msalInstance.acquireTokenPopup(loginRequest)
        return `Bearer ${response.accessToken}`
      } catch {
        return undefined
      }
    }
  }
  // Dev mode: use token from localStorage
  const token = localStorage.getItem('auth_token')
  return token ? `Bearer ${token}` : undefined
}
