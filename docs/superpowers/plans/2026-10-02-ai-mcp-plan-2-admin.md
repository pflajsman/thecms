# AI MCP Agent, Plan 2: Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An "Access tokens" page at `/account/tokens` where each user creates, copies and revokes personal access tokens for MCP, with a ready Claude Code command.

**Architecture:** A small `features/tokens` module: API functions for `GET/POST/DELETE /tokens` (backend Plan 1, merged), TanStack Query hooks, and one page. The page is routed next to `/account/ai` and linked from the user menu for every role.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, react-i18next (typed keys, en/cs, `i18next/no-literal-string` lint), shadcn/Radix, Vitest + Testing Library + axe.

**Spec:** `docs/superpowers/specs/2026-10-02-ai-mcp-agent-design.md` (section 5). Backend: `packages/backend/src/modules/tokens` (merged).

## Global Constraints

- API: `GET /tokens` returns `{ id, name, prefix, createdAt, lastUsedAt?, expiresAt?, expired }[]` newest first; `POST /tokens` with `{ name, expiresInDays?: 30 | 90 | 365 }` returns the item plus `token` once (`409` with `reason: 'TOKEN_LIMIT'` at 10); `DELETE /tokens/:id` answers `204`.
- The token is shown once, with Copy, and a ready command `claude mcp add --transport http thecms <API base>/mcp --header "Authorization: Bearer <token>"` with Copy, and the note that it will not be shown again. Closing the box removes the token from the page (it is never put in the query cache).
- At 10 tokens that are not expired, Create is disabled with "You have 10 tokens. Revoke one to create another."
- The page says what a token allows: read content and create or edit drafts as you; never publish or delete.
- List: name, prefix, created, last used, expiry (or "Expired"); Revoke with confirmation.
- Every role sees the page and the menu item.
- All text in English and Czech under the lint guard (string literals passed to calls inside JSX are flagged: use module constants or helpers); axe; works at 360px.
- Code and docs in English; never an em dash. Commit trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. The page is left (navigate away and back) while a new token is shown: the token is gone, never cached or restored (Task 2 test "never keeps the token after the box is closed or the page is left").
2. Create is pressed twice quickly: only one request is sent (Task 2 test "sends one request when Create is pressed twice").
3. A token name of only spaces: Create stays disabled; the backend would refuse it anyway (Task 2 test "needs a name").
4. The list request fails: an error with Retry, not an empty list that suggests there are no tokens (Task 2 test "offers a retry when the tokens cannot be loaded").
5. A long token and command at 360px: they wrap or scroll inside their box, never widening the page (Task 3 browser check).

## File Structure

| File | Responsibility |
|---|---|
| `packages/admin-dashboard/src/features/tokens/tokens-api.ts` (new) | Types, API calls, `mcpCommand`, `MAX_TOKENS` |
| `packages/admin-dashboard/src/features/tokens/tokens-queries.ts` (new) | `useTokens`, `useTokenWrites` |
| `packages/admin-dashboard/src/features/tokens/tokens-api.test.ts` (new) | API tests |
| `packages/admin-dashboard/src/features/tokens/pages/TokensPage.tsx` (new) | The page |
| `packages/admin-dashboard/src/features/tokens/pages/TokensPage.test.tsx` (new) | Page tests |
| `packages/admin-dashboard/src/i18n/locales/{en,cs}/tokens.json` (new), `i18n/resources.ts` | `tokens` namespace |
| `packages/admin-dashboard/src/i18n/locales/{en,cs}/shell.json` | `userMenu.accessTokens` |
| `packages/admin-dashboard/src/app/routes.tsx`, `app/shell/UserMenu.tsx` | Route and menu item |
| `TEST_RESULTS.md` | Verification |

---

### Task 1: Tokens API and queries

**Files:**
- Create: `packages/admin-dashboard/src/features/tokens/tokens-api.ts`, `packages/admin-dashboard/src/features/tokens/tokens-queries.ts`
- Test: `packages/admin-dashboard/src/features/tokens/tokens-api.test.ts`

**Interfaces:**
- Produces: `AccessToken { id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string; expiresAt?: string; expired: boolean }`; `CreatedToken = AccessToken & { token: string }`; `TokenExpiry = 30 | 90 | 365`; `listTokens(): Promise<AccessToken[]>`; `createToken(body: { name: string; expiresInDays?: TokenExpiry }): Promise<CreatedToken>`; `revokeToken(id: string): Promise<void>`; `mcpCommand(token: string, base?: string): string`; `MAX_TOKENS = 10`; `tokenKeys.list`; `useTokens()`; `useTokenWrites(): { create(body): Promise<CreatedToken>; revoke(id): Promise<void> }`.

- [ ] **Step 1: Write the failing tests**

```ts
import apiClient from '@/lib/api'
import { createToken, listTokens, mcpCommand, revokeToken } from './tokens-api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

it('lists, creates and revokes through the tokens endpoints', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [{ id: 't1' }] } })
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { id: 't2', token: 'tcms_pat_x' } } })
  vi.mocked(apiClient.delete).mockResolvedValue({ status: 204 })
  expect(await listTokens()).toEqual([{ id: 't1' }])
  expect(apiClient.get).toHaveBeenCalledWith('/tokens')
  expect(await createToken({ name: 'Laptop', expiresInDays: 90 })).toEqual({ id: 't2', token: 'tcms_pat_x' })
  expect(apiClient.post).toHaveBeenCalledWith('/tokens', { name: 'Laptop', expiresInDays: 90 })
  await revokeToken('t1')
  expect(apiClient.delete).toHaveBeenCalledWith('/tokens/t1')
})

it('builds the Claude Code command for the MCP endpoint', () => {
  expect(mcpCommand('tcms_pat_abc', 'https://api.example.cz/api/v1')).toBe(
    'claude mcp add --transport http thecms https://api.example.cz/api/v1/mcp --header "Authorization: Bearer tcms_pat_abc"',
  )
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/tokens`
Expected: FAIL with `Failed to resolve import "./tokens-api"`

- [ ] **Step 3: Write the API** `tokens-api.ts`

```ts
import apiClient from '@/lib/api'
import { API_BASE_URL } from '@/lib/auth-header'
import type { ApiResponse } from '@/types'

export interface AccessToken {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
  expired: boolean
}

export type CreatedToken = AccessToken & { token: string }
export type TokenExpiry = 30 | 90 | 365

export const MAX_TOKENS = 10

export async function listTokens(): Promise<AccessToken[]> {
  return (await apiClient.get<ApiResponse<AccessToken[]>>('/tokens')).data.data
}

export async function createToken(body: { name: string; expiresInDays?: TokenExpiry }): Promise<CreatedToken> {
  return (await apiClient.post<ApiResponse<CreatedToken>>('/tokens', body)).data.data
}

export async function revokeToken(id: string): Promise<void> {
  await apiClient.delete(`/tokens/${id}`)
}

/** The command that connects Claude Code to this installation's MCP server. */
export function mcpCommand(token: string, base: string = API_BASE_URL): string {
  return `claude mcp add --transport http thecms ${base.replace(/\/+$/, '')}/mcp --header "Authorization: Bearer ${token}"`
}
```

`tokens-queries.ts`:

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createToken, listTokens, revokeToken, type TokenExpiry } from './tokens-api'

export const tokenKeys = { list: ['tokens', 'list'] as const }

export function useTokens() {
  return useQuery({ queryKey: tokenKeys.list, queryFn: listTokens })
}

/** Writes refresh the list; the created token itself is returned to the caller and never cached. */
export function useTokenWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: tokenKeys.list })
    return {
      create: async (body: { name: string; expiresInDays?: TokenExpiry }) => {
        const created = await createToken(body)
        refresh()
        return created
      },
      revoke: async (id: string) => {
        await revokeToken(id)
        refresh()
      },
    }
  }, [queryClient])
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/tokens`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add packages/admin-dashboard/src/features/tokens
git commit -m "feat(mcp): admin API for personal access tokens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Access tokens page, route and menu

**Files:**
- Create: `packages/admin-dashboard/src/features/tokens/pages/TokensPage.tsx`, `packages/admin-dashboard/src/i18n/locales/en/tokens.json`, `packages/admin-dashboard/src/i18n/locales/cs/tokens.json`
- Modify: `packages/admin-dashboard/src/i18n/resources.ts`, `packages/admin-dashboard/src/i18n/locales/{en,cs}/shell.json`, `packages/admin-dashboard/src/app/routes.tsx`, `packages/admin-dashboard/src/app/shell/UserMenu.tsx`
- Test: `packages/admin-dashboard/src/features/tokens/pages/TokensPage.test.tsx`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `TokensPage` at `/account/tokens`; menu item `userMenu.accessTokens`.

- [ ] **Step 1: Add the text**

`en/tokens.json`:

```json
{
  "title": "Access tokens",
  "description": "Personal tokens let an AI agent such as Claude Code work with TheCMS through MCP as you.",
  "allows": "A token can read content and create or edit drafts as you. It can never publish, unpublish, archive or delete anything, or change a published version.",
  "create": {
    "title": "New token",
    "name": "Name",
    "namePlaceholder": "Claude Code on my laptop",
    "expiry": "Expires",
    "days30": "In 30 days",
    "days90": "In 90 days",
    "days365": "In a year",
    "never": "Never",
    "submit": "Create token",
    "limit": "You have 10 tokens. Revoke one to create another."
  },
  "created": {
    "title": "Your new token",
    "once": "Copy it now. It will not be shown again.",
    "token": "Token",
    "command": "Claude Code command",
    "copy": "Copy",
    "copied": "Copied",
    "done": "Done"
  },
  "list": {
    "title": "Your tokens",
    "empty": "You have no tokens yet.",
    "created": "Created {{date}}",
    "lastUsed": "Last used {{date}}",
    "neverUsed": "Never used",
    "expires": "Expires {{date}}",
    "noExpiry": "Never expires",
    "expired": "Expired",
    "revoke": "Revoke",
    "revokeLabel": "Revoke {{name}}"
  },
  "revoke": {
    "title": "Revoke this token?",
    "text": "Agents using \"{{name}}\" will lose access right away. This cannot be undone.",
    "confirm": "Revoke token",
    "done": "Token revoked"
  },
  "loadError": "Could not load your tokens.",
  "retry": "Retry"
}
```

`cs/tokens.json`:

```json
{
  "title": "Přístupové tokeny",
  "description": "Osobní tokeny umožní AI agentovi, například Claude Code, pracovat s TheCMS přes MCP vaším jménem.",
  "allows": "Token umí číst obsah a vytvářet nebo upravovat koncepty vaším jménem. Nikdy nic nepublikuje, nestáhne z webu, nearchivuje ani nesmaže a nezmění publikovanou verzi.",
  "create": {
    "title": "Nový token",
    "name": "Název",
    "namePlaceholder": "Claude Code na mém notebooku",
    "expiry": "Platnost",
    "days30": "30 dní",
    "days90": "90 dní",
    "days365": "1 rok",
    "never": "Bez omezení",
    "submit": "Vytvořit token",
    "limit": "Máte 10 tokenů. Pro vytvoření dalšího jeden zrušte."
  },
  "created": {
    "title": "Váš nový token",
    "once": "Zkopírujte si ho hned. Znovu už se nezobrazí.",
    "token": "Token",
    "command": "Příkaz pro Claude Code",
    "copy": "Kopírovat",
    "copied": "Zkopírováno",
    "done": "Hotovo"
  },
  "list": {
    "title": "Vaše tokeny",
    "empty": "Zatím nemáte žádný token.",
    "created": "Vytvořen {{date}}",
    "lastUsed": "Naposledy použit {{date}}",
    "neverUsed": "Zatím nepoužit",
    "expires": "Platí do {{date}}",
    "noExpiry": "Bez omezení platnosti",
    "expired": "Vypršel",
    "revoke": "Zrušit",
    "revokeLabel": "Zrušit {{name}}"
  },
  "revoke": {
    "title": "Zrušit tento token?",
    "text": "Agenti, kteří používají „{{name}}“, okamžitě ztratí přístup. Nelze to vrátit.",
    "confirm": "Zrušit token",
    "done": "Token je zrušený"
  },
  "loadError": "Tokeny se nepodařilo načíst.",
  "retry": "Zkusit znovu"
}
```

Register the namespace in `i18n/resources.ts`: import `enTokens`/`csTokens` from `./locales/{en,cs}/tokens.json`, add `'tokens'` to `NAMESPACES`, and `tokens: enTokens` / `tokens: csTokens` to `resources.en` / `resources.cs`.

`shell.json`, inside `userMenu`: en `"accessTokens": "Access tokens"`, cs `"accessTokens": "Přístupové tokeny"`.

- [ ] **Step 2: Write the failing tests** `pages/TokensPage.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { TokensPage } from './TokensPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const SECRET = 'tcms_pat_SECRETsecretSECRETsecretSECRETsecret123'
const routes = [
  { path: '/account/tokens', element: <><TokensPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/elsewhere', element: <Link to="/account/tokens">back</Link> },
]
const item = (over: Record<string, unknown> = {}) => ({ id: 't1', name: 'Laptop', prefix: 'tcms_pat_abc', createdAt: '2026-10-02T08:00:00.000Z', expired: false, ...over })

let stored: ReturnType<typeof item>[] = []
beforeEach(() => {
  stored = []
  vi.mocked(apiClient.get).mockImplementation(async () => ({ data: { success: true, data: stored } }))
  vi.mocked(apiClient.post).mockImplementation(async (_url: string, body: unknown) => {
    const b = body as { name: string; expiresInDays?: number }
    const created = item({ id: `t${stored.length + 1}`, name: b.name, ...(b.expiresInDays ? { expiresAt: '2026-11-01T08:00:00.000Z' } : {}) })
    stored = [created, ...stored]
    return { data: { success: true, data: { ...created, token: SECRET } } }
  })
  vi.mocked(apiClient.delete).mockImplementation(async (url: string) => {
    stored = stored.filter((t) => `/tokens/${t.id}` !== url)
    return { status: 204 }
  })
})

it('creates a token and shows it once with the Claude Code command', async () => {
  const { container } = renderRoutes(routes, { route: '/account/tokens' })
  expect(await screen.findByText('You have no tokens yet.')).toBeInTheDocument()
  expect(screen.getByText(/never publish, unpublish, archive or delete/)).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Name'), 'Laptop')
  await userEvent.selectOptions(screen.getByLabelText('Expires'), 'In 30 days')
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  const box = await screen.findByRole('region', { name: 'Your new token' })
  expect(apiClient.post).toHaveBeenCalledWith('/tokens', { name: 'Laptop', expiresInDays: 30 })
  expect(within(box).getByLabelText('Token')).toHaveValue(SECRET)
  expect(within(box).getByText(/claude mcp add --transport http thecms .*\/mcp --header "Authorization: Bearer tcms_pat_SECRET/)).toBeInTheDocument()
  expect(within(box).getByText('Copy it now. It will not be shown again.')).toBeInTheDocument()
  expect(await screen.findByText('Laptop')).toBeInTheDocument()
  expect(screen.getByText(/Expires/)).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('copies the token and the command', async () => {
  const user = userEvent.setup()
  renderRoutes(routes, { route: '/account/tokens' })
  await user.type(await screen.findByLabelText('Name'), 'Laptop')
  await user.click(screen.getByRole('button', { name: 'Create token' }))
  const box = await screen.findByRole('region', { name: 'Your new token' })
  await user.click(within(box).getByRole('button', { name: 'Copy Token' }))
  expect(await navigator.clipboard.readText()).toBe(SECRET)
  await user.click(within(box).getByRole('button', { name: 'Copy Claude Code command' }))
  expect(await navigator.clipboard.readText()).toContain(`Bearer ${SECRET}`)
})

it('never keeps the token after the box is closed or the page is left', async () => {
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Laptop')
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  await userEvent.click(within(await screen.findByRole('region', { name: 'Your new token' })).getByRole('button', { name: 'Done' }))
  expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Name'), 'Second')
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  await screen.findByRole('region', { name: 'Your new token' })
  await userEvent.click(screen.getByRole('link', { name: 'elsewhere' }))
  await userEvent.click(await screen.findByRole('link', { name: 'back' }))
  expect(await screen.findByText('Second')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Your new token' })).not.toBeInTheDocument()
  expect(document.body.innerHTML).not.toContain(SECRET)
})

it('sends one request when Create is pressed twice', async () => {
  let release: () => void = () => {}
  vi.mocked(apiClient.post).mockImplementationOnce(
    () => new Promise((resolve) => (release = () => resolve({ data: { success: true, data: { ...item(), token: SECRET } } }))),
  )
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Laptop')
  const create = screen.getByRole('button', { name: 'Create token' })
  await userEvent.click(create)
  await userEvent.click(create)
  release()
  await screen.findByRole('region', { name: 'Your new token' })
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

it('needs a name', async () => {
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.type(await screen.findByLabelText('Name'), '   ')
  expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled()
})

it('lists tokens with their state and revokes after confirmation', async () => {
  stored = [
    item({ id: 't1', name: 'Laptop', lastUsedAt: '2026-10-02T09:00:00.000Z', expiresAt: '2026-11-01T08:00:00.000Z' }),
    item({ id: 't2', name: 'Old one', expiresAt: '2026-09-01T08:00:00.000Z', expired: true }),
  ]
  renderRoutes(routes, { route: '/account/tokens' })
  const laptop = (await screen.findByText('Laptop')).closest('li')!
  expect(laptop).toHaveTextContent('tcms_pat_abc')
  expect(laptop).toHaveTextContent('Last used')
  expect((screen.getByText('Old one').closest('li') as HTMLElement)).toHaveTextContent('Expired')
  await userEvent.click(within(laptop).getByRole('button', { name: 'Revoke Laptop' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Agents using "Laptop" will lose access right away.')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke token' }))
  await waitFor(() => expect(screen.queryByText('Laptop')).not.toBeInTheDocument())
  expect(apiClient.delete).toHaveBeenCalledWith('/tokens/t1')
})

it('disables Create at 10 tokens that are not expired', async () => {
  stored = Array.from({ length: 10 }, (_, i) => item({ id: `t${i}`, name: `Token ${i}` }))
  renderRoutes(routes, { route: '/account/tokens' })
  expect(await screen.findByText('You have 10 tokens. Revoke one to create another.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled()
})

it('offers a retry when the tokens cannot be loaded', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('down'))
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('You have no tokens yet.')).toBeInTheDocument()
})

it('speaks Czech', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/account/tokens' })
  expect(await screen.findByRole('heading', { name: 'Přístupové tokeny' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vytvořit token' })).toBeInTheDocument()
  expect(screen.getByText('Zatím nemáte žádný token.')).toBeInTheDocument()
})
```

The test setup resets the admin language to English after each test.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/tokens`
Expected: FAIL with `Failed to resolve import "./TokensPage"`

- [ ] **Step 4: Write the page** `pages/TokensPage.tsx`

```tsx
import { useTranslation } from 'react-i18next'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Copy, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { MAX_TOKENS, mcpCommand, type AccessToken, type CreatedToken, type TokenExpiry } from '../tokens-api'
import { useTokenWrites, useTokens } from '../tokens-queries'

const EXPIRY_OPTIONS = [
  { value: '30', key: 'create.days30' },
  { value: '90', key: 'create.days90' },
  { value: '365', key: 'create.days365' },
  { value: 'never', key: 'create.never' },
] as const
const NEVER = 'never'
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function CopyRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const { t } = useTranslation('tokens')
  const id = `token-copy-${label.replace(/\W+/g, '-').toLowerCase()}`
  const copy = () => void navigator.clipboard?.writeText(value).then(() => toast.success(t('created.copied')))
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-2">
        {multiline ? (
          <pre id={id} className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{value}</pre>
        ) : (
          <Input id={id} readOnly value={value} className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        )}
        <Button type="button" variant="outline" size="sm" aria-label={`${t('created.copy')} ${label}`} onClick={copy}>
          <Copy aria-hidden />
          {t('created.copy')}
        </Button>
      </div>
    </div>
  )
}

export function TokensPage() {
  const { t } = useTranslation('tokens')
  const tokens = useTokens()
  const writes = useTokenWrites()
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState<string>('90')
  const [creating, setCreating] = useState(false)
  // Held only in this component: it disappears with Done or when the page is left.
  const [created, setCreated] = useState<CreatedToken | null>(null)
  const [revoking, setRevoking] = useState<AccessToken | null>(null)
  const busy = useRef(false)

  if (tokens.isPending) return <Skeleton className="h-40 w-full" />
  if (tokens.isError && !tokens.data) return <ErrorState message={t('loadError')} onRetry={() => void tokens.refetch()} />

  const list = tokens.data ?? []
  const atLimit = list.filter((tk) => !tk.expired).length >= MAX_TOKENS

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy.current || !name.trim() || atLimit) return
    busy.current = true
    setCreating(true)
    try {
      const token = await writes.create({ name: name.trim(), ...(expiry === NEVER ? {} : { expiresInDays: Number(expiry) as TokenExpiry }) })
      setCreated(token)
      setName('')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      busy.current = false
      setCreating(false)
    }
  }

  const revoke = async () => {
    if (!revoking) return
    try {
      await writes.revoke(revoking.id)
      toast.success(t('revoke.done'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <p className="rounded-lg border bg-muted/40 p-3 text-sm">{t('allows')}</p>

      {created && (
        <section aria-label={t('created.title')} className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <h2 className="font-medium">{t('created.title')}</h2>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t('created.once')}</p>
          <CopyRow label={t('created.token')} value={created.token} />
          <CopyRow label={t('created.command')} value={mcpCommand(created.token)} multiline />
          <Button type="button" onClick={() => setCreated(null)}>
            {t('created.done')}
          </Button>
        </section>
      )}

      <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{t('create.title')}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-1.5">
            <Label htmlFor="token-name">{t('create.name')}</Label>
            <Input id="token-name" value={name} maxLength={100} placeholder={t('create.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-expiry">{t('create.expiry')}</Label>
            <select id="token-expiry" className={selectClass} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.key)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {atLimit && <p className="text-sm text-muted-foreground">{t('create.limit')}</p>}
        <Button type="submit" disabled={creating || !name.trim() || atLimit}>
          <KeyRound aria-hidden />
          {t('create.submit')}
        </Button>
      </form>

      <section aria-labelledby="tokens-list-title" className="space-y-3">
        <h2 id="tokens-list-title" className="font-medium">
          {t('list.title')}
        </h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {list.map((tk) => (
              <li key={tk.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-medium">{tk.name}</span>
                    <code className="text-xs text-muted-foreground">{tk.prefix}…</code>
                    {tk.expired && <Badge variant="secondary">{t('list.expired')}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('list.created', { date: formatDate(tk.createdAt) })}
                    {' · '}
                    {tk.lastUsedAt ? t('list.lastUsed', { date: formatDate(tk.lastUsedAt) }) : t('list.neverUsed')}
                    {' · '}
                    {tk.expiresAt ? t('list.expires', { date: formatDate(tk.expiresAt) }) : t('list.noExpiry')}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" aria-label={t('list.revokeLabel', { name: tk.name })} onClick={() => setRevoking(tk)}>
                  {t('list.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t('revoke.title')}
        description={t('revoke.text', { name: revoking?.name ?? '' })}
        confirmLabel={t('revoke.confirm')}
        destructive
        onConfirm={() => void revoke()}
      />
    </div>
  )
}
```

If the lint guard flags `' · '` (a literal string in JSX), move it to a module constant `const SEPARATOR = ' · '`.

- [ ] **Step 5: Route and menu**

`app/routes.tsx`: import `TokensPage` from `@/features/tokens/pages/TokensPage` and add `{ path: 'account/tokens', element: <TokensPage /> }` next to the `account/ai` route.

`app/shell/UserMenu.tsx`: import `KeyRound` from `lucide-react` and, after the AI block and before the theme separator, add for every user:

```tsx
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account/tokens">
            <KeyRound aria-hidden />
            {t('userMenu.accessTokens')}
          </Link>
        </DropdownMenuItem>
```

Before adding the menu item, add this case inside `describe('UserMenu language', ...)` in `app/shell/shell.test.tsx`, run it and watch it fail:

```tsx
  it('links to the access tokens page for every user', async () => {
    auth.value = { ...auth.value, isAuthenticated: true, isLoading: false }
    renderWithProviders(<UserMenu variant="sidebar" />)
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findByRole('menuitem', { name: 'Access tokens' })).toHaveAttribute('href', '/account/tokens')
  })
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/tokens src/app`
Expected: PASS, the 9 page tests, the API tests and the shell tests including the new menu case

- [ ] **Step 7: Lint, then commit**

Run: `pnpm --filter admin-dashboard lint`
Expected: 0 problems

```bash
git add packages/admin-dashboard/src
git commit -m "feat(mcp): access tokens page and user menu item

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Verification

**Files:**
- Modify: `TEST_RESULTS.md`

- [ ] **Step 1: Full admin suite, lint and build**

Run: `pnpm --filter admin-dashboard exec vitest run > /tmp/admin-tokens.log 2>&1; tail -6 /tmp/admin-tokens.log; pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all tests pass, lint 0 problems, build exits 0

- [ ] **Step 2: Browser check**

Throwaway copy of the local database (never `thecms` itself); worktree backend on port 3100; worktree admin on port 5175 with `VITE_API_URL=http://localhost:3100/api/v1`.

1. User menu shows "Access tokens"; the page explains what a token allows and shows "You have no tokens yet."
2. Create "Live check" with 30 days: the box shows the token and the command with `http://localhost:3100/api/v1/mcp`; both Copy buttons work (read back with `navigator.clipboard.readText()` or a paste); Done removes the token from the page and the list shows the token with its prefix, "Never used" and the expiry.
3. Use the copied token with an MCP SDK client script against `/api/v1/mcp` (`list_languages`); reload the page: "Last used" appears.
4. Revoke with confirmation: the token disappears; the same script now gets `401`.
5. Czech admin language: page text in Czech. At 360px (a 360px frame of the page if the window cannot be resized) the token and command stay inside their box and the page has no horizontal scroll.

Drop the throwaway database and stop the extra servers afterwards.

- [ ] **Step 3: Record and commit**

Append "AI MCP Plan 2 verification" to `TEST_RESULTS.md` with the date, test counts, lint, build and each browser step's result.

```bash
git add TEST_RESULTS.md
git commit -m "docs: AI MCP Plan 2 verification

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
