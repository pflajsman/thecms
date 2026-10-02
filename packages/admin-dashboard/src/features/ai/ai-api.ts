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

export class AiRequestError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AiRequestError'
    this.code = code
  }
}

/** The user's AI status, or null when the user may not use AI (Viewer) or the server cannot be asked. */
export async function getAiStatus(): Promise<AiStatus | null> {
  try {
    return (await apiClient.get<ApiResponse<AiStatus>>('/ai/connection')).data.data ?? null
  } catch {
    return null
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

function refusedCode(status: number, reason: unknown): string {
  if (typeof reason === 'string') return reason
  if (status === 429) return 'AI_RATE_LIMIT'
  if (status === 413) return 'TOO_LONG'
  return 'PROVIDER'
}

/**
 * Streams the answer of POST /ai/generate. `onText` gets the whole text so far after each piece.
 * Rejects with AiRequestError for refused requests and error events; an abort is rethrown as is.
 */
export async function streamGenerate(body: GenerateRequest, options: { signal?: AbortSignal; onText: (text: string) => void }): Promise<GenerateResult> {
  const authorization = await authorizationHeader()
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/ai/generate`, {
      method: 'POST',
      signal: options.signal,
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new AiRequestError('NETWORK', 'The server cannot be reached')
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown; reason?: unknown }
    throw new AiRequestError(refusedCode(res.status, data.reason), typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
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
      const payload = JSON.parse(data) as { text?: string; inputTokens?: number; outputTokens?: number; truncated?: boolean; code?: string; message?: string }
      if (event === 'delta') {
        text += payload.text ?? ''
        options.onText(text)
      } else if (event === 'done') {
        return { text, inputTokens: payload.inputTokens ?? 0, outputTokens: payload.outputTokens ?? 0, ...(payload.truncated ? { truncated: true } : {}) }
      } else if (event === 'error') {
        throw new AiRequestError(payload.code ?? 'PROVIDER', payload.message ?? 'The AI request failed')
      }
    }
  }
  throw new AiRequestError('PROVIDER', 'The answer ended early')
}
