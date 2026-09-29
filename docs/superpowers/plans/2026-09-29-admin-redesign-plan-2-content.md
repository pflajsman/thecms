# Admin Redesign, Plan 2: Content List and Entry Editor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy MUI Content Entries list and form with the new cross-type Content list and the canvas-plus-side-panel entry editor (autosave for drafts, unsaved-changes guard, client validation, relation picker), and add entry search to the ⌘K palette.

**Architecture:** A `features/content` module owns the content API calls (`content-api.ts`), React Query hooks (`queries.ts`), URL-state helpers, the list page and the editor. Pure logic (validation, payload cleanup, editor button states, URL parsing) lives in small tested modules; components compose them. The app moves to a React Router data router so the editor can block navigation with unsaved changes. Rich text and media fields reuse the existing TipTap `RichTextEditor` and `MediaPicker` components until Plan 3 rebuilds media.

**Tech Stack:** React 19, React Router 7 (data router), TanStack Query 5, zod 3, shadcn/ui (popover, calendar, switch, select, textarea), sonner, cmdk, Vitest, React Testing Library. Backend: Express, Mongoose, Jest.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-dashboard-redesign-design.md` (sections 5.2, 5.3, 6, 7.3)

**Series:** Plan 2 of 5. Plan 1 (backend additions, shell) is merged on `main`.

## Global Constraints

- Public API (`/api/v1/public/*`) request and response shapes must not change.
- Admin endpoint changes are additive only.
- Title fallback text is exactly `Untitled`.
- Status labels shown to users: "Published", "Draft", "Archived"; never raw enums.
- Colors come only from Tailwind token utilities; no hard-coded hex values in new components.
- Mobile layout breakpoint: below 768px (`md`); the editor side panel becomes a sheet below 1024px (`lg`).
- Every screen must work at 360px width without horizontal scrolling.
- Autosave: drafts only, 2 seconds after the last change, and on blur. Published entries never autosave.
- Saving never navigates away from the editor; `⌘S` / `Ctrl+S` saves.
- Every mutation shows a toast on success; failures show a toast with the server message.
- Copy is English. Never use an em dash in UI copy, code comments or docs.

## Decisions (deviations from the spec, for the reviewer)

1. **List thumbnails deferred to Plan 3.** Showing the first media field as a thumbnail needs a media lookup per row; Plan 3 builds the media layer. Rows show a type initial badge instead.
2. **One pager on all widths.** The spec asks for "Load more" on mobile. A single compact Previous/Next pager keeps one query mode; it works at 360px.
3. **react-hook-form not used for the entry form.** The entry form is a single dynamic object with autosave and a saved baseline; a small `useEntryForm` hook plus zod is simpler. react-hook-form stays available for Plan 4's builders.
4. **Relation picker filters by `validation.targetContentType` only when it is a 24-character id.** The current model builder never stores a target type, so in practice the picker searches all entries.
5. **Archived entries are read-only** until restored to draft.
6. **Media field drag-to-reorder and drop-to-upload move to Plan 3** with the shared media grid.

## Review Focus

1. **Optional fields left empty must be omitted, not sent as `''`:** the backend rejects `''` for Number, Media and Relation fields. Tested in Tasks 3 and 6.
2. **Autosave racing a manual save on a new entry must not create two entries.** Tested in Task 6.
3. **An invalid regex `pattern` in a model must not crash the editor.** Tested in Task 3.
4. **Tampered URLs** (`?page=abc`, `?page=99`, `?type=not-an-id`) must not show errors or false empty states. Tested in Task 5.
5. **The editor's own redirect after creating an entry must not trigger the unsaved-changes dialog.** Tested in Task 6.

---

## File Structure

### Backend (`packages/backend`)

| File | Change |
|---|---|
| `src/modules/stats/stats.service.ts` | Add `entries.byType` |
| `src/modules/stats/stats.test.ts` | Extend |

### Frontend (`packages/admin-dashboard/src`)

| File | Responsibility |
|---|---|
| `types/index.ts` (modify) | `EntryStatus`, `EntryListItem`, `EntryContentTypeRef`, extra validation keys, `byType` |
| `app/routes.tsx` (create), `App.tsx` (modify) | Data router |
| `test/render.tsx` (modify) | `renderRoutes` helper |
| `lib/api-error.ts` (create) | `apiErrorMessage(err)` |
| `lib/format.ts` (modify) | `formatRelative`, `formatAbsolute` |
| `lib/hooks/useHotkey.ts`, `useDebouncedValue.ts`, `useAutosave.ts`, `useUnsavedGuard.ts` (create) | Reusable hooks |
| `lib/entry-schema.ts` (create) | Validation, payload cleanup, title field, initial values |
| `components/common/ErrorState.tsx`, `Pager.tsx`, `DataList.tsx` (create) | Shared UI |
| `components/ui/{popover,calendar,switch,select,textarea}.tsx` (generated) | shadcn |
| `features/content/content-api.ts`, `queries.ts` (create) | API calls and hooks |
| `features/content/list-params.ts` (create) | URL state |
| `features/content/useEntryActions.ts` (create) | Row actions with toasts and undo |
| `features/content/components/{TypeChooser,NewEntryButton,ContentFilters,EntryRowMenu}.tsx` (create) | List UI |
| `features/content/pages/ContentListPage.tsx` (create) | Content list |
| `features/content/editor/{editor-actions.ts,useEntryForm.ts,EntryEditor.tsx,EditorTopBar.tsx,EditorSidePanel.tsx,UnsavedChangesDialog.tsx}` (create) | Editor |
| `features/content/editor/fields/{FieldShell,BasicFields,DateField,RelationField,LegacyFields,FieldControl}.tsx` (create) | Field controls |
| `features/content/pages/EntryEditorPage.tsx`, `features/content/LegacyRedirects.tsx` (create) | Routes |
| `modules/registry.tsx` (modify) | New content routes, create action |
| `app/shell/CommandPalette.tsx` (modify) | Entry search, key guard |
| `pages/ContentEntries/*`, `components/DynamicFormGenerator.tsx`, `services/contentEntries.ts` (delete) | Replaced |

---

## Task 1: Entry counts per content type in `/stats`

**Files:**
- Modify: `packages/backend/src/modules/stats/stats.service.ts`
- Test: `packages/backend/src/modules/stats/stats.test.ts`

**Interfaces:**
- Produces: `DashboardStats.entries.byType: Record<string, number>` (content type id to entry count; types with no entries are absent).

- [ ] **Step 1: Update the tests**

In `stats.test.ts`, change the empty-install expectation's `entries` to:

```ts
    entries: { total: 0, draft: 0, published: 0, archived: 0, byType: {} },
```

and in the counting test replace `expect(stats.entries).toEqual({ total: 4, draft: 2, published: 1, archived: 1 });` with:

```ts
  expect(stats.entries).toEqual({
    total: 4,
    draft: 2,
    published: 1,
    archived: 1,
    byType: { [type.id]: 4 },
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- stats`
Expected: FAIL, `byType` missing from received object.

- [ ] **Step 3: Implement**

In `stats.service.ts`:
- Add `byType: Record<string, number>;` to `DashboardStats.entries`.
- Add a sixth item to the `Promise.all` array (after the status aggregate):

```ts
    ContentEntryModel.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: '$contentTypeId', count: { $sum: 1 } } },
    ]),
```

- Destructure it as `byTypeRows` (so the list reads `[byStatus, byTypeRows, contentTypes, media, sites, unread]`, keeping the array order in sync).
- Return `entries: { total: draft + published + archived, draft, published, archived, byType: Object.fromEntries(byTypeRows.map((r) => [String(r._id), r.count])) }`.

- [ ] **Step 4: Run tests and build**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/stats
git commit -m "feat(backend): add entry counts per content type to /stats"
```

---

## Task 2: Data router, content API and query hooks

All frontend paths below are relative to `packages/admin-dashboard/src` unless absolute.

**Files:**
- Modify: `types/index.ts`, `App.tsx`, `test/render.tsx`
- Create: `app/routes.tsx`, `lib/api-error.ts`, `features/content/content-api.ts`, `features/content/queries.ts`
- Generated: `components/ui/{popover,calendar,switch,select,textarea}.tsx`
- Test: `features/content/content-api.test.ts`, `lib/api-error.test.ts`

**Interfaces:**
- Produces:
  - Types: `EntryStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`; `EntryContentTypeRef { id; name; slug }`; `EntryListItem = Omit<ContentEntry, 'contentType'> & { title: string; contentType: EntryContentTypeRef | null }`; `DashboardStats.entries.byType`.
  - `content-api.ts`: `EntryListParams { contentTypeId?; status?; search?; sortBy?: 'updatedAt' | 'createdAt' | 'title'; sortOrder?: 'asc' | 'desc'; page?; limit? }`, `EntryWriteBody { data: Record<string, unknown>; status?: EntryStatus }`, `listEntries(params) => Promise<PaginatedResponse<EntryListItem>>`, `getEntry(id) => Promise<ContentEntry>`, `createEntry(typeId, body) => Promise<ContentEntry>`, `updateEntry(id, body: Partial<EntryWriteBody>) => Promise<ContentEntry>`, `publishEntry(id)`, `unpublishEntry(id)`, `archiveEntry(id)` (each `=> Promise<ContentEntry>`), `deleteEntry(id) => Promise<void>`, `listContentTypes() => Promise<ContentType[]>`, `getContentType(id) => Promise<ContentType>`, `entryTypeId(entry: ContentEntry) => string`.
  - `queries.ts`: `contentKeys`, `useEntryList(params, options?: { enabled?: boolean })`, `useEntry(id?)`, `useContentTypes()`, `useContentType(id?)`, `useEntryWrites() => { create({ typeId, body }), update({ id, body }), publish(id), unpublish(id), archive(id), remove(id) }`.
  - `apiErrorMessage(err: unknown) => string`.
  - `routes: RouteObject[]` from `@/app/routes`.
  - `renderRoutes(routes, { route? }) => RenderResult & { router, queryClient }` (includes `<Toaster />`).

- [ ] **Step 1: Add dependencies and shadcn components**

```bash
cd /Users/pavelflajsman/personalGit/thecms
pnpm --filter admin-dashboard add zod@^3.23.8
cd packages/admin-dashboard
mv package-lock.json /tmp/admin-package-lock.json.bak
pnpm dlx shadcn@latest add popover calendar switch select textarea --yes --overwrite
mv /tmp/admin-package-lock.json.bak package-lock.json
sed -i '' 's#from "cn"#from "@/lib/utils"#' src/components/ui/*.tsx
git -C ../.. diff --stat package.json
```

If the CLI added `cn` or `next-themes` to `package.json`, run `pnpm remove cn next-themes`. (The npm lockfile move works around the shadcn CLI picking npm; see Plan 1 ledger.)

- [ ] **Step 2: Extend `types/index.ts`**

Add to `ValidationRules`:

```ts
  integer?: boolean;
  minDate?: string;
  maxDate?: string;
  targetContentType?: string;
```

Change `ContentEntry.status` to `status: EntryStatus;` and add before `ContentEntry`:

```ts
export type EntryStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface EntryContentTypeRef {
  id: string;
  name: string;
  slug: string;
}
```

After `ContentEntry` add:

```ts
export type EntryListItem = Omit<ContentEntry, 'contentType'> & {
  title: string;
  contentType: EntryContentTypeRef | null;
};
```

In `DashboardStats.entries` add `byType: Record<string, number>;`.

- [ ] **Step 3: Write failing tests**

`lib/api-error.test.ts`:

```ts
import { AxiosError, AxiosHeaders } from 'axios'
import { apiErrorMessage } from './api-error'

function axiosError(status: number, data: unknown) {
  const headers = new AxiosHeaders()
  return new AxiosError('Request failed', 'ERR', { headers }, null, {
    status, statusText: '', headers, config: { headers }, data,
  })
}

describe('apiErrorMessage', () => {
  it('uses the server error message', () => {
    expect(apiErrorMessage(axiosError(400, { error: 'Validation failed: Title is required' })))
      .toBe('Validation failed: Title is required')
  })
  it('falls back for network errors and unknown values', () => {
    expect(apiErrorMessage(new AxiosError('Network Error'))).toBe('Could not reach the server. Check your connection and try again.')
    expect(apiErrorMessage('boom')).toBe('Something went wrong. Please try again.')
  })
})
```

`features/content/content-api.test.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- api`
Expected: FAIL, cannot resolve `./api-error` and `./content-api`.

- [ ] **Step 5: Implement `lib/api-error.ts`**

```ts
import { isAxiosError } from 'axios'

export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const serverMessage = (error.response?.data as { error?: unknown } | undefined)?.error
    if (typeof serverMessage === 'string' && serverMessage) return serverMessage
    if (!error.response) return 'Could not reach the server. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}
```

- [ ] **Step 6: Implement `features/content/content-api.ts`**

```ts
import apiClient from '@/lib/api'
import type { ApiResponse, ContentEntry, ContentType, EntryListItem, EntryStatus, PaginatedResponse } from '@/types'

export interface EntryListParams {
  contentTypeId?: string
  status?: EntryStatus
  search?: string
  sortBy?: 'updatedAt' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface EntryWriteBody {
  data: Record<string, unknown>
  status?: EntryStatus
}

function withoutEmpty<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>
}

export async function listEntries(params: EntryListParams): Promise<PaginatedResponse<EntryListItem>> {
  const res = await apiClient.get<PaginatedResponse<EntryListItem>>('/entries', { params: withoutEmpty(params) })
  return res.data
}

export async function getEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.get<ApiResponse<ContentEntry>>(`/entries/${id}`)).data.data
}

export async function createEntry(typeId: string, body: EntryWriteBody): Promise<ContentEntry> {
  return (await apiClient.post<ApiResponse<ContentEntry>>(`/content-types/${typeId}/entries`, body)).data.data
}

export async function updateEntry(id: string, body: Partial<EntryWriteBody>): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}`, body)).data.data
}

export async function publishEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}/publish`)).data.data
}

export async function unpublishEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}/unpublish`)).data.data
}

export async function archiveEntry(id: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${id}/archive`)).data.data
}

export async function deleteEntry(id: string): Promise<void> {
  await apiClient.delete(`/entries/${id}`)
}

export async function listContentTypes(): Promise<ContentType[]> {
  const res = await apiClient.get<PaginatedResponse<ContentType>>('/content-types', { params: { page: 1, limit: 100 } })
  return res.data.data
}

export async function getContentType(id: string): Promise<ContentType> {
  return (await apiClient.get<ApiResponse<ContentType>>(`/content-types/${id}`)).data.data
}

/** GET /entries/:id populates contentTypeId; create and update return it as a plain id. */
export function entryTypeId(entry: ContentEntry): string {
  const ref = entry.contentTypeId as unknown
  if (ref && typeof ref === 'object') {
    const obj = ref as { id?: string; _id?: string }
    return obj.id ?? obj._id ?? ''
  }
  return String(ref)
}
```

- [ ] **Step 7: Implement `features/content/queries.ts`**

```ts
import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import type { ContentEntry } from '@/types'
import {
  archiveEntry,
  createEntry,
  deleteEntry,
  getContentType,
  getEntry,
  listContentTypes,
  listEntries,
  publishEntry,
  unpublishEntry,
  updateEntry,
  type EntryListParams,
  type EntryWriteBody,
} from './content-api'

export const contentKeys = {
  all: ['content'] as const,
  lists: () => [...contentKeys.all, 'list'] as const,
  list: (params: EntryListParams) => [...contentKeys.lists(), params] as const,
  entry: (id: string) => [...contentKeys.all, 'entry', id] as const,
  types: () => [...contentKeys.all, 'types'] as const,
  type: (id: string) => [...contentKeys.all, 'type', id] as const,
}

export function useEntryList(params: EntryListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contentKeys.list(params),
    queryFn: () => listEntries(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useEntry(id?: string) {
  return useQuery({
    queryKey: contentKeys.entry(id ?? ''),
    queryFn: () => getEntry(id!),
    enabled: !!id,
  })
}

export function useContentTypes() {
  return useQuery({ queryKey: contentKeys.types(), queryFn: listContentTypes, staleTime: 60_000 })
}

export function useContentType(id?: string) {
  return useQuery({
    queryKey: contentKeys.type(id ?? ''),
    queryFn: () => getContentType(id!),
    enabled: !!id,
    staleTime: 60_000,
  })
}

/** Write helpers: every write refreshes lists and stats, and seeds the entry cache. */
export function useEntryWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    const done = async (promise: Promise<ContentEntry>) => {
      const entry = await promise
      queryClient.setQueryData(contentKeys.entry(entry.id), entry)
      refresh()
      return entry
    }
    return {
      create: ({ typeId, body }: { typeId: string; body: EntryWriteBody }) => done(createEntry(typeId, body)),
      update: ({ id, body }: { id: string; body: Partial<EntryWriteBody> }) => done(updateEntry(id, body)),
      publish: (id: string) => done(publishEntry(id)),
      unpublish: (id: string) => done(unpublishEntry(id)),
      archive: (id: string) => done(archiveEntry(id)),
      remove: async (id: string) => {
        await deleteEntry(id)
        queryClient.removeQueries({ queryKey: contentKeys.entry(id) })
        refresh()
      },
    }
  }, [queryClient])
}
```

- [ ] **Step 8: Move routes into `app/routes.tsx` and switch to a data router**

`app/routes.tsx`:

```tsx
import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { collectRoutes } from '@/modules/nav'
import { modules } from '@/modules/registry'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...collectRoutes(modules), { path: '*', element: <Navigate to="/" replace /> }],
  },
]
```

In `App.tsx`:
- Replace the router imports with `import { RouterProvider, createBrowserRouter } from 'react-router-dom'`.
- Remove the local `routes` constant, the `AppRoutes` component, and the imports of `AppShell`, `collectRoutes`, `modules` and `Navigate`/`useRoutes`/`RouteObject`.
- Add `import { routes } from './app/routes'` and, after the MSAL block, `const router = createBrowserRouter(routes)`.
- Replace `<BrowserRouter><AppRoutes /></BrowserRouter>` with `<RouterProvider router={router} />`.

- [ ] **Step 9: Add `renderRoutes` to `test/render.tsx`**

Add these imports: `import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'` and `import { Toaster } from '@/components/ui/sonner'`. Append:

```tsx
export function renderRoutes(routes: RouteObject[], { route = '/' }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { ...result, router, queryClient }
}
```

- [ ] **Step 10: Run tests, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build`
Expected: PASS (existing shell tests still pass), build succeeds.

```bash
git add -A packages/admin-dashboard pnpm-lock.yaml
git commit -m "feat(admin): content API, query hooks and data router"
```

---

## Task 3: Entry validation and payload rules

**Files:**
- Create: `lib/entry-schema.ts`
- Test: `lib/entry-schema.test.ts`

**Interfaces:**
- Produces: `EntryValues = Record<string, unknown>`, `UNTITLED = 'Untitled'`, `resolveTitleField(fields, titleField?) => string | undefined`, `isEmptyValue(field, value) => boolean`, `buildEntrySchema(fields) => z.ZodType<EntryValues>`, `validateEntry(fields, values) => Record<string, string>` (field name to first error message), `toEntryPayload(fields, values) => EntryValues`, `createInitialValues(fields, data?) => EntryValues`, `duplicateData(data, fields, titleField?) => EntryValues`.

- [ ] **Step 1: Write the failing tests `lib/entry-schema.test.ts`**

```ts
import type { Field } from '@/types'
import {
  buildEntrySchema,
  createInitialValues,
  duplicateData,
  resolveTitleField,
  toEntryPayload,
  validateEntry,
} from './entry-schema'

const f = (over: Partial<Field> & Pick<Field, 'name' | 'type'>): Field => ({ label: over.name, required: false, ...over })

describe('resolveTitleField', () => {
  const fields = [f({ name: 'cover', type: 'MEDIA' }), f({ name: 'headline', type: 'TEXT' }), f({ name: 'summary', type: 'TEXT' })]
  it('uses titleField when it is a TEXT field, else the first TEXT field', () => {
    expect(resolveTitleField(fields, 'summary')).toBe('summary')
    expect(resolveTitleField(fields, 'cover')).toBe('headline')
    expect(resolveTitleField(fields)).toBe('headline')
    expect(resolveTitleField([f({ name: 'n', type: 'NUMBER' })])).toBeUndefined()
  })
})

describe('validateEntry: required', () => {
  it.each([
    ['TEXT', '   '],
    ['TEXT', undefined],
    ['RICH_TEXT', '<p></p>'],
    ['NUMBER', undefined],
    ['NUMBER', Number.NaN],
    ['DATE', ''],
    ['MEDIA', ''],
    ['RELATION', []],
  ] as const)('%s with %j is missing', (type, value) => {
    const fields = [f({ name: 'x', label: 'X', type, required: true, validation: type === 'RELATION' ? { multiple: true } : undefined })]
    expect(validateEntry(fields, { x: value })).toEqual({ x: 'X is required' })
  })

  it('treats false and 0 as provided', () => {
    const fields = [f({ name: 'b', type: 'BOOLEAN', required: true }), f({ name: 'n', type: 'NUMBER', required: true })]
    expect(validateEntry(fields, { b: false, n: 0 })).toEqual({})
  })

  it('ignores empty optional fields', () => {
    const fields = [f({ name: 'n', type: 'NUMBER', validation: { min: 5 } })]
    expect(validateEntry(fields, { n: undefined })).toEqual({})
  })
})

describe('validateEntry: rules', () => {
  it('checks text length and pattern', () => {
    const fields = [f({ name: 't', label: 'Slug', type: 'TEXT', validation: { minLength: 3, maxLength: 5, pattern: '^[a-z]+$' } })]
    expect(validateEntry(fields, { t: 'ab' })).toEqual({ t: 'Slug must be at least 3 characters' })
    expect(validateEntry(fields, { t: 'abcdef' })).toEqual({ t: 'Slug must be at most 5 characters' })
    expect(validateEntry(fields, { t: 'ABC' })).toEqual({ t: 'Slug does not match the required pattern' })
    expect(validateEntry(fields, { t: 'abc' })).toEqual({})
  })

  it('does not throw on an invalid pattern and skips the pattern check', () => {
    const fields = [f({ name: 't', type: 'TEXT', validation: { pattern: '([' } })]
    expect(() => validateEntry(fields, { t: 'anything' })).not.toThrow()
    expect(validateEntry(fields, { t: 'anything' })).toEqual({})
  })

  it('checks numbers', () => {
    const fields = [f({ name: 'km', label: 'Distance', type: 'NUMBER', validation: { min: 1, max: 500, integer: true } })]
    expect(validateEntry(fields, { km: 0 })).toEqual({ km: 'Distance must be at least 1' })
    expect(validateEntry(fields, { km: 501 })).toEqual({ km: 'Distance must be at most 500' })
    expect(validateEntry(fields, { km: 1.5 })).toEqual({ km: 'Distance must be a whole number' })
    expect(validateEntry(fields, { km: '12' })).toEqual({ km: 'Distance must be a number' })
  })

  it('checks dates', () => {
    const fields = [f({ name: 'd', label: 'Date', type: 'DATE', validation: { minDate: '2026-01-01T00:00:00.000Z' } })]
    expect(validateEntry(fields, { d: 'not a date' })).toEqual({ d: 'Date must be a valid date' })
    expect(validateEntry(fields, { d: '2025-06-01T00:00:00.000Z' })).toEqual({ d: 'Date must be on or after 1 Jan 2026' })
    expect(validateEntry(fields, { d: '2026-06-01T00:00:00.000Z' })).toEqual({})
  })

  it('checks rich text max length', () => {
    const fields = [f({ name: 'b', label: 'Body', type: 'RICH_TEXT', validation: { maxLength: 10 } })]
    expect(validateEntry(fields, { b: '<p>way too long</p>' })).toEqual({ b: 'Body must be at most 10 characters' })
  })

  it('checks single and multiple references', () => {
    const fields = [f({ name: 'one', label: 'One', type: 'MEDIA' }), f({ name: 'many', label: 'Many', type: 'RELATION', validation: { multiple: true } })]
    expect(validateEntry(fields, { one: ['a'], many: 'a' })).toEqual({ one: 'One must be a single item', many: 'Many must be a list' })
  })

  it('is exposed as a zod schema', () => {
    const schema = buildEntrySchema([f({ name: 't', label: 'Title', type: 'TEXT', required: true })])
    const result = schema.safeParse({ t: '' })
    expect(result.success).toBe(false)
  })
})

describe('toEntryPayload', () => {
  const fields = [
    f({ name: 'title', type: 'TEXT' }),
    f({ name: 'km', type: 'NUMBER' }),
    f({ name: 'cover', type: 'MEDIA' }),
    f({ name: 'tags', type: 'RELATION', validation: { multiple: true } }),
    f({ name: 'body', type: 'RICH_TEXT' }),
    f({ name: 'done', type: 'BOOLEAN' }),
  ]
  it('omits empty optional values so the backend never receives empty strings', () => {
    expect(toEntryPayload(fields, { title: 'Hi', km: undefined, cover: '', tags: [], body: '<p></p>', done: false }))
      .toEqual({ title: 'Hi', done: false })
  })
  it('keeps zero and data from fields no longer in the model', () => {
    expect(toEntryPayload(fields, { km: 0, legacyField: 'keep me' })).toEqual({ km: 0, legacyField: 'keep me' })
  })
})

describe('createInitialValues and duplicateData', () => {
  const fields = [f({ name: 'title', type: 'TEXT' }), f({ name: 'featured', type: 'BOOLEAN', defaultValue: true })]
  it('applies defaults only for new entries', () => {
    expect(createInitialValues(fields)).toEqual({ featured: true })
    expect(createInitialValues(fields, { title: 'A' })).toEqual({ title: 'A' })
  })
  it('suffixes the title of a copy', () => {
    expect(duplicateData({ title: 'Trip', featured: true }, fields)).toEqual({ title: 'Trip (copy)', featured: true })
    expect(duplicateData({ featured: true }, fields)).toEqual({ featured: true })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- entry-schema`
Expected: FAIL, cannot resolve `./entry-schema`.

- [ ] **Step 3: Implement `lib/entry-schema.ts`**

```ts
import { z } from 'zod'
import { format } from 'date-fns'
import type { Field } from '@/types'

export type EntryValues = Record<string, unknown>

export const UNTITLED = 'Untitled'

const EMPTY_HTML = /^(\s|&nbsp;|<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>)*$/i

/** Same rule as the backend: explicit TEXT titleField, else the first TEXT field. */
export function resolveTitleField(fields: Pick<Field, 'name' | 'type'>[], titleField?: string): string | undefined {
  if (titleField && fields.some((f) => f.name === titleField && f.type === 'TEXT')) return titleField
  return fields.find((f) => f.type === 'TEXT')?.name
}

export function isEmptyValue(field: Pick<Field, 'type'>, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'number') return Number.isNaN(value)
  if (typeof value === 'string') return field.type === 'RICH_TEXT' ? EMPTY_HTML.test(value) : value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function safeRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

function formatDay(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy')
}

function fieldError(field: Field, value: unknown): string | null {
  const label = field.label || field.name
  const rules = field.validation ?? {}

  switch (field.type) {
    case 'TEXT': {
      if (typeof value !== 'string') return `${label} must be text`
      if (rules.minLength !== undefined && value.length < rules.minLength) return `${label} must be at least ${rules.minLength} characters`
      if (rules.maxLength !== undefined && value.length > rules.maxLength) return `${label} must be at most ${rules.maxLength} characters`
      const re = rules.pattern ? safeRegExp(rules.pattern) : null
      if (re && !re.test(value)) return `${label} does not match the required pattern`
      return null
    }
    case 'RICH_TEXT': {
      if (typeof value !== 'string') return `${label} must be text`
      if (rules.maxLength !== undefined && value.length > rules.maxLength) return `${label} must be at most ${rules.maxLength} characters`
      return null
    }
    case 'NUMBER': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number`
      if (rules.integer && !Number.isInteger(value)) return `${label} must be a whole number`
      if (rules.min !== undefined && value < rules.min) return `${label} must be at least ${rules.min}`
      if (rules.max !== undefined && value > rules.max) return `${label} must be at most ${rules.max}`
      return null
    }
    case 'DATE': {
      const time = typeof value === 'string' ? new Date(value).getTime() : Number.NaN
      if (Number.isNaN(time)) return `${label} must be a valid date`
      if (rules.minDate && time < new Date(rules.minDate).getTime()) return `${label} must be on or after ${formatDay(rules.minDate)}`
      if (rules.maxDate && time > new Date(rules.maxDate).getTime()) return `${label} must be on or before ${formatDay(rules.maxDate)}`
      return null
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : `${label} must be yes or no`
    case 'MEDIA':
    case 'RELATION': {
      if (rules.multiple) {
        return Array.isArray(value) && value.every((v) => typeof v === 'string') ? null : `${label} must be a list`
      }
      return typeof value === 'string' ? null : `${label} must be a single item`
    }
    default:
      return null
  }
}

/** Field name to its first error. Mirrors packages/backend/.../validation.helper.ts, plus: empty strings count as missing. */
export function validateEntry(fields: Field[], values: EntryValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = values[field.name]
    if (isEmptyValue(field, value)) {
      if (field.required) errors[field.name] = `${field.label || field.name} is required`
      continue
    }
    const error = fieldError(field, value)
    if (error) errors[field.name] = error
  }
  return errors
}

export function buildEntrySchema(fields: Field[]): z.ZodType<EntryValues> {
  return z.record(z.unknown()).superRefine((values, ctx) => {
    for (const [name, message] of Object.entries(validateEntry(fields, values))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message })
    }
  })
}

/** Data to send: empty model fields are omitted; data of fields no longer in the model is kept untouched. */
export function toEntryPayload(fields: Field[], values: EntryValues): EntryValues {
  const byName = new Map(fields.map((f) => [f.name, f]))
  const payload: EntryValues = {}
  for (const [name, value] of Object.entries(values)) {
    const field = byName.get(name)
    if (field && isEmptyValue(field, value)) continue
    payload[name] = value
  }
  return payload
}

export function createInitialValues(fields: Field[], data?: EntryValues): EntryValues {
  if (data) return { ...data }
  const values: EntryValues = {}
  for (const field of fields) {
    if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
      values[field.name] = field.defaultValue
    }
  }
  return values
}

export function duplicateData(data: EntryValues, fields: Field[], titleField?: string): EntryValues {
  const copy = { ...data }
  const key = resolveTitleField(fields, titleField)
  if (key && typeof copy[key] === 'string' && (copy[key] as string).trim()) copy[key] = `${copy[key]} (copy)`
  return copy
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/admin-dashboard && pnpm test -- entry-schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-dashboard/src/lib/entry-schema.ts packages/admin-dashboard/src/lib/entry-schema.test.ts
git commit -m "feat(admin): entry validation and payload rules"
```

---

## Task 4: Hooks and date formatting

**Files:**
- Create: `lib/hooks/useHotkey.ts`, `lib/hooks/useDebouncedValue.ts`, `lib/hooks/useAutosave.ts`, `lib/hooks/useUnsavedGuard.ts`
- Modify: `lib/format.ts`
- Test: `lib/hooks/hooks.test.tsx`, `lib/format.test.ts`

**Interfaces:**
- Produces:
  - `useHotkey(key: string, handler: (e: KeyboardEvent) => void, options?: { mod?: boolean; allowInInputs?: boolean })`, `isTypingTarget(target: EventTarget | null) => boolean`
  - `useDebouncedValue<T>(value: T, delay: number) => T`
  - `useAutosave({ enabled, isDirty, isValid, changeKey, save, delay? }) => { flush: () => void }` (default delay 2000 ms)
  - `useUnsavedGuard(when: boolean) => Blocker` (navigations whose `state.skipGuard === true` are never blocked; also sets `beforeunload`)
  - `formatRelative(date: string | Date, now?: Date) => string`, `formatAbsolute(date: string | Date) => string`

- [ ] **Step 1: Write failing tests**

Append to `lib/format.test.ts`:

```ts
import { formatAbsolute, formatRelative } from './format'

describe('formatRelative', () => {
  const now = new Date('2026-09-29T12:00:00Z')
  it.each([
    ['2026-09-29T11:59:40Z', 'just now'],
    ['2026-09-29T11:15:00Z', '45m ago'],
    ['2026-09-29T09:00:00Z', '3h ago'],
    ['2026-09-28T09:00:00Z', 'yesterday'],
    ['2026-09-25T12:00:00Z', '4 days ago'],
    ['2026-08-01T12:00:00Z', '1 Aug 2026'],
  ])('%s is %s', (date, expected) => {
    expect(formatRelative(date, now)).toBe(expected)
  })
  it('treats future timestamps (clock skew) as just now', () => {
    expect(formatRelative('2026-09-29T12:05:00Z', now)).toBe('just now')
  })
  it('formats absolute dates', () => {
    expect(formatAbsolute(new Date(2026, 8, 29, 14, 5))).toBe('29 Sep 2026, 14:05')
  })
})
```

`lib/hooks/hooks.test.tsx`:

```tsx
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router-dom'
import { useHotkey } from './useHotkey'
import { useDebouncedValue } from './useDebouncedValue'
import { useAutosave } from './useAutosave'
import { useUnsavedGuard } from './useUnsavedGuard'

describe('useHotkey', () => {
  function Harness({ onN, onSave }: { onN: () => void; onSave: () => void }) {
    useHotkey('n', onN)
    useHotkey('s', onSave, { mod: true, allowInInputs: true })
    return <input aria-label="field" />
  }

  it('ignores plain keys while typing but allows mod shortcuts', async () => {
    const onN = vi.fn()
    const onSave = vi.fn()
    render(<Harness onN={onN} onSave={onSave} />)
    await userEvent.keyboard('n')
    expect(onN).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByLabelText('field'))
    await userEvent.keyboard('n')
    expect(onN).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Meta>}s{/Meta}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not throw for key events without a key (autofill)', () => {
    render(<Harness onN={vi.fn()} onSave={vi.fn()} />)
    expect(() => window.dispatchEvent(new KeyboardEvent('keydown'))).not.toThrow()
  })
})

describe('useDebouncedValue', () => {
  it('updates after the delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    expect(result.current).toBe('a')
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('ab')
    vi.useRealTimers()
  })
})

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const base = { enabled: true, isDirty: true, isValid: true, changeKey: 'v1' }

  it('saves once, 2 seconds after the last change', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook((props) => useAutosave({ ...props, save }), { initialProps: base })
    act(() => { vi.advanceTimersByTime(1500) })
    rerender({ ...base, changeKey: 'v2' })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(save).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(500) })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['disabled (published)', { enabled: false }],
    ['invalid', { isValid: false }],
    ['clean', { isDirty: false }],
  ])('does not save when %s', (_label, over) => {
    const save = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosave({ ...base, ...over, save }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(save).not.toHaveBeenCalled()
  })

  it('flush saves immediately', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave({ ...base, save }))
    act(() => result.current.flush())
    expect(save).toHaveBeenCalledTimes(1)
  })
})

describe('useUnsavedGuard', () => {
  function Page({ dirty }: { dirty: boolean }) {
    const blocker = useUnsavedGuard(dirty)
    const navigate = useNavigate()
    return (
      <div>
        <Link to="/other">leave</Link>
        <button onClick={() => navigate('/redirected', { state: { skipGuard: true } })}>redirect</button>
        <span data-testid="state">{blocker.state}</span>
      </div>
    )
  }

  function setup(dirty: boolean) {
    const router = createMemoryRouter(
      [
        { path: '/', element: <Page dirty={dirty} /> },
        { path: '/other', element: <p>other</p> },
        { path: '/redirected', element: <p>redirected</p> },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  it('blocks navigation when dirty', async () => {
    const router = setup(true)
    await userEvent.click(screen.getByText('leave'))
    expect(screen.getByTestId('state')).toHaveTextContent('blocked')
    expect(router.state.location.pathname).toBe('/')
  })

  it('lets navigation through when clean', async () => {
    setup(false)
    await userEvent.click(screen.getByText('leave'))
    expect(screen.getByText('other')).toBeInTheDocument()
  })

  it('never blocks navigations marked skipGuard', async () => {
    setup(true)
    await userEvent.click(screen.getByText('redirect'))
    expect(screen.getByText('redirected')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- hooks format`
Expected: FAIL, missing modules and exports.

- [ ] **Step 3: Implement the hooks**

`lib/hooks/useHotkey.ts`:

```ts
import { useEffect, useRef } from 'react'

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

interface HotkeyOptions {
  /** Require ⌘ (macOS) or Ctrl. */
  mod?: boolean
  allowInInputs?: boolean
}

export function useHotkey(key: string, handler: (event: KeyboardEvent) => void, { mod = false, allowInInputs = false }: HotkeyOptions = {}) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typeof event.key !== 'string' || event.key.toLowerCase() !== key) return
      if (mod !== (event.metaKey || event.ctrlKey)) return
      if (!allowInInputs && isTypingTarget(event.target)) return
      handlerRef.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, mod, allowInInputs])
}
```

`lib/hooks/useDebouncedValue.ts`:

```ts
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

`lib/hooks/useAutosave.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react'

interface AutosaveOptions {
  /** False for published and archived entries. */
  enabled: boolean
  isDirty: boolean
  isValid: boolean
  /** Changes whenever the values change; restarts the timer. */
  changeKey: string
  save: () => Promise<unknown>
  delay?: number
}

export function useAutosave({ enabled, isDirty, isValid, changeKey, save, delay = 2000 }: AutosaveOptions) {
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  const ready = enabled && isDirty && isValid

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      void saveRef.current()
    }, delay)
    return () => clearTimeout(timer)
  }, [ready, changeKey, delay])

  const flush = useCallback(() => {
    if (ready) void saveRef.current()
  }, [ready])

  return { flush }
}
```

`lib/hooks/useUnsavedGuard.ts`:

```ts
import { useEffect } from 'react'
import { useBlocker, type Blocker } from 'react-router-dom'

/** Blocks in-app navigation and tab close while `when` is true. Navigations with state.skipGuard pass. */
export function useUnsavedGuard(when: boolean): Blocker {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const skip = (nextLocation.state as { skipGuard?: boolean } | null)?.skipGuard === true
    return when && !skip && currentLocation.pathname !== nextLocation.pathname
  })

  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  return blocker
}
```

- [ ] **Step 4: Implement the date helpers in `lib/format.ts`**

Add at the top `import { differenceInCalendarDays, format } from 'date-fns'` and append:

```ts
/** Short relative time for lists: "just now", "45m ago", "3h ago", "yesterday", "4 days ago", else "1 Aug 2026". */
export function formatRelative(date: string | Date, now: Date = new Date()): string {
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24 && differenceInCalendarDays(now, then) === 0) return `${hours}h ago`
  const days = differenceInCalendarDays(now, then)
  if (days <= 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return format(then, 'd MMM yyyy')
}

export function formatAbsolute(date: string | Date): string {
  return format(new Date(date), 'd MMM yyyy, HH:mm')
}
```

- [ ] **Step 5: Run tests**

Run: `cd packages/admin-dashboard && pnpm test -- hooks format`
Expected: PASS. (The "3h ago" case runs in the test machine's time zone; if it lands on a different calendar day in an extreme zone, run with `TZ=UTC pnpm test` and add `"test": "TZ=UTC vitest run"` to `package.json`.)

- [ ] **Step 6: Commit**

```bash
git add packages/admin-dashboard/src/lib
git commit -m "feat(admin): hotkey, debounce, autosave and unsaved-guard hooks; relative dates"
```

---

## Task 5: Content list

**Files:**
- Create: `components/common/ErrorState.tsx`, `components/common/Pager.tsx`, `components/common/DataList.tsx`
- Create: `features/content/list-params.ts`, `features/content/useEntryActions.ts`
- Create: `features/content/components/TypeChooser.tsx`, `NewEntryButton.tsx`, `ContentFilters.tsx`, `EntryRowMenu.tsx`
- Create: `features/content/pages/ContentListPage.tsx`
- Create: `features/content/test-fixtures.ts`
- Test: `features/content/list-params.test.ts`, `features/content/pages/ContentListPage.test.tsx`

**Interfaces:**
- Consumes: `content-api`, `queries` (Task 2), `formatRelative`, `formatAbsolute`, `useHotkey`, `useDebouncedValue` (Task 4), `duplicateData`, `resolveTitleField` (Task 3), `useStats` (Plan 1), `StatusPill`, `EmptyState`, `PageHeader`, `ConfirmDialog` (Plan 1).
- Produces:
  - `ContentListParams { type?: string; status?: EntryStatus; q?: string; sort: 'updatedAt' | 'createdAt' | 'title'; page: number }`, `PAGE_SIZE = 20`, `parseListParams(sp)`, `serializeListParams(p)`, `toEntryQuery(p) => EntryListParams`, `useContentListParams() => [params, update(patch)]` (any patch without `page` resets to page 1).
  - `useEntryActions() => { publish(e), unpublish(e), archive(e), restore(e), duplicate(e, type?), remove(e) }` where `e` is `EntryListItem`.
  - `<TypeChooser types onChoose? />`, `<ContentListPage />`, `<ErrorState message onRetry />`, `<Pager page limit total onPageChange />`, `<DataList rows columns rowKey mobileRow caption />`.

- [ ] **Step 1: Write the fixtures `features/content/test-fixtures.ts`**

```ts
import type { ContentEntry, ContentType, EntryListItem, PaginatedResponse } from '@/types'

export const tripType: ContentType = {
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Trip',
  slug: 'trip',
  fields: [
    { name: 'title', label: 'Title', type: 'TEXT', required: true },
    { name: 'distanceKm', label: 'Distance (km)', type: 'NUMBER', required: false },
    { name: 'published', label: 'Show on home page', type: 'BOOLEAN', required: false },
  ],
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
}

export const postType: ContentType = {
  ...tripType,
  id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  name: 'Blog post',
  slug: 'blog-post',
  fields: [{ name: 'title', label: 'Title', type: 'TEXT', required: true }],
}

export function makeEntry(over: Partial<ContentEntry> = {}): ContentEntry {
  return {
    id: 'e1',
    contentTypeId: tripType.id,
    data: { title: 'Přes Šumavu', distanceKm: 142 },
    title: 'Přes Šumavu',
    status: 'DRAFT',
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-29T10:00:00Z',
    ...over,
  }
}

export function makeListItem(over: Partial<EntryListItem> = {}): EntryListItem {
  const { contentType: _ignored, ...entry } = makeEntry()
  return { ...entry, title: 'Přes Šumavu', contentType: { id: tripType.id, name: 'Trip', slug: 'trip' }, ...over }
}

export function page(items: EntryListItem[], total = items.length, pageNo = 1, limit = 20): PaginatedResponse<EntryListItem> {
  return { success: true, data: items, pagination: { page: pageNo, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } }
}
```

- [ ] **Step 2: Write failing tests**

`features/content/list-params.test.ts`:

```ts
import { parseListParams, serializeListParams, toEntryQuery } from './list-params'

describe('list params', () => {
  it('parses valid params', () => {
    const p = parseListParams(new URLSearchParams('type=aaaaaaaaaaaaaaaaaaaaaaaa&status=DRAFT&q=sum&sort=title&page=2'))
    expect(p).toEqual({ type: 'aaaaaaaaaaaaaaaaaaaaaaaa', status: 'DRAFT', q: 'sum', sort: 'title', page: 2 })
  })

  it('ignores tampered values', () => {
    expect(parseListParams(new URLSearchParams('type=not-an-id&status=SECRET&sort=data.x&page=abc'))).toEqual({ sort: 'updatedAt', page: 1 })
    expect(parseListParams(new URLSearchParams('page=-3')).page).toBe(1)
  })

  it('serializes without defaults', () => {
    expect(serializeListParams({ sort: 'updatedAt', page: 1 }).toString()).toBe('')
    expect(serializeListParams({ q: 'x', sort: 'title', page: 3 }).toString()).toBe('q=x&sort=title&page=3')
  })

  it('maps to the API query, title ascending', () => {
    expect(toEntryQuery({ sort: 'title', page: 2, q: 'a' })).toEqual({ search: 'a', sortBy: 'title', sortOrder: 'asc', page: 2, limit: 20, contentTypeId: undefined, status: undefined })
    expect(toEntryQuery({ sort: 'updatedAt', page: 1 }).sortOrder).toBe('desc')
  })
})
```

`features/content/pages/ContentListPage.test.tsx`:

```tsx
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import * as api from '../content-api'
import { ContentListPage } from './ContentListPage'
import { makeListItem, page, postType, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content-api')>()
  return {
    ...actual,
    listEntries: vi.fn(),
    listContentTypes: vi.fn(),
    updateEntry: vi.fn(),
    archiveEntry: vi.fn(),
    deleteEntry: vi.fn(),
  }
})
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({ data: { entries: { byType: { [tripType.id]: 8, [postType.id]: 12 } } } }),
  useUnreadCount: () => 0,
}))

const routes = [
  { path: '/content', element: <ContentListPage /> },
  { path: '/content/:id', element: <p>editor</p> },
  { path: '/models', element: <p>models</p> },
]

beforeEach(() => {
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType, postType])
})

describe('ContentListPage', () => {
  it('lists entries across types with titles, type, status and pager', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem(), makeListItem({ id: 'e2', title: 'Jak jsem stavěl CMS', status: 'PUBLISHED', contentType: { id: postType.id, name: 'Blog post', slug: 'blog-post' } })], 23))
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    expect(within(table).getByRole('link', { name: 'Přes Šumavu' })).toHaveAttribute('href', '/content/e1')
    expect(within(table).getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('1–20 of 23')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Trip\s*8/ })).toBeInTheDocument()
  })

  it('filters by type and resets the page', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem()], 40))
    const { router } = renderRoutes(routes, { route: '/content?page=2' })
    await userEvent.click(await screen.findByRole('button', { name: /Trip\s*8/ }))
    await waitFor(() => expect(router.state.location.search).toBe(`?type=${tripType.id}`))
    expect(api.listEntries).toHaveBeenLastCalledWith(expect.objectContaining({ contentTypeId: tripType.id, page: 1 }))
  })

  it('debounces search into the URL', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem()]))
    const { router } = renderRoutes(routes, { route: '/content' })
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search entries' }), 'šum')
    await waitFor(() => expect(router.state.location.search).toBe('?q=%C5%A1um'))
  })

  it('moves to the last page when the URL page is past the end', async () => {
    vi.mocked(api.listEntries).mockImplementation(async (p) => (p.page === 9 ? page([], 23, 9) : page([makeListItem()], 23, p.page)))
    const { router } = renderRoutes(routes, { route: '/content?page=9' })
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'))
  })

  it('shows a clear-filters state when filters match nothing', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([]))
    const { router } = renderRoutes(routes, { route: '/content?q=zzz' })
    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('asks for a content model first on an empty install', async () => {
    vi.mocked(api.listContentTypes).mockResolvedValue([])
    vi.mocked(api.listEntries).mockResolvedValue(page([]))
    renderRoutes(routes, { route: '/content' })
    expect(await screen.findByRole('link', { name: 'Create a content model' })).toHaveAttribute('href', '/models')
  })

  it('shows an error with retry', async () => {
    vi.mocked(api.listEntries).mockRejectedValueOnce(new Error('down')).mockResolvedValue(page([makeListItem()]))
    renderRoutes(routes, { route: '/content' })
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: 'Entries' })).toBeInTheDocument()
  })

  it('archives from the row menu with undo', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem({ status: 'PUBLISHED' })]))
    vi.mocked(api.archiveEntry).mockResolvedValue({ ...makeListItem(), status: 'ARCHIVED' } as never)
    vi.mocked(api.updateEntry).mockResolvedValue({ ...makeListItem(), status: 'PUBLISHED' } as never)
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Přes Šumavu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    expect(api.archiveEntry).toHaveBeenCalledWith('e1')
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(api.updateEntry).toHaveBeenCalledWith('e1', { status: 'PUBLISHED' })
  })

  it('confirms before deleting', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem()]))
    vi.mocked(api.deleteEntry).mockResolvedValue()
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Přes Šumavu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(api.deleteEntry).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(api.deleteEntry).toHaveBeenCalledWith('e1')
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- list-params ContentListPage`
Expected: FAIL, missing modules.

- [ ] **Step 4: Implement `features/content/list-params.ts`**

```ts
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { EntryStatus } from '@/types'
import type { EntryListParams } from './content-api'

export type ContentSort = 'updatedAt' | 'createdAt' | 'title'

export interface ContentListParams {
  type?: string
  status?: EntryStatus
  q?: string
  sort: ContentSort
  page: number
}

export const PAGE_SIZE = 20
const STATUSES: EntryStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const SORTS: ContentSort[] = ['updatedAt', 'createdAt', 'title']
const OBJECT_ID = /^[a-f0-9]{24}$/i

export function parseListParams(sp: URLSearchParams): ContentListParams {
  const params: ContentListParams = { sort: 'updatedAt', page: 1 }
  const type = sp.get('type')
  if (type && OBJECT_ID.test(type)) params.type = type
  const status = sp.get('status') as EntryStatus | null
  if (status && STATUSES.includes(status)) params.status = status
  const q = sp.get('q')?.trim()
  if (q) params.q = q.slice(0, 100)
  const sort = sp.get('sort') as ContentSort | null
  if (sort && SORTS.includes(sort)) params.sort = sort
  const pageNo = Number(sp.get('page'))
  if (Number.isInteger(pageNo) && pageNo > 1) params.page = pageNo
  return params
}

export function serializeListParams(p: ContentListParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (p.type) sp.set('type', p.type)
  if (p.status) sp.set('status', p.status)
  if (p.q) sp.set('q', p.q)
  if (p.sort !== 'updatedAt') sp.set('sort', p.sort)
  if (p.page > 1) sp.set('page', String(p.page))
  return sp
}

export function toEntryQuery(p: ContentListParams): EntryListParams {
  return {
    contentTypeId: p.type,
    status: p.status,
    search: p.q,
    sortBy: p.sort,
    sortOrder: p.sort === 'title' ? 'asc' : 'desc',
    page: p.page,
    limit: PAGE_SIZE,
  }
}

export function useContentListParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseListParams(searchParams), [searchParams])
  const update = useCallback(
    (patch: Partial<ContentListParams>) => {
      const next: ContentListParams = { ...params, ...patch, page: patch.page ?? 1 }
      setSearchParams(serializeListParams(next), { replace: true })
    },
    [params, setSearchParams],
  )
  return [params, update] as const
}
```

- [ ] **Step 5: Implement the shared components**

`components/common/ErrorState.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border bg-card px-6 py-10 text-center">
      <AlertTriangle aria-hidden className="mb-3 size-8 text-destructive" />
      <p className="max-w-sm text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
```

`components/common/Pager.tsx`:

```tsx
import { Button } from '@/components/ui/button'

interface PagerProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
}

export function Pager({ page, limit, total, onPageChange }: PagerProps) {
  if (total === 0) return null
  const last = Math.max(1, Math.ceil(total / limit))
  const from = Math.min((page - 1) * limit + 1, total)
  const to = Math.min(page * limit, total)
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= last} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  )
}
```

`components/common/DataList.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DataColumn<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataListProps<T> {
  rows: T[]
  columns: DataColumn<T>[]
  rowKey: (row: T) => string
  /** Card rendered below the md breakpoint. */
  mobileRow: (row: T) => ReactNode
  /** Accessible name of the table. */
  caption: string
}

/** A table on desktop, a list of cards on mobile. */
export function DataList<T>({ rows, columns, rowKey, mobileRow, caption }: DataListProps<T>) {
  return (
    <>
      <table aria-label={caption} className="hidden w-full border-separate border-spacing-y-1.5 text-sm md:table">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn('px-3 pb-1 font-medium', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="bg-card shadow-[0_0_0_1px_var(--border)] [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg">
              {columns.map((c) => (
                <td key={c.id} className={cn('px-3 py-2.5 align-middle', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={caption} className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border bg-card p-3">
            {mobileRow(row)}
          </li>
        ))}
      </ul>
    </>
  )
}
```

- [ ] **Step 6: Implement `features/content/useEntryActions.ts`**

```ts
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { duplicateData } from '@/lib/entry-schema'
import type { ContentType, EntryListItem } from '@/types'
import { useEntryWrites } from './queries'

export function useEntryActions() {
  const writes = useEntryWrites()
  const navigate = useNavigate()

  async function run(action: () => Promise<unknown>, message: string, undo?: () => Promise<unknown>) {
    try {
      await action()
      toast.success(message, undo ? {
        action: {
          label: 'Undo',
          onClick: () => {
            undo().then(() => toast.success('Undone')).catch((e) => toast.error(apiErrorMessage(e)))
          },
        },
      } : undefined)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return {
    publish: (e: EntryListItem) => run(() => writes.publish(e.id), `Published “${e.title}”`),
    unpublish: (e: EntryListItem) => run(() => writes.unpublish(e.id), `Unpublished “${e.title}”`, () => writes.publish(e.id)),
    archive: (e: EntryListItem) =>
      run(() => writes.archive(e.id), `Archived “${e.title}”`, () => writes.update({ id: e.id, body: { status: e.status } })),
    restore: (e: EntryListItem) => run(() => writes.update({ id: e.id, body: { status: 'DRAFT' } }), `Restored “${e.title}” to draft`),
    duplicate: async (e: EntryListItem, type?: ContentType) => {
      if (!e.contentType) return
      try {
        const data = type ? duplicateData(e.data, type.fields, type.titleField) : { ...e.data }
        const copy = await writes.create({ typeId: e.contentType.id, body: { data, status: 'DRAFT' } })
        toast.success(`Duplicated “${e.title}”`)
        navigate(`/content/${copy.id}`)
      } catch (error) {
        toast.error(apiErrorMessage(error))
      }
    },
    remove: (e: EntryListItem) => run(() => writes.remove(e.id), `Deleted “${e.title}”`),
  }
}
```

- [ ] **Step 7: Implement the list components**

`features/content/components/TypeChooser.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Boxes } from 'lucide-react'
import type { ContentType } from '@/types'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

interface TypeChooserProps {
  types: ContentType[]
  onChoose?: () => void
}

export function TypeChooser({ types, onChoose }: TypeChooserProps) {
  if (types.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="Create a content model first"
        description="Content models define the fields your entries have."
        action={<Button asChild><Link to="/models">Create a content model</Link></Button>}
      />
    )
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {types.map((t) => (
        <li key={t.id}>
          <Link
            to={`/content/new?type=${t.id}`}
            onClick={onChoose}
            className="flex flex-col rounded-lg border bg-card p-3 hover:bg-accent focus-visible:outline-2"
          >
            <span className="font-serif text-base font-semibold">{t.name}</span>
            <span className="text-xs text-muted-foreground">
              {t.description || `${t.fields.length} field${t.fields.length === 1 ? '' : 's'}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

`features/content/components/NewEntryButton.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus } from 'lucide-react'
import type { ContentType } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TypeChooser } from './TypeChooser'

export function NewEntryButton({ types }: { types: ContentType[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex">
      <Button className="rounded-r-none" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New entry
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="rounded-l-none border-l border-primary-foreground/30 px-2" aria-label="New entry of type">
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {types.map((t) => (
            <DropdownMenuItem key={t.id} asChild>
              <Link to={`/content/new?type=${t.id}`}>{t.name}</Link>
            </DropdownMenuItem>
          ))}
          {types.length === 0 && (
            <DropdownMenuItem asChild>
              <Link to="/models">Create a content model</Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">New entry</DialogTitle>
            <DialogDescription>Choose what you want to create.</DialogDescription>
          </DialogHeader>
          <TypeChooser types={types} onChoose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

`features/content/components/ContentFilters.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { ContentType, EntryStatus } from '@/types'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ContentListParams, ContentSort } from '../list-params'

interface ContentFiltersProps {
  types: ContentType[]
  counts?: Record<string, number>
  params: ContentListParams
  update: (patch: Partial<ContentListParams>) => void
}

const ANY = 'any'

export function ContentFilters({ types, counts, params, update }: ContentFiltersProps) {
  const [search, setSearch] = useState(params.q ?? '')
  const debounced = useDebouncedValue(search, 300)

  useEffect(() => {
    const next = debounced.trim() || undefined
    if (next !== params.q) update({ q: next })
    // Only react to the debounced text; params.q changes elsewhere are mirrored below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search entries"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={params.status ?? ANY} onValueChange={(v) => update({ status: v === ANY ? undefined : (v as EntryStatus) })}>
            <SelectTrigger aria-label="Status" className="w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={params.sort} onValueChange={(v) => update({ sort: v as ContentSort })}>
            <SelectTrigger aria-label="Sort" className="w-40 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Last edited</SelectItem>
              <SelectItem value="createdAt">Created</SelectItem>
              <SelectItem value="title">Title A to Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Content model">
        <Chip active={!params.type} onClick={() => update({ type: undefined })}>
          All types
        </Chip>
        {types.map((t) => (
          <Chip key={t.id} active={params.type === t.id} onClick={() => update({ type: t.id })}>
            {t.name}
            {counts?.[t.id] !== undefined && <span className="ml-1.5 text-xs opacity-70">{counts[t.id]}</span>}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}
```

`features/content/components/EntryRowMenu.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import type { ContentType, EntryListItem } from '@/types'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEntryActions } from '../useEntryActions'

export function EntryRowMenu({ entry, type }: { entry: EntryListItem; type?: ContentType }) {
  const actions = useEntryActions()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${entry.title}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link to={`/content/${entry.id}`}>Open</Link>
          </DropdownMenuItem>
          {entry.status === 'DRAFT' && <DropdownMenuItem onSelect={() => actions.publish(entry)}>Publish</DropdownMenuItem>}
          {entry.status === 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.unpublish(entry)}>Unpublish</DropdownMenuItem>}
          {entry.status === 'ARCHIVED' ? (
            <DropdownMenuItem onSelect={() => actions.restore(entry)}>Restore to draft</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => actions.archive(entry)}>Archive</DropdownMenuItem>
          )}
          {entry.contentType && <DropdownMenuItem onSelect={() => actions.duplicate(entry, type)}>Duplicate</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${entry.title}”?`}
        description="This permanently removes the entry. Sites that show it will stop receiving it."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void actions.remove(entry)
        }}
      />
    </>
  )
}
```

If the generated `DropdownMenuItem` has no `variant` prop, replace `variant="destructive"` with `className="text-destructive focus:text-destructive"`.

- [ ] **Step 8: Implement `features/content/pages/ContentListPage.tsx`**

```tsx
import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, SearchX } from 'lucide-react'
import type { EntryListItem } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Pager } from '@/components/common/Pager'
import { DataList, type DataColumn } from '@/components/common/DataList'
import { StatusPill } from '@/components/common/StatusPill'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useStats } from '@/lib/queries/stats'
import { useHotkey } from '@/lib/hooks/useHotkey'
import { formatAbsolute, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { UNTITLED } from '@/lib/entry-schema'
import { useContentTypes, useEntryList } from '../queries'
import { PAGE_SIZE, toEntryQuery, useContentListParams } from '../list-params'
import { ContentFilters } from '../components/ContentFilters'
import { NewEntryButton } from '../components/NewEntryButton'
import { EntryRowMenu } from '../components/EntryRowMenu'
import { TypeChooser } from '../components/TypeChooser'

export function ContentListPage() {
  const navigate = useNavigate()
  const [params, update] = useContentListParams()
  const typesQuery = useContentTypes()
  const stats = useStats()
  const list = useEntryList(toEntryQuery(params))
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data])
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types])
  const filtersActive = !!(params.type || params.status || params.q)

  useHotkey('n', () => navigate(params.type ? `/content/new?type=${params.type}` : '/content/new'))

  // A page past the end (old link, deleted entries) jumps to the last page instead of looking empty.
  const pagination = list.data?.pagination
  const rows = list.data?.data
  useEffect(() => {
    if (rows && rows.length === 0 && pagination && pagination.total > 0 && params.page > pagination.totalPages) {
      update({ page: pagination.totalPages })
    }
  }, [rows, pagination, params.page, update])

  const columns: DataColumn<EntryListItem>[] = [
    { id: 'title', header: 'Title', cell: (e) => <TitleLink entry={e} /> },
    { id: 'type', header: 'Model', cell: (e) => <TypeLabel entry={e} />, className: 'w-40' },
    { id: 'edited', header: 'Edited', cell: (e) => <Edited date={e.updatedAt} />, className: 'w-32 whitespace-nowrap' },
    { id: 'status', header: 'Status', cell: (e) => <StatusPill status={e.status} />, className: 'w-28' },
    { id: 'actions', header: '', cell: (e) => <EntryRowMenu entry={e} type={e.contentType ? typeById.get(e.contentType.id) : undefined} />, className: 'w-12 text-right' },
  ]

  let body: React.ReactNode
  if (typesQuery.isSuccess && types.length === 0) {
    body = <TypeChooser types={[]} />
  } else if (list.isPending) {
    body = <ListSkeleton />
  } else if (list.isError) {
    body = <ErrorState message="Could not load content." onRetry={() => void list.refetch()} />
  } else if (list.data.data.length === 0 && filtersActive) {
    body = (
      <EmptyState
        icon={SearchX}
        title="No entries match these filters"
        action={<Button variant="outline" onClick={() => update({ type: undefined, status: undefined, q: undefined })}>Clear filters</Button>}
      />
    )
  } else if (list.data.data.length === 0) {
    body = (
      <EmptyState
        icon={FileText}
        title="No entries yet"
        description="Create your first entry to see it here."
        action={<Button asChild><Link to="/content/new">New entry</Link></Button>}
      />
    )
  } else {
    body = (
      <div className={cn(list.isPlaceholderData && 'opacity-60 transition-opacity')}>
        <DataList
          caption="Entries"
          rows={list.data.data}
          columns={columns}
          rowKey={(e) => e.id}
          mobileRow={(e) => (
            <div className="flex items-start gap-3">
              <TypeBadge entry={e} />
              <div className="min-w-0 flex-1">
                <TitleLink entry={e} />
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.contentType?.name ?? 'Deleted model'} · <Edited date={e.updatedAt} />
                </p>
              </div>
              <StatusPill status={e.status} />
              <EntryRowMenu entry={e} type={e.contentType ? typeById.get(e.contentType.id) : undefined} />
            </div>
          )}
        />
        <Pager page={params.page} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={(p) => update({ page: p })} />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Content" description="Everything you publish, across all content models." actions={<NewEntryButton types={types} />} />
      {types.length > 0 && <ContentFilters types={types} counts={stats.data?.entries.byType} params={params} update={update} />}
      {body}
    </>
  )
}

function TitleLink({ entry }: { entry: EntryListItem }) {
  const untitled = entry.title === UNTITLED
  return (
    <Link
      to={`/content/${entry.id}`}
      className={cn('font-serif text-base font-semibold hover:underline', untitled && 'italic text-muted-foreground')}
    >
      {entry.title}
    </Link>
  )
}

function TypeLabel({ entry }: { entry: EntryListItem }) {
  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <TypeBadge entry={entry} />
      {entry.contentType?.name ?? 'Deleted model'}
    </span>
  )
}

function TypeBadge({ entry }: { entry: EntryListItem }) {
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary font-serif text-sm font-semibold text-secondary-foreground">
      {(entry.contentType?.name ?? '?').charAt(0).toUpperCase()}
    </span>
  )
}

function Edited({ date }: { date: string }) {
  return <time dateTime={date} title={formatAbsolute(date)}>{formatRelative(date)}</time>
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading entries" className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

```

- [ ] **Step 9: Run tests**

Run: `cd packages/admin-dashboard && pnpm test -- list-params ContentListPage`
Expected: PASS. Radix Select and DropdownMenu need pointer APIs; if a test reports `releasePointerCapture` missing, add `Element.prototype.releasePointerCapture ??= () => {}` to `src/test/setup.ts`.

- [ ] **Step 10: Commit**

```bash
git add packages/admin-dashboard/src
git commit -m "feat(admin): cross-type content list with filters, row actions and undo"
```

---

## Task 6: Entry editor, routes and legacy removal

**Files:**
- Create: `features/content/editor/editor-actions.ts`, `useEntryForm.ts`, `EntryEditor.tsx`, `EditorTopBar.tsx`, `EditorSidePanel.tsx`, `UnsavedChangesDialog.tsx`
- Create: `features/content/editor/fields/FieldShell.tsx`, `BasicFields.tsx`, `DateField.tsx`, `RelationField.tsx`, `LegacyFields.tsx`, `FieldControl.tsx`
- Create: `features/content/pages/EntryEditorPage.tsx`, `features/content/LegacyRedirects.tsx`
- Modify: `modules/registry.tsx`
- Delete: `pages/ContentEntries/ContentEntriesList.tsx`, `pages/ContentEntries/ContentEntryForm.tsx`, `components/DynamicFormGenerator.tsx`, `services/contentEntries.ts`
- Test: `features/content/editor/editor-actions.test.ts`, `features/content/editor/useEntryForm.test.tsx`, `features/content/pages/EntryEditorPage.test.tsx`, `features/content/LegacyRedirects.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2 to 5.
- Produces:
  - `getEditorActions({ isNew, status, isDirty }) => EditorActionSet` where `EditorAction = 'saveDraft' | 'publish' | 'publishChanges' | 'discard' | 'unpublish' | 'archive' | 'restore' | 'delete' | 'duplicate'` and `EditorActionSet { primary: { action; label; disabled? }; secondary?: { action; label }; menu: { action; label; destructive? }[] }`.
  - `useEntryForm(fields, initial) => { values, setValue(name, value), touch(name), showAllErrors(), errors, visibleErrors, isValid, isDirty, changeKey, baseline, markSaved(values), reset(values) }`.
  - `stableStringify(value) => string`.
  - Routes: `/content/:id` (`id === 'new'` for a new entry, with `?type=`), legacy `/entries`, `/entries/new`, `/entries/:id/edit` redirect.
  - `createActions[0].to === '/content/new'`.

- [ ] **Step 1: Write failing unit tests**

`features/content/editor/editor-actions.test.ts`:

```ts
import { getEditorActions } from './editor-actions'

describe('getEditorActions', () => {
  it('new entry: publish or save draft', () => {
    const a = getEditorActions({ isNew: true, status: 'DRAFT', isDirty: false })
    expect(a.primary).toEqual({ action: 'publish', label: 'Publish' })
    expect(a.secondary).toEqual({ action: 'saveDraft', label: 'Save draft' })
    expect(a.menu).toEqual([])
  })

  it('draft: publish, save draft, and archive/delete in the menu', () => {
    const a = getEditorActions({ isNew: false, status: 'DRAFT', isDirty: true })
    expect(a.primary.action).toBe('publish')
    expect(a.secondary?.action).toBe('saveDraft')
    expect(a.menu.map((m) => m.action)).toEqual(['duplicate', 'archive', 'delete'])
  })

  it('published and clean: nothing to save', () => {
    const a = getEditorActions({ isNew: false, status: 'PUBLISHED', isDirty: false })
    expect(a.primary).toEqual({ action: 'publishChanges', label: 'Published', disabled: true })
    expect(a.secondary).toBeUndefined()
    expect(a.menu.map((m) => m.action)).toEqual(['duplicate', 'unpublish', 'archive', 'delete'])
  })

  it('published with changes: publish changes or discard', () => {
    const a = getEditorActions({ isNew: false, status: 'PUBLISHED', isDirty: true })
    expect(a.primary).toEqual({ action: 'publishChanges', label: 'Publish changes' })
    expect(a.secondary).toEqual({ action: 'discard', label: 'Discard changes' })
  })

  it('archived: restore to draft', () => {
    const a = getEditorActions({ isNew: false, status: 'ARCHIVED', isDirty: false })
    expect(a.primary).toEqual({ action: 'restore', label: 'Restore to draft' })
    expect(a.menu.map((m) => m.action)).toEqual(['duplicate', 'delete'])
  })
})
```

`features/content/editor/useEntryForm.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import type { Field } from '@/types'
import { stableStringify, useEntryForm } from './useEntryForm'

const fields: Field[] = [
  { name: 'title', label: 'Title', type: 'TEXT', required: true },
  { name: 'km', label: 'Distance', type: 'NUMBER', required: false },
]

it('stableStringify ignores key order', () => {
  expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }))
})

describe('useEntryForm', () => {
  it('tracks dirty state against the saved baseline', () => {
    const { result } = renderHook(() => useEntryForm(fields, { title: 'A' }))
    expect(result.current.isDirty).toBe(false)
    act(() => result.current.setValue('title', 'B'))
    expect(result.current.isDirty).toBe(true)
    act(() => result.current.markSaved({ title: 'B' }))
    expect(result.current.isDirty).toBe(false)
  })

  it('keeps later edits dirty when an older snapshot is marked saved', () => {
    const { result } = renderHook(() => useEntryForm(fields, { title: 'A' }))
    act(() => result.current.setValue('title', 'B'))
    const snapshot = result.current.values
    act(() => result.current.setValue('title', 'BC'))
    act(() => result.current.markSaved(snapshot))
    expect(result.current.isDirty).toBe(true)
  })

  it('shows errors only for touched fields until all are revealed', () => {
    const { result } = renderHook(() => useEntryForm(fields, {}))
    expect(result.current.errors).toEqual({ title: 'Title is required' })
    expect(result.current.visibleErrors).toEqual({})
    act(() => result.current.touch('title'))
    expect(result.current.visibleErrors).toEqual({ title: 'Title is required' })
    act(() => result.current.showAllErrors())
    expect(result.current.isValid).toBe(false)
  })

  it('reset restores values and baseline', () => {
    const { result } = renderHook(() => useEntryForm(fields, { title: 'A' }))
    act(() => result.current.setValue('title', 'B'))
    act(() => result.current.reset(result.current.baseline))
    expect(result.current.values).toEqual({ title: 'A' })
    expect(result.current.isDirty).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- editor-actions useEntryForm`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `editor-actions.ts` and `useEntryForm.ts`**

`features/content/editor/editor-actions.ts`:

```ts
import type { EntryStatus } from '@/types'

export type EditorAction = 'saveDraft' | 'publish' | 'publishChanges' | 'discard' | 'unpublish' | 'archive' | 'restore' | 'delete' | 'duplicate'

export interface EditorActionSet {
  primary: { action: EditorAction; label: string; disabled?: boolean }
  secondary?: { action: EditorAction; label: string }
  menu: { action: EditorAction; label: string; destructive?: boolean }[]
}

const DUPLICATE = { action: 'duplicate', label: 'Duplicate' } as const
const UNPUBLISH = { action: 'unpublish', label: 'Unpublish' } as const
const ARCHIVE = { action: 'archive', label: 'Archive' } as const
const DELETE = { action: 'delete', label: 'Delete', destructive: true } as const

export function getEditorActions({ isNew, status, isDirty }: { isNew: boolean; status: EntryStatus; isDirty: boolean }): EditorActionSet {
  if (isNew) {
    return { primary: { action: 'publish', label: 'Publish' }, secondary: { action: 'saveDraft', label: 'Save draft' }, menu: [] }
  }
  switch (status) {
    case 'PUBLISHED':
      return isDirty
        ? {
            primary: { action: 'publishChanges', label: 'Publish changes' },
            secondary: { action: 'discard', label: 'Discard changes' },
            menu: [DUPLICATE, UNPUBLISH, ARCHIVE, DELETE],
          }
        : { primary: { action: 'publishChanges', label: 'Published', disabled: true }, menu: [DUPLICATE, UNPUBLISH, ARCHIVE, DELETE] }
    case 'ARCHIVED':
      return { primary: { action: 'restore', label: 'Restore to draft' }, menu: [DUPLICATE, DELETE] }
    case 'DRAFT':
    default:
      return {
        primary: { action: 'publish', label: 'Publish' },
        secondary: { action: 'saveDraft', label: 'Save draft' },
        menu: [DUPLICATE, ARCHIVE, DELETE],
      }
  }
}
```

`features/content/editor/useEntryForm.ts`:

```ts
import { useCallback, useMemo, useState } from 'react'
import type { Field } from '@/types'
import { validateEntry, type EntryValues } from '@/lib/entry-schema'

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

export function useEntryForm(fields: Field[], initial: EntryValues) {
  const [values, setValues] = useState<EntryValues>(initial)
  const [baseline, setBaseline] = useState<EntryValues>(initial)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [revealAll, setRevealAll] = useState(false)

  const errors = useMemo(() => validateEntry(fields, values), [fields, values])
  const changeKey = useMemo(() => stableStringify(values), [values])
  const isDirty = useMemo(() => changeKey !== stableStringify(baseline), [changeKey, baseline])
  const visibleErrors = useMemo(
    () => (revealAll ? errors : Object.fromEntries(Object.entries(errors).filter(([name]) => touched[name]))),
    [errors, touched, revealAll],
  )

  const setValue = useCallback((name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value })), [])
  const touch = useCallback((name: string) => setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true })), [])
  const showAllErrors = useCallback(() => setRevealAll(true), [])
  const markSaved = useCallback((saved: EntryValues) => setBaseline(saved), [])
  const reset = useCallback((next: EntryValues) => {
    setValues(next)
    setBaseline(next)
    setTouched({})
    setRevealAll(false)
  }, [])

  return {
    values,
    baseline,
    errors,
    visibleErrors,
    isValid: Object.keys(errors).length === 0,
    isDirty,
    changeKey,
    setValue,
    touch,
    showAllErrors,
    markSaved,
    reset,
  }
}
```

- [ ] **Step 4: Run the unit tests**

Run: `cd packages/admin-dashboard && pnpm test -- editor-actions useEntryForm`
Expected: PASS.

- [ ] **Step 5: Implement the field controls**

`features/content/editor/fields/FieldShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { Field } from '@/types'
import { Label } from '@/components/ui/label'

export interface FieldControlProps {
  field: Field
  id: string
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  error?: string
  disabled?: boolean
}

/** ARIA props every input gets: invalid state and a link to its help or error text. */
export function describedBy(id: string, field: Field, error?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : field.description ? `${id}-help` : undefined,
  }
}

export function FieldShell({ field, id, error, counter, children }: { field: Field; id: string; error?: string; counter?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {field.label || field.name}
          {field.required && <span aria-hidden className="text-destructive"> *</span>}
        </Label>
        {counter}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>
      ) : (
        field.description && <p id={`${id}-help`} className="text-sm text-muted-foreground">{field.description}</p>
      )}
    </div>
  )
}
```

`features/content/editor/fields/BasicFields.tsx`:

```tsx
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { describedBy, FieldShell, type FieldControlProps } from './FieldShell'

export function TextField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  const text = typeof value === 'string' ? value : ''
  const max = field.validation?.maxLength
  return (
    <FieldShell field={field} id={id} error={error} counter={max ? <span className="text-xs text-muted-foreground">{text.length}/{max}</span> : undefined}>
      <Input id={id} value={text} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={disabled} {...describedBy(id, field, error)} />
    </FieldShell>
  )
}

export function NumberField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  return (
    <FieldShell field={field} id={id} error={error}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
        min={field.validation?.min}
        max={field.validation?.max}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
        onBlur={onBlur}
        disabled={disabled}
        {...describedBy(id, field, error)}
      />
    </FieldShell>
  )
}

export function BooleanField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  return (
    <FieldShell field={field} id={id} error={error}>
      <Switch id={id} checked={value === true} onCheckedChange={(checked) => { onChange(checked); onBlur() }} disabled={disabled} {...describedBy(id, field, error)} />
    </FieldShell>
  )
}
```

`features/content/editor/fields/DateField.tsx`:

```tsx
import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { describedBy, FieldShell, type FieldControlProps } from './FieldShell'

export function DateField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  const [open, setOpen] = useState(false)
  const date = typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : undefined

  return (
    <FieldShell field={field} id={id} error={error}>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) onBlur() }}>
          <PopoverTrigger asChild>
            <Button id={id} variant="outline" disabled={disabled} className="w-full justify-start rounded-md font-normal sm:w-64" {...describedBy(id, field, error)}>
              <CalendarIcon aria-hidden />
              {date ? format(date, 'd MMM yyyy') : <span className="text-muted-foreground">Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { onChange(d ? d.toISOString() : undefined); setOpen(false) }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {date && !disabled && (
          <Button variant="ghost" size="icon" aria-label={`Clear ${field.label}`} onClick={() => { onChange(undefined); onBlur() }}>
            <X aria-hidden />
          </Button>
        )}
      </div>
    </FieldShell>
  )
}
```

`features/content/editor/fields/RelationField.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { StatusPill } from '@/components/common/StatusPill'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useEntry, useEntryList } from '../../queries'
import { describedBy, FieldShell, type FieldControlProps } from './FieldShell'

const OBJECT_ID = /^[a-f0-9]{24}$/i

export function RelationField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  const multiple = !!field.validation?.multiple
  const selected = Array.isArray(value) ? (value as string[]) : typeof value === 'string' && value ? [value] : []
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 250)
  const target = field.validation?.targetContentType
  const results = useEntryList(
    { search: debounced || undefined, contentTypeId: target && OBJECT_ID.test(target) ? target : undefined, limit: 20 },
    { enabled: open },
  )

  const choose = (entryId: string) => {
    if (multiple) {
      onChange(selected.includes(entryId) ? selected.filter((s) => s !== entryId) : [...selected, entryId])
    } else {
      onChange(entryId)
      setOpen(false)
    }
  }
  const remove = (entryId: string) => onChange(multiple ? selected.filter((s) => s !== entryId) : undefined)

  return (
    <FieldShell field={field} id={id} error={error}>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((entryId) => (
          <RelationChip key={entryId} id={entryId} onRemove={disabled ? undefined : () => remove(entryId)} />
        ))}
        {(multiple || selected.length === 0) && !disabled && (
          <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) onBlur() }}>
            <PopoverTrigger asChild>
              <Button id={id} variant="outline" size="sm" {...describedBy(id, field, error)}>
                <Plus aria-hidden />
                {selected.length ? 'Add entry' : 'Choose entry'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search entries…" value={search} onValueChange={setSearch} />
                <CommandList>
                  <CommandEmpty>{results.isFetching ? 'Searching…' : 'No entries found.'}</CommandEmpty>
                  <CommandGroup>
                    {(results.data?.data ?? []).map((entry) => (
                      <CommandItem key={entry.id} value={entry.id} onSelect={() => choose(entry.id)}>
                        <span className="flex-1 truncate">{entry.title}</span>
                        <span className="text-xs text-muted-foreground">{entry.contentType?.name}</span>
                        {selected.includes(entry.id) && <span className="sr-only">(selected)</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </FieldShell>
  )
}

function RelationChip({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const entry = useEntry(id)
  const title = entry.data?.title ?? (entry.isError ? 'Missing entry' : 'Loading…')
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
      <Link to={`/content/${id}`} className="max-w-48 truncate hover:underline">{title}</Link>
      {entry.data && <StatusPill status={entry.data.status} />}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${title}`} className="rounded-full p-1 hover:bg-accent">
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  )
}
```

`features/content/editor/fields/LegacyFields.tsx`:

```tsx
import { RichTextEditor } from '@/components/RichTextEditor'
import { MediaPicker } from '@/components/MediaPicker'
import { FieldShell, type FieldControlProps } from './FieldShell'

// TipTap and the media picker still use MUI; Plan 3 rebuilds the media picker.
export function RichTextField({ field, id, value, onChange, onBlur, error, disabled }: FieldControlProps) {
  return (
    <FieldShell field={field} id={id} error={error}>
      <div id={id} onBlur={onBlur} className={disabled ? 'pointer-events-none opacity-60' : undefined}>
        <RichTextEditor value={typeof value === 'string' ? value : ''} onChange={onChange} placeholder={field.description} />
      </div>
    </FieldShell>
  )
}

export function MediaField({ field, id, value, onChange, onBlur, error, disabled }: FieldControlProps) {
  const multiple = !!field.validation?.multiple
  const current = multiple ? (Array.isArray(value) ? (value as string[]) : []) : typeof value === 'string' ? value : ''
  return (
    <FieldShell field={field} id={id} error={error}>
      <div id={id} className={disabled ? 'pointer-events-none opacity-60' : undefined}>
        <MediaPicker value={current} onChange={(v) => { onChange(v); onBlur() }} multiple={multiple} allowedMimeTypes={field.validation?.allowedMimeTypes} />
      </div>
    </FieldShell>
  )
}
```

`features/content/editor/fields/FieldControl.tsx`:

```tsx
import type { FieldControlProps } from './FieldShell'
import { BooleanField, NumberField, TextField } from './BasicFields'
import { DateField } from './DateField'
import { RelationField } from './RelationField'
import { MediaField, RichTextField } from './LegacyFields'

export function FieldControl(props: FieldControlProps) {
  switch (props.field.type) {
    case 'TEXT':
      return <TextField {...props} />
    case 'RICH_TEXT':
      return <RichTextField {...props} />
    case 'NUMBER':
      return <NumberField {...props} />
    case 'DATE':
      return <DateField {...props} />
    case 'BOOLEAN':
      return <BooleanField {...props} />
    case 'MEDIA':
      return <MediaField {...props} />
    case 'RELATION':
      return <RelationField {...props} />
    default:
      return null
  }
}
```

- [ ] **Step 6: Implement the editor chrome**

`features/content/editor/UnsavedChangesDialog.tsx`:

```tsx
import type { Blocker } from 'react-router-dom'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => { if (!open && blocker.state === 'blocked') blocker.reset() }}
      title="Leave without saving?"
      description="Your changes to this entry have not been saved."
      confirmLabel="Leave"
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
```

`features/content/editor/EditorTopBar.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EditorAction, EditorActionSet } from './editor-actions'

interface EditorTopBarProps {
  typeName: string
  saveLabel: string
  saveTone: 'muted' | 'error'
  onRetry?: () => void
  actions: EditorActionSet
  busy: boolean
  onAction: (action: EditorAction) => void
  onOpenDetails: () => void
}

export function EditorTopBar({ typeName, saveLabel, saveTone, onRetry, actions, busy, onAction, onOpenDetails }: EditorTopBarProps) {
  const safeMenu = actions.menu.filter((m) => !m.destructive)
  const dangerMenu = actions.menu.filter((m) => m.destructive)
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:top-0 md:-mx-8 md:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/content">
          <ArrowLeft aria-hidden />
          Content
        </Link>
      </Button>
      <span className="hidden text-sm text-muted-foreground sm:inline">/ {typeName}</span>
      <span className="flex-1" />
      <span role="status" aria-live="polite" className={saveTone === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
        {saveLabel}
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-2 underline">
            Retry
          </button>
        )}
      </span>
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Details" onClick={onOpenDetails}>
        <PanelRight aria-hidden />
      </Button>
      {actions.secondary && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction(actions.secondary!.action)}>
          {actions.secondary.label}
        </Button>
      )}
      <Button size="sm" disabled={busy || actions.primary.disabled} onClick={() => onAction(actions.primary.action)}>
        {actions.primary.label}
      </Button>
      {actions.menu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {safeMenu.map((m) => (
              <DropdownMenuItem key={m.action} onSelect={() => onAction(m.action)}>{m.label}</DropdownMenuItem>
            ))}
            {dangerMenu.length > 0 && <DropdownMenuSeparator />}
            {dangerMenu.map((m) => (
              <DropdownMenuItem key={m.action} className="text-destructive focus:text-destructive" onSelect={() => onAction(m.action)}>
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
```

`features/content/editor/EditorSidePanel.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { ContentEntry, EntryStatus } from '@/types'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { formatAbsolute } from '@/lib/format'

interface EditorSidePanelProps {
  status: EntryStatus
  isNew: boolean
  entry?: ContentEntry
  cover?: ReactNode
  canArchive: boolean
  onArchive: () => void
  onDelete: () => void
}

function statusHint(status: EntryStatus, entry?: ContentEntry): string {
  if (!entry) return 'Not saved yet'
  if (status === 'PUBLISHED' && entry.publishedAt) return `Published ${formatAbsolute(entry.publishedAt)}`
  if (status === 'ARCHIVED') return 'Hidden from sites. Restore it to edit.'
  return 'Not visible on sites'
}

export function EditorSidePanel({ status, isNew, entry, cover, canArchive, onArchive, onDelete }: EditorSidePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</h2>
        <StatusPill status={status} />
        <p className="mt-2 text-xs text-muted-foreground">{statusHint(status, entry)}</p>
      </section>
      {cover && <section className="rounded-lg border bg-card p-3">{cover}</section>}
      {entry && (
        <section className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          <h2 className="mb-2 font-medium uppercase tracking-wide">Info</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>Created</dt>
            <dd>{formatAbsolute(entry.createdAt)}</dd>
            <dt>Edited</dt>
            <dd>{formatAbsolute(entry.updatedAt)}</dd>
            <dt>ID</dt>
            <dd className="flex items-center gap-1 font-mono">
              <span className="truncate">{entry.id}</span>
              <button
                type="button"
                aria-label="Copy entry ID"
                className="rounded p-0.5 hover:bg-accent"
                onClick={() => void navigator.clipboard?.writeText(entry.id).then(() => toast.success('ID copied'))}
              >
                <Copy aria-hidden className="size-3.5" />
              </button>
            </dd>
          </dl>
        </section>
      )}
      {!isNew && (
        <div className="flex flex-wrap gap-2">
          {canArchive && <Button variant="outline" size="sm" onClick={onArchive}>Archive</Button>}
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>Delete</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Implement `features/content/editor/EntryEditor.tsx`**

```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ContentEntry, ContentType, EntryStatus } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { createInitialValues, duplicateData, resolveTitleField, toEntryPayload, type EntryValues } from '@/lib/entry-schema'
import { useAutosave } from '@/lib/hooks/useAutosave'
import { useHotkey } from '@/lib/hooks/useHotkey'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useEntryWrites } from '../queries'
import { getEditorActions, type EditorAction } from './editor-actions'
import { useEntryForm } from './useEntryForm'
import { EditorTopBar } from './EditorTopBar'
import { EditorSidePanel } from './EditorSidePanel'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { FieldControl } from './fields/FieldControl'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface EntryEditorProps {
  contentType: ContentType
  entry?: ContentEntry
}

export function EntryEditor({ contentType, entry: initialEntry }: EntryEditorProps) {
  const navigate = useNavigate()
  const writes = useEntryWrites()
  const fields = contentType.fields
  const titleKey = resolveTitleField(fields, contentType.titleField)
  const coverField = fields.find((f) => f.type === 'MEDIA' && !f.validation?.multiple)
  const bodyFields = fields.filter((f) => f.name !== titleKey && f.name !== coverField?.name)

  const [entry, setEntry] = useState<ContentEntry | undefined>(initialEntry)
  const [status, setStatus] = useState<EntryStatus>(initialEntry?.status ?? 'DRAFT')
  const [saveState, setSaveState] = useState<SaveState>(initialEntry ? 'saved' : 'idle')
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)

  const form = useEntryForm(fields, createInitialValues(fields, initialEntry?.data))
  const readOnly = status === 'ARCHIVED'

  // Saves run one after another; the id ref makes a queued save after a create become an update.
  const entryIdRef = useRef<string | undefined>(initialEntry?.id)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())

  const persist = useCallback(
    (options: { status?: EntryStatus } = {}) => {
      const run = async (): Promise<ContentEntry> => {
        const snapshot: EntryValues = form.values
        const data = toEntryPayload(fields, snapshot)
        setSaveState('saving')
        setServerError(null)
        try {
          let saved: ContentEntry
          if (!entryIdRef.current) {
            saved = await writes.create({ typeId: contentType.id, body: { data, status: options.status ?? 'DRAFT' } })
            entryIdRef.current = saved.id
            navigate(`/content/${saved.id}`, { replace: true, state: { skipGuard: true } })
          } else {
            saved = await writes.update({ id: entryIdRef.current, body: { data } })
          }
          form.markSaved(snapshot)
          setEntry(saved)
          setStatus(saved.status)
          setSaveState('saved')
          return saved
        } catch (error) {
          setSaveState('error')
          setServerError(apiErrorMessage(error))
          throw error
        }
      }
      const next = queueRef.current.then(run, run)
      queueRef.current = next.catch(() => undefined)
      return next
    },
    [form, fields, writes, contentType.id, navigate],
  )

  const autosave = useAutosave({
    enabled: status === 'DRAFT',
    isDirty: form.isDirty,
    isValid: form.isValid,
    changeKey: form.changeKey,
    save: () => persist().catch(() => undefined),
  })

  const blocker = useUnsavedGuard(form.isDirty)

  const requireValid = useCallback(() => {
    if (form.isValid) return true
    form.showAllErrors()
    const count = Object.keys(form.errors).length
    toast.error(`Fix ${count} field${count === 1 ? '' : 's'} before saving`)
    const first = Object.keys(form.errors)[0]
    document.getElementById(`field-${first}`)?.focus()
    return false
  }, [form])

  const act = useCallback(
    async (action: EditorAction) => {
      const id = entryIdRef.current
      setBusy(true)
      try {
        switch (action) {
          case 'saveDraft':
            if (!requireValid()) return
            await persist()
            toast.success('Draft saved')
            break
          case 'publish':
            if (!requireValid()) return
            if (!id) {
              await persist({ status: 'PUBLISHED' })
            } else {
              if (form.isDirty) await persist()
              const published = await writes.publish(id)
              setEntry(published)
              setStatus('PUBLISHED')
            }
            toast.success('Published')
            break
          case 'publishChanges':
            if (!requireValid()) return
            await persist()
            toast.success('Changes published')
            break
          case 'discard':
            form.reset(form.baseline)
            break
          case 'unpublish': {
            const saved = await writes.unpublish(id!)
            setEntry(saved)
            setStatus('DRAFT')
            toast.success('Unpublished. The entry is a draft again.')
            break
          }
          case 'archive':
            setConfirm('archive')
            break
          case 'restore': {
            const saved = await writes.update({ id: id!, body: { status: 'DRAFT' } })
            setEntry(saved)
            setStatus('DRAFT')
            toast.success('Restored to draft')
            break
          }
          case 'delete':
            setConfirm('delete')
            break
          case 'duplicate': {
            const copy = await writes.create({
              typeId: contentType.id,
              body: { data: duplicateData(toEntryPayload(fields, form.values), fields, contentType.titleField), status: 'DRAFT' },
            })
            toast.success('Duplicated. You are editing the copy.')
            navigate(`/content/${copy.id}`)
            break
          }
        }
      } catch (error) {
        toast.error(apiErrorMessage(error))
      } finally {
        setBusy(false)
      }
    },
    [contentType, fields, form, navigate, persist, requireValid, writes],
  )

  const confirmArchive = async () => {
    setConfirm(null)
    try {
      const saved = await writes.archive(entryIdRef.current!)
      setEntry(saved)
      setStatus('ARCHIVED')
      toast.success('Archived')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const confirmDelete = async () => {
    setConfirm(null)
    try {
      await writes.remove(entryIdRef.current!)
      toast.success('Entry deleted')
      navigate('/content', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  useHotkey(
    's',
    (event) => {
      event.preventDefault()
      if (status === 'ARCHIVED') return
      void act(status === 'PUBLISHED' ? 'publishChanges' : 'saveDraft')
    },
    { mod: true, allowInInputs: true },
  )

  const isNew = !entryIdRef.current
  const actions = getEditorActions({ isNew, status, isDirty: form.isDirty })
  const errorCount = Object.keys(form.errors).length

  const saveLabel = useMemo(() => {
    if (saveState === 'saving') return 'Saving…'
    if (saveState === 'error') return 'Save failed'
    if (form.isDirty && !form.isValid && status === 'DRAFT') return `Fix ${errorCount} field${errorCount === 1 ? '' : 's'} to save`
    if (form.isDirty) return 'Unsaved changes'
    if (isNew) return 'Not saved yet'
    return 'Saved'
  }, [saveState, form.isDirty, form.isValid, status, errorCount, isNew])

  const renderField = (fieldName: string, className?: string) => {
    const field = fields.find((f) => f.name === fieldName)!
    return (
      <div className={className}>
        <FieldControl
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
      </div>
    )
  }

  const panel = (
    <EditorSidePanel
      status={status}
      isNew={isNew}
      entry={entry}
      cover={coverField ? renderField(coverField.name) : undefined}
      canArchive={status !== 'ARCHIVED'}
      onArchive={() => setConfirm('archive')}
      onDelete={() => setConfirm('delete')}
    />
  )

  const titleValue = titleKey ? form.values[titleKey] : undefined
  const titleError = titleKey ? form.visibleErrors[titleKey] : undefined

  return (
    <>
      <EditorTopBar
        typeName={contentType.name}
        saveLabel={saveLabel}
        saveTone={saveState === 'error' ? 'error' : 'muted'}
        onRetry={saveState === 'error' ? () => void persist().catch(() => undefined) : undefined}
        actions={actions}
        busy={busy}
        onAction={(a) => void act(a)}
        onOpenDetails={() => setDetailsOpen(true)}
      />
      {serverError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form
          className="flex min-w-0 flex-col gap-6"
          onSubmit={(e) => e.preventDefault()}
          aria-label={`${contentType.name} fields`}
        >
          <fieldset disabled={readOnly} className="contents">
            {titleKey && (
              <div>
                <label htmlFor={`field-${titleKey}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {fields.find((f) => f.name === titleKey)?.label ?? 'Title'}
                </label>
                <input
                  id={`field-${titleKey}`}
                  value={typeof titleValue === 'string' ? titleValue : ''}
                  onChange={(e) => form.setValue(titleKey, e.target.value)}
                  onBlur={() => {
                    form.touch(titleKey)
                    autosave.flush()
                  }}
                  placeholder="Untitled"
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? `field-${titleKey}-error` : undefined}
                  className={cn(
                    'mt-1 w-full border-0 border-b bg-transparent pb-1 font-serif text-3xl font-semibold outline-none placeholder:text-muted-foreground/60 focus:border-ring',
                    titleError && 'border-destructive',
                  )}
                />
                {titleError && <p id={`field-${titleKey}-error`} className="mt-1 text-sm text-destructive">{titleError}</p>}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              {bodyFields.map((f) =>
                renderField(f.name, ['NUMBER', 'DATE', 'BOOLEAN'].includes(f.type) ? undefined : 'sm:col-span-2'),
              )}
            </div>
          </fieldset>
        </form>
        <aside className="hidden lg:block" aria-label="Entry details">
          {panel}
        </aside>
      </div>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{panel}</div>
        </SheetContent>
      </Sheet>
      <UnsavedChangesDialog blocker={blocker} />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Archive this entry?"
        description="Sites stop receiving it. You can restore it to draft later."
        confirmLabel="Archive"
        onConfirm={() => void confirmArchive()}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this entry?"
        description="This permanently removes the entry and cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

```

- [ ] **Step 8: Implement the page and redirects**

`features/content/pages/EntryEditorPage.tsx`:

```tsx
import { useParams, useSearchParams } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { isAxiosError } from 'axios'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useContentType, useContentTypes, useEntry } from '../queries'
import { entryTypeId } from '../content-api'
import { TypeChooser } from '../components/TypeChooser'
import { EntryEditor } from '../editor/EntryEditor'

export function EntryEditorPage() {
  const { id = 'new' } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = id === 'new'
  const entryQuery = useEntry(isNew ? undefined : id)
  const typeId = isNew ? searchParams.get('type') ?? undefined : entryQuery.data ? entryTypeId(entryQuery.data) : undefined
  const typeQuery = useContentType(typeId)
  const typesQuery = useContentTypes()

  if (isNew && !typeId) {
    return (
      <>
        <PageHeader title="New entry" description="Choose what you want to create." />
        {typesQuery.data ? <TypeChooser types={typesQuery.data} /> : <Skeleton className="h-24 w-full" />}
      </>
    )
  }

  const notFound = (!isNew && isAxiosError(entryQuery.error) && entryQuery.error.response?.status === 404) ||
    (isAxiosError(typeQuery.error) && typeQuery.error.response?.status === 404)
  if (notFound) {
    return <EmptyState icon={FileQuestion} title="This entry does not exist" description="It may have been deleted." />
  }
  if (entryQuery.isError || typeQuery.isError) {
    return <ErrorState message="Could not load this entry." onRetry={() => { void entryQuery.refetch(); void typeQuery.refetch() }} />
  }
  if (!typeQuery.data || (!isNew && !entryQuery.data)) {
    return (
      <div aria-busy="true" aria-label="Loading entry" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // Keyed by type only: after the first save the URL changes from /content/new to /content/:id
  // and the editor must stay mounted so in-progress edits survive.
  return <EntryEditor key={typeQuery.data.id} contentType={typeQuery.data} entry={isNew ? undefined : entryQuery.data} />
}
```

`features/content/LegacyRedirects.tsx`:

```tsx
import { Navigate, useParams, useSearchParams } from 'react-router-dom'

export function LegacyEntriesRedirect() {
  const [params] = useSearchParams()
  const type = params.get('contentType')
  return <Navigate to={type ? `/content?type=${encodeURIComponent(type)}` : '/content'} replace />
}

export function LegacyNewEntryRedirect() {
  const [params] = useSearchParams()
  const type = params.get('contentType')
  return <Navigate to={type ? `/content/new?type=${encodeURIComponent(type)}` : '/content/new'} replace />
}

export function LegacyEditEntryRedirect() {
  const { id } = useParams()
  return <Navigate to={`/content/${id}`} replace />
}
```

- [ ] **Step 9: Update the registry and delete the legacy content pages**

In `modules/registry.tsx`:
- Remove the imports of `ContentEntriesList` and `ContentEntryForm`.
- Add `import { ContentListPage } from '@/features/content/pages/ContentListPage'`, `import { EntryEditorPage } from '@/features/content/pages/EntryEditorPage'`, `import { LegacyEditEntryRedirect, LegacyEntriesRedirect, LegacyNewEntryRedirect } from '@/features/content/LegacyRedirects'`.
- Replace the content module's `routes` with:

```tsx
    routes: [
      { path: 'content', element: <ContentListPage /> },
      { path: 'content/:id', element: <EntryEditorPage /> },
      { path: 'entries', element: <LegacyEntriesRedirect /> },
      { path: 'entries/new', element: <LegacyNewEntryRedirect /> },
      { path: 'entries/:id/edit', element: <LegacyEditEntryRedirect /> },
    ],
```

- Change the first create action to `{ id: 'new-entry', label: 'New entry', to: '/content/new', icon: Plus }`.

Then:

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q src/pages/ContentEntries/ContentEntriesList.tsx src/pages/ContentEntries/ContentEntryForm.tsx src/components/DynamicFormGenerator.tsx src/services/contentEntries.ts
grep -rn "ContentEntries/\|DynamicFormGenerator\|services/contentEntries" src || echo "no references"
```

Expected: `no references`.

- [ ] **Step 10: Write the editor integration tests**

`features/content/LegacyRedirects.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { renderRoutes } from '@/test/render'
import { LegacyEditEntryRedirect, LegacyEntriesRedirect, LegacyNewEntryRedirect } from './LegacyRedirects'

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

const routes = [
  { path: '/entries', element: <LegacyEntriesRedirect /> },
  { path: '/entries/new', element: <LegacyNewEntryRedirect /> },
  { path: '/entries/:id/edit', element: <LegacyEditEntryRedirect /> },
  { path: '*', element: <Where /> },
]

it.each([
  ['/entries?contentType=abc', '/content?type=abc'],
  ['/entries', '/content'],
  ['/entries/new?contentType=abc', '/content/new?type=abc'],
  ['/entries/e1/edit', '/content/e1'],
])('%s redirects to %s', async (from, to) => {
  renderRoutes(routes, { route: from })
  expect(await screen.findByTestId('where')).toHaveTextContent(to)
})
```

`features/content/pages/EntryEditorPage.test.tsx`:

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes } from '@/test/render'
import * as api from '../content-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content-api')>()
  return {
    ...actual,
    getEntry: vi.fn(),
    getContentType: vi.fn(),
    listContentTypes: vi.fn(),
    listEntries: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    publishEntry: vi.fn(),
  }
})
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="rich text" /> }))
vi.mock('@/components/MediaPicker', () => ({ MediaPicker: () => <div>media picker</div> }))

const routes = [
  { path: '/content/:id', element: <><EntryEditorPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/content', element: <p>content list</p> },
  { path: '/elsewhere', element: <p>elsewhere page</p> },
]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
})

afterEach(() => vi.useRealTimers())

describe('new entry', () => {
  it('asks for the type when none is given', async () => {
    renderRoutes(routes, { route: '/content/new' })
    expect(await screen.findByRole('link', { name: /Trip/ })).toHaveAttribute('href', `/content/new?type=${tripType.id}`)
  })

  it('saves a draft, omits empty optional fields and stays in the editor without a leave prompt', async () => {
    vi.mocked(api.createEntry).mockResolvedValue(makeEntry({ id: 'e-new', data: { title: 'Hello' }, title: 'Hello' }))
    const { router } = renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    await userEvent.type(await screen.findByLabelText('Title'), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/content/e-new'))
    expect(api.createEntry).toHaveBeenCalledWith(tripType.id, { data: { title: 'Hello' }, status: 'DRAFT' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Hello')
  })

  it('creates only once when saves overlap', async () => {
    let resolveCreate: (e: ReturnType<typeof makeEntry>) => void = () => {}
    vi.mocked(api.createEntry).mockImplementation(() => new Promise((r) => { resolveCreate = r }))
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ id: 'e-new', data: { title: 'Hi' } }))
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    await userEvent.type(await screen.findByLabelText('Title'), 'Hi')
    await userEvent.keyboard('{Meta>}s{/Meta}')
    await userEvent.keyboard('{Meta>}s{/Meta}')
    await act(async () => resolveCreate(makeEntry({ id: 'e-new', data: { title: 'Hi' } })))
    await waitFor(() => expect(api.updateEntry).toHaveBeenCalledTimes(1))
    expect(api.createEntry).toHaveBeenCalledTimes(1)
  })

  it('shows a required error on blur and does not save', async () => {
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    const title = await screen.findByLabelText('Title')
    await userEvent.click(title)
    await userEvent.tab()
    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(api.createEntry).not.toHaveBeenCalled()
  })
})

describe('existing entries', () => {
  it('autosaves a draft 2 seconds after typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry())
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ data: { title: 'Přes Šumavu!', distanceKm: 142 } }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderRoutes(routes, { route: '/content/e1' })
    await user.type(await screen.findByLabelText('Title'), '!')
    expect(api.updateEntry).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(2100) })
    await waitFor(() => expect(api.updateEntry).toHaveBeenCalledWith('e1', { data: { title: 'Přes Šumavu!', distanceKm: 142 } }))
  })

  it('never autosaves a published entry and publishes changes on request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED', publishedAt: '2026-09-21T10:00:00Z' }))
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED' }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderRoutes(routes, { route: '/content/e1' })
    expect(await screen.findByRole('button', { name: 'Published' })).toBeDisabled()
    await user.type(screen.getByLabelText('Title'), '!')
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(api.updateEntry).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Publish changes' }))
    expect(api.updateEntry).toHaveBeenCalledTimes(1)
  })

  it('asks before leaving with unsaved changes', async () => {
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED' }))
    renderRoutes(routes, { route: '/content/e1' })
    await userEvent.type(await screen.findByLabelText('Title'), '!')
    await userEvent.click(screen.getByRole('link', { name: 'elsewhere' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Leave without saving?')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave' }))
    expect(await screen.findByText('elsewhere page')).toBeInTheDocument()
  })

  it('publishes a draft', async () => {
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry())
    vi.mocked(api.publishEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED' }))
    renderRoutes(routes, { route: '/content/e1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    expect(api.publishEntry).toHaveBeenCalledWith('e1')
    expect(await screen.findByRole('button', { name: 'Published' })).toBeDisabled()
  })

  it('keeps archived entries read-only until restored', async () => {
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ status: 'ARCHIVED' }))
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ status: 'DRAFT' }))
    renderRoutes(routes, { route: '/content/e1' })
    expect(await screen.findByLabelText('Title')).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Restore to draft' }))
    expect(api.updateEntry).toHaveBeenCalledWith('e1', { status: 'DRAFT' })
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeEnabled())
  })
})
```

- [ ] **Step 11: Run all tests, build and lint the new files**

Run:

```bash
cd packages/admin-dashboard
pnpm test
pnpm build
pnpm exec eslint src/features src/lib src/components/common src/app src/modules
```

Expected: tests PASS, build succeeds, no lint errors in these folders.

- [ ] **Step 12: Commit**

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): entry editor with autosave, unsaved-changes guard and new content routes"
```

---

## Task 7: Entry search in the ⌘K palette

**Files:**
- Modify: `app/shell/CommandPalette.tsx`
- Test: `app/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `useEntryList` (Task 2), `useDebouncedValue` (Task 4).
- Produces: the palette shows an "Entries" group for queries of 2 or more characters; selecting an entry navigates to `/content/:id`. The ⌘K handler ignores key events without a `key`.

- [ ] **Step 1: Write the failing tests**

In `shell.test.tsx`, add to the imports `import * as contentApi from '@/features/content/content-api'` and `import { makeListItem, page } from '@/features/content/test-fixtures'`, add this mock at the top level:

```tsx
vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, listEntries: vi.fn() }
})
```

and add to `describe('Command palette')`:

```tsx
  it('finds entries by title and opens them', async () => {
    vi.mocked(contentApi.listEntries).mockResolvedValue(page([makeListItem({ id: 'e9', title: 'Přes Šumavu na kole' })]))
    const user = userEvent.setup()
    renderWithProviders(withPalette(<div />))
    await user.keyboard('{Control>}k{/Control}')
    await user.type(await screen.findByPlaceholderText('Search or jump to…'), 'šumavu')
    await user.click(await screen.findByRole('option', { name: /Přes Šumavu na kole/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/content/e9')
    expect(contentApi.listEntries).toHaveBeenCalledWith(expect.objectContaining({ search: 'šumavu', limit: 8 }))
  })

  it('ignores key events without a key', () => {
    renderWithProviders(withPalette(<div />))
    expect(() => window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true }))).not.toThrow()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- shell`
Expected: FAIL: no entry option appears; the second test throws `Cannot read properties of undefined (reading 'toLowerCase')`.

- [ ] **Step 3: Implement**

In `CommandPalette.tsx`:
- Add imports: `import { FileText } from 'lucide-react'`, `import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'`, `import { useEntryList } from '@/features/content/queries'`.
- In the keydown handler replace `event.key.toLowerCase() === 'k'` with `typeof event.key === 'string' && event.key.toLowerCase() === 'k'`.
- Add state to the provider: `const [query, setQuery] = useState('')`, `const debouncedQuery = useDebouncedValue(query.trim(), 250)`, and

```tsx
  const entrySearch = useEntryList(
    { search: debouncedQuery, limit: 8, sortBy: 'updatedAt' },
    { enabled: open && debouncedQuery.length >= 2 },
  )
  const entries = debouncedQuery.length >= 2 ? entrySearch.data?.data ?? [] : []
```

- In `go`, also call `setQuery('')`.
- Change `<CommandInput placeholder="Search or jump to…" />` to `<CommandInput placeholder="Search or jump to…" value={query} onValueChange={setQuery} />`.
- Add this group before "Go to":

```tsx
          {entries.length > 0 && (
            <CommandGroup heading="Entries">
              {entries.map((e) => (
                <CommandItem key={e.id} value={`entry-${e.id}`} keywords={[e.title, debouncedQuery]} onSelect={() => go(`/content/${e.id}`)}>
                  <FileText aria-hidden />
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{e.contentType?.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
```

(`keywords` includes the typed query so cmdk's own filter never hides server matches, for example when accents differ.)

- [ ] **Step 4: Run tests**

Run: `cd packages/admin-dashboard && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-dashboard/src/app/shell
git commit -m "feat(admin): search entries from the command palette"
```

---

## Task 8: Verification in the running app

**Files:** none unless a defect is found (fix it in the owning task's files and commit separately, with a test when behaviour can be tested in jsdom).

- [ ] **Step 1: Start services**

Docker is not installed on this machine (Plan 1 ledger). Start the same stand-ins as Plan 1:

```bash
SP=<session scratchpad directory>
mkdir -p $SP/mongo $SP/azurite
~/.cache/mongodb-binaries/mongod-arm64-darwin-6.0.14 --dbpath $SP/mongo --port 27017 --bind_ip 127.0.0.1   # background
npx -y azurite --silent --location $SP/azurite --blobHost 127.0.0.1 --loose                               # background
PORT=3000 NODE_ENV=development MONGODB_URI=mongodb://127.0.0.1:27017/thecms CORS_ORIGINS=http://localhost:5173 pnpm --filter @thecms/backend dev   # background
pnpm --filter admin-dashboard dev --port 5173 --strictPort                                                  # background
```

Seed: a Trip model (Title required TEXT, Distance NUMBER, Show on home BOOLEAN, Date DATE, Related RELATION), a Blog post model (Title TEXT, Body RICH_TEXT, Cover MEDIA), and 25 entries across both, some published.

- [ ] **Step 2: Check each item and note the result**

1. `/content` lists all entries with type chips and counts, status filter, sort, search (try `šumavu` and `C++`), pager "1–20 of 25", Next.
2. Row menu: Publish, Unpublish (toast with Undo works), Archive (Undo restores), Duplicate (opens the copy titled "… (copy)"), Delete asks first.
3. **N** opens the type chooser; **+ New entry** dialog and the split menu both work.
4. New Trip: leave Title empty and tab away, error shows; type a title, wait 2 s, it saves by itself and the URL becomes `/content/<id>` with no leave prompt.
5. Optional Distance left empty saves without a backend error.
6. Published entry: edit, "Publish changes" appears, no autosave after 5 s; navigating away asks "Leave without saving?"; reload with changes shows the browser's leave warning.
7. ⌘S saves; the status line reads Saving…, then Saved.
8. Archived entry is read-only; Restore to draft enables editing.
9. Relation picker searches entries and shows chosen ones as chips; Date picker sets and clears a date; Yes/No switch toggles.
10. Old URLs: `/entries`, `/entries?contentType=<id>`, `/entries/<id>/edit` land on the new pages.
11. ⌘K: typing part of a title lists the entry; Enter opens it.
12. 360px (iframe method from Plan 1): list shows cards, editor shows the Details button that opens the bottom sheet; no horizontal scroll.
13. Dark theme: list and editor readable, including the legacy rich text and media pickers.

- [ ] **Step 3: Record and commit**

Append a "Plan 2 verification" table to `TEST_RESULTS.md` (same format as Plan 1) and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record Plan 2 verification results"
```

---

## Self-Review Notes

- **Spec coverage:** 5.2 filters, chips with counts, status, search, sort, pager, rows (title, type, edited, status), row menu, split New button, three empty states → Task 5 (thumbnails deferred, see Decisions). 5.3 top bar with save indicator, canvas with serif title, side-by-side short fields, side panel (status, cover, info with copy, archive/delete), mobile Details sheet, button states, autosave rules, never navigate on save, ⌘S, unsaved guard, client validation with first-error focus, server error banner, field controls, duplicate → Task 6. Section 6 toasts, undo, confirmations, skeletons, empty states, inline errors, keyboard (`⌘K`, `⌘S`, `N`, `Esc` via Radix) → Tasks 5 to 7. 7.3 byType → Task 1. Route map for content and redirects → Task 6. ⌘K entry search (deferred from Plan 1) → Task 7.
- **Type consistency:** `EntryListItem`, `EntryListParams`, `EntryWriteBody`, `useEntryWrites` method names and `getEditorActions` shapes match across Tasks 2, 5, 6 and 7.
