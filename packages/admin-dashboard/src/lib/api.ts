import axios from 'axios';
import { isEntraConfigured } from '../config/msalConfig';
import { API_BASE_URL, authorizationHeader } from './auth-header';

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
