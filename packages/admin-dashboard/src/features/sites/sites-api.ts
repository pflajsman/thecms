import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sitesService, type Site } from '@/services/sites'
import { statsKeys } from '@/lib/queries/stats'
import type { SitePayload } from './sites-utils'

export type { Site }

export const siteKeys = { all: ['sites'] as const, item: (id: string) => ['sites', 'item', id] as const }

export function useSites() {
  return useQuery({
    queryKey: siteKeys.all,
    queryFn: async () => (await sitesService.list(1, 100)).data,
    staleTime: 60_000,
  })
}

export function useSite(id?: string) {
  return useQuery({ queryKey: siteKeys.item(id ?? ''), queryFn: async () => (await sitesService.getById(id!)).data, enabled: !!id })
}

export function useSiteWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.all, exact: true })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    const done = (site: Site) => {
      queryClient.setQueryData(siteKeys.item(site.id), site)
      refresh()
      return site
    }
    return {
      create: async (body: SitePayload) => done((await sitesService.create(body)).data),
      update: async (id: string, body: SitePayload) => done((await sitesService.update(id, body)).data),
      rotate: async (id: string) => done((await sitesService.rotateApiKey(id)).data),
      remove: async (id: string) => {
        await sitesService.delete(id)
        queryClient.removeQueries({ queryKey: siteKeys.item(id) })
        refresh()
      },
    }
  }, [queryClient])
}
