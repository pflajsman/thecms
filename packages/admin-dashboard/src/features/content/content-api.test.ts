import apiClient from '@/lib/api'
import { entryTypeId, listEntries, updateEntry } from './content-api'
import type { ContentEntry } from '@/types'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

describe('content-api', () => {
  it('drops empty params when listing entries', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [], pagination: {} } })
    await listEntries({ search: '', status: undefined, page: 2, limit: 20 })
    expect(apiClient.get).toHaveBeenCalledWith('/entries', { params: { page: 2, limit: 20 } })
  })

  it('unwraps the entry from update responses', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true, data: { id: 'e1' } } })
    await expect(updateEntry('e1', { status: 'DRAFT' })).resolves.toEqual({ id: 'e1' })
  })

  it('reads the content type id from plain and populated entries', () => {
    expect(entryTypeId({ contentTypeId: 't1' } as ContentEntry)).toBe('t1')
    expect(entryTypeId({ contentTypeId: { id: 't2' } } as unknown as ContentEntry)).toBe('t2')
    expect(entryTypeId({ contentTypeId: { _id: 't3' } } as unknown as ContentEntry)).toBe('t3')
  })
})
