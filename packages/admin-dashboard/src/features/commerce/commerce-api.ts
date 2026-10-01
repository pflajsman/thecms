import apiClient from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types'

export interface ShopCurrency {
  code: string
  decimals: number
}

export interface VatRate {
  id: string
  name: string
  /** Basis points: 2100 = 21 %. */
  rate: number
}

export interface ShopSettings {
  currencies: ShopCurrency[]
  defaultCurrency?: string
  vatRates: VatRate[]
}

export type ProductType = 'PHYSICAL' | 'DIGITAL'
export type Labels = Record<string, string>

export interface ProductOption {
  key: string
  labels: Labels
  values: { key: string; labels: Labels }[]
}

export interface DigitalFile {
  originalName: string
  mimeType: string
  size: number
}

export interface Product {
  id: string
  itemId: string
  type: ProductType
  vatRateId: string
  active: boolean
  options: ProductOption[]
  digitalFile?: DigitalFile
}

export interface Variant {
  id: string
  sku: string
  optionValues: Record<string, string>
  /** Minor units per currency code. */
  prices: Record<string, number>
  weightGrams: number
  stock: { tracked: boolean; quantity: number }
  active: boolean
}

// baseQuantity: the stock the form loaded, so the server applies only the admin's change.
export type VariantRow = Omit<Variant, 'id' | 'stock'> & { id?: string; stock: Variant['stock'] & { baseQuantity?: number } }

export interface ProductDetail {
  product: Product
  variants: Variant[]
  entry: { itemId: string; defaultVersionId: string | null; name: string }
  removedVariantIds?: string[]
}

export interface ProductListItem {
  id: string
  itemId: string
  type: ProductType
  active: boolean
  name: string
  published: boolean
  variantsCount: number
  priceRange: { min: number; max: number } | null
  stock: 'out' | 'low' | null
}

export type ProductStatusFilter = 'active' | 'inactive' | 'unpublished'

export interface ProductListParams {
  page?: number
  limit?: number
  search?: string
  type?: ProductType
  status?: ProductStatusFilter
}

function withoutEmpty<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}

export async function getShopSettings(): Promise<ShopSettings> {
  return (await apiClient.get<ApiResponse<ShopSettings>>('/commerce/settings')).data.data
}

export async function saveShopSettings(body: ShopSettings): Promise<ShopSettings> {
  return (await apiClient.put<ApiResponse<ShopSettings>>('/commerce/settings', body)).data.data
}

export async function listProducts(params: ProductListParams): Promise<PaginatedResponse<ProductListItem>> {
  return (await apiClient.get<PaginatedResponse<ProductListItem>>('/commerce/products', { params: withoutEmpty(params) })).data
}

export async function createProduct(body: { name: string; type: ProductType }): Promise<ProductDetail> {
  return (await apiClient.post<ApiResponse<ProductDetail>>('/commerce/products', body)).data.data
}

export async function getProduct(id: string): Promise<ProductDetail> {
  return (await apiClient.get<ApiResponse<ProductDetail>>(`/commerce/products/${id}`)).data.data
}

export async function updateProduct(id: string, body: { vatRateId?: string; active?: boolean; options?: ProductOption[] }): Promise<ProductDetail> {
  return (await apiClient.put<ApiResponse<ProductDetail>>(`/commerce/products/${id}`, body)).data.data
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/commerce/products/${id}`)
}

export async function saveVariants(id: string, variants: VariantRow[]): Promise<Variant[]> {
  return (await apiClient.put<ApiResponse<Variant[]>>(`/commerce/products/${id}/variants`, { variants })).data.data
}

export async function uploadProductFile(id: string, file: File): Promise<DigitalFile> {
  const form = new FormData()
  form.append('file', file)
  return (await apiClient.post<ApiResponse<DigitalFile>>(`/commerce/products/${id}/file`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data
}
