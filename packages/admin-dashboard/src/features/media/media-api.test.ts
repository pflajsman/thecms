import apiClient from '@/lib/api'
import { listMedia, uploadMedia } from './media-api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

describe('media-api', () => {
  it('joins ids and drops empty params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [], pagination: {} } })
    await listMedia({ ids: ['a', 'b'], search: '' })
    expect(apiClient.get).toHaveBeenCalledWith('/media', { params: { ids: 'a,b' } })
  })

  it('uploads as multipart and reports progress', async () => {
    vi.mocked(apiClient.post).mockImplementation(async (_url, _body, config) => {
      config?.onUploadProgress?.({ loaded: 50, total: 100 } as never)
      return { data: { data: { id: 'm9' } } }
    })
    const progress = vi.fn()
    await expect(uploadMedia(new File(['x'], 'a.png', { type: 'image/png' }), progress)).resolves.toEqual({ id: 'm9' })
    const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0]
    expect(url).toBe('/media/upload')
    expect(body).toBeInstanceOf(FormData)
    expect(config?.headers).toEqual({ 'Content-Type': 'multipart/form-data' })
    expect(progress).toHaveBeenCalledWith(0.5)
  })
})
