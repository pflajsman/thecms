import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWebhook,
  deleteWebhook,
  getLogs,
  getWebhook,
  listWebhooks,
  rotateSecret,
  testWebhook,
  updateWebhook,
  type WebhookPayload,
} from './webhooks-api'

export const webhookKeys = {
  all: ['webhooks'] as const,
  item: (id: string) => ['webhooks', 'item', id] as const,
  logs: (id: string) => ['webhooks', 'logs', id] as const,
}

export function useWebhooks() {
  return useQuery({ queryKey: webhookKeys.all, queryFn: listWebhooks })
}

export function useWebhook(id?: string) {
  return useQuery({ queryKey: webhookKeys.item(id ?? ''), queryFn: () => getWebhook(id!), enabled: !!id })
}

export function useWebhookLogs(id?: string) {
  return useQuery({ queryKey: webhookKeys.logs(id ?? ''), queryFn: () => getLogs(id!), enabled: !!id })
}

export function useWebhookWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refreshList = () => void queryClient.invalidateQueries({ queryKey: webhookKeys.all, exact: true })
    return {
      create: async (body: WebhookPayload) => {
        const created = await createWebhook(body)
        refreshList()
        return created
      },
      update: async (id: string, body: WebhookPayload) => {
        const updated = await updateWebhook(id, body)
        queryClient.setQueryData(webhookKeys.item(id), updated)
        refreshList()
        return updated
      },
      remove: async (id: string) => {
        await deleteWebhook(id)
        queryClient.removeQueries({ queryKey: webhookKeys.item(id) })
        refreshList()
      },
      test: async (id: string) => {
        const result = await testWebhook(id)
        refreshList()
        void queryClient.invalidateQueries({ queryKey: webhookKeys.item(id) })
        void queryClient.invalidateQueries({ queryKey: webhookKeys.logs(id) })
        return result
      },
      rotate: async (id: string) => {
        const secret = await rotateSecret(id)
        void queryClient.invalidateQueries({ queryKey: webhookKeys.item(id) })
        return secret
      },
    }
  }, [queryClient])
}
