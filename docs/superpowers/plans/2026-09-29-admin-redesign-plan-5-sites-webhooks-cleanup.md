# Admin Redesign, Plan 5: Sites, Webhooks and Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the redesign: new Sites & API keys and Webhooks screens, a route-level error page, a TipTap editor without MUI, removal of MUI and Emotion, a clean `pnpm lint`, and an accessibility pass backed by automated checks.

**Architecture:** `features/sites` and `features/webhooks` follow the same pattern as the other features (API module, query hooks module, pages). A route `errorElement` keeps the shell visible when a page crashes. The rich text editor keeps its TipTap extensions but gets a Tailwind toolbar and its own content stylesheet. With the last MUI consumers gone, `LegacyMuiTheme` and the MUI packages are removed. Automated tests check token contrast and run axe on the main screens.

**Tech Stack:** React 19, TanStack Query 5, TipTap 3, shadcn/ui, axe-core, Vitest. Backend: Express, Mongoose, Jest.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-dashboard-redesign-design.md` (sections 5.8, 5.9, 6, 8 "Removed at the end", 9 step 8)

**Series:** Plan 5 of 5. Plans 1 to 4 are merged on `main`.

## Global Constraints

- Public API (`/api/v1/public/*`) request and response shapes must not change.
- Admin endpoint changes are additive only.
- Rotating an API key requires typing the site name and warns that the old key stops working immediately.
- WCAG AA contrast (4.5:1 for text) in both themes; visible focus; all actions reachable by keyboard.
- Colors only from Tailwind token utilities; no hard-coded hex values in components (the rich text color picker's swatch values are user content, not UI colors).
- Every screen works at 360px width without horizontal scrolling.
- Every mutation shows a toast on success; failures show the server message.
- `@mui/material`, `@mui/icons-material`, `@mui/x-date-pickers`, `@emotion/react`, `@emotion/styled` are removed from `package.json`.
- Copy is English. Never use an em dash in UI copy, code comments or docs.

## Decisions (deviations from the spec, for the reviewer)

1. **Webhook secrets are shown in full only right after creating or rotating**, in a dialog with Copy. The backend stores the secret but its JSON hides it (shows `secretPreview`), which is the safer design; "reveal later" would need a new endpoint that exposes secrets.
2. **Webhook event groups are Entries, Content models and Media.** The backend has no form events yet; the spec's "forms" group has nothing to list.
3. **Links in rich text accept only http(s), mailto and relative URLs.** The old `prompt()` accepted `javascript:` URLs.

## Review Focus

1. **Rotating a key with the wrong site name typed** must not rotate. Tested in Task 3.
2. **Allowed origins that are not URLs** (`example.com` without a scheme) must be rejected with a message before saving (the backend requires URLs). Tested in Task 3.
3. **A webhook with no events selected** must block save. Tested in Task 4.
4. **A `javascript:` link typed into the rich text link box** must be refused. Tested in Task 5.
5. **A page component that throws** must show an error screen inside the shell with a way back, not a blank page. Tested in Task 2.

---

## File Structure

### Backend (`packages/backend/src`)

| File | Change |
|---|---|
| `modules/webhooks/webhooks.controller.ts` | Create response includes the full `secret` once |
| `modules/webhooks/webhooks.test.ts` (create) | Tests |

### Frontend (`packages/admin-dashboard/src`)

| File | Responsibility |
|---|---|
| `app/RouteError.tsx`, `app/routes.tsx` | Route error page |
| `features/sites/sites-api.ts` (modify), `features/sites/sites-utils.ts`, `components/ConnectSnippets.tsx`, `pages/SitesListPage.tsx`, `pages/SiteFormPage.tsx` | Sites |
| `features/webhooks/webhooks-api.ts`, `webhooks-queries.ts`, `webhook-events.ts`, `components/SecretDialog.tsx`, `components/DeliveryLog.tsx`, `pages/WebhooksListPage.tsx`, `pages/WebhookFormPage.tsx` | Webhooks |
| `components/RichTextEditor.tsx` (rewrite), `components/rich-text/EditorToolbar.tsx`, `components/rich-text/link-utils.ts`, `styles/prose.css` | Editor without MUI |
| `contexts/AuthContext.tsx` (modify) | No effect-driven state; no sign-in flash |
| `App.tsx`, `types/index.ts` (modify) | Lint-clean |
| `test/a11y.ts`, `styles/contrast.test.ts`, `app/a11y.test.tsx` | Accessibility checks |
| Delete: `app/theme/LegacyMuiTheme.tsx`, `app/theme/LegacyMuiTheme.test.tsx`, `pages/Sites/*`, `features/webhooks/pages/WebhooksPlaceholder.tsx` | Replaced |

---

## Task 1: Return the webhook secret once on create

**Files:**
- Modify: `packages/backend/src/modules/webhooks/webhooks.controller.ts` (`createWebhook`)
- Test: `packages/backend/src/modules/webhooks/webhooks.test.ts`

**Interfaces:**
- Produces: `POST /api/v1/webhooks` responds `{ success: true, data: { ...webhookJson, secret: string } }`; `GET /api/v1/webhooks/:id` and the list still return only `secretPreview`.

- [ ] **Step 1: Write the failing test `webhooks.test.ts`**

```ts
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import webhooksRoutes from './webhooks.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/webhooks', webhooksRoutes);

it('returns the full secret only in the create response', async () => {
  const created = await request(app)
    .post('/webhooks')
    .send({ name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published'] });
  expect(created.status).toBe(201);
  const secret: string = created.body.data.secret;
  expect(typeof secret).toBe('string');
  expect(secret.length).toBeGreaterThan(16);

  const fetched = await request(app).get(`/webhooks/${created.body.data.id}`);
  expect(fetched.body.data.secret).toBeUndefined();
  expect(fetched.body.data.secretPreview).toBe(`${secret.substring(0, 8)}...`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- webhooks.test`
Expected: FAIL: `created.body.data.secret` is undefined.

- [ ] **Step 3: Implement**

In `webhooks.controller.ts` `createWebhook`, replace `data: webhook,` in the 201 response with:

```ts
        // The only time the full signing secret is returned; later responses show secretPreview.
        data: { ...webhook.toJSON(), secret: webhook.secret },
```

- [ ] **Step 4: Run tests, build, commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS, build succeeds.

```bash
git add packages/backend/src/modules/webhooks
git commit -m "feat(backend): return the webhook signing secret once on create"
```

---

## Task 2: Route error page

All frontend paths are relative to `packages/admin-dashboard/src`.

**Files:**
- Create: `app/RouteError.tsx`
- Modify: `app/routes.tsx`
- Test: `app/RouteError.test.tsx`

**Interfaces:**
- Produces: `<RouteError />` (uses `useRouteError`); `routes` gains a pathless child route with `errorElement: <RouteError />` wrapping all module routes, so the shell stays visible; the top route has `errorElement: <RouteError fullPage />`.

- [ ] **Step 1: Write the failing test `app/RouteError.test.tsx`**

```tsx
import { screen } from '@testing-library/react'
import { Outlet } from 'react-router-dom'
import { renderRoutes } from '@/test/render'
import { RouteError } from './RouteError'

function Boom(): never {
  throw new Error('kaboom')
}

it('shows an error inside the layout with ways back', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  renderRoutes(
    [
      {
        element: (
          <div>
            <nav aria-label="Main navigation">shell</nav>
            <Outlet />
          </div>
        ),
        children: [{ errorElement: <RouteError />, children: [{ path: '/broken', element: <Boom /> }] }],
      },
    ],
    { route: '/broken' },
  )
  expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
})

it('explains a missing page', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  renderRoutes([{ path: '/', element: <p>home</p>, errorElement: <RouteError fullPage /> }], { route: '/nowhere' })
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- RouteError`
Expected: FAIL, cannot resolve `./RouteError`.

- [ ] **Step 3: Implement `app/RouteError.tsx`**

```tsx
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RouteError({ fullPage = false }: { fullPage?: boolean }) {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-16 text-center', fullPage && 'min-h-dvh justify-center bg-background')}>
      <AlertTriangle aria-hidden className="mb-3 size-10 text-destructive" />
      <h1 className="font-serif text-2xl font-semibold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {notFound ? 'The page you asked for does not exist.' : 'This page hit an unexpected error. Your saved content is safe.'}
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link to="/">Go to Home</Link>
        </Button>
        {!notFound && <Button onClick={() => window.location.reload()}>Reload page</Button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Use it in `app/routes.tsx`**

```tsx
import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { RouteError } from './RouteError'
import { collectRoutes } from '@/modules/nav'
import { modules } from '@/modules/registry'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError fullPage />,
    children: [
      {
        // Page errors render here, inside the shell, so navigation stays available.
        errorElement: <RouteError />,
        children: [...collectRoutes(modules), { path: '*', element: <Navigate to="/" replace /> }],
      },
    ],
  },
]
```

- [ ] **Step 5: Run tests and commit**

Run: `cd packages/admin-dashboard && pnpm test`
Expected: PASS.

```bash
git add packages/admin-dashboard/src/app
git commit -m "feat(admin): route error page inside the shell"
```

---

## Task 3: Sites & API keys

**Files:**
- Modify: `features/sites/sites-api.ts`
- Create: `features/sites/sites-utils.ts`, `features/sites/components/ConnectSnippets.tsx`, `features/sites/pages/SitesListPage.tsx`, `features/sites/pages/SiteFormPage.tsx`
- Modify: `modules/registry.tsx`
- Delete: `pages/Sites/SitesList.tsx`, `pages/Sites/SiteForm.tsx`
- Test: `features/sites/sites-utils.test.ts`, `features/sites/pages/SitesPages.test.tsx`

**Interfaces:**
- Consumes: `sitesService` (`services/sites.ts`: `list`, `getById`, `create`, `update`, `delete`, `rotateApiKey`), `useContentTypes` (Plan 2), `publicApiBase` (Plan 3), `ConfirmDialog`.
- Produces:
  - `sites-api.ts`: `useSites()` (unchanged), `useSite(id?)`, `useSiteWrites() => { create(body), update(id, body), remove(id), rotate(id) }` where body is `SitePayload { name; domain; description?; allowedOrigins: string[]; isActive?: boolean }`.
  - `sites-utils.ts`: `maskKey(key: string) => string`, `originError(value: string, existing: string[]) => string | null`, `validateSite(d: SitePayload) => Record<string, string>`.
  - Routes `/sites`, `/sites/:id` (`new`); redirect `/sites/:id/edit` → `/sites/:id`.

- [ ] **Step 1: Check the service method names**

Run: `grep -n "async\|: async" packages/admin-dashboard/src/services/sites.ts`
Expected: `list`, `getById`, `create`, `update`, `delete`, and a rotate method. If the rotate method is not called `rotateApiKey`, use its real name wherever this task says `rotateApiKey`.

- [ ] **Step 2: Write the failing tests**

`features/sites/sites-utils.test.ts`:

```ts
import { maskKey, originError, validateSite } from './sites-utils'

it('masks API keys, keeping the prefix and the last 4 characters', () => {
  expect(maskKey('cms_3pb84HyVsBJaZUynsNSvQLZmdaugcBNVo0XYt16EpWk')).toBe('cms_••••••••EpWk')
  expect(maskKey('short')).toBe('•••••')
})

it('validates allowed origins', () => {
  expect(originError('example.com', [])).toBe('Enter a full URL, for example https://example.com')
  expect(originError('https://example.com/', ['https://example.com'])).toBe('This origin is already in the list')
  expect(originError('http://localhost:5174', [])).toBeNull()
})

it('validates a site', () => {
  expect(validateSite({ name: '', domain: '', allowedOrigins: [] })).toEqual({ name: 'Name is required', domain: 'Domain is required' })
  expect(validateSite({ name: 'Blog', domain: 'blog.test', allowedOrigins: ['nope'] })).toEqual({ allowedOrigins: 'Enter a full URL, for example https://example.com' })
})
```

`features/sites/pages/SitesPages.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import { sitesService, type Site } from '@/services/sites'
import * as contentApi from '@/features/content/content-api'
import { tripType } from '@/features/content/test-fixtures'
import { SitesListPage } from './SitesListPage'
import { SiteFormPage } from './SiteFormPage'

vi.mock('@/services/sites', () => ({
  sitesService: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), rotateApiKey: vi.fn() },
}))
vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, listContentTypes: vi.fn() }
})

const site: Site = {
  id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_secretkey123456WXYZ', description: '', allowedOrigins: ['https://blog.test'],
  isActive: true, requestCount: 42, lastRequestAt: '2026-09-29T10:00:00Z', createdAt: '', updatedAt: '',
}

const routes = [
  { path: '/sites', element: <SitesListPage /> },
  { path: '/sites/:id', element: <SiteFormPage /> },
]

beforeEach(() => {
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [site], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
  vi.mocked(sitesService.getById).mockResolvedValue({ success: true, data: site })
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([tripType])
})

describe('SitesListPage', () => {
  it('masks the key and reveals it on request', async () => {
    renderRoutes(routes, { route: '/sites' })
    const card = await screen.findByRole('article', { name: 'Blog' })
    expect(within(card).getByText('cms_••••••••WXYZ')).toBeInTheDocument()
    expect(within(card).getByText(/42 requests/)).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Reveal API key' }))
    expect(within(card).getByText('cms_secretkey123456WXYZ')).toBeInTheDocument()
  })

  it('rotates only after the exact site name is typed', async () => {
    vi.mocked(sitesService.rotateApiKey).mockResolvedValue({ success: true, data: { ...site, apiKey: 'cms_newkey000000ABCD' } })
    renderRoutes(routes, { route: '/sites' })
    const card = await screen.findByRole('article', { name: 'Blog' })
    await userEvent.click(within(card).getByRole('button', { name: 'Rotate key' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('stops working immediately')
    const confirm = within(dialog).getByRole('button', { name: 'Rotate key' })
    await userEvent.type(within(dialog).getByLabelText(/type/i), 'blog')
    expect(confirm).toBeDisabled()
    await userEvent.clear(within(dialog).getByLabelText(/type/i))
    await userEvent.type(within(dialog).getByLabelText(/type/i), 'Blog')
    await userEvent.click(confirm)
    expect(sitesService.rotateApiKey).toHaveBeenCalledWith('s1')
  })
})

describe('SiteFormPage', () => {
  it('adds allowed origins as chips and rejects invalid ones', async () => {
    vi.mocked(sitesService.update).mockResolvedValue({ success: true, data: site })
    renderRoutes(routes, { route: '/sites/s1' })
    const input = await screen.findByLabelText('Add allowed origin')
    await userEvent.type(input, 'blog.test{Enter}')
    expect(screen.getByText('Enter a full URL, for example https://example.com')).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, 'http://localhost:5174{Enter}')
    expect(screen.getByRole('button', { name: 'Remove http://localhost:5174' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save site' }))
    expect(sitesService.update).toHaveBeenCalledWith('s1', expect.objectContaining({ allowedOrigins: ['https://blog.test', 'http://localhost:5174'] }))
  })

  it('shows connect snippets with the real key and first model', async () => {
    renderRoutes(routes, { route: '/sites/s1' })
    const js = await screen.findByLabelText('JavaScript example')
    expect(js).toHaveTextContent('/api/v1/public/content/trip')
    expect(js).toHaveTextContent('cms_secretkey123456WXYZ')
    expect(screen.getByLabelText('curl example')).toHaveTextContent("curl -H 'X-API-Key: cms_secretkey123456WXYZ'")
  })

  it('creates a new site and opens it', async () => {
    vi.mocked(sitesService.create).mockResolvedValue({ success: true, data: { ...site, id: 's9' } })
    const { router } = renderRoutes(routes, { route: '/sites/new' })
    await userEvent.type(await screen.findByLabelText('Name'), 'Shop')
    await userEvent.type(screen.getByLabelText('Domain'), 'shop.test')
    await userEvent.click(screen.getByRole('button', { name: 'Save site' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sites/s9'))
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- sites-utils SitesPages`
Expected: FAIL, missing modules.

- [ ] **Step 4: Implement `features/sites/sites-utils.ts`**

```ts
export interface SitePayload {
  name: string
  domain: string
  description?: string
  allowedOrigins: string[]
  isActive?: boolean
}

export function maskKey(key: string): string {
  if (key.length <= 12) return '•'.repeat(key.length)
  const prefix = key.includes('_') ? key.slice(0, key.indexOf('_') + 1) : ''
  return `${prefix}${'•'.repeat(8)}${key.slice(-4)}`
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function originError(value: string, existing: string[]): string | null {
  const v = normalizeOrigin(value)
  try {
    const url = new URL(v)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
  } catch {
    return 'Enter a full URL, for example https://example.com'
  }
  if (existing.map(normalizeOrigin).includes(v)) return 'This origin is already in the list'
  return null
}

export function validateSite(d: SitePayload): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!d.name.trim()) errors.name = 'Name is required'
  if (!d.domain.trim()) errors.domain = 'Domain is required'
  const bad = d.allowedOrigins.find((o, i) => originError(o, d.allowedOrigins.slice(0, i)))
  if (bad !== undefined) errors.allowedOrigins = originError(bad, [])!
  return errors
}

export { normalizeOrigin }
```

Note: in `validateSite`, a duplicate is caught when adding, so only the URL check matters for stored values; `originError(bad, [])` reports the URL problem.

- [ ] **Step 5: Extend `features/sites/sites-api.ts`**

Replace the file with:

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sitesService, type Site } from '@/services/sites'
import { statsKeys } from '@/lib/queries/stats'
import type { SitePayload } from './sites-utils'

export type { Site }

export const siteKeys = { all: ['sites'] as const, item: (id: string) => ['sites', 'item', id] as const }

export function useSites() {
  return useQuery({ queryKey: siteKeys.all, queryFn: async () => (await sitesService.list(1, 100)).data, staleTime: 60_000 })
}

export function useSite(id?: string) {
  return useQuery({ queryKey: siteKeys.item(id ?? ''), queryFn: async () => (await sitesService.getById(id!)).data, enabled: !!id })
}

export function useSiteWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.all })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    const done = (site: Site) => {
      queryClient.setQueryData(siteKeys.item(site.id), site)
      refresh()
      return site
    }
    return {
      create: async (body: SitePayload) => done((await sitesService.create(body)).data),
      update: async (id: string, body: SitePayload) => done((await sitesService.update(id, body)).data),
      rotate: async (id: string) => done((await sitesService.rotateApiKey(id)).data),
      remove: async (id: string) => {
        await sitesService.delete(id)
        queryClient.removeQueries({ queryKey: siteKeys.item(id) })
        refresh()
      },
    }
  }, [queryClient])
}
```

If `sitesService.create`/`update` parameter types do not accept `SitePayload` exactly, cast at the call (`body as Parameters<typeof sitesService.create>[0]`); the field names match (`name`, `domain`, `description`, `allowedOrigins`, `isActive`).

- [ ] **Step 6: Implement the components and pages**

`features/sites/components/ConnectSnippets.tsx`:

```tsx
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '@/features/home/home-utils'

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="rounded-lg border bg-muted/60">
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <span>{label}</span>
        <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success(`${label} copied`))}>
          <Copy aria-hidden />
          Copy
        </Button>
      </div>
      <pre aria-label={`${label} example`} className="overflow-x-auto p-3 text-xs"><code>{code}</code></pre>
    </div>
  )
}

export function ConnectSnippets({ apiKey, slug }: { apiKey: string; slug?: string }) {
  const url = `${publicApiBase()}/content/${slug ?? 'your-model'}`
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-lg font-semibold">Connect your site</h2>
      <p className="text-sm text-muted-foreground">Load published entries with this site's API key.</p>
      <Snippet label="JavaScript" code={`const res = await fetch('${url}', {\n  headers: { 'X-API-Key': '${apiKey}' },\n})\nconst { data } = await res.json()`} />
      <Snippet label="curl" code={`curl -H 'X-API-Key: ${apiKey}' '${url}'`} />
    </section>
  )
}
```

`features/sites/pages/SitesListPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Eye, EyeOff, KeyRound, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { formatRelative } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSites, useSiteWrites, type Site } from '../sites-api'
import { maskKey } from '../sites-utils'

export function SitesListPage() {
  const sites = useSites()
  const action = (
    <Button asChild>
      <Link to="/sites/new"><Plus aria-hidden />New site</Link>
    </Button>
  )
  let body: React.ReactNode
  if (sites.isPending) body = <Skeleton className="h-32 w-full" />
  else if (sites.isError) body = <ErrorState message="Could not load sites." onRetry={() => void sites.refetch()} />
  else if (sites.data.length === 0) body = <EmptyState icon={KeyRound} title="No sites yet" description="A site gets an API key your website uses to read published content." action={action} />
  else body = <div className="grid gap-4 md:grid-cols-2">{sites.data.map((s) => <SiteCard key={s.id} site={s} />)}</div>
  return (
    <>
      <PageHeader title="Sites & API keys" description="Each website that reads your content has its own key." actions={action} />
      {body}
    </>
  )
}

function SiteCard({ site }: { site: Site }) {
  const writes = useSiteWrites()
  const [revealed, setRevealed] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const rotate = async () => {
    setConfirmRotate(false)
    try {
      await writes.rotate(site.id)
      toast.success('New key created. Update your site with it.')
      setRevealed(true)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }
  return (
    <article aria-label={site.name} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/sites/${site.id}`} className="font-serif text-lg font-semibold hover:underline">{site.name}</Link>
          <p className="truncate text-sm text-muted-foreground">{site.domain}</p>
        </div>
        <span className={site.isActive ? 'rounded-full bg-status-published-bg px-2.5 py-0.5 text-xs text-status-published-fg' : 'rounded-full bg-status-archived-bg px-2.5 py-0.5 text-xs text-status-archived-fg'}>
          {site.isActive ? 'Active' : 'Disabled'}
        </span>
      </header>
      <p className="text-sm text-muted-foreground">
        {site.requestCount} requests · {site.lastRequestAt ? `last ${formatRelative(site.lastRequestAt)}` : 'no requests yet'}
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs">{revealed ? site.apiKey : maskKey(site.apiKey)}</code>
        <Button variant="ghost" size="icon" aria-label={revealed ? 'Hide API key' : 'Reveal API key'} onClick={() => setRevealed(!revealed)}>
          {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Copy API key" onClick={() => void navigator.clipboard?.writeText(site.apiKey).then(() => toast.success('API key copied'))}>
          <Copy aria-hidden />
        </Button>
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => setConfirmRotate(true)}>
          <RefreshCw aria-hidden />
          Rotate key
        </Button>
      </div>
      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={`Rotate the key for ${site.name}?`}
        description="The current key stops working immediately. Update your site with the new key right away."
        confirmText={site.name}
        confirmLabel="Rotate key"
        destructive
        onConfirm={() => void rotate()}
      />
    </article>
  )
}
```

`features/sites/pages/SiteFormPage.tsx`:

```tsx
import { useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { stableStringify } from '@/features/content/editor/useEntryForm'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { useContentTypes } from '@/features/content/queries'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useSite, useSiteWrites, type Site } from '../sites-api'
import { normalizeOrigin, originError, validateSite, type SitePayload } from '../sites-utils'
import { ConnectSnippets } from '../components/ConnectSnippets'

const EMPTY: SitePayload = { name: '', domain: '', description: '', allowedOrigins: [], isActive: true }

export function SiteFormPage() {
  const { id = 'new' } = useParams()
  const siteQuery = useSite(id === 'new' ? undefined : id)
  if (id === 'new') return <SiteForm key="new" initial={EMPTY} />
  if (siteQuery.isError) return <ErrorState message="Could not load this site." onRetry={() => void siteQuery.refetch()} />
  if (!siteQuery.data) return <Skeleton className="h-64 w-full" />
  const s = siteQuery.data
  return <SiteForm key={s.id} site={s} initial={{ name: s.name, domain: s.domain, description: s.description ?? '', allowedOrigins: s.allowedOrigins ?? [], isActive: s.isActive }} />
}

function SiteForm({ site, initial }: { site?: Site; initial: SitePayload }) {
  const navigate = useNavigate()
  const writes = useSiteWrites()
  const types = useContentTypes()
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(initial))
  const [origin, setOrigin] = useState('')
  const [originMessage, setOriginMessage] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const errors = validateSite(draft)
  const visible = showErrors ? errors : {}
  const dirty = stableStringify(draft) !== baseline
  const blocker = useUnsavedGuard(dirty)

  const addOrigin = () => {
    const message = originError(origin, draft.allowedOrigins)
    setOriginMessage(message)
    if (message) return
    setDraft({ ...draft, allowedOrigins: [...draft.allowedOrigins, normalizeOrigin(origin)] })
    setOrigin('')
  }
  const onOriginKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addOrigin()
    }
  }

  const save = async () => {
    setShowErrors(true)
    if (Object.keys(errors).length) {
      toast.error('Fix the highlighted fields before saving')
      return
    }
    const payload = { ...draft, name: draft.name.trim(), domain: draft.domain.trim().toLowerCase(), description: draft.description?.trim() }
    try {
      const saved = site ? await writes.update(site.id, payload) : await writes.create(payload)
      setBaseline(stableStringify(draft))
      toast.success(site ? 'Site saved' : 'Site created')
      if (!site) navigate(`/sites/${saved.id}`, { replace: true, state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await writes.remove(site!.id)
      toast.success(`Deleted ${site!.name}`)
      navigate('/sites', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={draft.name.trim() || 'New site'}
        breadcrumb={<Link to="/sites">Sites & API keys</Link>}
        actions={
          <>
            {site && <Button variant="outline" onClick={() => setConfirmDelete(true)}>Delete site</Button>}
            <Button onClick={() => void save()} disabled={!!site && !dirty}>Save site</Button>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="site-name">Name</Label>
            <Input id="site-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={visible.name ? true : undefined} />
            {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-domain">Domain</Label>
            <Input id="site-domain" value={draft.domain} placeholder="example.com" onChange={(e) => setDraft({ ...draft, domain: e.target.value })} aria-invalid={visible.domain ? true : undefined} />
            {visible.domain && <p className="text-sm text-destructive">{visible.domain}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-description">Description</Label>
            <Textarea id="site-description" rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-origin">Add allowed origin</Label>
            <div className="flex gap-2">
              <Input id="site-origin" value={origin} placeholder="https://example.com" onChange={(e) => setOrigin(e.target.value)} onKeyDown={onOriginKey} aria-invalid={originMessage ? true : undefined} />
              <Button type="button" variant="outline" onClick={addOrigin}>Add</Button>
            </div>
            {(originMessage || visible.allowedOrigins) && <p className="text-sm text-destructive">{originMessage ?? visible.allowedOrigins}</p>}
            <p className="text-xs text-muted-foreground">Browsers on these origins may call the API with this key. Leave empty to allow any.</p>
            <ul className="flex flex-wrap gap-1.5">
              {draft.allowedOrigins.map((o) => (
                <li key={o} className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-3 text-sm">
                  {o}
                  <button type="button" aria-label={`Remove ${o}`} className="rounded-full p-1 hover:bg-accent" onClick={() => setDraft({ ...draft, allowedOrigins: draft.allowedOrigins.filter((x) => x !== o) })}>
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="site-active">Active</Label>
            <Switch id="site-active" checked={draft.isActive !== false} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
          </div>
        </section>
        {site && <ConnectSnippets apiKey={site.apiKey} slug={types.data?.[0]?.slug} />}
      </div>
      <UnsavedChangesDialog blocker={blocker} />
      {site && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${site.name}?`}
          description="Its API key stops working immediately."
          confirmText={site.name}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
```

- [ ] **Step 7: Route and delete the legacy pages**

In `modules/registry.tsx`: remove the `SitesList` and `SiteForm` imports; add `import { SitesListPage } from '@/features/sites/pages/SitesListPage'` and `import { SiteFormPage } from '@/features/sites/pages/SiteFormPage'`; set the sites routes to:

```tsx
    routes: [
      { path: 'sites', element: <SitesListPage /> },
      { path: 'sites/:id', element: <SiteFormPage /> },
      { path: 'sites/:id/edit', element: <RedirectWithId to={(id) => `/sites/${id}`} /> },
    ],
```

Then:

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q -r src/pages/Sites
grep -rn "pages/Sites" src || echo "no references"
```

- [ ] **Step 8: Run tests, build, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/features src/modules`
Expected: PASS, build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): sites and API keys with masked keys, guarded rotation and connect snippets"
```

---

## Task 4: Webhooks

**Files:**
- Create: `features/webhooks/webhooks-api.ts`, `webhooks-queries.ts`, `webhook-events.ts`, `components/SecretDialog.tsx`, `components/DeliveryLog.tsx`, `pages/WebhooksListPage.tsx`, `pages/WebhookFormPage.tsx`
- Modify: `modules/registry.tsx`
- Delete: `features/webhooks/pages/WebhooksPlaceholder.tsx`
- Test: `features/webhooks/webhook-events.test.ts`, `features/webhooks/pages/WebhookPages.test.tsx`

**Interfaces:**
- Consumes: Task 1 create response with `secret`; `useSites` (Task 3).
- Produces:
  - `webhooks-api.ts`: `Webhook { id; name; url; description?; events: string[]; isActive: boolean; siteId?: string; secretPreview?: string; totalDeliveries: number; successfulDeliveries: number; failedDeliveries: number; lastDeliveryAt?: string; lastDeliveryStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING'; createdAt; updatedAt }`, `DeliveryLogEntry { timestamp; event; status; statusCode?; responseTime?; errorMessage?; attemptNumber; payload? }`, `WebhookPayload { name; url; description?; events: string[]; siteId?: string; isActive?: boolean }`, `TestResult { success: boolean; statusCode?: number; responseTime?: number; error?: string }`, functions `listWebhooks()`, `getWebhook(id)`, `createWebhook(body) => Promise<Webhook & { secret: string }>`, `updateWebhook(id, body)`, `deleteWebhook(id)`, `testWebhook(id) => Promise<TestResult>`, `rotateSecret(id) => Promise<string>`, `getLogs(id) => Promise<DeliveryLogEntry[]>`.
  - `webhooks-queries.ts`: `webhookKeys`, `useWebhooks()`, `useWebhook(id?)`, `useWebhookLogs(id?)`, `useWebhookWrites()`.
  - `webhook-events.ts`: `EVENT_GROUPS: { label: string; events: { value: string; label: string }[] }[]`, `eventLabel(value) => string`, `validateWebhook(body) => Record<string, string>`.
  - Routes `/webhooks`, `/webhooks/:id` (`new`).

- [ ] **Step 1: Write the failing tests**

`features/webhooks/webhook-events.test.ts`:

```ts
import { EVENT_GROUPS, eventLabel, validateWebhook } from './webhook-events'

it('groups every backend event', () => {
  expect(EVENT_GROUPS.map((g) => g.label)).toEqual(['Entries', 'Content models', 'Media'])
  expect(EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.value))).toHaveLength(11)
  expect(eventLabel('entry.published')).toBe('Entry published')
  expect(eventLabel('custom.thing')).toBe('custom.thing')
})

it('validates a webhook', () => {
  expect(validateWebhook({ name: '', url: 'ftp://x', events: [] })).toEqual({
    name: 'Name is required',
    url: 'Enter an http or https URL',
    events: 'Choose at least one event',
  })
  expect(validateWebhook({ name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published'] })).toEqual({})
})
```

`features/webhooks/pages/WebhookPages.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import apiClient from '@/lib/api'
import { sitesService } from '@/services/sites'
import { WebhooksListPage } from './WebhooksListPage'
import { WebhookFormPage } from './WebhookFormPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn() } }))

const hook = {
  id: 'w1', name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published', 'entry.unpublished'], isActive: true,
  secretPreview: 'whsec_ab...', totalDeliveries: 3, successfulDeliveries: 2, failedDeliveries: 1,
  lastDeliveryAt: '2026-09-29T10:00:00Z', lastDeliveryStatus: 'FAILED', createdAt: '', updatedAt: '',
}
const logs = [
  { timestamp: '2026-09-29T10:00:00Z', event: 'entry.published', status: 'FAILED', statusCode: 500, responseTime: 120, errorMessage: 'Internal error', attemptNumber: 1, payload: { hello: 'world' } },
]

const routes = [
  { path: '/webhooks', element: <WebhooksListPage /> },
  { path: '/webhooks/:id', element: <WebhookFormPage /> },
]

beforeEach(() => {
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/webhooks') return { data: { success: true, data: [hook], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } } }
    if (url === '/webhooks/w1') return { data: { success: true, data: hook } }
    if (url === '/webhooks/w1/logs') return { data: { success: true, data: logs } }
    return { data: { success: true, data: [] } }
  })
})

it('lists webhooks with their last delivery', async () => {
  renderRoutes(routes, { route: '/webhooks' })
  const row = await screen.findByRole('link', { name: /Deploy/ })
  expect(row).toHaveAttribute('href', '/webhooks/w1')
  expect(screen.getByText(/2 events/)).toBeInTheDocument()
  expect(screen.getByText('Last delivery failed')).toBeInTheDocument()
})

it('creates a webhook and shows its secret once', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { ...hook, id: 'w9', secret: 'whsec_full_secret_value' } } })
  const { router } = renderRoutes(routes, { route: '/webhooks/new' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Deploy')
  await userEvent.type(screen.getByLabelText('Endpoint URL'), 'https://example.com/hook')
  await userEvent.click(screen.getByRole('button', { name: 'Save webhook' }))
  expect(await screen.findByText('Choose at least one event')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Entry published' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save webhook' }))
  const dialog = await screen.findByRole('dialog', { name: 'Signing secret' })
  expect(dialog).toHaveTextContent('whsec_full_secret_value')
  expect(apiClient.post).toHaveBeenCalledWith('/webhooks', expect.objectContaining({ events: ['entry.published'] }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/webhooks/w9'))
})

it('sends a test and shows the delivery log', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { success: true, statusCode: 200, responseTime: 85 } } })
  renderRoutes(routes, { route: '/webhooks/w1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Send test' }))
  expect(await screen.findByText('Test delivered: 200 in 85 ms')).toBeInTheDocument()
  expect(apiClient.post).toHaveBeenCalledWith('/webhooks/w1/test')
  const log = screen.getByRole('table', { name: 'Delivery log' })
  expect(within(log).getByText('Entry published')).toBeInTheDocument()
  expect(within(log).getByText('500')).toBeInTheDocument()
})

it('rotates the secret after confirming and shows the new one', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { newSecret: 'whsec_rotated' } } })
  renderRoutes(routes, { route: '/webhooks/w1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Rotate secret' }))
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rotate secret' }))
  expect(await screen.findByRole('dialog', { name: 'Signing secret' })).toHaveTextContent('whsec_rotated')
  expect(apiClient.post).toHaveBeenCalledWith('/webhooks/w1/rotate-secret')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- webhook-events WebhookPages`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `webhook-events.ts`, `webhooks-api.ts`, `webhooks-queries.ts`**

`features/webhooks/webhook-events.ts`:

```ts
export const EVENT_GROUPS: { label: string; events: { value: string; label: string }[] }[] = [
  {
    label: 'Entries',
    events: [
      { value: 'entry.created', label: 'Entry created' },
      { value: 'entry.updated', label: 'Entry updated' },
      { value: 'entry.deleted', label: 'Entry deleted' },
      { value: 'entry.published', label: 'Entry published' },
      { value: 'entry.unpublished', label: 'Entry unpublished' },
      { value: 'entry.archived', label: 'Entry archived' },
    ],
  },
  {
    label: 'Content models',
    events: [
      { value: 'content_type.created', label: 'Model created' },
      { value: 'content_type.updated', label: 'Model updated' },
      { value: 'content_type.deleted', label: 'Model deleted' },
    ],
  },
  {
    label: 'Media',
    events: [
      { value: 'media.uploaded', label: 'Media uploaded' },
      { value: 'media.deleted', label: 'Media deleted' },
    ],
  },
]

const LABELS = new Map(EVENT_GROUPS.flatMap((g) => g.events.map((e) => [e.value, e.label] as const)))

export function eventLabel(value: string): string {
  return LABELS.get(value) ?? value
}

export function validateWebhook(body: { name: string; url: string; events: string[] }): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!body.name.trim()) errors.name = 'Name is required'
  try {
    const url = new URL(body.url.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
  } catch {
    errors.url = 'Enter an http or https URL'
  }
  if (body.events.length === 0) errors.events = 'Choose at least one event'
  return errors
}
```

`features/webhooks/webhooks-api.ts`:

```ts
import apiClient from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types'

export type DeliveryStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING'

export interface Webhook {
  id: string
  name: string
  url: string
  description?: string
  events: string[]
  isActive: boolean
  siteId?: string
  secretPreview?: string
  totalDeliveries: number
  successfulDeliveries: number
  failedDeliveries: number
  lastDeliveryAt?: string
  lastDeliveryStatus?: DeliveryStatus
  createdAt: string
  updatedAt: string
}

export interface DeliveryLogEntry {
  timestamp: string
  event: string
  status: DeliveryStatus
  statusCode?: number
  responseTime?: number
  errorMessage?: string
  attemptNumber: number
  payload?: unknown
}

export interface WebhookPayload {
  name: string
  url: string
  description?: string
  events: string[]
  siteId?: string
  isActive?: boolean
}

export interface TestResult {
  success: boolean
  statusCode?: number
  responseTime?: number
  error?: string
}

export async function listWebhooks(): Promise<Webhook[]> {
  return (await apiClient.get<PaginatedResponse<Webhook>>('/webhooks', { params: { page: 1, limit: 100 } })).data.data
}

export async function getWebhook(id: string): Promise<Webhook> {
  return (await apiClient.get<ApiResponse<Webhook>>(`/webhooks/${id}`)).data.data
}

export async function createWebhook(body: WebhookPayload): Promise<Webhook & { secret: string }> {
  return (await apiClient.post<ApiResponse<Webhook & { secret: string }>>('/webhooks', body)).data.data
}

export async function updateWebhook(id: string, body: WebhookPayload): Promise<Webhook> {
  return (await apiClient.put<ApiResponse<Webhook>>(`/webhooks/${id}`, body)).data.data
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiClient.delete(`/webhooks/${id}`)
}

export async function testWebhook(id: string): Promise<TestResult> {
  return (await apiClient.post<ApiResponse<TestResult>>(`/webhooks/${id}/test`)).data.data
}

export async function rotateSecret(id: string): Promise<string> {
  return (await apiClient.post<ApiResponse<{ newSecret: string }>>(`/webhooks/${id}/rotate-secret`)).data.data.newSecret
}

export async function getLogs(id: string): Promise<DeliveryLogEntry[]> {
  return (await apiClient.get<ApiResponse<DeliveryLogEntry[]>>(`/webhooks/${id}/logs`)).data.data
}
```

The page test mocks `apiClient.get` with a single argument check (`url`); `listWebhooks` passes params as the second argument, which the mock ignores.

`features/webhooks/webhooks-queries.ts`:

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createWebhook, deleteWebhook, getLogs, getWebhook, listWebhooks, rotateSecret, testWebhook, updateWebhook, type WebhookPayload } from './webhooks-api'

export const webhookKeys = {
  all: ['webhooks'] as const,
  item: (id: string) => ['webhooks', 'item', id] as const,
  logs: (id: string) => ['webhooks', 'logs', id] as const,
}

export function useWebhooks() {
  return useQuery({ queryKey: webhookKeys.all, queryFn: listWebhooks })
}

export function useWebhook(id?: string) {
  return useQuery({ queryKey: webhookKeys.item(id ?? ''), queryFn: () => getWebhook(id!), enabled: !!id })
}

export function useWebhookLogs(id?: string) {
  return useQuery({ queryKey: webhookKeys.logs(id ?? ''), queryFn: () => getLogs(id!), enabled: !!id })
}

export function useWebhookWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = (id?: string) => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all })
      if (id) void queryClient.invalidateQueries({ queryKey: webhookKeys.logs(id) })
    }
    return {
      create: async (body: WebhookPayload) => {
        const created = await createWebhook(body)
        refresh()
        return created
      },
      update: async (id: string, body: WebhookPayload) => {
        const updated = await updateWebhook(id, body)
        queryClient.setQueryData(webhookKeys.item(id), updated)
        refresh(id)
        return updated
      },
      remove: async (id: string) => {
        await deleteWebhook(id)
        queryClient.removeQueries({ queryKey: webhookKeys.item(id) })
        refresh()
      },
      test: async (id: string) => {
        const result = await testWebhook(id)
        refresh(id)
        return result
      },
      rotate: async (id: string) => {
        const secret = await rotateSecret(id)
        void queryClient.invalidateQueries({ queryKey: webhookKeys.item(id) })
        return secret
      },
    }
  }, [queryClient])
}
```

- [ ] **Step 4: Implement the components and pages**

`features/webhooks/components/SecretDialog.tsx`:

```tsx
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function SecretDialog({ secret, onDone }: { secret: string | null; onDone: () => void }) {
  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signing secret</DialogTitle>
          <DialogDescription>Copy it now: it is shown only once. Use it to verify the X-Webhook-Signature header.</DialogDescription>
        </DialogHeader>
        <code className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-sm">{secret}</code>
        <DialogFooter>
          <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(secret ?? '').then(() => toast.success('Secret copied'))}>
            <Copy aria-hidden />
            Copy
          </Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Check the signature header name with `grep -rn "X-.*Signature" packages/backend/src/services/webhook.service.ts` and use the real header name in the description text.

`features/webhooks/components/DeliveryLog.tsx`:

```tsx
import type { DeliveryLogEntry } from '../webhooks-api'
import { eventLabel } from '../webhook-events'
import { formatAbsolute } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DeliveryLog({ logs }: { logs: DeliveryLogEntry[] }) {
  if (logs.length === 0) return <p className="text-sm text-muted-foreground">No deliveries yet. Send a test to try it.</p>
  return (
    <div className="overflow-x-auto">
      <table aria-label="Delivery log" className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Time</th>
            <th scope="col" className="py-1 pr-3 font-medium">Event</th>
            <th scope="col" className="py-1 pr-3 font-medium">Result</th>
            <th scope="col" className="py-1 pr-3 font-medium">Code</th>
            <th scope="col" className="py-1 font-medium">Time taken</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={`${log.timestamp}-${i}`} className="border-t align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{formatAbsolute(log.timestamp)}</td>
              <td className="py-2 pr-3">{eventLabel(log.event)}</td>
              <td className="py-2 pr-3">
                <span className={cn('rounded-full px-2 py-0.5 text-xs', log.status === 'SUCCESS' ? 'bg-status-published-bg text-status-published-fg' : log.status === 'FAILED' ? 'bg-status-unread-bg text-status-unread-fg' : 'bg-status-draft-bg text-status-draft-fg')}>
                  {log.status === 'SUCCESS' ? 'Delivered' : log.status === 'FAILED' ? 'Failed' : log.status === 'RETRYING' ? 'Retrying' : 'Pending'}
                </span>
                {log.errorMessage && <p className="mt-1 text-xs text-muted-foreground">{log.errorMessage}</p>}
                {log.payload !== undefined && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-primary">Payload</summary>
                    <pre className="mt-1 max-w-[70vw] overflow-x-auto rounded bg-muted p-2">{JSON.stringify(log.payload, null, 2)}</pre>
                  </details>
                )}
              </td>
              <td className="py-2 pr-3">{log.statusCode ?? ''}</td>
              <td className="py-2">{log.responseTime !== undefined ? `${log.responseTime} ms` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`features/webhooks/pages/WebhooksListPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Plus, Webhook as WebhookIcon } from 'lucide-react'
import { formatRelative } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWebhooks } from '../webhooks-queries'

export function WebhooksListPage() {
  const hooks = useWebhooks()
  const action = (
    <Button asChild>
      <Link to="/webhooks/new"><Plus aria-hidden />New webhook</Link>
    </Button>
  )
  let body: React.ReactNode
  if (hooks.isPending) body = <Skeleton className="h-32 w-full" />
  else if (hooks.isError) body = <ErrorState message="Could not load webhooks." onRetry={() => void hooks.refetch()} />
  else if (hooks.data.length === 0) body = <EmptyState icon={WebhookIcon} title="No webhooks yet" description="Webhooks call your endpoint when content changes, for example to rebuild your site." action={action} />
  else
    body = (
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {hooks.data.map((h) => (
          <li key={h.id}>
            <Link to={`/webhooks/${h.id}`} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-accent sm:flex-row sm:items-center sm:gap-4">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{h.name}</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">{h.url}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {h.events.length} {h.events.length === 1 ? 'event' : 'events'} · {h.isActive ? 'Active' : 'Paused'}
              </span>
              <span className="text-sm text-muted-foreground">
                {h.lastDeliveryStatus === 'FAILED' ? 'Last delivery failed' : h.lastDeliveryAt ? `Delivered ${formatRelative(h.lastDeliveryAt)}` : 'No deliveries yet'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )
  return (
    <>
      <PageHeader title="Webhooks" description="Notify other services when content changes." actions={action} />
      {body}
    </>
  )
}
```

`features/webhooks/pages/WebhookFormPage.tsx`:

```tsx
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { stableStringify } from '@/features/content/editor/useEntryForm'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { useSites } from '@/features/sites/sites-api'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TestResult, Webhook, WebhookPayload } from '../webhooks-api'
import { useWebhook, useWebhookLogs, useWebhookWrites } from '../webhooks-queries'
import { EVENT_GROUPS, validateWebhook } from '../webhook-events'
import { SecretDialog } from '../components/SecretDialog'
import { DeliveryLog } from '../components/DeliveryLog'

const EMPTY: WebhookPayload = { name: '', url: '', description: '', events: [], isActive: true }

export function WebhookFormPage() {
  const { id = 'new' } = useParams()
  const hook = useWebhook(id === 'new' ? undefined : id)
  if (id === 'new') return <WebhookForm key="new" initial={EMPTY} />
  if (hook.isError) return <ErrorState message="Could not load this webhook." onRetry={() => void hook.refetch()} />
  if (!hook.data) return <Skeleton className="h-64 w-full" />
  const h = hook.data
  return <WebhookForm key={h.id} webhook={h} initial={{ name: h.name, url: h.url, description: h.description ?? '', events: h.events, siteId: h.siteId, isActive: h.isActive }} />
}

function WebhookForm({ webhook, initial }: { webhook?: Webhook; initial: WebhookPayload }) {
  const navigate = useNavigate()
  const writes = useWebhookWrites()
  const sites = useSites()
  const logs = useWebhookLogs(webhook?.id)
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(initial))
  const [showErrors, setShowErrors] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [confirm, setConfirm] = useState<'rotate' | 'delete' | null>(null)
  const errors = validateWebhook(draft)
  const visible = showErrors ? errors : {}
  const dirty = stableStringify(draft) !== baseline
  const blocker = useUnsavedGuard(dirty && !createdId)

  const toggleEvent = (value: string) =>
    setDraft({ ...draft, events: draft.events.includes(value) ? draft.events.filter((e) => e !== value) : [...draft.events, value] })

  const save = async () => {
    setShowErrors(true)
    if (Object.keys(errors).length) {
      toast.error('Fix the highlighted fields before saving')
      return
    }
    const payload: WebhookPayload = { ...draft, name: draft.name.trim(), url: draft.url.trim(), description: draft.description?.trim() }
    if (!payload.siteId) delete payload.siteId
    try {
      if (webhook) {
        await writes.update(webhook.id, payload)
        setBaseline(stableStringify(draft))
        toast.success('Webhook saved')
      } else {
        const created = await writes.create(payload)
        setBaseline(stableStringify(draft))
        setCreatedId(created.id)
        setSecret(created.secret)
        toast.success('Webhook created')
      }
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      setTestResult(await writes.test(webhook!.id))
    } catch (error) {
      setTestResult({ success: false, error: apiErrorMessage(error) })
    } finally {
      setTesting(false)
    }
  }

  const rotate = async () => {
    setConfirm(null)
    try {
      setSecret(await writes.rotate(webhook!.id))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const remove = async () => {
    setConfirm(null)
    try {
      await writes.remove(webhook!.id)
      toast.success(`Deleted ${webhook!.name}`)
      navigate('/webhooks', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={draft.name.trim() || 'New webhook'}
        breadcrumb={<Link to="/webhooks">Webhooks</Link>}
        actions={
          <>
            {webhook && <Button variant="outline" onClick={() => setConfirm('delete')}>Delete webhook</Button>}
            <Button onClick={() => void save()} disabled={!!webhook && !dirty}>Save webhook</Button>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="wh-name">Name</Label>
            <Input id="wh-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={visible.name ? true : undefined} />
            {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-url">Endpoint URL</Label>
            <Input id="wh-url" type="url" className="font-mono" value={draft.url} placeholder="https://example.com/hooks/cms" onChange={(e) => setDraft({ ...draft, url: e.target.value })} aria-invalid={visible.url ? true : undefined} />
            {visible.url && <p className="text-sm text-destructive">{visible.url}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-description">Description</Label>
            <Textarea id="wh-description" rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Events</legend>
            {visible.events && <p className="text-sm text-destructive">{visible.events}</p>}
            {EVENT_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.events.map((e) => (
                    <label key={e.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={draft.events.includes(e.value)} onChange={() => toggleEvent(e.value)} />
                      {e.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="wh-site">Site</Label>
            <Select value={draft.siteId ?? 'none'} onValueChange={(v) => setDraft({ ...draft, siteId: v === 'none' ? undefined : v })}>
              <SelectTrigger id="wh-site"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All sites</SelectItem>
                {(sites.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="wh-active">Active</Label>
            <Switch id="wh-active" checked={draft.isActive !== false} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
          </div>
        </section>

        {webhook && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <h2 className="font-serif text-lg font-semibold">Signing secret</h2>
              <p className="text-sm text-muted-foreground">
                Requests are signed with this secret. Current secret starts with <code className="font-mono">{webhook.secretPreview}</code>.
              </p>
              <Button variant="outline" size="sm" className="self-start" onClick={() => setConfirm('rotate')}>
                <RefreshCw aria-hidden />
                Rotate secret
              </Button>
            </section>
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-lg font-semibold">Deliveries</h2>
                <Button variant="outline" size="sm" onClick={() => void sendTest()} disabled={testing}>
                  <Send aria-hidden />
                  {testing ? 'Sending…' : 'Send test'}
                </Button>
              </div>
              {testResult && (
                <p role="status" className={testResult.success ? 'text-sm text-status-published-fg' : 'text-sm text-destructive'}>
                  {testResult.success
                    ? `Test delivered: ${testResult.statusCode ?? ''} in ${testResult.responseTime ?? 0} ms`
                    : `Test failed${testResult.statusCode ? ` with ${testResult.statusCode}` : ''}: ${testResult.error ?? 'no response'}`}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {webhook.totalDeliveries} total · {webhook.successfulDeliveries} delivered · {webhook.failedDeliveries} failed
              </p>
              {logs.isPending ? <Skeleton className="h-20 w-full" /> : <DeliveryLog logs={logs.data ?? []} />}
            </section>
          </div>
        )}
      </div>

      <UnsavedChangesDialog blocker={blocker} />
      <SecretDialog
        secret={secret}
        onDone={() => {
          setSecret(null)
          if (createdId) navigate(`/webhooks/${createdId}`, { replace: true, state: { skipGuard: true } })
        }}
      />
      {webhook && (
        <>
          <ConfirmDialog
            open={confirm === 'rotate'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title="Rotate the signing secret?"
            description="The receiving service must switch to the new secret, or it will reject signed requests."
            confirmLabel="Rotate secret"
            destructive
            onConfirm={() => void rotate()}
          />
          <ConfirmDialog
            open={confirm === 'delete'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={`Delete ${webhook.name}?`}
            description="It stops receiving events immediately."
            confirmLabel="Delete"
            destructive
            onConfirm={() => void remove()}
          />
        </>
      )}
    </>
  )
}
```

- [ ] **Step 5: Route and delete the placeholder**

In `modules/registry.tsx`: remove the `WebhooksPlaceholder` import; add `import { WebhooksListPage } from '@/features/webhooks/pages/WebhooksListPage'` and `import { WebhookFormPage } from '@/features/webhooks/pages/WebhookFormPage'`; set the webhooks routes to `[{ path: 'webhooks', element: <WebhooksListPage /> }, { path: 'webhooks/:id', element: <WebhookFormPage /> }]`. Then `git rm -q packages/admin-dashboard/src/features/webhooks/pages/WebhooksPlaceholder.tsx`.

- [ ] **Step 6: Run tests, build, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/features src/modules`
Expected: PASS, build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): webhooks with events, signing secret, test send and delivery log"
```

---

## Task 5: Rich text editor without MUI

**Files:**
- Create: `components/rich-text/link-utils.ts`, `components/rich-text/EditorToolbar.tsx`, `styles/prose.css`
- Modify (rewrite): `components/RichTextEditor.tsx`
- Modify: `styles/globals.css` (import `prose.css`)
- Test: `components/rich-text/link-utils.test.ts`, `components/RichTextEditor.test.tsx`

**Interfaces:**
- Consumes: TipTap extensions already used (`StarterKit`, `Underline`, `Link`, `TextStyle`, `Color`, `Highlight`, `TextAlign`, `ResizableImage`, `FontSize`); `MediaPickerDialog` (Plan 3).
- Produces: `RichTextEditor` with the same props (`value`, `onChange`, `placeholder?`); `safeHref(input: string) => string | null`; `<EditorToolbar editor onPickImage />`; content styles under `.cms-prose`.

- [ ] **Step 1: Write the failing tests**

`components/rich-text/link-utils.test.ts`:

```ts
import { safeHref } from './link-utils'

it.each([
  ['https://example.com', 'https://example.com'],
  ['example.com/path', 'https://example.com/path'],
  ['mailto:jana@example.com', 'mailto:jana@example.com'],
  ['/about', '/about'],
  ['#section', '#section'],
])('%s becomes %s', (input, output) => {
  expect(safeHref(input)).toBe(output)
})

it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,hi', ''])('refuses %j', (input) => {
  expect(safeHref(input)).toBeNull()
})
```

`components/RichTextEditor.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { RichTextEditor } from './RichTextEditor'

vi.mock('@/features/media/components/MediaPickerDialog', () => ({ MediaPickerDialog: () => null }))

it('renders the content and a labelled toolbar', async () => {
  renderWithProviders(<RichTextEditor value="<p>Hello <strong>world</strong></p>" onChange={() => {}} />)
  expect(await screen.findByText('world')).toBeInTheDocument()
  const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
  for (const name of ['Bold', 'Italic', 'Underline', 'Bullet list', 'Numbered list', 'Quote', 'Link', 'Insert image']) {
    expect(within(toolbar).getByRole('button', { name })).toBeInTheDocument()
  }
  expect(screen.getByRole('textbox')).toHaveAttribute('aria-multiline', 'true')
})

it('toggles bold and reports the new HTML', async () => {
  const onChange = vi.fn()
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={onChange} />)
  const bold = await screen.findByRole('button', { name: 'Bold' })
  expect(bold).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(bold)
  await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'))
})

it('refuses a javascript: link', async () => {
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Link' }))
  await userEvent.type(await screen.findByLabelText('Link URL'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: 'Apply link' }))
  expect(screen.getByText('Use a web address (https://…), an email (mailto:…) or a page path (/about)')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- link-utils RichTextEditor`
Expected: FAIL: missing `./link-utils`; no toolbar with that name (the old toolbar has no role).

- [ ] **Step 3: Implement `components/rich-text/link-utils.ts`**

```ts
/** Allowed link targets: http(s), mailto, page paths and anchors. Bare domains get https://. */
export function safeHref(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (value.startsWith('/') || value.startsWith('#')) return value
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(value)) return value
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).toString().replace(/\/$/, value.endsWith('/') ? '/' : '')
    } catch {
      return null
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(value)) return `https://${value}`
  return null
}
```

- [ ] **Step 4: Implement `components/rich-text/EditorToolbar.tsx`**

```tsx
import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  PanelLeft,
  PanelRight,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { safeHref } from './link-utils'

const BLOCKS = [
  { value: '0', label: 'Paragraph' },
  { value: '1', label: 'Heading 1' },
  { value: '2', label: 'Heading 2' },
  { value: '3', label: 'Heading 3' },
]
const SIZES = [
  { value: '13px', label: 'Small' },
  { value: '', label: 'Normal' },
  { value: '20px', label: 'Large' },
  { value: '28px', label: 'Huge' },
]
const LINK_HINT = 'Use a web address (https://…), an email (mailto:…) or a page path (/about)'

function Tool({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('grid size-8 place-items-center rounded-md text-foreground hover:bg-accent disabled:opacity-40', active && 'bg-secondary text-primary')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />
}

export function EditorToolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [urlImageOpen, setUrlImageOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  const chain = () => editor.chain().focus()
  const heading = [1, 2, 3].find((level) => editor.isActive('heading', { level })) ?? 0
  const size = SIZES.find((s) => s.value && editor.isActive('textStyle', { fontSize: s.value }))?.value ?? ''
  const imageSelected = editor.isActive('image')

  const applyLink = () => {
    const href = safeHref(linkValue)
    if (!href) {
      setLinkError(LINK_HINT)
      return
    }
    chain().extendMarkRange('link').setLink({ href }).run()
    setLinkOpen(false)
  }

  const applyImageUrl = () => {
    const href = safeHref(imageUrl)
    if (!href || href.startsWith('mailto:')) return
    chain().setImage({ src: href }).run()
    setUrlImageOpen(false)
    setImageUrl('')
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
      <label className="sr-only" htmlFor="rte-block">Text style</label>
      <select
        id="rte-block"
        value={String(heading)}
        onChange={(e) => {
          const level = Number(e.target.value)
          if (level === 0) chain().setParagraph().run()
          else chain().toggleHeading({ level: level as 1 | 2 | 3 }).run()
        }}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {BLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
      <label className="sr-only" htmlFor="rte-size">Text size</label>
      <select
        id="rte-size"
        value={size}
        onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {SIZES.map((s) => <option key={s.label} value={s.value}>{s.label}</option>)}
      </select>
      <Divider />
      <Tool label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold aria-hidden className="size-4" /></Tool>
      <Tool label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic aria-hidden className="size-4" /></Tool>
      <Tool label="Underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon aria-hidden className="size-4" /></Tool>
      <Tool label="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough aria-hidden className="size-4" /></Tool>
      <label className="relative grid size-8 cursor-pointer place-items-center rounded-md hover:bg-accent" title="Text color">
        <span className="sr-only">Text color</span>
        <span aria-hidden className="font-serif text-sm font-semibold underline decoration-2">A</span>
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => chain().setColor(e.target.value).run()} />
      </label>
      <Tool label="Highlight" active={editor.isActive('highlight')} onClick={() => chain().toggleHighlight({ color: '#fff59d' }).run()}><Highlighter aria-hidden className="size-4" /></Tool>
      <Divider />
      <Tool label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft aria-hidden className="size-4" /></Tool>
      <Tool label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter aria-hidden className="size-4" /></Tool>
      <Tool label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight aria-hidden className="size-4" /></Tool>
      <Tool label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify aria-hidden className="size-4" /></Tool>
      <Divider />
      <Tool label="Bullet list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List aria-hidden className="size-4" /></Tool>
      <Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered aria-hidden className="size-4" /></Tool>
      <Tool label="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><Quote aria-hidden className="size-4" /></Tool>
      <Tool label="Code block" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()}><Code2 aria-hidden className="size-4" /></Tool>
      <Divider />
      <Popover
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open)
          if (open) {
            setLinkValue((editor.getAttributes('link').href as string | undefined) ?? '')
            setLinkError(null)
          }
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" aria-label="Link" title="Link" aria-pressed={editor.isActive('link')} className={cn('grid size-8 place-items-center rounded-md hover:bg-accent', editor.isActive('link') && 'bg-secondary text-primary')}>
            <LinkIcon aria-hidden className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); applyLink() }}>
            <Label htmlFor="rte-link">Link URL</Label>
            <Input id="rte-link" value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://example.com" aria-invalid={linkError ? true : undefined} />
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
            <div className="flex justify-end gap-2">
              {editor.isActive('link') && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { chain().extendMarkRange('link').unsetLink().run(); setLinkOpen(false) }}>
                  <Unlink aria-hidden />
                  Remove link
                </Button>
              )}
              <Button type="submit" size="sm">Apply link</Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Insert image" title="Insert image" className="grid size-8 place-items-center rounded-md hover:bg-accent">
            <ImageIcon aria-hidden className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onPickImage}>From media library</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setUrlImageOpen(true)}>By URL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {urlImageOpen && (
        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); applyImageUrl() }}>
          <label className="sr-only" htmlFor="rte-image-url">Image URL</label>
          <Input id="rte-image-url" autoFocus value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="h-8 w-56" />
          <Button type="submit" size="sm">Insert</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setUrlImageOpen(false)}>Cancel</Button>
        </form>
      )}
      {imageSelected && (
        <>
          <Divider />
          <Tool label="Wrap text on the right" active={editor.isActive('image', { float: 'left' })} onClick={() => chain().updateAttributes('image', { float: 'left' }).run()}><PanelLeft aria-hidden className="size-4" /></Tool>
          <Tool label="No text wrap" active={editor.isActive('image', { float: 'none' })} onClick={() => chain().updateAttributes('image', { float: 'none' }).run()}><ImageIcon aria-hidden className="size-4" /></Tool>
          <Tool label="Wrap text on the left" active={editor.isActive('image', { float: 'right' })} onClick={() => chain().updateAttributes('image', { float: 'right' }).run()}><PanelRight aria-hidden className="size-4" /></Tool>
        </>
      )}
    </div>
  )
}
```

The highlight color `#fff59d` is document content (a highlighter swatch stored in the HTML), not a UI color, so it is exempt from the token rule.

- [ ] **Step 5: Rewrite `components/RichTextEditor.tsx`**

```tsx
import { useState } from 'react'
import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { MediaPickerDialog } from '@/features/media/components/MediaPickerDialog'
import { ResizableImage } from './ResizableImage'
import { FontSize } from './FontSize'
import { EditorToolbar } from './rich-text/EditorToolbar'
import type { MediaFile } from '../types'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage,
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: 'cms-prose min-h-[200px] p-4 focus:outline-none',
        role: 'textbox',
        'aria-multiline': 'true',
        ...(placeholder ? { 'aria-label': placeholder, 'data-placeholder': placeholder } : {}),
      },
    },
  })
  // Re-render the toolbar when the selection or marks change.
  useEditorState({ editor, selector: (ctx) => ctx.editor?.state.selection.toJSON() })

  if (!editor) return null

  const insertFromLibrary = (media: MediaFile[]) => {
    const file = media[0]
    if (file) editor.chain().focus().setImage({ src: file.blobUrl, alt: file.altText || file.originalName }).run()
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <EditorToolbar editor={editor} onPickImage={() => setGalleryOpen(true)} />
      <div className="max-h-[500px] overflow-auto">
        <EditorContent editor={editor} />
      </div>
      <MediaPickerDialog open={galleryOpen} onOpenChange={setGalleryOpen} onSelect={insertFromLibrary} accept={['image/*']} />
    </div>
  )
}
```

If `useEditorState` with that selector does not trigger toolbar updates for mark toggles (Bold test), change the selector to `(ctx) => ({ sel: ctx.editor?.state.selection.toJSON(), marks: ctx.editor?.state.storedMarks?.map((m) => m.type.name).join(',') ?? '' })`.

- [ ] **Step 6: Add the content stylesheet**

`styles/prose.css`:

```css
/* Rich text content inside the editor (TipTap/ProseMirror). */
.cms-prose { color: var(--foreground); line-height: 1.65; }
.cms-prose > * + * { margin-top: 0.75em; }
.cms-prose h1, .cms-prose h2, .cms-prose h3 { font-family: var(--font-serif); font-weight: 600; line-height: 1.25; }
.cms-prose h1 { font-size: 1.75rem; }
.cms-prose h2 { font-size: 1.4rem; }
.cms-prose h3 { font-size: 1.15rem; }
.cms-prose ul { list-style: disc; padding-left: 1.5rem; }
.cms-prose ol { list-style: decimal; padding-left: 1.5rem; }
.cms-prose blockquote { border-left: 3px solid var(--border); padding-left: 1rem; color: var(--muted-foreground); font-style: italic; }
.cms-prose pre { background: var(--muted); border-radius: 0.5rem; padding: 0.75rem 1rem; overflow-x: auto; font-family: ui-monospace, monospace; font-size: 0.875em; }
.cms-prose code { background: var(--muted); border-radius: 0.25rem; padding: 0.1em 0.3em; font-size: 0.9em; }
.cms-prose pre code { background: none; padding: 0; }
.cms-prose a { color: var(--primary); text-decoration: underline; }
.cms-prose img { max-width: 100%; height: auto; border-radius: 0.375rem; }
.cms-prose mark { border-radius: 0.2em; padding: 0 0.15em; }
/* Clear floats so wrapped images do not bleed past the content. */
.cms-prose::after { content: ""; display: block; clear: both; }
.cms-prose p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--muted-foreground); float: left; height: 0; pointer-events: none; }
```

In `styles/globals.css`, add `@import "./prose.css";` after `@import "./tokens.css";`.

- [ ] **Step 7: Run tests, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/components src/features`
Expected: PASS (the entry editor tests mock `RichTextEditor`; the media picker test is unaffected), build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): rich text toolbar without MUI, safe links and content styles"
```

---

## Task 6: Remove MUI and make `pnpm lint` clean

**Files:**
- Delete: `app/theme/LegacyMuiTheme.tsx`, `app/theme/LegacyMuiTheme.test.tsx`
- Modify: `App.tsx`, `contexts/AuthContext.tsx`, `types/index.ts`, `package.json`
- Test: `contexts/AuthContext.test.tsx`

**Interfaces:**
- Produces: no `@mui/*` or `@emotion/*` import anywhere; `pnpm lint` exits 0; the dev auth provider is authenticated on its first render (no sign-in flash).

- [ ] **Step 1: Write the failing test `contexts/AuthContext.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../config/msalConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/msalConfig')>()
  return { ...actual, isEntraConfigured: () => false }
})

function Probe({ renders }: { renders: string[] }) {
  const { isAuthenticated, user } = useAuth()
  renders.push(isAuthenticated ? `in:${user?.name}` : 'out')
  return null
}

it('dev auth is signed in on the very first render', () => {
  const renders: string[] = []
  render(<AuthProvider><Probe renders={renders} /></AuthProvider>)
  expect(renders[0]).toBe('in:Test Admin')
  expect(renders).not.toContain('out')
  expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- AuthContext`
Expected: FAIL: the first render reports `out` (state is set in an effect).

- [ ] **Step 3: Fix `contexts/AuthContext.tsx`**

In `DevAuthProvider`, replace the two `useState` calls and the mount `useEffect` with lazy state:

```tsx
function devSession(): { token: string; user: User } {
  const decoded = JSON.parse(atob(DEFAULT_TOKEN.split('.')[1]))
  return { token: DEFAULT_TOKEN, user: { sub: decoded.sub, email: decoded.email, name: decoded.name } }
}

function DevAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ token: string; user: User } | null>(devSession)
  const token = session?.token ?? null
  const user = session?.user ?? null

  // The API client reads the dev token from storage.
  useEffect(() => {
    try {
      if (session) localStorage.setItem('auth_token', session.token)
      else localStorage.removeItem('auth_token')
    } catch {
      // Storage unavailable: requests go without a token.
    }
  }, [session])

  const login = () => setSession(devSession())
  const logout = () => setSession(null)
```

and keep the rest of the provider (it uses `token`, `user`, `login`, `logout`). Remove `setToken`/`setUser` usages in this provider.

In `EntraAuthProvider`, replace the `user` state and its effect with a derived value:

```tsx
  const user = useMemo<User | null>(
    () =>
      isAuthenticated && accounts.length > 0
        ? { sub: accounts[0].localAccountId, email: accounts[0].username || '', name: accounts[0].name || '' }
        : null,
    [isAuthenticated, accounts],
  )
```

Keep `token` state (set inside `getAccessToken`, an async callback), and expose `token: isAuthenticated ? token : null`. Add `useMemo` to the React import. Above `export function useAuth()` add:

```tsx
// Provider and hook live together so every consumer imports one module.
// eslint-disable-next-line react-refresh/only-export-components
```

- [ ] **Step 4: Remove the legacy MUI theme and packages**

In `App.tsx`: remove the `LegacyMuiTheme` import and wrapper (keep its children in place), and type the MSAL payload:

```tsx
import { PublicClientApplication, EventType, type AuthenticationResult } from '@azure/msal-browser'
```

```tsx
      const payload = event.payload as AuthenticationResult
      msalInstance!.setActiveAccount(payload.account)
```

Then:

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q src/app/theme/LegacyMuiTheme.tsx src/app/theme/LegacyMuiTheme.test.tsx
grep -rn "@mui\|@emotion" src || echo "no MUI imports"
cd /Users/pavelflajsman/personalGit/thecms
pnpm --filter admin-dashboard remove @mui/material @mui/icons-material @mui/x-date-pickers @emotion/react @emotion/styled
```

Expected: `no MUI imports`, packages removed.

- [ ] **Step 5: Make the shared types lint-clean**

In `types/index.ts`, the four `any` usages describe free-form JSON from the API (`defaultValue`, entry `data`, error `details`, submission `data`). Change `details?: any;` to `details?: unknown;`, and above each of the other three lines add:

```ts
  // Free-form JSON chosen by content editors; narrowed where it is read.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
```

- [ ] **Step 6: Run everything**

Run:

```bash
cd packages/admin-dashboard
pnpm test
pnpm build 2>&1 | tail -5
pnpm lint
```

Expected: tests PASS; build succeeds (note the main bundle size from the build output and compare with the Plan 4 build: it should drop after removing MUI); `pnpm lint` exits 0 with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A packages/admin-dashboard pnpm-lock.yaml
git commit -m "chore(admin): remove MUI and Emotion; lint clean; no dev sign-in flash"
```

---

## Task 7: Accessibility checks

**Files:**
- Create: `styles/contrast.test.ts`, `test/a11y.ts`, `app/a11y.test.tsx`
- Modify: `app/shell/AppShell.tsx` (skip link target), `features/forms/components/FormPreview.tsx` (required semantics), `features/content/editor/fields/MediaField.tsx` (drag handle)
- Test: the files above

**Interfaces:**
- Produces: `contrastRatio(a: string, b: string) => number`; `expectNoA11yViolations(container: Element) => Promise<void>`.

- [ ] **Step 1: Add axe**

```bash
cd /Users/pavelflajsman/personalGit/thecms
pnpm --filter admin-dashboard add -D axe-core
```

- [ ] **Step 2: Write the failing tests**

`styles/contrast.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')

function tokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\}`))![1]
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PAIRS: [string, string][] = [
  ['foreground', 'background'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['primary', 'background'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
  ['status-published-fg', 'status-published-bg'],
  ['status-draft-fg', 'status-draft-bg'],
  ['status-archived-fg', 'status-archived-bg'],
  ['status-unread-fg', 'status-unread-bg'],
  ['background', 'status-unread-fg'],
]

describe.each([':root', '.dark'])('%s tokens', (selector) => {
  const t = tokens(selector)
  it.each(PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
})
```

`test/a11y.ts`:

```ts
import axe from 'axe-core'

/** Runs axe on a rendered container. Color contrast is covered by styles/contrast.test.ts (jsdom has no layout). */
export async function expectNoA11yViolations(container: Element) {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary).toEqual([])
}
```

`app/a11y.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { renderRoutes } from '@/test/render'
import { setViewport } from '@/test/viewport'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { sitesService } from '@/services/sites'
import { makeListItem, page, tripType } from '@/features/content/test-fixtures'
import { makeMedia, mediaPage } from '@/features/media/test-fixtures'
import { ContentListPage } from '@/features/content/pages/ContentListPage'
import { MediaLibraryPage } from '@/features/media/pages/MediaLibraryPage'
import { InboxPage } from '@/features/inbox/pages/InboxPage'
import { ModelsListPage } from '@/features/models/pages/ModelsListPage'
import { FormBuilderPage } from '@/features/forms/pages/FormBuilderPage'
import { SitesListPage } from '@/features/sites/pages/SitesListPage'
import { WebhookFormPage } from '@/features/webhooks/pages/WebhookFormPage'
import { SignInScreen } from '@/app/shell/SignInScreen'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn(), getById: vi.fn() } }))
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({ data: { entries: { total: 1, draft: 1, published: 0, archived: 0, byType: { [tripType.id]: 1 } }, contentTypes: 1, media: 1, sites: 1, submissions: { unread: 0 } } }),
  useUnreadCount: () => 0,
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Pavel', email: 'p@x' }, login: vi.fn(), logout: vi.fn(), isAuthenticated: true, isLoading: false }) }))

const form = { id: 'f1', name: 'Contact', slug: 'contact', recipientEmail: 'me@x.test', isActive: true, submissionCount: 0, createdAt: '', updatedAt: '', fields: [{ name: 'email', label: 'Email', type: 'EMAIL', required: true }] }
const hook = { id: 'w1', name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published'], isActive: true, secretPreview: 'whsec_ab...', totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0, createdAt: '', updatedAt: '' }

beforeEach(() => {
  setViewport(true)
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [{ id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_key_1234567890', isActive: true, requestCount: 1, createdAt: '', updatedAt: '' }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    const ok = (data: unknown) => ({ data: { success: true, data, pagination: { page: 1, limit: 20, total: Array.isArray(data) ? data.length : 1, totalPages: 1 } } })
    if (url === '/entries') return { data: page([makeListItem()]) }
    if (url === '/content-types') return ok([tripType])
    if (url === '/media') return { data: mediaPage([makeMedia()]) }
    if (url === '/submissions') return ok([])
    if (url === '/contact-forms') return ok([form])
    if (url === '/contact-forms/f1') return ok(form)
    if (url === '/webhooks/w1') return ok(hook)
    if (url === '/webhooks/w1/logs') return ok([])
    return ok([])
  })
})

it.each([
  ['/content', <ContentListPage />, 'Content'],
  ['/media', <MediaLibraryPage />, 'Media'],
  ['/inbox', <InboxPage />, 'Inbox'],
  ['/models', <ModelsListPage />, 'Content models'],
  ['/forms/f1', <FormBuilderPage />, 'Contact'],
  ['/sites', <SitesListPage />, 'Sites & API keys'],
  ['/webhooks/w1', <WebhookFormPage />, 'Deploy'],
])('%s has no axe violations', async (path, element, heading) => {
  const route = path.includes('/f1') ? '/forms/:id' : path.includes('/w1') ? '/webhooks/:id' : path
  const { container } = renderRoutes([{ path: route, element }], { route: path })
  await screen.findByRole('heading', { level: 1, name: heading })
  await expectNoA11yViolations(container)
})

it('sign-in screen has no axe violations', async () => {
  const { container } = renderRoutes([{ path: '/', element: <SignInScreen /> }])
  await expectNoA11yViolations(container)
})
```

Add targeted tests for the three known gaps (deferred minors from earlier plans) to the existing files:

In `app/shell/shell.test.tsx`, inside `describe('AppShell')`:

```tsx
  it('skip link target can take focus', () => {
    auth.value = { ...auth.value, isAuthenticated: true, isLoading: false }
    renderWithProviders(<AppShell />)
    expect(document.getElementById('main')).toHaveAttribute('tabindex', '-1')
  })
```

In `features/forms/pages/FormBuilderPage.test.tsx`:

```tsx
it('marks required preview fields for assistive technology', async () => {
  renderRoutes(routes, { route: '/forms/f1' })
  const preview = await screen.findByRole('region', { name: 'Preview' })
  expect(within(preview).getByLabelText(/Email/)).toBeRequired()
})
```

In `features/content/editor/fields/MediaField.test.tsx`:

```tsx
it('drag handles are not keyboard stops (Move buttons are the keyboard path)', async () => {
  renderWithProviders(<Harness field={gallery} initial={['a', 'b']} />)
  const handle = await screen.findByLabelText('Drag a.jpg', {}, { timeout: 2000 }).catch(() => null)
  expect(handle).toBeNull()
})
```

- [ ] **Step 3: Run to verify they fail or report**

Run: `cd packages/admin-dashboard && pnpm test -- contrast a11y shell FormBuilderPage MediaField`
Expected: contrast tests PASS (tokens were chosen for AA and this locks them in); the three gap tests FAIL; the axe tests report violations, if any, as `rule-id: selector` lines.

- [ ] **Step 4: Fix the gaps and any axe violations**

- `app/shell/AppShell.tsx`: add `tabIndex={-1}` to `<main id="main" …>`.
- `features/forms/components/FormPreview.tsx`: pass `required={f.required}` to every `Input`, `Textarea`, `select` and the checkbox `input`.
- `features/content/editor/fields/MediaField.tsx`: on the drag handle `<button … aria-label={\`Drag ${name}\`}>`, replace the element with `<span {...listeners} aria-hidden className="cursor-grab rounded bg-background/90 p-0.5">` (drop `{...attributes}`, which made it a focusable button announcing a keyboard drag that has no keyboard sensor).
- For each axe violation reported in Step 3, fix it in the component that renders the reported selector. Common causes and fixes in this codebase: a form control without a name (add `aria-label` or a `<Label htmlFor>`), a list containing a non-`li` child (wrap it), duplicate ids (make the id unique, for example by adding the field `cid`), a button without text (add `aria-label`). Re-run until the axe tests report `[]`.

- [ ] **Step 5: Run all tests, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint`
Expected: PASS, lint exits 0.

```bash
git add -A packages/admin-dashboard pnpm-lock.yaml
git commit -m "test(admin): contrast and axe checks; fix skip link, required preview fields and drag handle semantics"
```

---

## Task 8: Verification in the running app

**Files:** none unless a defect is found (fix with a test when jsdom can express it).

- [ ] **Step 1: Start services** (cached mongod, Azurite via npx, backend and admin dev servers, as before).

- [ ] **Step 2: Check and note each result**

1. `/sites`: cards with masked keys, request counts; Reveal and Copy; Rotate asks for the site name and changes the key; the example site with the old key now gets 401 and works again with the new key after updating its local config.
2. `/sites/<id>`: add an origin without a scheme (rejected), add `http://localhost:5174`, save; connect snippets with `curl` return data.
3. `/webhooks`: create a webhook to a local request catcher (for example `npx -y http-echo-server 9999` or a `python3 -m http.server`-style listener); the secret dialog shows the full secret once; Send test shows the result; publishing an entry adds a delivery log row; rotate secret shows a new one.
4. Rich text: toolbar works (headings, sizes, marks, color, highlight, alignment, lists, quote, code block); link popover refuses `javascript:`; image from library and by URL; float buttons on a selected image; content renders with the new styles in light and dark.
5. A crashing page (temporarily throw in a component in dev, then revert) shows the error page inside the shell.
6. No sign-in screen flash on reload in dev mode.
7. `pnpm --filter admin-dashboard build` output: main bundle size vs before MUI removal.
8. 360px (iframe method): sites, site form, webhooks, webhook form; no horizontal scroll.
9. Keyboard only: Tab through the shell, ⌘K, the Content list row menu, the entry editor toolbar and field controls, the media picker, the model builder Move buttons, and the Inbox; focus is always visible.

- [ ] **Step 3: Record and commit**

Append a "Plan 5 verification" table to `TEST_RESULTS.md`, update the "Admin Dashboard" line in `README.md` to describe the Tailwind + shadcn/ui stack, and commit:

```bash
git add TEST_RESULTS.md README.md
git commit -m "docs: record Plan 5 verification results"
```

---

## Self-Review Notes

- **Spec coverage:** 5.8 site cards (domain, request count, last request), masked key with Reveal and Copy, Rotate requiring the typed name with the warning, allowed origins chips, connect panel with JS and curl snippets → Task 3. 5.9 list (URL, events count, active, last delivery), create/edit (URL, grouped events, site, active, secret rotate), Send test with inline result, delivery log with status code, duration and expandable body → Tasks 1 and 4 (reveal-later replaced by show-once, see Decisions). Section 6 route error boundary → Task 2; accessibility (contrast, labelled controls, keyboard, focus) → Tasks 6 and 7. Section 8 "Removed at the end" (MUI, Emotion) → Tasks 5 and 6. Section 9 step 8 (remove MUI, a11y and responsive pass, bundle size check) → Tasks 6 to 8.
- **Type consistency:** `SitePayload`, `useSiteWrites` methods, `Webhook`/`WebhookPayload`/`TestResult`, `useWebhookWrites` methods, `safeHref`, `EditorToolbar` props and `expectNoA11yViolations` match across tasks.
