import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { statsKeys } from '@/lib/queries/stats'
import type { SubmissionStatus } from '@/types'
import { listInbox, type InboxItem, type InboxParams } from './inbox-api'

export const inboxKeys = {
  all: ['inbox'] as const,
  list: (p: InboxParams) => [...inboxKeys.all, p] as const,
}

export function useInbox(params: InboxParams) {
  return useQuery({ queryKey: inboxKeys.list(params), queryFn: () => listInbox(params), placeholderData: keepPreviousData })
}

export function useSubmissionWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.all })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    return {
      setStatus: async (item: InboxItem, status: SubmissionStatus) => {
        await apiClient.patch(`/contact-forms/${item.formId}/submissions/${item.id}`, { status })
        refresh()
      },
      remove: async (item: InboxItem) => {
        await apiClient.delete(`/contact-forms/${item.formId}/submissions/${item.id}`)
        refresh()
      },
    }
  }, [queryClient])
}
