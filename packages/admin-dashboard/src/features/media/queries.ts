import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import type { MediaFile } from '@/types'
import { deleteMedia, getMedia, getMediaUsage, listMedia, updateMedia, type MediaListParams } from './media-api'

export const mediaKeys = {
  all: ['media'] as const,
  lists: () => [...mediaKeys.all, 'list'] as const,
  list: (params: MediaListParams) => [...mediaKeys.lists(), params] as const,
  item: (id: string) => [...mediaKeys.all, 'item', id] as const,
  byIds: (ids: string[]) => [...mediaKeys.all, 'ids', [...ids].sort().join(',')] as const,
  usage: (id: string) => [...mediaKeys.all, 'usage', id] as const,
}

export function useMediaList(params: MediaListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: mediaKeys.list(params),
    queryFn: () => listMedia(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useMedia(id?: string) {
  return useQuery({ queryKey: mediaKeys.item(id ?? ''), queryFn: () => getMedia(id!), enabled: !!id })
}

/** Batch lookup; ids missing from the result were deleted. */
export function useMediaByIds(ids: string[]) {
  const unique = useMemo(() => [...new Set(ids.filter(Boolean))], [ids])
  const query = useQuery({
    queryKey: mediaKeys.byIds(unique),
    queryFn: () => listMedia({ ids: unique, limit: 100 }),
    enabled: unique.length > 0,
    staleTime: 60_000,
  })
  const byId = useMemo(() => new Map<string, MediaFile>((query.data?.data ?? []).map((m) => [m.id, m])), [query.data])
  return { byId, isLoading: query.isLoading && unique.length > 0, isFetched: query.isFetched }
}

export function useMediaUsage(id?: string) {
  return useQuery({ queryKey: mediaKeys.usage(id ?? ''), queryFn: () => getMediaUsage(id!), enabled: !!id })
}

export function useMediaWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    return {
      invalidate,
      update: async (id: string, body: Parameters<typeof updateMedia>[1]) => {
        const media = await updateMedia(id, body)
        queryClient.setQueryData(mediaKeys.item(id), media)
        invalidate()
        return media
      },
      remove: async (id: string) => {
        await deleteMedia(id)
        queryClient.removeQueries({ queryKey: mediaKeys.item(id) })
        invalidate()
      },
    }
  }, [queryClient])
}
