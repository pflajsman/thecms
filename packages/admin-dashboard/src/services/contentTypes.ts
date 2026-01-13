import apiClient from '../lib/api';
import type { ContentType, PaginatedResponse, ApiResponse } from '../types';

export const contentTypesService = {
  // List all content types
  list: async (page = 1, limit = 20): Promise<PaginatedResponse<ContentType>> => {
    const response = await apiClient.get('/content-types', {
      params: { page, limit },
    });
    return response.data;
  },

  // Get single content type by ID
  getById: async (id: string): Promise<ApiResponse<ContentType>> => {
    const response = await apiClient.get(`/content-types/${id}`);
    return response.data;
  },

  // Get content type by slug
  getBySlug: async (slug: string): Promise<ApiResponse<ContentType>> => {
    const response = await apiClient.get(`/content-types/slug/${slug}`);
    return response.data;
  },

  // Create new content type
  create: async (data: Omit<ContentType, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<ContentType>> => {
    const response = await apiClient.post('/content-types', data);
    return response.data;
  },

  // Update content type
  update: async (id: string, data: Partial<Omit<ContentType, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<ContentType>> => {
    const response = await apiClient.put(`/content-types/${id}`, data);
    return response.data;
  },

  // Delete content type
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/content-types/${id}`);
    return response.data;
  },
};
