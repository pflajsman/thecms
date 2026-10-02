import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAiConnection, getAiStatus, saveAiConnection, saveAiSettings, type AiStatus, type ConnectionInput } from './ai-api'

export const aiKeys = { status: ['ai', 'status'] as const }

export function useAiStatus() {
  return useQuery({ queryKey: aiKeys.status, queryFn: getAiStatus, staleTime: 60_000 })
}

/** True when this user can use AI now: set up on the server, allowed, and connected. */
export function useAiReady(): boolean {
  const status = useAiStatus().data
  return !!status && status.available && status.enabled && !!status.connection
}

export function useAiWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const store = (status: AiStatus) => {
      queryClient.setQueryData(aiKeys.status, status)
      return status
    }
    return {
      save: async (body: ConnectionInput) => store(await saveAiConnection(body)),
      disconnect: async () => store(await deleteAiConnection()),
      setEnabled: async (enabled: boolean) => store(await saveAiSettings(enabled)),
    }
  }, [queryClient])
}
