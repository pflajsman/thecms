import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import { contentKeys } from '@/features/content/queries'
import { createLanguage, deleteLanguage, listLanguages, makeDefaultLanguage, renameLanguage } from './languages-api'

export const languageKeys = { all: ['languages'] as const }

export function useLanguages() {
  return useQuery({ queryKey: languageKeys.all, queryFn: listLanguages, staleTime: 60_000 })
}

export function useLanguageWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: languageKeys.all })
    return {
      create: async (body: { code: string; name: string }) => {
        const created = await createLanguage(body)
        refresh()
        return created
      },
      rename: async (code: string, name: string) => {
        const renamed = await renameLanguage(code, name)
        refresh()
        return renamed
      },
      makeDefault: async (code: string) => {
        const updated = await makeDefaultLanguage(code)
        refresh()
        return updated
      },
      remove: async (code: string) => {
        const result = await deleteLanguage(code)
        refresh()
        void queryClient.invalidateQueries({ queryKey: contentKeys.all })
        void queryClient.invalidateQueries({ queryKey: statsKeys.all })
        return result
      },
    }
  }, [queryClient])
}
