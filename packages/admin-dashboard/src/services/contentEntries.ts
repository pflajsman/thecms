import apiClient from '../lib/api';
import type { ContentEntry, PaginatedResponse, ApiResponse } from '../types';

export interface ListEntriesParams {
  page?: number;
  limit?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export const contentEntriesService = {
  // List entries for a content type
  listByContentType: async (
    contentTypeId: string,
    params: ListEntriesParams = {}
  ): Promise<PaginatedResponse<ContentEntry>> => {
    const response = await apiClient.get(`/content-types/${contentTypeId}/entries`, {
      params,
    });
    return response.data;
  },

  // Get single entry by ID
  getById: async (id: string): Promise<ApiResponse<ContentEntry>> => {
    const response = await apiClient.get(`/entries/${id}`);
    return response.data;
  },

  // Create new entry
  create: async (
    contentTypeId: string,
    data: {
      data: Record<string, any>;
      status?: 'DRAFT' | 'PUBLISHED';
    }
  ): Promise<ApiResponse<ContentEntry>> => {
    const response = await apiClient.post(`/content-types/${contentTypeId}/entries`, data);
    return response.data;
  },

  // Update entry
  update: async (
    id: string,
    data: {
      data: Record<string, any>;
    }
  ): Promise<ApiResponse<ContentEntry>> => {
    const response = await apiClient.put(`/entries/${id}`, data);
    return response.data;
  },

  // Delete entry
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/entries/${id}`);
    return response.data;
  },

  // Publish entry
  publish: async (id: string): Promise<ApiResponse<ContentEntry>> => {
    const response = await apiClient.put(`/entries/${id}/publish`);
    return response.data;
  },

  // Unpublish entry
  unpublish: async (id: string): Promise<ApiResponse<ContentEntry>> => {
    const response = await apiClient.put(`/entries/${id}/unpublish`);
    return response.data;
  },

  // Archive entry
  archive: async (id: string): Promise<ApiResponse<ContentEntry>> => {
    const response = await apiClient.put(`/entries/${id}/archive`);
    return response.data;
  },

  // Search entries
  search: async (query: string): Promise<PaginatedResponse<ContentEntry>> => {
    const response = await apiClient.get('/entries/search', {
      params: { q: query },
    });
    return response.data;
  },
};
