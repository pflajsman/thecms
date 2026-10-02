# AI Assistant, Plan 2: Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin and Editor users connect their own AI service on an "AI asistent" page, and text fields in the entry and product editors get an AI menu whose answer streams into a preview that is only applied on "Použít" or "Vložit pod".

**Architecture:** A `features/ai` area holds the API client (status, connection, settings) and a streaming client for `POST /ai/generate` that reads server-sent events with `fetch`, because axios cannot stream. The auth header logic moves from the axios interceptor into a shared `lib/auth-header.ts` so both clients use it. Fields get an optional addon slot in `FieldShell` (a React context), and an `AiField` wrapper in the entry editor fills it with the AI menu and renders the preview panel under the field; applying a rich-text result remounts the field so the TipTap editor shows the new content. One small backend addition tells the page whether the user is an Admin.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, react-i18next (typed keys, `en`/`cs`), shadcn/ui (Radix), Vitest + Testing Library + axe; backend Express + Jest for one field.

**Spec:** `docs/superpowers/specs/2026-10-02-ai-assistant-design.md` (sections 4 and 7). Backend: `docs/superpowers/plans/2026-10-02-ai-assistant-plan-1-backend.md` (merged).

## Global Constraints

- Backend contract (Plan 1, admin auth, Admin and Editor): `GET /ai/connection` returns `{ available, enabled, connection: { provider, model, baseUrl?, keyHint?, createdAt } | null, usage: { month, requests, inputTokens, outputTokens } }` (Task 1 adds `canManage`); `PUT /ai/connection` `{ provider: 'anthropic', model, apiKey? }` or `{ provider: 'openai-compatible', model, baseUrl, apiKey? }`; `DELETE /ai/connection`; `PUT /ai/settings` `{ enabled }` (Admin); `POST /ai/generate` `{ action, instruction?, field: { label, type: 'TEXT' | 'RICH_TEXT', value }, context: { contentType, language, fields: [{ label, value }] } }` answering `text/event-stream` with `delta { text }`, then `done { inputTokens, outputTokens, truncated? }` or `error { code, message }`.
- Error reasons and codes to explain: `AUTH`, `RATE_LIMIT`, `UNREACHABLE`, `TOO_LONG`, `TIMEOUT`, `PROVIDER`, `AI_DISABLED`, `NOT_CONNECTED`, `AI_NOT_AVAILABLE`, `KEY_UNREADABLE`, `KEY_REQUIRED`, `AI_RATE_LIMIT`, `BASE_URL`; anything else is shown as sent.
- Claude models: `claude-sonnet-5` (default), `claude-opus-5-5`, `claude-haiku-4-5-20251001`. Presets (prefill only): Ollama `http://localhost:11434/v1`, OpenRouter `https://openrouter.ai/api/v1`, Groq `https://api.groq.com/openai/v1`, Google Gemini `https://generativelanguage.googleapis.com/v1beta/openai`.
- Actions: empty field: draft (needs a brief); field with text: rewrite, shorten, expand, fix; always: own instruction.
- Results are never applied without "Použít" or "Vložit pod"; rich text is cleaned to `p, h2, h3, strong, em, u, s, a, ul, ol, li, blockquote, br` (links only `http`, `https`, `mailto`); plain-text fields get text only. Discard or closing aborts the request.
- All new UI text in English and Czech (`one`/`other`, `one`/`few`/`other`) under the lint guard; `pnpm --filter admin-dashboard lint` 0 problems; every new screen passes axe and works at 360px; server messages shown as sent.
- Run `pnpm --filter admin-dashboard test`, `lint` and `build` at the end of every task (and the backend tests in Task 1).
- Never use an em dash in code, copy or docs.

## Decisions (for the reviewer)

1. **Streaming uses `fetch`, not axios.** The auth header code moves to `lib/auth-header.ts` (axios interceptor and the stream share it).
2. **The AI button sits in the field label row through a context slot in `FieldShell`**, so the field components (`TextField`, `RichTextField`) stay unchanged.
3. **Applying a rich-text result bumps a key that remounts the field**, because `RichTextEditor` reads its value only on mount.
4. **Status failures (403 for Viewers, network) count as "AI not ready"**: the AI buttons and the menu item stay hidden instead of showing errors on every page.
5. **The settings page uses native radios and selects** for provider, preset and model, so the form is simple to test and works with the keyboard everywhere.

## Review Focus

1. **The user discards or navigates away while the answer is streaming**: the request is aborted and no state update lands on an unmounted panel. Tested in Task 3.
2. **The AI returns HTML with a script, an `onclick`, a `javascript:` link or a Markdown code fence**: only the allowed tags remain; nothing runs. Tested in Task 3.
3. **A rich-text result applied with "Použít"**: the TipTap editor shows the new text immediately and the entry becomes unsaved. Tested in Task 3 (remount) and Task 4 (editor integration).
4. **Changing only the Claude model on a connected account**: the form sends no key and the server keeps the stored one; the page says so. Tested in Task 2.
5. **A Viewer, or AI not set up on the server**: no AI menu item, no AI buttons, and the page explains why. Tested in Tasks 2 and 3.

---

## File Structure

All admin paths relative to `packages/admin-dashboard/src`.

| File | Responsibility |
|---|---|
| `packages/backend/src/modules/ai/ai.service.ts`, `ai.controller.ts`, `ai-connection.test.ts` | `canManage` in the status |
| `lib/auth-header.ts`, `lib/api.ts` | Shared `authorizationHeader`, `API_BASE_URL`, `setMsalInstance` |
| `features/ai/ai-api.ts` | Types, status, connection, settings calls, `streamGenerate` |
| `features/ai/ai-queries.ts` | `aiKeys`, `useAiStatus`, `useAiReady`, `useAiWrites` |
| `features/ai/ai-errors.ts` | `aiErrorKey`, `aiErrorMessage` |
| `features/ai/rich-text-clean.ts` | `cleanRichText`, `toPlainText` |
| `features/ai/pages/AiSettingsPage.tsx` | The "AI asistent" page |
| `features/ai/components/AiField.tsx` | Menu, instruction box, result panel for one field |
| `features/content/editor/fields/field-addon.ts`, `FieldShell.tsx` | Addon slot in the label row |
| `features/content/editor/EntryEditor.tsx` | Wraps text fields with `AiField` |
| `app/routes.tsx`, `app/shell/UserMenu.tsx` | Route `/account/ai`, menu item |
| `i18n/locales/{en,cs}/ai.json`, `shell.json`, `i18n/resources.ts` | Catalogs |

---

### Task 1: Admin flag, auth header and AI clients

**Files:**
- Modify: `packages/backend/src/modules/ai/ai.service.ts`, `packages/backend/src/modules/ai/ai.controller.ts`
- Test: `packages/backend/src/modules/ai/ai-connection.test.ts`
- Create: `lib/auth-header.ts`, `features/ai/ai-api.ts`, `features/ai/ai-queries.ts`, `features/ai/ai-errors.ts`
- Modify: `lib/api.ts`
- Test: `lib/auth-header.test.ts`, `features/ai/ai-api.test.ts`

**Interfaces:**
- Produces (backend): `AiStatus.canManage: boolean` (true for Admins).
- Produces (admin): `API_BASE_URL`, `setMsalInstance`, `authorizationHeader(): Promise<string | undefined>`; types `AiProviderName`, `AiAction`, `AiConnection`, `AiStatus`, `ConnectionInput`, `GenerateRequest`, `GenerateResult`; `AiRequestError` (`code`, `message`); `getAiStatus(): Promise<AiStatus | null>`, `saveAiConnection(body)`, `deleteAiConnection()`, `saveAiSettings(enabled)`, `streamGenerate(body, { signal, onText }): Promise<GenerateResult>` (`onText` gets the whole text so far); `aiKeys`, `useAiStatus()`, `useAiReady(): boolean`, `useAiWrites()` with `save(body)`, `disconnect()`, `setEnabled(enabled)`; `AiErrorKey`, `aiErrorKey(code): AiErrorKey | null`, `aiErrorMessage(error, t): string`.

- [ ] **Step 1: Write the failing backend test**

In `packages/backend/src/modules/ai/ai-connection.test.ts`, append:

```ts
it('tells the page whether the user may switch AI for everyone', async () => {
  expect((await request(app).get('/ai/connection')).body.data.canManage).toBe(false);
  expect((await request(app).get('/ai/connection').set('x-test-role', 'ADMIN')).body.data.canManage).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @thecms/backend exec jest src/modules/ai/ai-connection.test.ts -t "switch AI"`
Expected: FAIL, `canManage` is undefined.

- [ ] **Step 3: Add `canManage`**

In `ai.service.ts`, add `canManage: boolean;` to `AiStatus`, change `status(userId: string)` to `status(userId: string, canManage = false)` and include `canManage` in the returned object. `saveConnection` and the other callers keep calling `AiService.status(userId)`; the controller passes the role instead:

In `ai.controller.ts`, add:

```ts
import { UserRole } from '../../models/user.model';

const canManage = (req: Request) => (req as AuthRequest).user?.role === UserRole.ADMIN;
```

and change every `res.json({ success: true, data: await AiService.status(userId(req)) })` and the `saveConnection` handler so the returned status carries the flag:

```ts
  async getConnection(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await AiService.status(userId(req), canManage(req)) });
    } catch (error) {
      next(error);
    }
  },

  async saveConnection(req: Request, res: Response, next: NextFunction) {
    try {
      await AiService.saveConnection(userId(req), connectionBody.parse(req.body));
      res.json({ success: true, data: await AiService.status(userId(req), canManage(req)) });
    } catch (error) {
      next(error);
    }
  },
```

(`deleteConnection` and `saveSettings` likewise end with `AiService.status(userId(req), canManage(req))`.)

- [ ] **Step 4: Run the backend tests**

Run: `pnpm --filter @thecms/backend test`
Expected: all pass.

- [ ] **Step 5: Write the failing admin tests**

Create `lib/auth-header.test.ts`:

```ts
import { authorizationHeader } from './auth-header'

it('uses the dev token when Entra is not configured', async () => {
  localStorage.setItem('auth_token', 'dev-token')
  expect(await authorizationHeader()).toBe('Bearer dev-token')
  localStorage.removeItem('auth_token')
  expect(await authorizationHeader()).toBeUndefined()
})
```

Create `features/ai/ai-api.test.ts`:

```ts
import { AiRequestError, streamGenerate, type GenerateRequest } from './ai-api'

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
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/lib/auth-header.test.ts src/features/ai/ai-api.test.ts`
Expected: FAIL, the modules do not exist.

- [ ] **Step 7: Implement the auth header, the clients, the queries and the error helpers**

Create `lib/auth-header.ts`:

```ts
import { InteractionRequiredAuthError, type PublicClientApplication } from '@azure/msal-browser'
import { isEntraConfigured, loginRequest } from '../config/msalConfig'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// Shared MSAL instance reference (set from App.tsx)
let msalInstance: PublicClientApplication | null = null

export function setMsalInstance(instance: PublicClientApplication) {
  msalInstance = instance
}

/** "Bearer <token>" for the signed-in user (Entra through MSAL, or the dev token), or undefined. */
export async function authorizationHeader(): Promise<string | undefined> {
  if (isEntraConfigured() && msalInstance) {
    const accounts = msalInstance.getAllAccounts()
    if (accounts.length === 0) return undefined
    try {
      const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] })
      return `Bearer ${response.accessToken}`
    } catch (error) {
      // If silent fails due to interaction required, try popup
      if (!(error instanceof InteractionRequiredAuthError)) return undefined
      try {
        const response = await msalInstance.acquireTokenPopup(loginRequest)
        return `Bearer ${response.accessToken}`
      } catch {
        return undefined
      }
    }
  }
  // Dev mode: use token from localStorage
  const token = localStorage.getItem('auth_token')
  return token ? `Bearer ${token}` : undefined
}
```

In `lib/api.ts`: remove the `InteractionRequiredAuthError, PublicClientApplication` and `loginRequest` imports, the `API_URL` constant, the `msalInstance` variable and `setMsalInstance`; import `{ API_BASE_URL, authorizationHeader }` from `./auth-header` and add `export { setMsalInstance } from './auth-header';`; use `baseURL: API_BASE_URL`; and replace the request interceptor body with:

```ts
apiClient.interceptors.request.use(
  async (config) => {
    const authorization = await authorizationHeader();
    if (authorization) config.headers.Authorization = authorization;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

Keep `isEntraConfigured` imported in `api.ts` (the response interceptor uses it).

Create `features/ai/ai-api.ts`:

```ts
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
```

Create `features/ai/ai-queries.ts`:

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAiConnection, getAiStatus, saveAiConnection, saveAiSettings, type AiStatus, type ConnectionInput } from './ai-api'

export const aiKeys = { status: ['ai', 'status'] as const }

export function useAiStatus() {
  return useQuery({ queryKey: aiKeys.status, queryFn: getAiStatus, staleTime: 60_000 })
}

/** True when this user can use AI now: set up on the server, allowed, and connected. */
export function useAiReady(): boolean {
  const status = useAiStatus().data
  return !!status && status.available && status.enabled && !!status.connection
}

export function useAiWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const store = (status: AiStatus) => {
      queryClient.setQueryData(aiKeys.status, status)
      return status
    }
    return {
      save: async (body: ConnectionInput) => store(await saveAiConnection(body)),
      disconnect: async () => store(await deleteAiConnection()),
      setEnabled: async (enabled: boolean) => store(await saveAiSettings(enabled)),
    }
  }, [queryClient])
}
```

Create `features/ai/ai-errors.ts`:

```ts
import { isAxiosError } from 'axios'
import type { TFunction } from 'i18next'
import { apiErrorMessage } from '@/lib/api-error'

const KNOWN = [
  'AUTH',
  'RATE_LIMIT',
  'UNREACHABLE',
  'TOO_LONG',
  'TIMEOUT',
  'AI_DISABLED',
  'NOT_CONNECTED',
  'AI_NOT_AVAILABLE',
  'KEY_UNREADABLE',
  'KEY_REQUIRED',
  'AI_RATE_LIMIT',
  'BASE_URL',
  'NETWORK',
] as const
export type AiErrorKey = (typeof KNOWN)[number]

/** Codes with an explanation in the catalog; others are shown as the server sent them. */
export function aiErrorKey(code: string): AiErrorKey | null {
  return (KNOWN as readonly string[]).includes(code) ? (code as AiErrorKey) : null
}

/** Codes where the fix is on the AI assistant page. */
export const SETTINGS_CODES: AiErrorKey[] = ['AUTH', 'NOT_CONNECTED', 'KEY_UNREADABLE']

/** Message for a failed connection or settings request (axios error with a `reason`). */
export function aiErrorMessage(error: unknown, t: TFunction<'ai'>): string {
  const reason = isAxiosError(error) ? (error.response?.data as { reason?: unknown } | undefined)?.reason : undefined
  const key = typeof reason === 'string' ? aiErrorKey(reason) : null
  return key ? t(`errors.${key}`) : apiErrorMessage(error)
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/lib src/features/ai`
Expected: PASS.

- [ ] **Step 9: Full checks and commit**

Run: `pnpm --filter @thecms/backend test && pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass, lint 0 problems.

```bash
git add packages/backend/src/modules/ai packages/admin-dashboard/src
git commit -m "feat(ai): admin flag, shared auth header, AI status and streaming clients"
```

---

### Task 2: "AI asistent" page

**Files:**
- Create: `features/ai/pages/AiSettingsPage.tsx`, `i18n/locales/{en,cs}/ai.json`
- Modify: `i18n/resources.ts`, `i18n/locales/{en,cs}/shell.json`, `app/routes.tsx`, `app/shell/UserMenu.tsx`
- Test: `features/ai/pages/AiSettingsPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 clients, queries and error helpers; `ConfirmDialog`, `PageHeader`, `ErrorState`, `Skeleton`, `Switch`, `Input`, `Label`, `Button`; `formatDate`, `formatNumber` from `@/lib/format`.
- Produces: route `/account/ai`; the `ai` namespace (Task 3 adds `menu`, `panel`); `AI_PRESETS`.

- [ ] **Step 1: Write the failing test**

Create `features/ai/pages/AiSettingsPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { AiSettingsPage } from './AiSettingsPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/account/ai', element: <AiSettingsPage /> }]
const usage = { month: '2026-10', requests: 3, inputTokens: 1200, outputTokens: 450 }
const status = (over: Record<string, unknown> = {}) => ({ available: true, enabled: true, canManage: false, connection: null, usage, ...over })
const claude = { provider: 'anthropic', model: 'claude-sonnet-5', keyHint: 'abcd', createdAt: '2026-10-02T08:00:00.000Z' }

function serve(data: unknown) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data } })
}

beforeEach(() => {
  serve(status())
  vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => {
    if (url === '/ai/settings') return { data: { success: true, data: status({ canManage: true, enabled: (body as { enabled: boolean }).enabled }) } }
    const b = body as { provider: string; model: string; baseUrl?: string; apiKey?: string }
    return { data: { success: true, data: status({ connection: { provider: b.provider, model: b.model, baseUrl: b.baseUrl?.replace(/\/$/, ''), keyHint: b.apiKey ? b.apiKey.slice(-4) : undefined, createdAt: '2026-10-02T08:00:00.000Z' } }) } }
  })
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true, data: status() } })
})

it('connects Claude with a key and shows only the key ending', async () => {
  const { container } = renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByRole('heading', { name: 'AI assistant' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Claude (Anthropic)' })).toBeChecked()
  await userEvent.type(screen.getByLabelText('API key'), 'sk-ant-test-key-abcd')
  await userEvent.selectOptions(screen.getByLabelText('Model'), 'claude-opus-5-5')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/connection', { provider: 'anthropic', model: 'claude-opus-5-5', apiKey: 'sk-ant-test-key-abcd' }))
  expect(await screen.findByText('Key ending …abcd')).toBeInTheDocument()
  expect(screen.queryByDisplayValue('sk-ant-test-key-abcd')).not.toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('connects a local Ollama from the preset without a key', async () => {
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('radio', { name: 'OpenAI-compatible service' }))
  await userEvent.selectOptions(screen.getByLabelText('Preset'), 'ollama')
  expect(screen.getByLabelText('Base URL')).toHaveValue('http://localhost:11434/v1')
  expect(screen.getByLabelText('Model name')).toHaveValue('llama3.2')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/connection', { provider: 'openai-compatible', model: 'llama3.2', baseUrl: 'http://localhost:11434/v1' }))
})

it('checks the form before sending', async () => {
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('button', { name: 'Connect' }))
  expect(screen.getByText('Enter the API key')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'OpenAI-compatible service' }))
  await userEvent.type(screen.getByLabelText('Base URL'), 'ftp://x')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  expect(screen.getByText('Enter an http or https address')).toBeInTheDocument()
  expect(screen.getByText('Enter the model name')).toBeInTheDocument()
  expect(apiClient.put).not.toHaveBeenCalled()
})

it('explains a refused key', async () => {
  vi.mocked(apiClient.put).mockRejectedValue(
    Object.assign(new Error('400'), { isAxiosError: true, response: { status: 400, data: { success: false, error: 'The AI service refused the key', reason: 'AUTH' } } }),
  )
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.type(await screen.findByLabelText('API key'), 'sk-ant-wrong')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('The AI service refused the key.')
})

it('changes only the model and keeps the stored key', async () => {
  serve(status({ connection: claude }))
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('button', { name: 'Change' }))
  expect(screen.getByText('Leave empty to keep the stored key.')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Model'), 'claude-haiku-4-5-20251001')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/connection', { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }))
})

it('shows usage and disconnects after confirming', async () => {
  serve(status({ connection: claude }))
  renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByText('3 requests, 1,200 input and 450 output tokens')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Disconnect the AI service?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }))
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/ai/connection'))
  expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
})

it('lets an admin switch AI off for everyone, and hides the switch from editors', async () => {
  serve(status({ canManage: true }))
  const first = renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('switch', { name: 'Allow AI features for everyone' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/settings', { enabled: false }))
  expect(await screen.findByText('AI features are turned off for this installation.')).toBeInTheDocument()
  first.unmount()
  serve(status())
  renderRoutes(routes, { route: '/account/ai' })
  await screen.findByRole('button', { name: 'Connect' })
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

it('explains when AI is not set up or the user has no access', async () => {
  serve(status({ available: false }))
  const first = renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByText(/AI is not set up on this server/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
  first.unmount()
  vi.mocked(apiClient.get).mockRejectedValue(Object.assign(new Error('403'), { isAxiosError: true, response: { status: 403 } }))
  renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByText('The AI assistant is available to editors and admins.')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  serve(status({ connection: claude, canManage: true }))
  const { container } = renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByRole('heading', { name: 'AI asistent' })).toBeInTheDocument()
  expect(screen.getByText('Konec klíče …abcd')).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Povolit AI funkce pro všechny' })).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai/pages`
Expected: FAIL, `./AiSettingsPage` does not exist.

- [ ] **Step 3: Add the catalogs**

Create `i18n/locales/en/ai.json`:

```json
{
  "settings": {
    "title": "AI assistant",
    "description": "Connect your own AI service to get writing help in the editor. The service bills its usage to your account.",
    "noAccess": "The AI assistant is available to editors and admins.",
    "notAvailable": "AI is not set up on this server. An administrator needs to add AI_KEY_SECRET to the server settings.",
    "disabled": "AI features are turned off for this installation.",
    "allowAll": "Allow AI features for everyone",
    "allowAllHint": "When off, AI buttons disappear for all users. Stored connections are kept.",
    "provider": "Service",
    "providerAnthropic": "Claude (Anthropic)",
    "providerOpenAi": "OpenAI-compatible service",
    "providerOpenAiHint": "Ollama on your computer, OpenRouter, Groq, Google Gemini and others.",
    "apiKey": "API key",
    "apiKeyOptional": "API key (if the service needs one)",
    "keepKey": "Leave empty to keep the stored key.",
    "model": "Model",
    "modelName": "Model name",
    "modelNameHint": "For example llama3.2 for Ollama.",
    "baseUrl": "Base URL",
    "preset": "Preset",
    "presetCustom": "Custom address",
    "presetHint": "Prefills the address; check it against the service's documentation.",
    "connect": "Connect",
    "testing": "Testing the connection…",
    "cancel": "Cancel",
    "saved": "AI service connected",
    "connected": "Connected",
    "connectedTo": "{{provider}}, model {{model}}",
    "keyEnding": "Key ending …{{hint}}",
    "noKey": "No key",
    "since": "Connected {{date}}",
    "change": "Change",
    "disconnect": "Disconnect",
    "disconnectTitle": "Disconnect the AI service?",
    "disconnectText": "Your stored key is deleted. AI buttons disappear until you connect again.",
    "disconnected": "AI service disconnected",
    "usage": "This month",
    "usageText_one": "{{count}} request, {{input}} input and {{output}} output tokens",
    "usageText_other": "{{count}} requests, {{input}} input and {{output}} output tokens",
    "errors": {
      "keyRequired": "Enter the API key",
      "baseUrlInvalid": "Enter an http or https address",
      "modelRequired": "Enter the model name"
    }
  },
  "models": {
    "sonnet": "Claude Sonnet 5 (balanced, recommended)",
    "opus": "Claude Opus 5.5 (best quality)",
    "haiku": "Claude Haiku 4.5 (fast, lower cost)"
  },
  "errors": {
    "AUTH": "The AI service refused the key.",
    "RATE_LIMIT": "The AI service is limiting requests. Try again shortly.",
    "UNREACHABLE": "The AI service can't be reached. If you use Ollama, check that it is running.",
    "TOO_LONG": "The text is too long for this model.",
    "TIMEOUT": "The AI service took too long.",
    "AI_DISABLED": "AI features are turned off.",
    "NOT_CONNECTED": "Connect an AI service first.",
    "AI_NOT_AVAILABLE": "AI is not set up on this server.",
    "KEY_UNREADABLE": "The stored key can't be read anymore. Connect again.",
    "KEY_REQUIRED": "Enter the API key.",
    "AI_RATE_LIMIT": "Too many AI requests. Wait a minute.",
    "BASE_URL": "This address is not allowed.",
    "NETWORK": "Can't reach the server. Check your connection."
  }
}
```

Create `i18n/locales/cs/ai.json`:

```json
{
  "settings": {
    "title": "AI asistent",
    "description": "Připojte vlastní AI službu a získejte pomoc s psaním v editoru. Služba účtuje používání na váš účet.",
    "noAccess": "AI asistent je dostupný editorům a správcům.",
    "notAvailable": "AI není na tomto serveru nastavená. Správce musí přidat AI_KEY_SECRET do nastavení serveru.",
    "disabled": "AI funkce jsou pro tuto instalaci vypnuté.",
    "allowAll": "Povolit AI funkce pro všechny",
    "allowAllHint": "Když je vypnuto, AI tlačítka zmizí všem uživatelům. Uložená připojení zůstanou.",
    "provider": "Služba",
    "providerAnthropic": "Claude (Anthropic)",
    "providerOpenAi": "Služba kompatibilní s OpenAI",
    "providerOpenAiHint": "Ollama na vašem počítači, OpenRouter, Groq, Google Gemini a další.",
    "apiKey": "API klíč",
    "apiKeyOptional": "API klíč (pokud ho služba vyžaduje)",
    "keepKey": "Nechte prázdné, uložený klíč zůstane.",
    "model": "Model",
    "modelName": "Název modelu",
    "modelNameHint": "Například llama3.2 pro Ollamu.",
    "baseUrl": "Základní adresa",
    "preset": "Předvolba",
    "presetCustom": "Vlastní adresa",
    "presetHint": "Předvyplní adresu; ověřte ji v dokumentaci služby.",
    "connect": "Připojit",
    "testing": "Zkouším připojení…",
    "cancel": "Zrušit",
    "saved": "AI služba připojena",
    "connected": "Připojeno",
    "connectedTo": "{{provider}}, model {{model}}",
    "keyEnding": "Konec klíče …{{hint}}",
    "noKey": "Bez klíče",
    "since": "Připojeno {{date}}",
    "change": "Změnit",
    "disconnect": "Odpojit",
    "disconnectTitle": "Odpojit AI službu?",
    "disconnectText": "Uložený klíč se smaže. AI tlačítka zmizí, dokud se znovu nepřipojíte.",
    "disconnected": "AI služba odpojena",
    "usage": "Tento měsíc",
    "usageText_one": "{{count}} požadavek, {{input}} vstupních a {{output}} výstupních tokenů",
    "usageText_few": "{{count}} požadavky, {{input}} vstupních a {{output}} výstupních tokenů",
    "usageText_other": "{{count}} požadavků, {{input}} vstupních a {{output}} výstupních tokenů",
    "errors": {
      "keyRequired": "Zadejte API klíč",
      "baseUrlInvalid": "Zadejte adresu začínající http nebo https",
      "modelRequired": "Zadejte název modelu"
    }
  },
  "models": {
    "sonnet": "Claude Sonnet 5 (vyvážený, doporučený)",
    "opus": "Claude Opus 5.5 (nejlepší kvalita)",
    "haiku": "Claude Haiku 4.5 (rychlý, levnější)"
  },
  "errors": {
    "AUTH": "AI služba klíč odmítla.",
    "RATE_LIMIT": "AI služba omezuje počet požadavků. Zkuste to za chvíli.",
    "UNREACHABLE": "AI služba není dostupná. Pokud používáte Ollamu, zkontrolujte, že běží.",
    "TOO_LONG": "Text je pro tento model příliš dlouhý.",
    "TIMEOUT": "AI služba odpovídala příliš dlouho.",
    "AI_DISABLED": "AI funkce jsou vypnuté.",
    "NOT_CONNECTED": "Nejdřív připojte AI službu.",
    "AI_NOT_AVAILABLE": "AI není na tomto serveru nastavená.",
    "KEY_UNREADABLE": "Uložený klíč už nejde přečíst. Připojte se znovu.",
    "KEY_REQUIRED": "Zadejte API klíč.",
    "AI_RATE_LIMIT": "Příliš mnoho AI požadavků. Počkejte minutu.",
    "BASE_URL": "Tato adresa není povolená.",
    "NETWORK": "Server není dostupný. Zkontrolujte připojení."
  }
}
```

In `i18n/resources.ts`, import `enAi`/`csAi`, add `'ai'` to the end of `NAMESPACES`, and `ai: enAi` / `ai: csAi` to the resource maps. In `shell.json` `userMenu`, add `"aiAssistant": "AI assistant"` (en) and `"aiAssistant": "AI asistent"` (cs).

- [ ] **Step 4: Implement the page, route and menu item**

Create `features/ai/pages/AiSettingsPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { formatDate, formatNumber } from '@/lib/format'
import { CLAUDE_MODELS, type AiConnection, type AiProviderName, type ConnectionInput } from '../ai-api'
import { useAiStatus, useAiWrites } from '../ai-queries'
import { aiErrorMessage } from '../ai-errors'

export const AI_PRESETS = [
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: '' },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '' },
] as const

const MODEL_LABEL = { 'claude-sonnet-5': 'sonnet', 'claude-opus-5-5': 'opus', 'claude-haiku-4-5-20251001': 'haiku' } as const
const CUSTOM = 'custom'
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const isHttp = (text: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(text.trim()).protocol)
  } catch {
    return false
  }
}
const trimSlash = (url: string) => url.trim().replace(/\/+$/, '')

interface FormState {
  provider: AiProviderName
  model: string
  baseUrl: string
  apiKey: string
  preset: string
}

function initialForm(current: AiConnection | null): FormState {
  const preset = AI_PRESETS.find((p) => p.baseUrl === current?.baseUrl)?.id ?? CUSTOM
  return { provider: current?.provider ?? 'anthropic', model: current?.model ?? 'claude-sonnet-5', baseUrl: current?.baseUrl ?? '', apiKey: '', preset }
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{children}</p>
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} className="text-sm text-destructive">{text}</p> : null
}

function ConnectionForm({ current, onDone, onCancel }: { current: AiConnection | null; onDone: () => void; onCancel?: () => void }) {
  const { t } = useTranslation('ai')
  const writes = useAiWrites()
  const [form, setForm] = useState<FormState>(() => initialForm(current))
  const [errors, setErrors] = useState<{ apiKey?: string; baseUrl?: string; model?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))
  // The server keeps the stored key when the provider (and address) stay the same.
  const keepsKey = !!current?.keyHint && current.provider === form.provider && (form.provider === 'anthropic' || current.baseUrl === trimSlash(form.baseUrl))

  const switchProvider = (provider: AiProviderName) =>
    update(provider === 'anthropic' ? { provider, model: 'claude-sonnet-5' } : { provider, model: current?.provider === provider ? current.model : '', baseUrl: current?.baseUrl ?? '' })

  const pickPreset = (id: string) => {
    const preset = AI_PRESETS.find((p) => p.id === id)
    update(preset ? { preset: id, baseUrl: preset.baseUrl, model: preset.model || form.model } : { preset: id })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    const apiKey = form.apiKey.trim()
    if (form.provider === 'anthropic' && !apiKey && !keepsKey) next.apiKey = t('settings.errors.keyRequired')
    if (form.provider === 'openai-compatible') {
      if (!isHttp(form.baseUrl)) next.baseUrl = t('settings.errors.baseUrlInvalid')
      if (!form.model.trim()) next.model = t('settings.errors.modelRequired')
    }
    setErrors(next)
    if (Object.keys(next).length) return
    const body: ConnectionInput =
      form.provider === 'anthropic'
        ? { provider: 'anthropic', model: form.model, ...(apiKey ? { apiKey } : {}) }
        : { provider: 'openai-compatible', model: form.model.trim(), baseUrl: trimSlash(form.baseUrl), ...(apiKey ? { apiKey } : {}) }
    setPending(true)
    setServerError(null)
    try {
      await writes.save(body)
      toast.success(t('settings.saved'))
      onDone()
    } catch (error) {
      setServerError(aiErrorMessage(error, t))
    } finally {
      setPending(false)
    }
  }

  const keyLabel = form.provider === 'anthropic' ? t('settings.apiKey') : t('settings.apiKeyOptional')
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5 rounded-xl border bg-card p-5">
      {serverError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('settings.provider')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" className="size-4 accent-primary" checked={form.provider === 'anthropic'} onChange={() => switchProvider('anthropic')} />
          {t('settings.providerAnthropic')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" className="size-4 accent-primary" checked={form.provider === 'openai-compatible'} onChange={() => switchProvider('openai-compatible')} aria-describedby="ai-openai-hint" />
          {t('settings.providerOpenAi')}
        </label>
        <p id="ai-openai-hint" className="text-xs text-muted-foreground">{t('settings.providerOpenAiHint')}</p>
      </fieldset>

      {form.provider === 'openai-compatible' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ai-preset">{t('settings.preset')}</Label>
            <select id="ai-preset" className={selectClass} value={form.preset} onChange={(e) => pickPreset(e.target.value)} aria-describedby="ai-preset-hint">
              <option value={CUSTOM}>{t('settings.presetCustom')}</option>
              {AI_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p id="ai-preset-hint" className="text-xs text-muted-foreground">{t('settings.presetHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-base-url">{t('settings.baseUrl')}</Label>
            <Input id="ai-base-url" type="url" value={form.baseUrl} onChange={(e) => update({ baseUrl: e.target.value, preset: CUSTOM })} aria-invalid={errors.baseUrl ? true : undefined} aria-describedby={errors.baseUrl ? 'ai-base-url-error' : undefined} />
            <FieldError id="ai-base-url-error" text={errors.baseUrl} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-name">{t('settings.modelName')}</Label>
            <Input id="ai-model-name" value={form.model} onChange={(e) => update({ model: e.target.value })} aria-invalid={errors.model ? true : undefined} aria-describedby={errors.model ? 'ai-model-name-error' : 'ai-model-name-hint'} />
            <p id="ai-model-name-hint" className="text-xs text-muted-foreground">{t('settings.modelNameHint')}</p>
            <FieldError id="ai-model-name-error" text={errors.model} />
          </div>
        </>
      )}

      {form.provider === 'anthropic' && (
        <div className="space-y-1.5">
          <Label htmlFor="ai-model">{t('settings.model')}</Label>
          <select id="ai-model" className={selectClass} value={form.model} onChange={(e) => update({ model: e.target.value })}>
            {CLAUDE_MODELS.map((m) => (
              <option key={m} value={m}>{t(`models.${MODEL_LABEL[m]}`)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ai-key">{keyLabel}</Label>
        <Input
          id="ai-key"
          type="password"
          autoComplete="off"
          value={form.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          aria-invalid={errors.apiKey ? true : undefined}
          aria-describedby={errors.apiKey ? 'ai-key-error' : keepsKey ? 'ai-key-keep' : undefined}
        />
        {keepsKey && <p id="ai-key-keep" className="text-xs text-muted-foreground">{t('settings.keepKey')}</p>}
        <FieldError id="ai-key-error" text={errors.apiKey} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? t('settings.testing') : t('settings.connect')}</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>{t('settings.cancel')}</Button>
        )}
      </div>
    </form>
  )
}

export function AiSettingsPage() {
  const { t } = useTranslation('ai')
  const status = useAiStatus()
  const writes = useAiWrites()
  const [editing, setEditing] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  if (status.isPending) return <Skeleton className="h-40 w-full" />
  if (!status.data) return <ErrorState message={t('settings.noAccess')} />
  const s = status.data
  const providerName = (c: AiConnection) => (c.provider === 'anthropic' ? t('settings.providerAnthropic') : t('settings.providerOpenAi'))

  const disconnect = async () => {
    try {
      await writes.disconnect()
      toast.success(t('settings.disconnected'))
      setEditing(false)
    } catch (error) {
      toast.error(aiErrorMessage(error, t))
    } finally {
      setConfirmDisconnect(false)
    }
  }

  const toggle = async (enabled: boolean) => {
    try {
      await writes.setEnabled(enabled)
    } catch (error) {
      toast.error(aiErrorMessage(error, t))
    }
  }

  let body: ReactNode
  if (!s.available) body = <Note>{t('settings.notAvailable')}</Note>
  else if (!s.enabled) body = <Note>{t('settings.disabled')}</Note>
  else if (s.connection && !editing) {
    const c = s.connection
    body = (
      <section aria-labelledby="ai-connected" className="space-y-2 rounded-xl border bg-card p-5">
        <h2 id="ai-connected" className="font-serif text-lg font-semibold">{t('settings.connected')}</h2>
        <p>{t('settings.connectedTo', { provider: providerName(c), model: c.model })}</p>
        {c.baseUrl && <p className="break-all font-mono text-sm text-muted-foreground">{c.baseUrl}</p>}
        <p className="text-sm text-muted-foreground">{c.keyHint ? t('settings.keyEnding', { hint: c.keyHint }) : t('settings.noKey')}</p>
        <p className="text-sm text-muted-foreground">{t('settings.since', { date: formatDate(c.createdAt) })}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={() => setEditing(true)}>{t('settings.change')}</Button>
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmDisconnect(true)}>{t('settings.disconnect')}</Button>
        </div>
      </section>
    )
  } else body = <ConnectionForm current={s.connection} onDone={() => setEditing(false)} onCancel={s.connection ? () => setEditing(false) : undefined} />

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="max-w-2xl space-y-6">
        {s.canManage && s.available && (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <Switch id="ai-allow-all" checked={s.enabled} onCheckedChange={(v) => void toggle(v)} aria-describedby="ai-allow-all-hint" />
            <div className="space-y-1">
              <Label htmlFor="ai-allow-all">{t('settings.allowAll')}</Label>
              <p id="ai-allow-all-hint" className="text-xs text-muted-foreground">{t('settings.allowAllHint')}</p>
            </div>
          </div>
        )}
        {body}
        {s.available && (
          <section aria-labelledby="ai-usage" className="space-y-1">
            <h2 id="ai-usage" className="text-sm font-medium">{t('settings.usage')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('settings.usageText', { count: s.usage.requests, input: formatNumber(s.usage.inputTokens), output: formatNumber(s.usage.outputTokens) })}
            </p>
          </section>
        )}
      </div>
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t('settings.disconnectTitle')}
        description={t('settings.disconnectText')}
        confirmLabel={t('settings.disconnect')}
        destructive
        onConfirm={() => void disconnect()}
      />
    </>
  )
}
```

In `app/routes.tsx`, import `AiSettingsPage` and add `{ path: 'account/ai', element: <AiSettingsPage /> }` before the `'*'` route.

In `app/shell/UserMenu.tsx`, import `Sparkles` from `lucide-react` and `useAiStatus` from `@/features/ai/ai-queries`; inside the component add `const aiStatus = useAiStatus()`; and before the theme separator add:

```tsx
        {aiStatus.data && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/account/ai">
                <Sparkles aria-hidden />
                {t('userMenu.aiAssistant')}
              </Link>
            </DropdownMenuItem>
          </>
        )}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai src/app src/i18n`
Expected: PASS. If a shell test breaks because its `apiClient.get` mock does not know `/ai/connection`, make that mock answer it (the status query must not break other screens) and ledger it.

- [ ] **Step 6: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(ai): AI assistant page to connect Claude or an OpenAI-compatible service"
```

---

### Task 3: AI menu and result panel for a field

**Files:**
- Create: `features/ai/rich-text-clean.ts`, `features/ai/components/AiField.tsx`, `features/content/editor/fields/field-addon.ts`
- Modify: `features/content/editor/fields/FieldShell.tsx`, `i18n/locales/{en,cs}/ai.json`
- Test: `features/ai/rich-text-clean.test.ts`, `features/ai/components/AiField.test.tsx`

**Interfaces:**
- Consumes: `streamGenerate`, `AiRequestError`, `AiAction`, `GenerateRequest` (Task 1); `useAiReady`; `aiErrorKey`, `SETTINGS_CODES`; `Field` from `@/types`.
- Produces: `cleanRichText(html): string`, `toPlainText(text): string`; `FieldAddonContext`; `AiField({ field, value, onApply, getContext, disabled, children })` where `getContext: (fieldName: string) => GenerateRequest['context']` and `children: (version: number) => ReactNode`.

- [ ] **Step 1: Write the failing tests**

Create `features/ai/rich-text-clean.test.ts`:

```ts
import { cleanRichText, toPlainText } from './rich-text-clean'

it('keeps the editor tags and safe links, and drops everything else', () => {
  expect(cleanRichText('<h2>Šumava</h2><p>Byli jsme <strong>tam</strong> a <a href="https://x.test" onclick="alert(1)">zpět</a>.</p>')).toBe(
    '<h2>Šumava</h2><p>Byli jsme <strong>tam</strong> a <a href="https://x.test">zpět</a>.</p>',
  )
  expect(cleanRichText('<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe>')).toBe('<p>a</p>')
  expect(cleanRichText('<p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>')).toBe('<p><a>x</a></p>')
  expect(cleanRichText('<div><b>tučně</b> <i>kurzíva</i></div><h1>Nadpis</h1>')).toBe('<p><strong>tučně</strong> <em>kurzíva</em></p><h2>Nadpis</h2>')
})

it('removes a Markdown code fence around the answer', () => {
  expect(cleanRichText('```html\n<p>Ahoj</p>\n```')).toBe('<p>Ahoj</p>')
  expect(toPlainText('```\nAhoj\n```')).toBe('Ahoj')
})

it('turns any HTML into plain text for text fields', () => {
  expect(toPlainText('<p>Byli jsme <strong>tam</strong>.</p>')).toBe('Byli jsme tam.')
  expect(toPlainText('  Jen text  ')).toBe('Jen text')
})
```

Create `features/ai/components/AiField.test.tsx`:

```tsx
import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import type { Field } from '@/types'
import { FieldShell } from '@/features/content/editor/fields/FieldShell'
import { AiField } from './AiField'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const ready = { available: true, enabled: true, canManage: false, connection: { provider: 'openai-compatible', model: 'm', createdAt: '2026-10-02' }, usage: { month: '2026-10', requests: 0, inputTokens: 0, outputTokens: 0 } }
const perex: Field = { name: 'perex', label: 'Perex', type: 'TEXT', required: false }
const body: Field = { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false }
const context = () => ({ contentType: 'Blog post', language: 'cs', fields: [{ label: 'Title', value: 'Šumava' }] })

function sse(events: string[], hold?: Promise<void>) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const e of events) controller.enqueue(encoder.encode(e))
        if (hold) await hold
        controller.close()
      },
    }),
    { status: 200 },
  )
}
const delta = (text: string) => `event: delta\ndata: ${JSON.stringify({ text })}\n\n`
const done = (extra = '') => `event: done\ndata: {"inputTokens":1,"outputTokens":2${extra}}\n\n`

function Harness({ field, initial }: { field: Field; initial: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <AiField field={field} value={value} onApply={setValue} getContext={context}>
        {(version) => (
          <FieldShell field={field} id={`field-${field.name}`}>
            <input id={`field-${field.name}`} data-version={version} value={value} onChange={(e) => setValue(e.target.value)} />
          </FieldShell>
        )}
      </AiField>
      <output data-testid="value">{value}</output>
    </>
  )
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: ready } })
})

it('offers a draft for an empty field and the text actions for a filled one', async () => {
  const first = renderWithProviders(<Harness field={perex} initial="" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Write a draft', 'Own instruction'])
  first.unmount()
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Rewrite more clearly', 'Shorten', 'Expand', 'Fix spelling and grammar', 'Own instruction'])
})

it('streams a rewrite into the preview and replaces the field only on Use', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Byli jsme'), delta(' na Šumavě.'), done()]))
  const { container } = renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rewrite more clearly' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Perex' })
  expect(await within(panel).findByText('Byli jsme na Šumavě.')).toBeInTheDocument()
  expect(screen.getByTestId('value')).toHaveTextContent('Byli jsme tam.')
  const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
  expect(sent).toEqual({ action: 'rewrite', field: { label: 'Perex', type: 'TEXT', value: 'Byli jsme tam.' }, context: context() })
  await expectNoA11yViolations(container)
  await userEvent.click(within(panel).getByRole('button', { name: 'Use' }))
  expect(screen.getByTestId('value')).toHaveTextContent('Byli jsme na Šumavě.')
  expect(screen.queryByRole('region', { name: 'AI suggestion for Perex' })).not.toBeInTheDocument()
  expect(container.querySelector('#field-perex')).toHaveAttribute('data-version', '1')
})

it('asks for a brief before a draft and sends it as the instruction', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Nový text'), done()]))
  renderWithProviders(<Harness field={perex} initial="" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Write a draft' }))
  await userEvent.type(screen.getByLabelText('What should AI write?'), 'o výletu na Šumavu')
  await userEvent.click(screen.getByRole('button', { name: 'Create' }))
  expect(await screen.findByText('Nový text')).toBeInTheDocument()
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'draft', instruction: 'o výletu na Šumavu' })
})

it('cleans rich text and can insert it below the current text', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('<p>Druhý <strong>odstavec</strong></p><script>alert(1)</script>'), done()]))
  renderWithProviders(<Harness field={body} initial="<p>První</p>" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Body' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Expand' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Body' })
  await within(panel).findByText('odstavec')
  expect(panel.querySelector('script')).toBeNull()
  await userEvent.click(within(panel).getByRole('button', { name: 'Insert below' }))
  expect(screen.getByTestId('value').textContent).toBe('<p>První</p><p>Druhý <strong>odstavec</strong></p>')
})

it('aborts the request on Discard and shows nothing more', async () => {
  let release: () => void = () => {}
  const hold = new Promise<void>((resolve) => (release = resolve))
  let signal: AbortSignal | undefined
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    signal = init?.signal ?? undefined
    return sse([delta('Začátek')], hold)
  })
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Shorten' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Perex' })
  await within(panel).findByText('Začátek')
  await userEvent.click(within(panel).getByRole('button', { name: 'Discard' }))
  expect(signal?.aborted).toBe(true)
  release()
  await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument())
  expect(screen.getByTestId('value')).toHaveTextContent('Byli jsme tam.')
})

it('explains errors, links to the settings for key problems, and can retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(sse(['event: error\ndata: {"code":"AUTH","message":"The AI service refused the key"}\n\n'])).mockResolvedValueOnce(sse([delta('Opraveno'), done()]))
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Fix spelling and grammar' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Perex' })
  expect(await within(panel).findByRole('alert')).toHaveTextContent('The AI service refused the key.')
  expect(within(panel).getByRole('link', { name: 'AI assistant settings' })).toHaveAttribute('href', '/account/ai')
  await userEvent.click(within(panel).getByRole('button', { name: 'Try again' }))
  expect(await within(panel).findByText('Opraveno')).toBeInTheDocument()
})

it('warns when the answer was cut off', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Dlouhý'), done(',"truncated":true')]))
  renderWithProviders(<Harness field={perex} initial="x" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Expand' }))
  expect(await screen.findByText('The answer was cut off at the length limit.')).toBeInTheDocument()
})

it('shows no AI button when AI is not ready', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: { ...ready, connection: null } } })
  renderWithProviders(<Harness field={perex} initial="x" />)
  await screen.findByLabelText('Perex')
  await waitFor(() => expect(apiClient.get).toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'AI for Perex' })).not.toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Kratší'), done()]))
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI pro Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Zkrátit' }))
  const panel = await screen.findByRole('region', { name: 'Návrh AI pro Perex' })
  await within(panel).findByText('Kratší')
  expect(within(panel).getByRole('button', { name: 'Použít' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Zahodit' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai`
Expected: FAIL, `./rich-text-clean` and `./AiField` do not exist.

- [ ] **Step 3: Add the menu and panel catalog keys**

Add to `i18n/locales/en/ai.json`:

```json
  "menu": {
    "open": "AI for {{field}}",
    "draft": "Write a draft",
    "rewrite": "Rewrite more clearly",
    "shorten": "Shorten",
    "expand": "Expand",
    "fix": "Fix spelling and grammar",
    "custom": "Own instruction"
  },
  "panel": {
    "title": "AI suggestion for {{field}}",
    "writing": "Writing…",
    "instructionDraft": "What should AI write?",
    "instructionCustom": "Instruction",
    "run": "Create",
    "use": "Use",
    "insertBelow": "Insert below",
    "retry": "Try again",
    "discard": "Discard",
    "truncated": "The answer was cut off at the length limit.",
    "empty": "The AI returned no text.",
    "openSettings": "AI assistant settings"
  }
```

And to `i18n/locales/cs/ai.json`:

```json
  "menu": {
    "open": "AI pro {{field}}",
    "draft": "Napsat návrh",
    "rewrite": "Přepsat srozumitelněji",
    "shorten": "Zkrátit",
    "expand": "Rozvést",
    "fix": "Opravit pravopis a gramatiku",
    "custom": "Vlastní pokyn"
  },
  "panel": {
    "title": "Návrh AI pro {{field}}",
    "writing": "Píšu…",
    "instructionDraft": "Co má AI napsat?",
    "instructionCustom": "Pokyn",
    "run": "Vytvořit",
    "use": "Použít",
    "insertBelow": "Vložit pod",
    "retry": "Znovu",
    "discard": "Zahodit",
    "truncated": "Odpověď byla useknuta na limitu délky.",
    "empty": "AI nevrátila žádný text.",
    "openSettings": "Nastavení AI asistenta"
  }
```

- [ ] **Step 4: Implement the cleaner, the addon slot and the field wrapper**

Create `features/ai/rich-text-clean.ts`:

```ts
const KEEP = new Set(['P', 'H2', 'H3', 'STRONG', 'EM', 'U', 'S', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'BR'])
const RENAME: Record<string, string> = { B: 'STRONG', I: 'EM', H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3', DIV: 'P', STRIKE: 'S', DEL: 'S' }
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META'])
const SAFE_HREF = /^(https?:|mailto:)/i

/** Models sometimes wrap the answer in a Markdown code fence. */
function unfence(text: string): string {
  const fenced = /^\s*```[a-z]*\s*\n([\s\S]*?)\n?```\s*$/i.exec(text)
  return (fenced ? fenced[1] : text).trim()
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (text: string) => escape(text).replace(/"/g, '&quot;')

function walk(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escape(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  if (DROP.has(el.tagName)) return ''
  const inner = Array.from(el.childNodes).map(walk).join('')
  const tag = RENAME[el.tagName] ?? el.tagName
  if (!KEEP.has(tag)) return inner
  const name = tag.toLowerCase()
  if (tag === 'BR') return '<br>'
  if (tag === 'A') {
    const href = el.getAttribute('href')?.trim() ?? ''
    return SAFE_HREF.test(href) ? `<a href="${escapeAttr(href)}">${inner}</a>` : `<a>${inner}</a>`
  }
  return `<${name}>${inner}</${name}>`
}

/** The AI's HTML reduced to the tags the rich-text editor keeps; no attributes except safe link targets. */
export function cleanRichText(html: string): string {
  const doc = new DOMParser().parseFromString(unfence(html), 'text/html')
  return Array.from(doc.body.childNodes).map(walk).join('').trim()
}

/** Text without any markup, for plain text fields. */
export function toPlainText(text: string): string {
  const doc = new DOMParser().parseFromString(unfence(text), 'text/html')
  return (doc.body.textContent ?? '').trim()
}
```

Create `features/content/editor/fields/field-addon.ts`:

```ts
import { createContext, type ReactNode } from 'react'

/** Extra controls shown in a field's label row (the AI menu), provided by a wrapper around the field. */
export const FieldAddonContext = createContext<ReactNode>(null)
```

In `features/content/editor/fields/FieldShell.tsx`, import `useContext` from `react` and `FieldAddonContext` from `./field-addon`; read `const addon = useContext(FieldAddonContext)` at the top of `FieldShell`; and replace `{counter}` in the label row with:

```tsx
        <div className="flex items-center gap-2">
          {addon}
          {counter}
        </div>
```

Create `features/ai/components/AiField.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Field } from '@/types'
import { FieldAddonContext } from '@/features/content/editor/fields/field-addon'
import { AiRequestError, streamGenerate, type AiAction, type GenerateRequest } from '../ai-api'
import { useAiReady } from '../ai-queries'
import { SETTINGS_CODES, aiErrorKey, type AiErrorKey } from '../ai-errors'
import { cleanRichText, toPlainText } from '../rich-text-clean'

interface AiFieldProps {
  field: Field
  value: unknown
  onApply: (value: string) => void
  /** The entry's other text, the model name and the version language, for the prompt. */
  getContext: (fieldName: string) => GenerateRequest['context']
  disabled?: boolean
  /** Renders the field; `version` changes after a result is applied so editors that read their value once remount. */
  children: (version: number) => ReactNode
}

type Panel =
  | { kind: 'instruction'; action: 'draft' | 'custom'; instruction: string }
  | { kind: 'running' | 'done' | 'error'; action: AiAction; instruction?: string; text: string; truncated?: boolean; error?: { key: AiErrorKey | null; message: string } }

const FILLED_ACTIONS: AiAction[] = ['rewrite', 'shorten', 'expand', 'fix']

export function AiField({ field, value, onApply, getContext, disabled, children }: AiFieldProps) {
  const { t } = useTranslation('ai')
  const ready = useAiReady()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [version, setVersion] = useState(0)
  const request = useRef<AbortController | null>(null)
  // Leaving the editor stops a running answer.
  useEffect(() => () => request.current?.abort(), [])

  const supported = field.type === 'TEXT' || field.type === 'RICH_TEXT'
  if (!ready || !supported || disabled) return <>{children(version)}</>

  const label = field.label || field.name
  const current = typeof value === 'string' ? value : ''
  const empty = toPlainText(current) === ''
  const rich = field.type === 'RICH_TEXT'

  const run = async (action: AiAction, instruction?: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPanel({ kind: 'running', action, instruction, text: '' })
    try {
      const result = await streamGenerate(
        { action, ...(instruction ? { instruction } : {}), field: { label, type: rich ? 'RICH_TEXT' : 'TEXT', value: current }, context: getContext(field.name) },
        { signal: controller.signal, onText: (text) => setPanel((p) => (p && p.kind === 'running' ? { ...p, text } : p)) },
      )
      if (controller.signal.aborted) return
      setPanel({ kind: 'done', action, instruction, text: result.text, truncated: result.truncated })
    } catch (error) {
      if (controller.signal.aborted) return
      const known = error instanceof AiRequestError ? error : new AiRequestError('PROVIDER', String(error))
      setPanel((p) => ({ kind: 'error', action, instruction, text: p && 'text' in p ? p.text : '', error: { key: aiErrorKey(known.code), message: known.message } }))
    }
  }

  const close = () => {
    request.current?.abort()
    request.current = null
    setPanel(null)
  }

  const apply = (mode: 'replace' | 'append') => {
    if (!panel || panel.kind !== 'done') return
    const cleaned = rich ? cleanRichText(panel.text) : toPlainText(panel.text)
    onApply(mode === 'append' ? `${current}${cleaned}` : cleaned)
    setVersion((v) => v + 1)
    setPanel(null)
  }

  const pick = (action: AiAction) => {
    if (action === 'draft' || action === 'custom') setPanel({ kind: 'instruction', action, instruction: '' })
    else void run(action)
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" aria-label={t('menu.open', { field: label })}>
          <Sparkles aria-hidden className="size-3.5" />
          {t('menu.short')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {empty ? (
          <DropdownMenuItem onSelect={() => pick('draft')}>{t('menu.draft')}</DropdownMenuItem>
        ) : (
          FILLED_ACTIONS.map((a) => (
            <DropdownMenuItem key={a} onSelect={() => pick(a)}>{t(`menu.${a}`)}</DropdownMenuItem>
          ))
        )}
        <DropdownMenuItem onSelect={() => pick('custom')}>{t('menu.custom')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const panelId = `ai-panel-${field.name}`
  const instructionId = `ai-instruction-${field.name}`
  let content: ReactNode = null
  if (panel?.kind === 'instruction') {
    content = (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (panel.instruction.trim()) void run(panel.action, panel.instruction.trim())
        }}
      >
        <Label htmlFor={instructionId}>{panel.action === 'draft' ? t('panel.instructionDraft') : t('panel.instructionCustom')}</Label>
        <Textarea id={instructionId} value={panel.instruction} maxLength={1000} onChange={(e) => setPanel({ ...panel, instruction: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!panel.instruction.trim()}>{t('panel.run')}</Button>
          <Button type="button" size="sm" variant="outline" onClick={close}>{t('panel.discard')}</Button>
        </div>
      </form>
    )
  } else if (panel) {
    const shown = rich ? cleanRichText(panel.text) : toPlainText(panel.text)
    content = (
      <div className="space-y-3">
        {panel.kind === 'running' && !shown && <p className="text-sm text-muted-foreground">{t('panel.writing')}</p>}
        {shown &&
          (rich ? (
            <div className="prose prose-sm max-w-none break-words" dangerouslySetInnerHTML={{ __html: shown }} />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm">{shown}</p>
          ))}
        {panel.kind === 'done' && !shown && <p className="text-sm text-muted-foreground">{t('panel.empty')}</p>}
        {panel.kind === 'done' && panel.truncated && <p className="text-sm text-amber-700 dark:text-amber-400">{t('panel.truncated')}</p>}
        {panel.kind === 'error' && panel.error && (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            <p>{panel.error.key ? t(`errors.${panel.error.key}`) : panel.error.message}</p>
            {panel.error.key && SETTINGS_CODES.includes(panel.error.key) && (
              <Link to="/account/ai" className="underline underline-offset-2">{t('panel.openSettings')}</Link>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {panel.kind === 'done' && shown && (
            <Button type="button" size="sm" onClick={() => apply('replace')}>{t('panel.use')}</Button>
          )}
          {panel.kind === 'done' && shown && rich && (
            <Button type="button" size="sm" variant="outline" onClick={() => apply('append')}>{t('panel.insertBelow')}</Button>
          )}
          {panel.kind !== 'running' && (
            <Button type="button" size="sm" variant="outline" onClick={() => void run(panel.action, panel.instruction)}>{t('panel.retry')}</Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={close}>{t('panel.discard')}</Button>
        </div>
      </div>
    )
  }

  return (
    <FieldAddonContext.Provider value={menu}>
      {children(version)}
      {panel && (
        <section id={panelId} aria-label={t('panel.title', { field: label })} aria-busy={panel.kind === 'running'} className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          {content}
        </section>
      )}
    </FieldAddonContext.Provider>
  )
}
```

Add `"short": "AI"` to the `menu` object in both `ai.json` files.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai src/features/content/editor src/i18n`
Expected: PASS.

- [ ] **Step 6: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass. Lint flags literal strings passed to helpers inside JSX (as in earlier plans); move such values into module constants and ledger it.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(ai): AI menu and streamed suggestion panel for text fields"
```

---

### Task 4: Wire AI into the entry editor and check in the browser

**Files:**
- Modify: `features/content/editor/EntryEditor.tsx`
- Test: `features/content/pages/EntryEditorAi.test.tsx`
- Modify: `TEST_RESULTS.md`

**Interfaces:**
- Consumes: `AiField`, `toPlainText` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `features/content/pages/EntryEditorAi.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import * as api from '../content-api'
import * as aiApi from '@/features/ai/ai-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content-api')>()
  return { ...actual, getEntry: vi.fn(), getContentType: vi.fn(), listContentTypes: vi.fn(), listEntries: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(), publishEntry: vi.fn() }
})
vi.mock('@/features/ai/ai-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/ai/ai-api')>()
  return { ...actual, getAiStatus: vi.fn(), streamGenerate: vi.fn() }
})
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: ({ value }: { value: string }) => <textarea aria-label="rich text" defaultValue={value} /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const routes = [{ path: '/content/:id', element: <EntryEditorPage /> }]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(aiApi.getAiStatus).mockResolvedValue({
    available: true,
    enabled: true,
    canManage: false,
    connection: { provider: 'openai-compatible', model: 'm', createdAt: '2026-10-02' },
    usage: { month: '2026-10', requests: 0, inputTokens: 0, outputTokens: 0 },
  })
})

it('offers AI on text fields and applies the suggestion as an unsaved edit with the entry as context', async () => {
  vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ id: 'e1', data: { title: 'Šumava' }, title: 'Šumava' }))
  vi.mocked(aiApi.streamGenerate).mockImplementation(async (_body, { onText }) => {
    onText('Šumava v létě')
    return { text: 'Šumava v létě', inputTokens: 1, outputTokens: 1 }
  })
  renderRoutes(routes, { route: '/content/e1' })
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Title' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rewrite more clearly' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Title' })
  await userEvent.click(await within(panel).findByRole('button', { name: 'Use' }))
  expect(screen.getByLabelText('Title')).toHaveValue('Šumava v létě')
  await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeInTheDocument())
  const sent = vi.mocked(aiApi.streamGenerate).mock.calls[0][0]
  expect(sent).toMatchObject({ action: 'rewrite', field: { label: 'Title', type: 'TEXT', value: 'Šumava' }, context: { contentType: tripType.name, language: expect.any(String) } })
  expect(sent.context.fields.some((f) => f.label === 'Title')).toBe(false)
})

it('shows no AI buttons when the user is not connected', async () => {
  vi.mocked(aiApi.getAiStatus).mockResolvedValue(null)
  vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ id: 'e1', data: { title: 'Šumava' }, title: 'Šumava' }))
  renderRoutes(routes, { route: '/content/e1' })
  await screen.findByLabelText('Title')
  expect(screen.queryByRole('button', { name: /^AI for/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/content/pages/EntryEditorAi.test.tsx`
Expected: FAIL, no "AI for Title" button. If the "Unsaved changes" text differs in this editor, use the editor's existing unsaved label from `features/content` catalogs and ledger it.

- [ ] **Step 3: Wrap text fields with `AiField`**

In `features/content/editor/EntryEditor.tsx`, import `AiField` from `@/features/ai/components/AiField` and `toPlainText` from `@/features/ai/rich-text-clean`, add near the other callbacks:

```tsx
  // Context for AI help: the other text fields of this version, the model name and the version language.
  const aiContext = useCallback(
    (fieldName: string) => ({
      contentType: contentType.name,
      language,
      fields: fields
        .filter((f) => f.name !== fieldName && (f.type === 'TEXT' || f.type === 'RICH_TEXT'))
        .map((f) => ({ label: f.label || f.name, value: toPlainText(typeof form.values[f.name] === 'string' ? (form.values[f.name] as string) : '') }))
        .filter((f) => f.value),
    }),
    [contentType.name, language, fields, form.values],
  )
```

and replace the `<FieldControl ... />` in `renderField` with:

```tsx
        <AiField field={field} value={form.values[field.name]} onApply={(v) => form.setValue(field.name, v)} getContext={aiContext} disabled={readOnly}>
          {(version) => (
            <FieldControl
              key={version}
              field={field}
              id={`field-${field.name}`}
              value={form.values[field.name]}
              onChange={(v) => form.setValue(field.name, v)}
              onBlur={() => {
                form.touch(field.name)
                autosave.flush()
              }}
              error={form.visibleErrors[field.name]}
              disabled={readOnly}
            />
          )}
        </AiField>
```

(`useCallback` is already imported in this file; add it to the React import if not.)

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/content src/features/ai`
Expected: PASS (all existing editor tests too: without a connection the editor is unchanged).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(ai): AI help on text fields in the entry and product editors"
```

- [ ] **Step 6: Browser check**

Copy the local database to `thecms_aiui` (never touch `thecms`). Start the worktree backend on port 3100 against it with a generated `AI_KEY_SECRET`, a fake OpenAI-compatible service on port 11500 (as in Plan 1: streams a few chunks, then usage and `[DONE]`; make it answer rich text with a `<p>` and a `<script>` when the system prompt asks for HTML), and the worktree admin on port 5175 (`VITE_API_URL=http://localhost:3100/api/v1`). If Ollama is running on the machine, also try it; do not install anything.

1. User menu shows "AI asistent"; the page connects the OpenAI-compatible service through the Ollama preset after replacing the address with `http://localhost:11500/v1` and model `fake`; status, usage and Disconnect work; the Admin switch hides everything when off and restores it when on.
2. In a blog post: a TEXT field's AI menu offers the right actions; Rewrite streams into the panel; Použít replaces the text and the entry shows unsaved; Zahodit during streaming stops it.
3. A RICH_TEXT field: Rozvést streams formatted text, the `<script>` is gone, Vložit pod adds it below in the editor.
4. The product Content tab shows the same AI buttons.
5. Stop the fake service: the panel says the service can't be reached; Znovu works after restarting it.
6. Czech admin language and a 360px iframe for the AI page and an editor with an open panel: no horizontal scroll; no console errors.
Expected: as described.

- [ ] **Step 7: Record and clean up**

Append "AI assistant Plan 2 verification" to `TEST_RESULTS.md` with the results (failures described as found), stop the servers, drop `thecms_aiui`, and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record AI assistant Plan 2 verification"
```

---

## Self-Review Notes

- **Spec coverage:** 7.1 page (not available, disabled, both providers with presets, key ending, change, disconnect, usage, Admin switch) → Tasks 1 and 2; 7.2 editor (button by the label for TEXT and RICH_TEXT when connected and allowed, menu per field state, streamed panel, Použít, Vložit pod, Znovu, Zahodit, abort, unsaved after use, errors with a settings link) → Tasks 3 and 4; rich text cleaned to the allowed tags → Task 3; English and Czech, axe, 360px → Tasks 2 to 4; browser check → Task 4.
- **Type consistency:** `AiStatus` (with `canManage`), `ConnectionInput`, `GenerateRequest`, `GenerateResult`, `AiRequestError`, `streamGenerate`, `useAiStatus`, `useAiReady`, `useAiWrites`, `aiErrorKey`, `SETTINGS_CODES`, `cleanRichText`, `toPlainText`, `FieldAddonContext`, `AiField` are used with the same names in every task.
- **Review Focus:** each line has its test (Task 3 abort and cleaning, Tasks 3 and 4 rich-text apply, Task 2 key kept, Tasks 2 and 3 not ready).
