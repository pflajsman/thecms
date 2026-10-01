import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import { contentKeys } from '@/features/content/queries'
import { entryTypeId } from '@/features/content/content-api'
import type { ContentEntry } from '@/types'
import { createModel, deleteModel, getEntryCount, updateModel, type ModelPayload } from './models-api'

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
        // Saving can rewrite entry data on the server (fields made shared, titles recomputed).
        queryClient.removeQueries({
          predicate: (q) => {
            const entry = q.queryKey[0] === contentKeys.all[0] && q.queryKey[1] === 'entry' ? (q.state.data as ContentEntry | undefined) : undefined
            return !!entry && entryTypeId(entry) === id
          },
        })
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
