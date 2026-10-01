import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import { contentKeys } from '@/features/content/queries'
import {
  createProduct,
  deleteProduct,
  getProduct,
  getShopSettings,
  listProducts,
  saveShopSettings,
  saveVariants,
  updateProduct,
  uploadProductFile,
  type ProductDetail,
  type ProductListParams,
  type ProductOption,
  type ProductType,
  type ShopSettings,
  type VariantRow,
} from './commerce-api'

export const commerceKeys = {
  all: ['commerce'] as const,
  settings: () => [...commerceKeys.all, 'settings'] as const,
  lists: () => [...commerceKeys.all, 'list'] as const,
  list: (params: ProductListParams) => [...commerceKeys.lists(), params] as const,
  product: (id: string) => [...commerceKeys.all, 'product', id] as const,
}

export function useShopSettings() {
  return useQuery({ queryKey: commerceKeys.settings(), queryFn: getShopSettings, staleTime: 60_000 })
}

export function useProducts(params: ProductListParams) {
  return useQuery({ queryKey: commerceKeys.list(params), queryFn: () => listProducts(params), placeholderData: keepPreviousData })
}

export function useProduct(id?: string) {
  return useQuery({ queryKey: commerceKeys.product(id ?? ''), queryFn: () => getProduct(id!), enabled: !!id })
}

/** Write helpers: every write refreshes the product and the lists. */
export function useCommerceWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refreshLists = () => void queryClient.invalidateQueries({ queryKey: commerceKeys.lists() })
    const refreshContent = () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    const setDetail = (detail: ProductDetail) => {
      queryClient.setQueryData(commerceKeys.product(detail.product.id), detail)
      refreshLists()
      return detail
    }
    return {
      saveSettings: async (body: ShopSettings) => {
        const saved = await saveShopSettings(body)
        queryClient.setQueryData(commerceKeys.settings(), saved)
        refreshLists()
        return saved
      },
      create: async (body: { name: string; type: ProductType }) => {
        const detail = setDetail(await createProduct(body))
        refreshContent()
        return detail
      },
      update: async (id: string, body: { vatRateId?: string; active?: boolean; options?: ProductOption[] }) => setDetail(await updateProduct(id, body)),
      remove: async (id: string) => {
        await deleteProduct(id)
        queryClient.removeQueries({ queryKey: commerceKeys.product(id) })
        refreshLists()
        refreshContent()
      },
      saveVariants: async (id: string, rows: VariantRow[]) => {
        const variants = await saveVariants(id, rows)
        void queryClient.invalidateQueries({ queryKey: commerceKeys.product(id) })
        refreshLists()
        return variants
      },
      uploadFile: async (id: string, file: File) => {
        const uploaded = await uploadProductFile(id, file)
        void queryClient.invalidateQueries({ queryKey: commerceKeys.product(id) })
        return uploaded
      },
    }
  }, [queryClient])
}
