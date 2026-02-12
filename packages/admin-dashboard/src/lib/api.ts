import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-browser';
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
        } catch {
          // Silent acquisition failed - token will be missing, 401 interceptor handles it
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
      if (isEntraConfigured() && msalInstance) {
        // Redirect to Entra login
        msalInstance.loginRedirect(loginRequest);
      } else {
        localStorage.removeItem('auth_token');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
