import axios from 'axios';
import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser';
import { loginRequest, isEntraConfigured } from '../config/msalConfig';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Shared MSAL instance reference (set from App.tsx)
let msalInstance: PublicClientApplication | null = null;

export function setMsalInstance(instance: PublicClientApplication) {
  msalInstance = instance;
}

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    if (isEntraConfigured() && msalInstance) {
      // Use MSAL to get a fresh access token
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const response = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0],
          });
          config.headers.Authorization = `Bearer ${response.accessToken}`;
        } catch (error) {
          // If silent fails due to interaction required, try popup
          if (error instanceof InteractionRequiredAuthError) {
            try {
              const response = await msalInstance.acquireTokenPopup(loginRequest);
              config.headers.Authorization = `Bearer ${response.accessToken}`;
            } catch {
              // Popup also failed - request will go without token
            }
          }
        }
      }
    } else {
      // Dev mode: use token from localStorage
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!isEntraConfigured()) {
        localStorage.removeItem('auth_token');
        window.location.href = '/';
      }
      // For Entra: don't redirect — the request interceptor already handled token
      // acquisition. A 401 here means the token is invalid or scopes are misconfigured.
      // Redirecting would cause an infinite loop.
    }
    return Promise.reject(error);
  }
);

export default apiClient;
