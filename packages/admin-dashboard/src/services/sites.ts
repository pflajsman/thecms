import apiClient from '../lib/api';
import type { PaginatedResponse, ApiResponse } from '../types';

export interface Site {
  id: string;
  name: string;
  domain: string;
  apiKey: string;
  description?: string;
  allowedOrigins?: string[];
  isActive: boolean;
  requestCount: number;
  lastRequestAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const sitesService = {
  // List all sites
  list: async (page = 1, limit = 20): Promise<PaginatedResponse<Site>> => {
    const response = await apiClient.get('/sites', {
      params: { page, limit },
    });
    return response.data;
  },

  // Get single site by ID
  getById: async (id: string): Promise<ApiResponse<Site>> => {
    const response = await apiClient.get(`/sites/${id}`);
    return response.data;
  },

  // Create new site
  create: async (data: {
    name: string;
    domain: string;
    description?: string;
    allowedOrigins?: string[];
  }): Promise<ApiResponse<Site>> => {
    const response = await apiClient.post('/sites', data);
    return response.data;
  },

  // Update site
  update: async (
    id: string,
    data: {
      name?: string;
      domain?: string;
      description?: string;
      allowedOrigins?: string[];
      isActive?: boolean;
    }
  ): Promise<ApiResponse<Site>> => {
    const response = await apiClient.put(`/sites/${id}`, data);
    return response.data;
  },

  // Delete site
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/sites/${id}`);
    return response.data;
  },

  // Rotate API key
  rotateApiKey: async (id: string): Promise<ApiResponse<Site>> => {
    const response = await apiClient.post(`/sites/${id}/rotate-key`);
    return response.data;
  },
};
