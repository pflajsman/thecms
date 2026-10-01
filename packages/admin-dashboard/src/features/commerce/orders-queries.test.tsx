import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useOrdersNeedingAction } from './orders-queries'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
}

it('returns the count of orders that need action, and nothing for zero', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: { count: 3 } } })
  const three = renderHook(() => useOrdersNeedingAction(), { wrapper })
  await waitFor(() => expect(three.result.current).toBe(3))
  expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders/needs-action')
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: { count: 0 } } })
  const none = renderHook(() => useOrdersNeedingAction(), { wrapper })
  await waitFor(() => expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(2))
  expect(none.result.current).toBeUndefined()
})
