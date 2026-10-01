import apiClient from '@/lib/api'
import type { ApiResponse, ContentEntry, ContentType, EntryListItem, EntryStatus, EntryVersion, PaginatedResponse } from '@/types'

export interface EntryListParams {
  contentTypeId?: string
  status?: EntryStatus
  search?: string
  sortBy?: 'updatedAt' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
  /** Only versions in this language. */
  language?: string
  /** Items with no version in this language. */
  missing?: string
}

export interface EntryWriteBody {
  data: Record<string, unknown>
  status?: EntryStatus
  /** Create only: the content language; the default language when absent. */
  language?: string
}

function withoutEmpty<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>
}

export async function listEntries(params: EntryListParams): Promise<PaginatedResponse<EntryListItem>> {
  const res = await apiClient.get<PaginatedResponse<EntryListItem>>('/entries', { params: withoutEmpty(params) })
  return res.data
}

export async function getEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.get<ApiResponse<ContentEntry>>(`/entries/${id}`)).data.data
}

export async function createEntry(typeId: string, body: EntryWriteBody): Promise<ContentEntry> {
  return (await apiClient.post<ApiResponse<ContentEntry>>(`/content-types/${typeId}/entries`, body)).data.data
}

export async function updateEntry(id: string, body: Partial<EntryWriteBody>): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}`, body)).data.data
}

export async function publishEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}/publish`)).data.data
}

export async function unpublishEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}/unpublish`)).data.data
}

export async function archiveEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}/archive`)).data.data
}

export async function deleteEntry(id: string): Promise<void> {
  await apiClient.delete(`/entries/${id}`)
}

export async function listVersions(entryId: string): Promise<EntryVersion[]> {
  return (await apiClient.get<ApiResponse<EntryVersion[]>>(`/entries/${entryId}/versions`)).data.data
}

export async function createVersion(entryId: string, language: string): Promise<ContentEntry> {
  return (await apiClient.post<ApiResponse<ContentEntry>>(`/entries/${entryId}/versions`, { language })).data.data
}

export async function changeLanguage(entryId: string, language: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${entryId}/language`, { language })).data.data
}

export async function listContentTypes(): Promise<ContentType[]> {
  const res = await apiClient.get<PaginatedResponse<ContentType>>('/content-types', { params: { page: 1, limit: 100 } })
  return res.data.data
}

export async function getContentType(id: string): Promise<ContentType> {
  return (await apiClient.get<ApiResponse<ContentType>>(`/content-types/${id}`)).data.data
}

/** GET /entries/:id populates contentTypeId; create and update return it as a plain id. */
export function entryTypeId(entry: ContentEntry): string {
  const ref = entry.contentTypeId as unknown
  if (ref && typeof ref === 'object') {
    const obj = ref as { id?: string; _id?: string }
    return obj.id ?? obj._id ?? ''
  }
  return String(ref)
}
