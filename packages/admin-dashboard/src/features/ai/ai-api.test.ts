import apiClient from '@/lib/api'
import { AiRequestError, getAiStatus, streamGenerate, streamTranslate, type GenerateRequest } from './ai-api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))

const body: GenerateRequest = {
  action: 'rewrite',
  field: { label: 'Perex', type: 'TEXT', value: 'Ahoj' },
  context: { contentType: 'Post', language: 'cs', fields: [] },
}

function stream(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c))
        controller.close()
      },
    }),
    { status, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

afterEach(() => localStorage.removeItem('auth_token'))

it('reads deltas split across chunks and resolves with the text and usage', async () => {
  localStorage.setItem('auth_token', 'dev-token')
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    stream(['event: delta\ndata: {"text":"Ahoj"}\n\nevent: del', 'ta\ndata: {"text":" světe"}\n\n', 'event: done\ndata: {"inputTokens":5,"outputTokens":2,"truncated":true}\n\n']),
  )
  const seen: string[] = []
  const result = await streamGenerate(body, { onText: (t) => seen.push(t) })
  expect(seen).toEqual(['Ahoj', 'Ahoj světe'])
  expect(result).toEqual({ text: 'Ahoj světe', inputTokens: 5, outputTokens: 2, truncated: true })
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/ai\/generate$/)
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer dev-token')
  expect(JSON.parse(String(init?.body))).toEqual(body)
})

it('throws the code of an error event', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream(['event: delta\ndata: {"text":"Půl"}\n\nevent: error\ndata: {"code":"UNREACHABLE","message":"The AI service cannot be reached"}\n\n']))
  await expect(streamGenerate(body, { onText: () => {} })).rejects.toMatchObject({ code: 'UNREACHABLE', message: 'The AI service cannot be reached' })
})

it('throws the reason of a refused request', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Connect an AI service first', reason: 'NOT_CONNECTED' }), { status: 409 }))
  const error = await streamGenerate(body, { onText: () => {} }).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(AiRequestError)
  expect(error).toMatchObject({ code: 'NOT_CONNECTED' })
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }))
  await expect(streamGenerate(body, { onText: () => {} })).rejects.toMatchObject({ code: 'AI_RATE_LIMIT' })
})

it('reports a stream that ends without done or error', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream(['event: delta\ndata: {"text":"Půl"}\n\n']))
  await expect(streamGenerate(body, { onText: () => {} })).rejects.toMatchObject({ code: 'PROVIDER' })
})

it('passes the abort signal and rethrows an abort as is', async () => {
  const controller = new AbortController()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    expect(init?.signal).toBe(controller.signal)
    controller.abort()
    throw new DOMException('aborted', 'AbortError')
  })
  await expect(streamGenerate(body, { signal: controller.signal, onText: () => {} })).rejects.toMatchObject({ name: 'AbortError' })
})

it('reports a too long request as TOO_LONG', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Validation failed', details: [{ path: 'body.field.value', message: 'String must contain at most 100000 character(s)' }] }), { status: 400 }))
  await expect(streamGenerate(body, { onText: () => {} })).rejects.toMatchObject({ code: 'TOO_LONG' })
})

it('treats only a refusal as "no AI" and lets other failures fail', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(Object.assign(new Error('403'), { isAxiosError: true, response: { status: 403 } }))
  expect(await getAiStatus()).toBeNull()
  vi.mocked(apiClient.get).mockRejectedValueOnce(Object.assign(new Error('500'), { isAxiosError: true, response: { status: 500 } }))
  await expect(getAiStatus()).rejects.toThrow('500')
})

describe('streamTranslate', () => {
  const start = 'event: start\ndata: {"fields":[{"name":"title","label":"Title"},{"name":"body","label":"Body"}]}\n\n'
  const field = (name: string, index: number) => `event: field\ndata: {"name":"${name}","index":${index},"total":2}\n\n`

  it('reports the fields and progress, then resolves with the new version', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      stream([start, field('title', 1), field('bo', 0).slice(0, 10), field('body', 2).slice(10), 'event: done\ndata: {"versionId":"v1","inputTokens":40,"outputTokens":10}\n\n']),
    )
    const onStart = vi.fn()
    const onField = vi.fn()
    await expect(streamTranslate({ entryId: 'e1', language: 'en' }, { onStart, onField })).resolves.toEqual({ versionId: 'v1', inputTokens: 40, outputTokens: 10 })
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/ai\/translate$/)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ entryId: 'e1', language: 'en' })
    expect(onStart).toHaveBeenCalledWith([{ name: 'title', label: 'Title' }, { name: 'body', label: 'Body' }])
    expect(onField.mock.calls).toEqual([['title', 1], ['body', 2]])
  })

  it('rejects with the code and field of an error event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream([start, 'event: error\ndata: {"code":"TOO_LONG","message":"Perex is too long","field":"perex"}\n\n']))
    const error = await streamTranslate({ entryId: 'e1', language: 'en' }, { onStart: vi.fn(), onField: vi.fn() }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AiRequestError)
    expect(error).toMatchObject({ code: 'TOO_LONG', field: 'perex' })
  })

  it('uses the reason of a refused request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'exists', reason: 'VERSION_EXISTS' }), { status: 409 }))
    await expect(streamTranslate({ entryId: 'e1', language: 'en' }, { onStart: vi.fn(), onField: vi.fn() })).rejects.toMatchObject({ code: 'VERSION_EXISTS' })
  })

  it('rejects when the stream ends early', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream([start, field('title', 1)]))
    await expect(streamTranslate({ entryId: 'e1', language: 'en' }, { onStart: vi.fn(), onField: vi.fn() })).rejects.toMatchObject({ code: 'PROVIDER' })
  })
})
