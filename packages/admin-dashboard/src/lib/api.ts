import axios, { type InternalAxiosRequestConfig } from 'axios';
import { isEntraConfigured } from '../config/msalConfig';
import { API_BASE_URL, authorizationHeader, renewSession } from './auth-header';
import { projectHeaders } from './current-project';

export { setMsalInstance } from './auth-header';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const authorization = await authorizationHeader();
    if (authorization) config.headers.Authorization = authorization;
    for (const [name, value] of Object.entries(projectHeaders())) config.headers[name] = value;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (!isEntraConfigured()) {
        localStorage.removeItem('auth_token');
        window.location.href = '/';
        return Promise.reject(error);
      }
      // For Entra: the cached token may be stale (e.g. after the laptop slept). Retry once with a fresh one,
      // and if the server still refuses, send the user through Entra instead of failing every request.
      const config = error.config as (InternalAxiosRequestConfig & { _authRetried?: boolean }) | undefined;
      if (config && !config._authRetried) {
        config._authRetried = true;
        const authorization = await authorizationHeader({ forceRefresh: true });
        if (authorization) {
          config.headers.Authorization = authorization;
          return apiClient(config);
        }
      } else {
        renewSession();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
