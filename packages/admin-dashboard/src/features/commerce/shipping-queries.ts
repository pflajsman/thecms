import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMethod,
  createZone,
  deleteMethod,
  deleteZone,
  listMethods,
  listZones,
  updateMethod,
  updateZone,
  type MethodInput,
  type ShippingMethod,
  type ZoneInput,
} from './shipping-api'

export const shippingKeys = {
  all: ['shipping'] as const,
  zones: () => [...shippingKeys.all, 'zones'] as const,
  methods: () => [...shippingKeys.all, 'methods'] as const,
}

export function useZones() {
  return useQuery({ queryKey: shippingKeys.zones(), queryFn: listZones, staleTime: 30_000 })
}

export function useMethods() {
  return useQuery({ queryKey: shippingKeys.methods(), queryFn: listMethods, staleTime: 30_000 })
}

export function useShippingWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: shippingKeys.all })
    return {
      saveZone: async (id: string | undefined, body: ZoneInput) => {
        const saved = id ? await updateZone(id, body) : await createZone(body)
        refresh()
        return saved
      },
      removeZone: async (id: string) => {
        await deleteZone(id)
        refresh()
      },
      saveMethod: async (id: string | undefined, body: MethodInput) => {
        const saved = id ? await updateMethod(id, body) : await createMethod(body)
        // The editor opens the saved method by id right away, so put it in the list before the refetch.
        queryClient.setQueryData<ShippingMethod[]>(shippingKeys.methods(), (old = []) =>
          old.some((m) => m.id === saved.id) ? old.map((m) => (m.id === saved.id ? saved : m)) : [...old, saved],
        )
        refresh()
        return saved
      },
      removeMethod: async (id: string) => {
        await deleteMethod(id)
        refresh()
      },
    }
  }, [queryClient])
}
