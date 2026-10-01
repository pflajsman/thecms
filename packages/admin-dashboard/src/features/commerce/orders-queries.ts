import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelOrder,
  getOrder,
  listOrders,
  markOrderPaid,
  markOrderShipped,
  ordersNeedingAction,
  resendOrderEmail,
  saveOrderNote,
  type OrderListParams,
} from './orders-api'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: OrderListParams) => [...orderKeys.lists(), params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  needsAction: () => [...orderKeys.all, 'needs-action'] as const,
}

export function useOrders(params: OrderListParams) {
  return useQuery({ queryKey: orderKeys.list(params), queryFn: () => listOrders(params), placeholderData: keepPreviousData })
}

export function useOrder(id?: string) {
  return useQuery({ queryKey: orderKeys.detail(id ?? ''), queryFn: () => getOrder(id!), enabled: !!id })
}

/** Navigation badge: orders the shop has to send. Refreshed every minute; zero shows no badge. */
export function useOrdersNeedingAction(): number | undefined {
  const query = useQuery({ queryKey: orderKeys.needsAction(), queryFn: ordersNeedingAction, refetchInterval: 60_000, staleTime: 30_000 })
  return query.data || undefined
}

/** Every action reloads the order (the action responses carry no payment instructions), the lists and the badge. */
export function useOrderWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = async (id: string) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: orderKeys.needsAction() })
      await queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
    }
    const after = async <T,>(id: string, run: Promise<T>) => {
      const result = await run
      await refresh(id)
      return result
    }
    return {
      refresh,
      markPaid: (id: string) => after(id, markOrderPaid(id)),
      markShipped: (id: string, tracking: { trackingNumber?: string; trackingUrl?: string }) => after(id, markOrderShipped(id, tracking)),
      cancel: (id: string, refunded: boolean) => after(id, cancelOrder(id, refunded)),
      resend: (id: string, what: 'confirmation' | 'downloads') => after(id, resendOrderEmail(id, what)),
      saveNote: (id: string, note: string) => after(id, saveOrderNote(id, note)),
    }
  }, [queryClient])
}
