import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import type { ContentEntry } from '@/types'
import {
  archiveEntry,
  changeLanguage as changeEntryLanguage,
  createVersion,
  listVersions,
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
  versions: (itemId: string) => [...contentKeys.all, 'versions', itemId] as const,
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

/** Every language version of the entry's item; keyed by item so all versions share one cache entry. */
export function useVersions(entry?: ContentEntry, options: { enabled?: boolean } = {}) {
  const itemId = entry?.itemId ?? entry?.id
  return useQuery({
    queryKey: contentKeys.versions(itemId ?? ''),
    queryFn: () => listVersions(entry!.id),
    enabled: !!entry && (options.enabled ?? true),
  })
}

/** Write helpers: every write refreshes lists and stats, and seeds the entry cache. */
export function useEntryWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = (saved?: ContentEntry) => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
      void queryClient.invalidateQueries({ queryKey: [...contentKeys.all, 'versions'] })
      // Shared fields are copied to the item's other language versions on the server. Drop those
      // cached versions: the editor reads its values once on open, so a stale copy would stay on screen.
      if (saved?.itemId) {
        queryClient.removeQueries({
          predicate: (q) =>
            q.queryKey[0] === contentKeys.all[0] &&
            q.queryKey[1] === 'entry' &&
            q.queryKey[2] !== saved.id &&
            (q.state.data as ContentEntry | undefined)?.itemId === saved.itemId,
        })
      }
    }
    const done = async (promise: Promise<ContentEntry>) => {
      const entry = await promise
      queryClient.setQueryData(contentKeys.entry(entry.id), entry)
      refresh(entry)
      return entry
    }
    return {
      create: ({ typeId, body }: { typeId: string; body: EntryWriteBody }) => done(createEntry(typeId, body)),
      update: ({ id, body }: { id: string; body: Partial<EntryWriteBody> }) => done(updateEntry(id, body)),
      publish: (id: string) => done(publishEntry(id)),
      unpublish: (id: string) => done(unpublishEntry(id)),
      archive: (id: string) => done(archiveEntry(id)),
      translate: (entryId: string, language: string) => done(createVersion(entryId, language)),
      changeLanguage: (entryId: string, language: string) => done(changeEntryLanguage(entryId, language)),
      /** After a version was created elsewhere (AI translation): refresh lists, stats and versions. */
      refreshVersions: () => refresh(),
      remove: async (id: string) => {
        await deleteEntry(id)
        queryClient.removeQueries({ queryKey: contentKeys.entry(id) })
        refresh()
      },
    }
  }, [queryClient])
}
