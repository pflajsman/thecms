import apiClient from '../lib/api';
import type { MediaFile, PaginatedResponse, ApiResponse } from '../types';

export interface ListMediaParams {
  page?: number;
  limit?: number;
  category?: 'image' | 'document' | 'video';
  mimeType?: string;
  tags?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const mediaService = {
  // List media files
  list: async (params: ListMediaParams = {}): Promise<PaginatedResponse<MediaFile>> => {
    const response = await apiClient.get('/media', { params });
    return response.data;
  },

  // Get single media file
  getById: async (id: string): Promise<ApiResponse<MediaFile>> => {
    const response = await apiClient.get(`/media/${id}`);
    return response.data;
  },

  // Upload media file
  upload: async (
    file: File,
    metadata?: {
      altText?: string;
      description?: string;
      tags?: string;
    }
  ): Promise<ApiResponse<MediaFile>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.altText) formData.append('altText', metadata.altText);
    if (metadata?.description) formData.append('description', metadata.description);
    if (metadata?.tags) formData.append('tags', metadata.tags);

    const response = await apiClient.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Update media metadata
  updateMetadata: async (
    id: string,
    metadata: {
      altText?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<ApiResponse<MediaFile>> => {
    const response = await apiClient.patch(`/media/${id}`, metadata);
    return response.data;
  },

  // Delete media file
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/media/${id}`);
    return response.data;
  },
};
