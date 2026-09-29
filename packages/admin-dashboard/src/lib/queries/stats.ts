import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import type { ApiResponse, DashboardStats } from '@/types'

export const statsKeys = { all: ['stats'] as const }

export function useStats() {
  return useQuery({
    queryKey: statsKeys.all,
    queryFn: async () => (await apiClient.get<ApiResponse<DashboardStats>>('/stats')).data.data,
    staleTime: 30_000,
  })
}

export function useUnreadCount(): number | undefined {
  return useStats().data?.submissions.unread
}
