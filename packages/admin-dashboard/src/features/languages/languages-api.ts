import apiClient from '@/lib/api'
import type { ApiResponse } from '@/types'

export interface Language {
  id: string
  code: string
  name: string
  isDefault: boolean
  order: number
}

/** Same rule as the backend (models/language.model.ts). */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/

export async function listLanguages(): Promise<Language[]> {
  return (await apiClient.get<ApiResponse<Language[]>>('/languages')).data.data
}

export async function createLanguage(body: { code: string; name: string }): Promise<Language> {
  return (await apiClient.post<ApiResponse<Language>>('/languages', body)).data.data
}

export async function renameLanguage(code: string, name: string): Promise<Language> {
  return (await apiClient.put<ApiResponse<Language>>(`/languages/${code}`, { name })).data.data
}

export async function makeDefaultLanguage(code: string): Promise<Language> {
  return (await apiClient.put<ApiResponse<Language>>(`/languages/${code}/default`)).data.data
}

export async function deleteLanguage(code: string): Promise<{ deletedVersions: number }> {
  return (await apiClient.delete<ApiResponse<{ deletedVersions: number }>>(`/languages/${code}`, { params: { confirm: code } })).data.data
}
