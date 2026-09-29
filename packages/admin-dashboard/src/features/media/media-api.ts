import apiClient from '@/lib/api'
import type { ApiResponse, EntryStatus, MediaFile, PaginatedResponse } from '@/types'

export interface MediaListParams {
  page?: number
  limit?: number
  category?: 'image' | 'document' | 'video'
  search?: string
  ids?: string[]
}

export interface MediaUsageItem {
  id: string
  title: string
  status: EntryStatus
  contentType: { id: string; name: string; slug: string }
}

export async function listMedia(params: MediaListParams): Promise<PaginatedResponse<MediaFile>> {
  const query: Record<string, string | number> = {}
  if (params.page) query.page = params.page
  if (params.limit) query.limit = params.limit
  if (params.category) query.category = params.category
  if (params.search) query.search = params.search
  if (params.ids && params.ids.length > 0) query.ids = params.ids.join(',')
  return (await apiClient.get<PaginatedResponse<MediaFile>>('/media', { params: query })).data
}

export async function getMedia(id: string): Promise<MediaFile> {
  return (await apiClient.get<ApiResponse<MediaFile>>(`/media/${id}`)).data.data
}

export async function uploadMedia(file: File, onProgress?: (fraction: number) => void): Promise<MediaFile> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<ApiResponse<MediaFile>>('/media/upload', form, {
    // The client's default JSON content type would serialize FormData; axios adds the boundary.
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
  })
  return res.data.data
}

export async function updateMedia(id: string, body: { altText?: string; description?: string; tags?: string[] }): Promise<MediaFile> {
  return (await apiClient.patch<ApiResponse<MediaFile>>(`/media/${id}`, body)).data.data
}

export async function deleteMedia(id: string): Promise<void> {
  await apiClient.delete(`/media/${id}`)
}

export async function getMediaUsage(id: string): Promise<MediaUsageItem[]> {
  return (await apiClient.get<ApiResponse<MediaUsageItem[]>>(`/media/${id}/usage`)).data.data
}
