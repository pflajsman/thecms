import apiClient from '@/lib/api'
import type { ApiResponse, ContentType, Field } from '@/types'

export interface ModelPayload {
  name: string
  slug: string
  description?: string
  fields: Field[]
  titleField?: string
}

export async function createModel(body: ModelPayload): Promise<ContentType> {
  return (await apiClient.post<ApiResponse<ContentType>>('/content-types', body)).data.data
}

export async function updateModel(id: string, body: ModelPayload): Promise<ContentType> {
  return (await apiClient.put<ApiResponse<ContentType>>(`/content-types/${id}`, body)).data.data
}

export async function deleteModel(id: string, force: boolean): Promise<void> {
  await apiClient.delete(`/content-types/${id}`, { params: force ? { force: 'true' } : undefined })
}

export async function getEntryCount(id: string): Promise<number> {
  const res = await apiClient.get<{ data?: { count?: number } }>(`/content-types/${id}/entry-count`)
  return res.data?.data?.count ?? 0
}
