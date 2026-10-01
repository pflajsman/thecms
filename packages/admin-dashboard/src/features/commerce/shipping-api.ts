import apiClient from '@/lib/api'
import type { ApiResponse } from '@/types'
import type { Labels } from './commerce-api'
import type { PaymentMethod } from './orders-api'

export interface ShippingZone {
  id: string
  name: string
  countries: string[]
  rest: boolean
  order: number
}
export type ZoneInput = Pick<ShippingZone, 'name' | 'countries' | 'rest'>

export interface WeightBand {
  /** null: no upper limit (only the last band). */
  upToGrams: number | null
  prices: Record<string, number>
}

export interface ShippingRate {
  zoneId: string
  bands: WeightBand[]
}

export interface ShippingMethod {
  id: string
  labels: Labels
  active: boolean
  paymentMethods: PaymentMethod[]
  codFees: Record<string, number>
  freeOver: Record<string, number>
  rates: ShippingRate[]
  order: number
}
export type MethodInput = Omit<ShippingMethod, 'id' | 'order'>

export async function listZones(): Promise<ShippingZone[]> {
  return (await apiClient.get<ApiResponse<ShippingZone[]>>('/commerce/shipping/zones')).data.data
}

export async function createZone(body: ZoneInput): Promise<ShippingZone> {
  return (await apiClient.post<ApiResponse<ShippingZone>>('/commerce/shipping/zones', body)).data.data
}

export async function updateZone(id: string, body: ZoneInput): Promise<ShippingZone> {
  return (await apiClient.put<ApiResponse<ShippingZone>>(`/commerce/shipping/zones/${id}`, body)).data.data
}

export async function deleteZone(id: string): Promise<void> {
  await apiClient.delete(`/commerce/shipping/zones/${id}`)
}

export async function listMethods(): Promise<ShippingMethod[]> {
  return (await apiClient.get<ApiResponse<ShippingMethod[]>>('/commerce/shipping/methods')).data.data
}

export async function createMethod(body: MethodInput): Promise<ShippingMethod> {
  return (await apiClient.post<ApiResponse<ShippingMethod>>('/commerce/shipping/methods', body)).data.data
}

export async function updateMethod(id: string, body: MethodInput): Promise<ShippingMethod> {
  return (await apiClient.put<ApiResponse<ShippingMethod>>(`/commerce/shipping/methods/${id}`, body)).data.data
}

export async function deleteMethod(id: string): Promise<void> {
  await apiClient.delete(`/commerce/shipping/methods/${id}`)
}
