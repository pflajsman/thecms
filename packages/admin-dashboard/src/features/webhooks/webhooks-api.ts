import apiClient from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types'

export type DeliveryStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING'

export interface Webhook {
  id: string
  name: string
  url: string
  description?: string
  events: string[]
  isActive: boolean
  siteId?: string
  secretPreview?: string
  totalDeliveries: number
  successfulDeliveries: number
  failedDeliveries: number
  lastDeliveryAt?: string
  lastDeliveryStatus?: DeliveryStatus
  createdAt: string
  updatedAt: string
}

export interface DeliveryLogEntry {
  timestamp: string
  event: string
  status: DeliveryStatus
  statusCode?: number
  responseTime?: number
  errorMessage?: string
  attemptNumber: number
  payload?: unknown
}

export interface WebhookPayload {
  name: string
  url: string
  description?: string
  events: string[]
  siteId?: string
  isActive?: boolean
}

export interface TestResult {
  success: boolean
  statusCode?: number
  responseTime?: number
  error?: string
}

export async function listWebhooks(): Promise<Webhook[]> {
  return (await apiClient.get<PaginatedResponse<Webhook>>('/webhooks', { params: { page: 1, limit: 100 } })).data.data
}

export async function getWebhook(id: string): Promise<Webhook> {
  return (await apiClient.get<ApiResponse<Webhook>>(`/webhooks/${id}`)).data.data
}

export async function createWebhook(body: WebhookPayload): Promise<Webhook & { secret: string }> {
  return (await apiClient.post<ApiResponse<Webhook & { secret: string }>>('/webhooks', body)).data.data
}

export async function updateWebhook(id: string, body: WebhookPayload): Promise<Webhook> {
  return (await apiClient.put<ApiResponse<Webhook>>(`/webhooks/${id}`, body)).data.data
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiClient.delete(`/webhooks/${id}`)
}

export async function testWebhook(id: string): Promise<TestResult> {
  return (await apiClient.post<ApiResponse<TestResult>>(`/webhooks/${id}/test`)).data.data
}

export async function rotateSecret(id: string): Promise<string> {
  return (await apiClient.post<ApiResponse<{ newSecret: string }>>(`/webhooks/${id}/rotate-secret`)).data.data.newSecret
}

export async function getLogs(id: string): Promise<DeliveryLogEntry[]> {
  return (await apiClient.get<ApiResponse<DeliveryLogEntry[]>>(`/webhooks/${id}/logs`)).data.data
}
