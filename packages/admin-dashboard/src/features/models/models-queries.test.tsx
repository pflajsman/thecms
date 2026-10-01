import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as api from './models-api'
import { useModelWrites } from './models-queries'
import { contentKeys } from '@/features/content/queries'
import { makeEntry, postType, tripType } from '@/features/content/test-fixtures'

vi.mock('./models-api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./models-api')>()), updateModel: vi.fn() }))

it('saving a model drops its cached entries, because the server may rewrite their data', async () => {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useModelWrites(), { wrapper })
  const trip = makeEntry({ id: 't1', contentTypeId: tripType.id })
  const post = makeEntry({ id: 'p1', contentTypeId: postType.id })
  queryClient.setQueryData(contentKeys.entry('t1'), trip)
  queryClient.setQueryData(contentKeys.entry('p1'), post)
  vi.mocked(api.updateModel).mockResolvedValue(tripType)
  await result.current.update(tripType.id, { name: 'Trip', slug: 'trip', fields: tripType.fields })
  expect(queryClient.getQueryData(contentKeys.entry('t1'))).toBeUndefined()
  expect(queryClient.getQueryData(contentKeys.entry('p1'))).toEqual(post)
})
