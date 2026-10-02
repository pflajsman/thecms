# AI Translate, Plan 2: Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the entry editor's language switcher, a missing language can be created with "Translate to <language> with AI": a dialog shows progress per field, then the editor opens the new DRAFT version.

**Architecture:** `streamTranslate` in `ai-api.ts` reads the `POST /ai/translate` event stream (sharing one SSE reader with `streamGenerate`); a `TranslateDialog` runs one request per open and shows fields, progress and errors; `LanguageMenu` gets an optional AI item; `EntryEditor` opens the dialog and navigates on success.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, react-i18next (typed keys, en/cs, `i18next/no-literal-string` lint), shadcn/Radix Dialog and DropdownMenu, Vitest + Testing Library + axe.

**Spec:** `docs/superpowers/specs/2026-10-02-ai-translate-versions-design.md` (section 4). Backend Plan 1 is merged: `POST /api/v1/ai/translate`.

## Global Constraints

- Request body `{ entryId, language }`. Refused before streaming as JSON with `reason` (`VERSION_EXISTS`, `NOT_CONNECTED`, `AI_DISABLED`, `AI_NOT_AVAILABLE`) or `429`.
- Events: `start { fields: [{ name, label }] }`, `field { name, index, total }` (index from 1), `done { versionId, inputTokens, outputTokens }`, `error { code, message, field? }`.
- Retry for `RATE_LIMIT`, `UNREACHABLE`, `TIMEOUT`, `PROVIDER`, `AI_RATE_LIMIT`, `NETWORK` and unknown codes; a link to `/account/ai` for `AUTH`, `NOT_CONNECTED`, `KEY_UNREADABLE`; `TOO_LONG` and `TRUNCATED` say to shorten the field or translate it by hand (no retry); `VERSION_EXISTS` offers to open the existing version.
- Closing the dialog (Cancel, Escape, overlay) aborts the request; nothing is created.
- On `done`: the editor opens the new version and shows "Translated draft created. Review it before publishing."; content lists, versions and the AI status (usage) are refreshed.
- The AI item shows only when `useAiReady()` is true; it is disabled with the existing "Save your changes before translating" note while the editor has unsaved changes.
- All new text in English and Czech under the lint guard (string literals passed to calls inside JSX are flagged: use module constants or helpers); axe on the dialog; works at 360px.
- Code and docs in English; never an em dash. Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. The dialog is closed while a field is being translated: the fetch is aborted and no "done" handler runs afterwards (Task 2 test "stops the request when cancelled").
2. The stream ends without `done` or `error` (server restarted, proxy cut): the dialog shows an error with Retry instead of spinning forever (Task 1 test "rejects when the stream ends early").
3. An error names a field that the `start` event never listed (or no `start` arrived because the request was refused): the message still reads well, using the field name as sent or no field at all (Task 2 test "links to the AI settings when the request is refused").
4. Retry after an error starts a clean run: progress resets and the previous error disappears (Task 2 test "offers a retry after a provider error").
5. A language created meanwhile: "Open the <language> version" finds the version by language and opens it (Task 3 test "opens the version created meanwhile").

## File Structure

| File | Responsibility |
|---|---|
| `packages/admin-dashboard/src/features/ai/ai-api.ts` | `postStream`, `readEvents` (shared), `streamTranslate`, `AiRequestError.field` |
| `packages/admin-dashboard/src/features/ai/ai-api.test.ts` | Translate stream tests |
| `packages/admin-dashboard/src/features/ai/components/TranslateDialog.tsx` (new) | Progress dialog |
| `packages/admin-dashboard/src/features/ai/components/TranslateDialog.test.tsx` (new) | Dialog tests |
| `packages/admin-dashboard/src/i18n/locales/{en,cs}/ai.json` | `translate.*` keys |
| `packages/admin-dashboard/src/i18n/locales/{en,cs}/editor.json` | `languages.translateWithAi`, `languages.aiTranslated` |
| `packages/admin-dashboard/src/features/content/editor/LanguageMenu.tsx` | Optional AI item |
| `packages/admin-dashboard/src/features/content/queries.ts` | `refreshVersions` write helper |
| `packages/admin-dashboard/src/features/content/editor/EntryEditor.tsx` | Opens the dialog, navigates |
| `packages/admin-dashboard/src/features/content/pages/EntryEditorAiTranslate.test.tsx` (new) | Editor wiring tests |
| `docs/superpowers/specs/2026-10-02-ai-translate-versions-design.md` | 4.1 matches the existing disabled-while-unsaved behaviour |
| `TEST_RESULTS.md` | Plan 2 verification |

---

### Task 1: `streamTranslate`

**Files:**
- Modify: `packages/admin-dashboard/src/features/ai/ai-api.ts`
- Test: `packages/admin-dashboard/src/features/ai/ai-api.test.ts` (append)

**Interfaces:**
- Produces: `AiRequestError(code: string, message: string, field?: string)` with `field?: string`; `TranslateField { name: string; label: string }`; `TranslateRequest { entryId: string; language: string }`; `TranslateResult { versionId: string; inputTokens: number; outputTokens: number }`; `streamTranslate(body: TranslateRequest, options: { signal?: AbortSignal; onStart: (fields: TranslateField[]) => void; onField: (name: string, index: number) => void }): Promise<TranslateResult>`.

- [ ] **Step 1: Write the failing tests** (append; add `streamTranslate` to the import from `./ai-api`)

```ts
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
```

The first test splits the body `field` event across two chunks (`field('bo', 0).slice(0, 10)` is the same 10-character prefix `event: fie` as the next event's).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai/ai-api.test.ts`
Expected: FAIL, "streamTranslate is not a function" (or an import error)

- [ ] **Step 3: Write the implementation**

In `ai-api.ts`, give `AiRequestError` a field:

```ts
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
```

Add the types next to `GenerateResult`:

```ts
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
```

Replace the body of `streamGenerate` (and keep `refusedCode`) with the shared helpers below:

```ts
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
```

- [ ] **Step 4: Run the AI tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai`
Expected: PASS, the 4 new tests plus every existing AI test (the generate tests prove the shared reader changed nothing)

- [ ] **Step 5: Commit**

```bash
git add packages/admin-dashboard/src/features/ai/ai-api.ts packages/admin-dashboard/src/features/ai/ai-api.test.ts
git commit -m "feat(ai): admin client for the translate stream

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Translate dialog

**Files:**
- Create: `packages/admin-dashboard/src/features/ai/components/TranslateDialog.tsx`
- Modify: `packages/admin-dashboard/src/i18n/locales/en/ai.json`, `packages/admin-dashboard/src/i18n/locales/cs/ai.json`
- Test: `packages/admin-dashboard/src/features/ai/components/TranslateDialog.test.tsx`

**Interfaces:**
- Consumes: `streamTranslate`, `AiRequestError`, `TranslateField` (Task 1); `aiKeys` from `../ai-queries`; `aiErrorKey`, `SETTINGS_CODES` from `../ai-errors`.
- Produces: `TranslateDialog({ entryId: string; language: { code: string; name: string }; onDone: (versionId: string) => void; onExists: () => void; onClose: () => void })`. Mounted by the parent while open; unmounting aborts.

- [ ] **Step 1: Add the text**

Add a `translate` object to `en/ai.json` (top level, after `panel`):

```json
"translate": {
  "title": "Translating to {{language}}",
  "description": "The saved version is translated field by field. Nothing is created until every field is done.",
  "starting": "Starting…",
  "progress": "Translating {{field}} ({{index}} of {{total}})",
  "stateDone": "Done",
  "stateCurrent": "Translating",
  "stateWaiting": "Waiting",
  "stateFailed": "Failed",
  "tooLong": "{{field}} is too long to translate. Shorten it or translate it by hand.",
  "truncated": "The translation of {{field}} was cut off. Shorten the field or translate it by hand.",
  "exists": "A {{language}} version was created in the meantime.",
  "openExisting": "Open the {{language}} version",
  "stoppedAt": "Stopped at {{field}}.",
  "cancel": "Cancel",
  "retry": "Try again",
  "close": "Close"
}
```

and to `cs/ai.json`:

```json
"translate": {
  "title": "Překládám do jazyka {{language}}",
  "description": "Uložená verze se překládá pole po poli. Nic se nevytvoří, dokud nejsou hotová všechna pole.",
  "starting": "Začínám…",
  "progress": "Překládám {{field}} ({{index}} z {{total}})",
  "stateDone": "Hotovo",
  "stateCurrent": "Překládám",
  "stateWaiting": "Čeká",
  "stateFailed": "Selhalo",
  "tooLong": "Pole {{field}} je příliš dlouhé na překlad. Zkraťte ho nebo ho přeložte ručně.",
  "truncated": "Překlad pole {{field}} se nevešel celý. Zkraťte pole nebo ho přeložte ručně.",
  "exists": "Verze v jazyce {{language}} mezitím vznikla.",
  "openExisting": "Otevřít verzi {{language}}",
  "stoppedAt": "Zastaveno u pole {{field}}.",
  "cancel": "Zrušit",
  "retry": "Zkusit znovu",
  "close": "Zavřít"
}
```

- [ ] **Step 2: Write the failing tests**

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import { TranslateDialog } from './TranslateDialog'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

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
afterEach(() => setTestLanguage('en'))
const start = 'event: start\ndata: {"fields":[{"name":"perex","label":"Perex"},{"name":"body","label":"Body"}]}\n\n'
const field = (name: string, index: number) => `event: field\ndata: {"name":"${name}","index":${index},"total":2}\n\n`
const done = 'event: done\ndata: {"versionId":"v1","inputTokens":1,"outputTokens":1}\n\n'
const error = (code: string, fieldName?: string) => `event: error\ndata: ${JSON.stringify({ code, message: 'Server text', ...(fieldName ? { field: fieldName } : {}) })}\n\n`
const deutsch = { code: 'de', name: 'Deutsch' }

function renderDialog() {
  const props = { onDone: vi.fn(), onExists: vi.fn(), onClose: vi.fn() }
  const view = renderWithProviders(<TranslateDialog entryId="e1" language={deutsch} {...props} />)
  return { ...props, ...view }
}

it('shows each field as it is translated and hands over the new version', async () => {
  let release: () => void = () => {}
  const hold = new Promise<void>((resolve) => (release = resolve))
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, field('perex', 1), field('body', 2)], hold))
  const { onDone, baseElement } = renderDialog()
  const dialog = await screen.findByRole('dialog', { name: 'Translating to Deutsch' })
  expect(await within(dialog).findByText('Translating Body (2 of 2)')).toBeInTheDocument()
  const items = within(dialog).getAllByRole('listitem').map((li) => li.textContent)
  expect(items).toEqual(['PerexDone', 'BodyTranslating'])
  await expectNoA11yViolations(baseElement)
  expect(onDone).not.toHaveBeenCalled()
  // The stream then ends without done: an error, never onDone.
  release()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()
})

it('calls onDone with the new version id', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, field('perex', 1), field('body', 2), done]))
  const { onDone } = renderDialog()
  await waitFor(() => expect(onDone).toHaveBeenCalledWith('v1'))
})

it('stops the request when cancelled', async () => {
  let signal: AbortSignal | undefined
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    signal = init?.signal ?? undefined
    return sse([start, field('perex', 1)], new Promise(() => {}))
  })
  const { onClose, onDone, unmount } = renderDialog()
  await screen.findByText('Translating Perex (1 of 2)')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalled()
  unmount()
  expect(signal?.aborted).toBe(true)
  expect(onDone).not.toHaveBeenCalled()
})

it('names the field that is too long and offers no retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, error('TOO_LONG', 'perex')]))
  const { onClose } = renderDialog()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Perex is too long to translate. Shorten it or translate it by hand.')
  expect(within(screen.getAllByRole('listitem')[0]).getByText('Failed')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})

it('offers a retry after a provider error', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(sse([start, field('perex', 1), error('RATE_LIMIT', 'perex')]))
    .mockResolvedValueOnce(sse([start, field('perex', 1), field('body', 2), done]))
  const { onDone } = renderDialog()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('The AI service is limiting requests. Try again shortly.')
  expect(alert).toHaveTextContent('Stopped at Perex.')
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(onDone).toHaveBeenCalledWith('v1'))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('links to the AI settings when the request is refused', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Connect an AI service first', reason: 'NOT_CONNECTED' }), { status: 409 }))
  renderDialog()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Connect an AI service first.')
  expect(within(alert).getByRole('link', { name: 'AI assistant settings' })).toHaveAttribute('href', '/account/ai')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

it('offers to open a version created meanwhile', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'exists', reason: 'VERSION_EXISTS' }), { status: 409 }))
  const { onExists } = renderDialog()
  expect(await screen.findByRole('alert')).toHaveTextContent('A Deutsch version was created in the meantime.')
  await userEvent.click(screen.getByRole('button', { name: 'Open the Deutsch version' }))
  expect(onExists).toHaveBeenCalled()
})

it('speaks Czech', async () => {
  setTestLanguage('cs')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, field('perex', 1)], new Promise(() => {})))
  renderDialog()
  expect(await screen.findByRole('dialog', { name: 'Překládám do jazyka Deutsch' })).toBeInTheDocument()
  expect(await screen.findByText('Překládám Perex (1 z 2)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zrušit' })).toBeInTheDocument()
})
```

The `afterEach` resets the admin language after the Czech test.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai/components/TranslateDialog.test.tsx`
Expected: FAIL with `Failed to resolve import "./TranslateDialog"`

- [ ] **Step 4: Write the implementation**

```tsx
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, CircleDashed, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AiRequestError, streamTranslate, type TranslateField } from '../ai-api'
import { aiKeys } from '../ai-queries'
import { SETTINGS_CODES, aiErrorKey } from '../ai-errors'

interface TranslateDialogProps {
  entryId: string
  language: { code: string; name: string }
  onDone: (versionId: string) => void
  onExists: () => void
  onClose: () => void
}

type FieldState = 'done' | 'current' | 'waiting' | 'failed'
const STATE_KEYS = { done: 'translate.stateDone', current: 'translate.stateCurrent', waiting: 'translate.stateWaiting', failed: 'translate.stateFailed' } as const
const RETRY_CODES = ['RATE_LIMIT', 'UNREACHABLE', 'TIMEOUT', 'PROVIDER', 'AI_RATE_LIMIT', 'NETWORK']
const NO_RETRY_CODES = ['TOO_LONG', 'TRUNCATED', 'VERSION_EXISTS', ...SETTINGS_CODES, 'AI_DISABLED', 'AI_NOT_AVAILABLE']
const SETTINGS_PATH = '/account/ai'

function StateIcon({ state }: { state: FieldState }) {
  if (state === 'done') return <Check aria-hidden className="size-4 text-primary" />
  if (state === 'current') return <Loader2 aria-hidden className="size-4 animate-spin" />
  if (state === 'failed') return <X aria-hidden className="size-4 text-destructive" />
  return <CircleDashed aria-hidden className="size-4 text-muted-foreground" />
}

/** Translates the saved version into `language`; mounted while open, and unmounting stops the request. */
export function TranslateDialog({ entryId, language, onDone, onExists, onClose }: TranslateDialogProps) {
  const { t } = useTranslation('ai')
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<TranslateField[]>([])
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<AiRequestError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const controller = new AbortController()
    setFields([])
    setIndex(0)
    setError(null)
    streamTranslate({ entryId, language: language.code }, { signal: controller.signal, onStart: setFields, onField: (_name, i) => setIndex(i) })
      .then((result) => {
        if (!controller.signal.aborted) doneRef.current(result.versionId)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof AiRequestError ? e : new AiRequestError('PROVIDER', String(e)))
      })
      // Tokens may have been used even when the run failed.
      .finally(() => void queryClient.invalidateQueries({ queryKey: aiKeys.status }))
    return () => controller.abort()
  }, [entryId, language.code, attempt, queryClient])

  const stateOf = (f: TranslateField, i: number): FieldState => {
    if (error?.field === f.name) return 'failed'
    if (i + 1 < index) return 'done'
    if (i + 1 === index && !error) return 'current'
    return 'waiting'
  }
  const fieldLabel = (name?: string) => (name ? (fields.find((f) => f.name === name)?.label ?? name) : undefined)
  const current = fields[index - 1]

  const errorText = (e: AiRequestError): string => {
    const field = fieldLabel(e.field)
    if (e.code === 'TOO_LONG' && field) return t('translate.tooLong', { field })
    if (e.code === 'TRUNCATED' && field) return t('translate.truncated', { field })
    if (e.code === 'VERSION_EXISTS') return t('translate.exists', { language: language.name })
    const key = aiErrorKey(e.code)
    return key ? t(`errors.${key}`) : e.message
  }
  const canRetry = !!error && (RETRY_CODES.includes(error.code) || !NO_RETRY_CODES.includes(error.code))
  const settingsKey = error ? aiErrorKey(error.code) : null
  const stoppedAt = error && !['TOO_LONG', 'TRUNCATED'].includes(error.code) ? fieldLabel(error.field) : undefined

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('translate.title', { language: language.name })}</DialogTitle>
          <DialogDescription>{t('translate.description')}</DialogDescription>
        </DialogHeader>

        {fields.length > 0 && (
          <ol className="space-y-1.5 text-sm">
            {fields.map((f, i) => {
              const state = stateOf(f, i)
              return (
                <li key={f.name} className="flex items-center gap-2">
                  <StateIcon state={state} />
                  <span className="flex-1 break-words">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{t(STATE_KEYS[state])}</span>
                </li>
              )
            })}
          </ol>
        )}

        <p role="status" className="text-sm text-muted-foreground">
          {!error && (current ? t('translate.progress', { field: current.label, index, total: fields.length }) : t('translate.starting'))}
        </p>

        {error && (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            <p>{errorText(error)}</p>
            {stoppedAt && <p>{t('translate.stoppedAt', { field: stoppedAt })}</p>}
            {settingsKey && SETTINGS_CODES.includes(settingsKey) && (
              <Link to={SETTINGS_PATH} className="underline underline-offset-2">
                {t('panel.openSettings')}
              </Link>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {error?.code === 'VERSION_EXISTS' && (
            <Button type="button" onClick={onExists}>
              {t('translate.openExisting', { language: language.name })}
            </Button>
          )}
          {canRetry && (
            <Button type="button" onClick={() => setAttempt((a) => a + 1)}>
              {t('translate.retry')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {error ? t('translate.close') : t('translate.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

If the lint guard flags a string literal passed to a call inside JSX (for example `['TOO_LONG', 'TRUNCATED'].includes`), it is already outside JSX here; move any other flagged literal to a module constant.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/ai`
Expected: PASS, the 8 dialog tests plus the other AI tests

- [ ] **Step 6: Lint**

Run: `pnpm --filter admin-dashboard lint`
Expected: 0 problems

- [ ] **Step 7: Commit**

```bash
git add packages/admin-dashboard/src/features/ai packages/admin-dashboard/src/i18n/locales
git commit -m "feat(ai): translate progress dialog

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Editor wiring

**Files:**
- Modify: `packages/admin-dashboard/src/features/content/editor/LanguageMenu.tsx`, `packages/admin-dashboard/src/features/content/editor/EntryEditor.tsx`, `packages/admin-dashboard/src/features/content/queries.ts`, `packages/admin-dashboard/src/i18n/locales/{en,cs}/editor.json`, `docs/superpowers/specs/2026-10-02-ai-translate-versions-design.md`
- Test: `packages/admin-dashboard/src/features/content/pages/EntryEditorAiTranslate.test.tsx`

**Interfaces:**
- Consumes: `TranslateDialog` (Task 2); `useAiReady` from `@/features/ai/ai-queries`; `listVersions` from `../content-api`.
- Produces: `LanguageMenu` optional prop `onTranslateAi?: (code: string) => void`; `useEntryWrites().refreshVersions(): void`.

- [ ] **Step 1: Add the text**

`en/editor.json`, inside `languages`:

```json
"translateWithAi": "Translate to {{language}} with AI",
"aiTranslated": "Translated draft created. Review it before publishing."
```

`cs/editor.json`, inside `languages`:

```json
"translateWithAi": "Přeložit pomocí AI: {{language}}",
"aiTranslated": "Přeložený koncept je vytvořený. Před publikováním ho zkontrolujte."
```

- [ ] **Step 2: Write the failing tests**

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes } from '@/test/render'
import * as api from '../content-api'
import * as languagesApi from '@/features/languages/languages-api'
import * as aiApi from '@/features/ai/ai-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../content-api')>()),
  getEntry: vi.fn(),
  getContentType: vi.fn(),
  listContentTypes: vi.fn(),
  updateEntry: vi.fn(),
  listVersions: vi.fn(),
  createVersion: vi.fn(),
}))
vi.mock('@/features/languages/languages-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/languages/languages-api')>()),
  listLanguages: vi.fn(),
}))
vi.mock('@/features/ai/ai-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ai/ai-api')>()),
  getAiStatus: vi.fn(),
  streamTranslate: vi.fn(),
}))
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="rich text" /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const en = { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }
const de = { id: 'l3', code: 'de', name: 'Deutsch', isDefault: false, order: 1 }
const enEntry = makeEntry({ id: 'en1', itemId: 'en1', language: 'en', status: 'PUBLISHED', data: { title: 'Over the hills', distanceKm: 10 }, title: 'Over the hills' })
const deEntry = makeEntry({ id: 'de1', itemId: 'en1', language: 'de', data: { title: 'Über die Hügel', distanceKm: 10 }, title: 'Über die Hügel' })
const enOnly = [{ id: 'en1', language: 'en', status: 'PUBLISHED' as const, title: 'Over the hills', updatedAt: '' }]
const withDe = [...enOnly, { id: 'de1', language: 'de', status: 'DRAFT' as const, title: 'Über die Hügel', updatedAt: '' }]
const ready = { available: true, enabled: true, canManage: false, connection: { provider: 'openai-compatible' as const, model: 'm', createdAt: '2026-10-02' }, usage: { month: '2026-10', requests: 0, inputTokens: 0, outputTokens: 0 } }
const routes = [
  { path: '/content/:id', element: <><EntryEditorPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/elsewhere', element: <p>elsewhere page</p> },
]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(api.getEntry).mockImplementation(async (id) => (id === 'de1' ? deEntry : enEntry))
  vi.mocked(api.listVersions).mockResolvedValue(enOnly)
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en, de])
  vi.mocked(aiApi.getAiStatus).mockResolvedValue(ready)
})

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: 'Language: English' }))
}

it('offers AI translation only when AI is ready', async () => {
  vi.mocked(aiApi.getAiStatus).mockResolvedValue(null)
  renderRoutes(routes, { route: '/content/en1' })
  await openMenu()
  expect(screen.getByRole('menuitem', { name: 'Translate to Deutsch' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Translate to Deutsch with AI' })).not.toBeInTheDocument()
})

it('translates with AI and opens the new draft', async () => {
  vi.mocked(aiApi.streamTranslate).mockImplementation(async (_body, options) => {
    options.onStart([{ name: 'title', label: 'Title' }])
    options.onField('title', 1)
    vi.mocked(api.listVersions).mockResolvedValue(withDe)
    return { versionId: 'de1', inputTokens: 1, outputTokens: 1 }
  })
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  await openMenu()
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Translate to Deutsch with AI' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/de1'))
  expect(aiApi.streamTranslate).toHaveBeenCalledWith({ entryId: 'en1', language: 'de' }, expect.anything())
  expect(await screen.findByDisplayValue('Über die Hügel')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('opens the version created meanwhile', async () => {
  vi.mocked(aiApi.streamTranslate).mockImplementation(async () => {
    vi.mocked(api.listVersions).mockResolvedValue(withDe)
    throw new aiApi.AiRequestError('VERSION_EXISTS', 'exists')
  })
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  await openMenu()
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Translate to Deutsch with AI' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Open the Deutsch version' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/de1'))
})

it('keeps the AI item disabled while there are unsaved changes', async () => {
  renderRoutes(routes, { route: '/content/en1' })
  await userEvent.type(await screen.findByDisplayValue('Over the hills'), '!')
  await openMenu()
  expect(screen.getByRole('menuitem', { name: 'Translate to Deutsch with AI' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('Save your changes before translating')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/content/pages/EntryEditorAiTranslate.test.tsx`
Expected: FAIL: the first test passes already (no AI item exists yet); the other three fail because no menu item "Translate to Deutsch with AI" exists

- [ ] **Step 4: Add the menu item** in `LanguageMenu.tsx`

Add `Sparkles` to the `lucide-react` import, the prop to the interface and the destructuring:

```tsx
  /** Present when AI is ready: offers an AI translation next to each copy. */
  onTranslateAi?: (code: string) => void
```

and render the AI item after each existing translate item:

```tsx
            {missing.map((l) => (
              <Fragment key={l.code}>
                <DropdownMenuItem disabled={!canTranslate || busy} onSelect={() => onTranslate(l.code)}>
                  <Plus aria-hidden />
                  {t('languages.translateTo', { language: l.name })}
                </DropdownMenuItem>
                {onTranslateAi && (
                  <DropdownMenuItem disabled={!canTranslate || busy} onSelect={() => onTranslateAi(l.code)}>
                    <Sparkles aria-hidden />
                    {t('languages.translateWithAi', { language: l.name })}
                  </DropdownMenuItem>
                )}
              </Fragment>
            ))}
```

(`import { Fragment } from 'react'`.)

- [ ] **Step 5: Add `refreshVersions`** in `queries.ts`, inside the returned object of `useEntryWrites`:

```ts
      /** After a version was created elsewhere (AI translation): refresh lists, stats and versions. */
      refreshVersions: () => refresh(),
```

- [ ] **Step 6: Wire the editor** in `EntryEditor.tsx`

Imports:

```tsx
import { TranslateDialog } from '@/features/ai/components/TranslateDialog'
import { useAiReady } from '@/features/ai/ai-queries'
import { listVersions } from '../content-api'
```

(Use the path the file already uses for `content-api` imports; `useVersions` comes from `'../queries'`, so `'../content-api'` is the sibling.)

State and handlers, next to `translate`:

```tsx
  const aiReady = useAiReady()
  const [aiTarget, setAiTarget] = useState<string | null>(null)

  const aiTranslated = (versionId: string) => {
    setAiTarget(null)
    writes.refreshVersions()
    toast.success(t('languages.aiTranslated'))
    navigate(versionPath(versionId))
  }

  // The language was created by someone else meanwhile: open that version.
  const openExisting = async (code: string) => {
    setAiTarget(null)
    writes.refreshVersions()
    const found = (await listVersions(entryIdRef.current!)).find((v) => v.language === code)
    if (found) navigate(versionPath(found.id))
  }
```

Pass the prop to `LanguageMenu`:

```tsx
              onTranslateAi={aiReady ? (code) => setAiTarget(code) : undefined}
```

Render the dialog next to `ChangeLanguageDialog`:

```tsx
      {aiTarget && entryIdRef.current && (
        <TranslateDialog
          entryId={entryIdRef.current}
          language={{ code: aiTarget, name: languageName(aiTarget) }}
          onDone={aiTranslated}
          onExists={() => void openExisting(aiTarget)}
          onClose={() => setAiTarget(null)}
        />
      )}
```

- [ ] **Step 7: Update the spec** (`docs/superpowers/specs/2026-10-02-ai-translate-versions-design.md`, section 4.1): replace the paragraph starting "If the editor has unsaved changes, a dialog explains" with:

```markdown
While the editor has unsaved changes, both translate items are disabled with the existing note "Save your changes before translating", so the saved version is what gets translated.
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/content src/features/ai`
Expected: PASS, the 4 new editor tests plus the existing content and AI tests (`EntryEditorLanguages.test.tsx` still passes: its AI status request fails, so no AI item appears)

- [ ] **Step 9: Lint, then commit**

Run: `pnpm --filter admin-dashboard lint`
Expected: 0 problems

```bash
git add packages/admin-dashboard/src docs/superpowers/specs/2026-10-02-ai-translate-versions-design.md
git commit -m "feat(ai): translate a version with AI from the language switcher

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Verification

**Files:**
- Modify: `TEST_RESULTS.md`

**Interfaces:**
- Consumes: everything above and backend Plan 1.

- [ ] **Step 1: Full admin suite, lint and build**

Run: `pnpm --filter admin-dashboard exec vitest run > /tmp/admin-suite.log 2>&1; tail -6 /tmp/admin-suite.log; pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all tests pass, lint 0 problems, build exits 0

- [ ] **Step 2: Browser check**

Throwaway copy of the local database (never `thecms` itself), the worktree backend on port 3100 with a generated `AI_KEY_SECRET`, the worktree admin on port 5175, and a fake OpenAI-compatible service on port 11500 that answers `[EN] <text>` (for HTML it prefixes each paragraph and appends a `<script>`). The dev user connects to the fake service at `/account/ai`.

1. Open a Czech entry (create `en` if missing): the language switcher lists "Translate to English" and "Translate to English with AI".
2. Choose the AI item: the dialog lists the fields, the progress line advances, then the editor opens the English draft with the toast; the title and text start with `[EN]`, the script is gone, shared fields are copied.
3. Type in the editor: the AI item is disabled with "Save your changes before translating".
4. Start a translation into another missing language and Cancel: no version appears in the switcher.
5. Stop the fake service and translate: the dialog shows "The AI service can't be reached" with Try again.
6. Czech admin language: the dialog and menu text are Czech. At 360px width the dialog fits without horizontal scrolling.

Drop the throwaway database and stop the extra servers afterwards.

- [ ] **Step 3: Record and commit**

Append "AI translate Plan 2 verification" to `TEST_RESULTS.md` with the date, test counts, lint and build, and each browser step's result.

```bash
git add TEST_RESULTS.md
git commit -m "docs: AI translate Plan 2 verification

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
