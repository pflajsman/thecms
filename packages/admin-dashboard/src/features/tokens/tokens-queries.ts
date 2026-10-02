import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createToken, listTokens, revokeToken, type TokenExpiry } from './tokens-api'

export const tokenKeys = { list: ['tokens', 'list'] as const }

export function useTokens() {
  return useQuery({ queryKey: tokenKeys.list, queryFn: listTokens })
}

/** Writes refresh the list; the created token itself is returned to the caller and never cached. */
export function useTokenWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: tokenKeys.list })
    return {
      create: async (body: { name: string; expiresInDays?: TokenExpiry }) => {
        const created = await createToken(body)
        refresh()
        return created
      },
      revoke: async (id: string) => {
        await revokeToken(id)
        refresh()
      },
    }
  }, [queryClient])
}
