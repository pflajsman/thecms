import { act, renderHook } from '@testing-library/react'
import type { MediaFile } from '@/types'
import { useUploadQueue } from './useUploadQueue'
import { makeMedia } from './test-fixtures'

const file = (name: string, size = 100, type = 'image/png') => new File([new Uint8Array(size)], name, { type })

function deferredUpload() {
  const pending: { name: string; resolve: (m: MediaFile) => void; reject: (e: unknown) => void; progress: (f: number) => void }[] = []
  const upload = vi.fn((f: File, onProgress?: (fraction: number) => void) =>
    new Promise<MediaFile>((resolve, reject) => pending.push({ name: f.name, resolve, reject, progress: (p) => onProgress?.(p) })),
  )
  return { upload, pending }
}

describe('useUploadQueue', () => {
  it('runs at most 3 uploads at once and starts the next when one finishes', async () => {
    const { upload, pending } = deferredUpload()
    const onUploaded = vi.fn()
    const { result } = renderHook(() => useUploadQueue({ upload, onUploaded }))
    act(() => result.current.add([file('1.png'), file('2.png'), file('3.png'), file('4.png')]))
    expect(upload).toHaveBeenCalledTimes(3)
    expect(result.current.items.map((i) => i.status)).toEqual(['uploading', 'uploading', 'uploading', 'queued'])
    await act(async () => pending[0].resolve(makeMedia({ id: 'm1' })))
    expect(upload).toHaveBeenCalledTimes(4)
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))
    expect(result.current.items[0]).toMatchObject({ status: 'done', progress: 1 })
  })

  it('reports progress', () => {
    const { upload, pending } = deferredUpload()
    const { result } = renderHook(() => useUploadQueue({ upload }))
    act(() => result.current.add([file('a.png')]))
    act(() => pending[0].progress(0.4))
    expect(result.current.items[0].progress).toBe(0.4)
  })

  it('rejects invalid files up front without blocking valid ones', () => {
    const { upload } = deferredUpload()
    const { result } = renderHook(() => useUploadQueue({ upload }))
    act(() => result.current.add([file('big.png', 10 * 1024 * 1024 + 1), file('ok.png'), file('x.exe', 10, 'application/x-msdownload')]))
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result.current.items.map((i) => [i.name, i.status])).toEqual([['big.png', 'error'], ['ok.png', 'uploading'], ['x.exe', 'error']])
    expect(result.current.items[0].error).toBe('big.png is larger than 10 MB.')
  })

  it('marks failed uploads and clears finished items', async () => {
    const { upload, pending } = deferredUpload()
    const { result } = renderHook(() => useUploadQueue({ upload }))
    act(() => result.current.add([file('a.png'), file('b.png')]))
    await act(async () => pending[0].reject(new Error('boom')))
    expect(result.current.items[0]).toMatchObject({ status: 'error', error: 'Something went wrong. Please try again.' })
    act(() => result.current.clearFinished())
    expect(result.current.items.map((i) => i.name)).toEqual(['b.png'])
  })
})
