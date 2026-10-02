import { isAxiosError } from 'axios'
import apiClient from '@/lib/api'
import { API_BASE_URL, authorizationHeader } from '@/lib/auth-header'
import type { ApiResponse } from '@/types'

export type AiProviderName = 'anthropic' | 'openai-compatible'
export type AiAction = 'draft' | 'rewrite' | 'shorten' | 'expand' | 'fix' | 'custom'
export const CLAUDE_MODELS = ['claude-sonnet-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001'] as const

export interface AiConnection {
  provider: AiProviderName
  model: string
  baseUrl?: string
  keyHint?: string
  createdAt: string
}

export interface AiStatus {
  available: boolean
  enabled: boolean
  canManage: boolean
  connection: AiConnection | null
  usage: { month: string; requests: number; inputTokens: number; outputTokens: number }
}

export type ConnectionInput =
  | { provider: 'anthropic'; model: string; apiKey?: string }
  | { provider: 'openai-compatible'; model: string; baseUrl: string; apiKey?: string }

export interface GenerateRequest {
  action: AiAction
  instruction?: string
  field: { label: string; type: 'TEXT' | 'RICH_TEXT'; value: string }
  context: { contentType: string; language: string; fields: { label: string; value: string }[] }
}

export interface GenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
  truncated?: boolean
}

export interface TranslateRequest {
  entryId: string
  language: string
}

export interface TranslateField {
  name: string
  label: string
}

export interface TranslateResult {
  versionId: string
  inputTokens: number
  outputTokens: number
}

export class AiRequestError extends Error {
  code: string
  /** The field an error event named, when one caused it. */
  field?: string

  constructor(code: string, message: string, field?: string) {
    super(message)
    this.name = 'AiRequestError'
    this.code = code
    this.field = field
  }
}

/** The user's AI status, or null when the user may not use AI (Viewer). Other failures throw, so the last good status is kept. */
export async function getAiStatus(): Promise<AiStatus | null> {
  try {
    return (await apiClient.get<ApiResponse<AiStatus>>('/ai/connection')).data.data ?? null
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) return null
    throw error
  }
}

export async function saveAiConnection(body: ConnectionInput): Promise<AiStatus> {
  return (await apiClient.put<ApiResponse<AiStatus>>('/ai/connection', body)).data.data
}

export async function deleteAiConnection(): Promise<AiStatus> {
  return (await apiClient.delete<ApiResponse<AiStatus>>('/ai/connection')).data.data
}

export async function saveAiSettings(enabled: boolean): Promise<AiStatus> {
  return (await apiClient.put<ApiResponse<AiStatus>>('/ai/settings', { enabled })).data.data
}

function refusedCode(status: number, reason: unknown, details: unknown): string {
  if (typeof reason === 'string') return reason
  // The request schema refuses an over-long field value.
  if (status === 400 && Array.isArray(details) && details.some((d) => /value/.test(String((d as { path?: unknown }).path)))) return 'TOO_LONG'
  if (status === 429) return 'AI_RATE_LIMIT'
  if (status === 413) return 'TOO_LONG'
  return 'PROVIDER'
}

type Payload = Record<string, unknown>
const str = (value: unknown) => (typeof value === 'string' ? value : undefined)
const num = (value: unknown) => (typeof value === 'number' ? value : 0)

/** POSTs to an AI endpoint that answers with server-sent events; refused requests reject with AiRequestError. */
async function postStream(path: string, body: unknown, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const authorization = await authorizationHeader()
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new AiRequestError('NETWORK', 'The server cannot be reached')
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown; reason?: unknown; details?: unknown }
    throw new AiRequestError(refusedCode(res.status, data.reason, data.details), typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
  }
  return res.body
}

/** Reads events until `onEvent` returns a result; an `error` event rejects with its code, message and field. */
async function readEvents<T>(stream: ReadableStream<Uint8Array>, onEvent: (event: string, payload: Payload) => T | undefined): Promise<T> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let end = buffer.indexOf('\n\n')
    while (end >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      end = buffer.indexOf('\n\n')
      const event = /^event: (.+)$/m.exec(block)?.[1]
      const data = /^data: (.+)$/m.exec(block)?.[1]
      if (!event || !data) continue
      const payload = JSON.parse(data) as Payload
      if (event === 'error') throw new AiRequestError(str(payload.code) ?? 'PROVIDER', str(payload.message) ?? 'The AI request failed', str(payload.field))
      const result = onEvent(event, payload)
      if (result !== undefined) return result
    }
  }
  throw new AiRequestError('PROVIDER', 'The answer ended early')
}

/**
 * Streams the answer of POST /ai/generate. `onText` gets the whole text so far after each piece.
 * Rejects with AiRequestError for refused requests and error events; an abort is rethrown as is.
 */
export async function streamGenerate(body: GenerateRequest, options: { signal?: AbortSignal; onText: (text: string) => void }): Promise<GenerateResult> {
  const stream = await postStream('/ai/generate', body, options.signal)
  let text = ''
  return readEvents<GenerateResult>(stream, (event, payload) => {
    if (event === 'delta') {
      text += str(payload.text) ?? ''
      options.onText(text)
    } else if (event === 'done') {
      return { text, inputTokens: num(payload.inputTokens), outputTokens: num(payload.outputTokens), ...(payload.truncated ? { truncated: true } : {}) }
    }
    return undefined
  })
}

/** Streams POST /ai/translate: the field list, progress per field, then the new version's id. */
export async function streamTranslate(
  body: TranslateRequest,
  options: { signal?: AbortSignal; onStart: (fields: TranslateField[]) => void; onField: (name: string, index: number) => void },
): Promise<TranslateResult> {
  const stream = await postStream('/ai/translate', body, options.signal)
  return readEvents<TranslateResult>(stream, (event, payload) => {
    if (event === 'start') options.onStart(Array.isArray(payload.fields) ? (payload.fields as TranslateField[]) : [])
    else if (event === 'field') options.onField(str(payload.name) ?? '', num(payload.index))
    else if (event === 'done') return { versionId: str(payload.versionId) ?? '', inputTokens: num(payload.inputTokens), outputTokens: num(payload.outputTokens) }
    return undefined
  })
}
