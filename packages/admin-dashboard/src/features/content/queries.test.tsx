import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as api from './content-api'
import { contentKeys, useEntryWrites } from './queries'
import { makeEntry } from './test-fixtures'

vi.mock('./content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./content-api')>()),
  updateEntry: vi.fn(),
  createVersion: vi.fn(),
}))

function setup() {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useEntryWrites(), { wrapper })
  return { queryClient, writes: result.current }
}

it('a save marks the other language versions stale, because shared fields changed on the server', async () => {
  const { queryClient, writes } = setup()
  const cs = makeEntry({ id: 'cs1', itemId: 'en1', language: 'cs' })
  const en = makeEntry({ id: 'en1', itemId: 'en1', language: 'en' })
  queryClient.setQueryData(contentKeys.entry('en1'), en)
  queryClient.setQueryData(contentKeys.versions('en1'), [])
  vi.mocked(api.updateEntry).mockResolvedValue({ ...cs, data: { ...cs.data, distanceKm: 99 } })
  await writes.update({ id: 'cs1', body: { data: { distanceKm: 99 } } })
  await waitFor(() => expect(queryClient.getQueryState(contentKeys.entry('en1'))?.isInvalidated).toBe(true))
  expect(queryClient.getQueryState(contentKeys.versions('en1'))?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(contentKeys.entry('cs1'))?.isInvalidated).toBe(false)
})

it('translate creates a version and caches it', async () => {
  const { queryClient, writes } = setup()
  const created = makeEntry({ id: 'cs1', itemId: 'en1', language: 'cs' })
  vi.mocked(api.createVersion).mockResolvedValue(created)
  expect(await writes.translate('en1', 'cs')).toEqual(created)
  expect(api.createVersion).toHaveBeenCalledWith('en1', 'cs')
  expect(queryClient.getQueryData(contentKeys.entry('cs1'))).toEqual(created)
})
