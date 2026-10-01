import apiClient from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { withoutEmpty } from './commerce-api'

export type OrderStatus = 'PLACED' | 'COMPLETED' | 'CANCELLED'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED'
export type FulfilmentStatus = 'UNFULFILLED' | 'SHIPPED'
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_DELIVERY'
export const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH_ON_DELIVERY']
export const ORDER_STATUSES: OrderStatus[] = ['PLACED', 'COMPLETED', 'CANCELLED']
export const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID', 'REFUNDED']
export const FULFILMENT_STATUSES: FulfilmentStatus[] = ['UNFULFILLED', 'SHIPPED']

export interface OrderListItem {
  id: string
  number: string
  createdAt: string
  customer: { name: string; email: string }
  total: number
  currency: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfilmentStatus: FulfilmentStatus
}

export interface OrderListParams {
  search?: string
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  fulfilmentStatus?: FulfilmentStatus
  needsAction?: boolean
  page?: number
  limit?: number
}

export interface Address {
  name: string
  company?: string
  street: string
  city: string
  postalCode: string
  country: string
  vatId?: string
}

export interface OrderLine {
  productId: string
  variantId: string
  itemId: string
  sku: string
  name: string
  optionLabels: { option: string; value: string }[]
  type: 'PHYSICAL' | 'DIGITAL'
  unitPrice: number
  quantity: number
  vatRate: number
  lineTotal: number
  weightGrams: number
}

export interface OrderHistoryEntry {
  at: string
  type: string
  by?: string
  detail?: string
}

export interface PaymentInstructions {
  holder: string
  accountNumber?: string
  iban?: string
  bic?: string
  amount: number
  currency: string
  reference: string
  qr?: string
}

export interface Order {
  id: string
  number: string
  currency: string
  language: string
  customer: { email: string; name: string; phone?: string }
  billingAddress: Address
  shippingAddress?: Address
  note?: string
  lines: OrderLine[]
  shipping: { methodId: string; name: string; price: number } | null
  payment: { method: PaymentMethod; fee: number; reference: string }
  totals: { items: number; shipping: number; paymentFee: number; total: number; vat: { rate: number; base: number; amount: number }[] }
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfilmentStatus: FulfilmentStatus
  tracking?: { number?: string; url?: string }
  internalNote?: string
  history: OrderHistoryEntry[]
  createdAt: string
  /** Present while the order is open and unpaid. */
  instructions?: PaymentInstructions
}

export async function listOrders(params: OrderListParams): Promise<PaginatedResponse<OrderListItem>> {
  const { needsAction, ...rest } = params
  return (await apiClient.get<PaginatedResponse<OrderListItem>>('/commerce/orders', { params: withoutEmpty({ ...rest, needsAction: needsAction ? 'true' : undefined }) })).data
}

export async function getOrder(id: string): Promise<Order> {
  return (await apiClient.get<ApiResponse<Order>>(`/commerce/orders/${id}`)).data.data
}

export async function ordersNeedingAction(): Promise<number> {
  return (await apiClient.get<ApiResponse<{ count: number }>>('/commerce/orders/needs-action')).data.data.count
}

export async function markOrderPaid(id: string): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/paid`)).data.data
}

export async function markOrderShipped(id: string, tracking: { trackingNumber?: string; trackingUrl?: string }): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/shipped`, tracking)).data.data
}

export async function cancelOrder(id: string, refunded: boolean): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/cancel`, { refunded })).data.data
}

export async function resendOrderEmail(id: string, what: 'confirmation' | 'downloads'): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/resend`, { what })).data.data
}

export async function saveOrderNote(id: string, note: string): Promise<Order> {
  return (await apiClient.put<ApiResponse<Order>>(`/commerce/orders/${id}/note`, { note })).data.data
}
