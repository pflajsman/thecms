import { useQuery } from '@tanstack/react-query'
import { sitesService, type Site } from '@/services/sites'

export type { Site }

export const siteKeys = { all: ['sites'] as const }

export function useSites() {
  return useQuery({
    queryKey: siteKeys.all,
    queryFn: async () => (await sitesService.list(1, 100)).data,
    staleTime: 60_000,
  })
}
