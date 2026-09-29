import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { statsKeys } from '@/lib/queries/stats'
import { contentKeys } from '@/features/content/queries'
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

export function useEntryCount(id?: string) {
  return useQuery({ queryKey: [...contentKeys.type(id ?? ''), 'entry-count'], queryFn: () => getEntryCount(id!), enabled: !!id })
}

export function useModelWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = (id?: string) => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.types() })
      if (id) void queryClient.invalidateQueries({ queryKey: contentKeys.type(id) })
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    return {
      create: async (body: ModelPayload) => {
        const ct = await createModel(body)
        queryClient.setQueryData(contentKeys.type(ct.id), ct)
        refresh(ct.id)
        return ct
      },
      update: async (id: string, body: ModelPayload) => {
        const ct = await updateModel(id, body)
        queryClient.setQueryData(contentKeys.type(id), ct)
        refresh(id)
        return ct
      },
      remove: async (id: string, force: boolean) => {
        await deleteModel(id, force)
        queryClient.removeQueries({ queryKey: contentKeys.type(id) })
        refresh()
      },
    }
  }, [queryClient])
}
