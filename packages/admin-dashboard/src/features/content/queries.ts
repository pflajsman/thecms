import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import type { ContentEntry } from '@/types'
import {
  archiveEntry,
  createEntry,
  deleteEntry,
  getContentType,
  getEntry,
  listContentTypes,
  listEntries,
  publishEntry,
  unpublishEntry,
  updateEntry,
  type EntryListParams,
  type EntryWriteBody,
} from './content-api'

export const contentKeys = {
  all: ['content'] as const,
  lists: () => [...contentKeys.all, 'list'] as const,
  list: (params: EntryListParams) => [...contentKeys.lists(), params] as const,
  entry: (id: string) => [...contentKeys.all, 'entry', id] as const,
  types: () => [...contentKeys.all, 'types'] as const,
  type: (id: string) => [...contentKeys.all, 'type', id] as const,
}

export function useEntryList(params: EntryListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contentKeys.list(params),
    queryFn: () => listEntries(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useEntry(id?: string) {
  return useQuery({
    queryKey: contentKeys.entry(id ?? ''),
    queryFn: () => getEntry(id!),
    enabled: !!id,
  })
}

export function useContentTypes() {
  return useQuery({ queryKey: contentKeys.types(), queryFn: listContentTypes, staleTime: 60_000 })
}

export function useContentType(id?: string) {
  return useQuery({
    queryKey: contentKeys.type(id ?? ''),
    queryFn: () => getContentType(id!),
    enabled: !!id,
    staleTime: 60_000,
  })
}

/** Write helpers: every write refreshes lists and stats, and seeds the entry cache. */
export function useEntryWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    const done = async (promise: Promise<ContentEntry>) => {
      const entry = await promise
      queryClient.setQueryData(contentKeys.entry(entry.id), entry)
      refresh()
      return entry
    }
    return {
      create: ({ typeId, body }: { typeId: string; body: EntryWriteBody }) => done(createEntry(typeId, body)),
      update: ({ id, body }: { id: string; body: Partial<EntryWriteBody> }) => done(updateEntry(id, body)),
      publish: (id: string) => done(publishEntry(id)),
      unpublish: (id: string) => done(unpublishEntry(id)),
      archive: (id: string) => done(archiveEntry(id)),
      remove: async (id: string) => {
        await deleteEntry(id)
        queryClient.removeQueries({ queryKey: contentKeys.entry(id) })
        refresh()
      },
    }
  }, [queryClient])
}
