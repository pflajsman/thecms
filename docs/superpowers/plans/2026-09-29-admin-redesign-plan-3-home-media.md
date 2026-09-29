# Admin Redesign, Plan 3: Home and Media

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Dashboard and Media Library with the new Home (setup checklist or work queue) and Media library (grid, drop-anywhere upload with progress, detail drawer with "Used in"), build one shared media picker for media fields and rich text, give media fields thumbnails, drag-to-reorder and drop-to-upload, and show entry thumbnails in the Content list.

**Architecture:** A `features/media` module owns media API calls, query hooks, pure helpers (type detection, preview URL choice, upload validation) and an upload queue hook. `MediaGrid` is the one grid used by the library page and the picker dialog. The media field and the TipTap editor both use the new `MediaPickerDialog`. `features/home` composes stats, drafts and sites into the two Home states. The backend gains a batch lookup (`ids`) and a Cosmos-friendly search for media.

**Tech Stack:** React 19, TanStack Query 5, shadcn/ui (sheet, dialog, input, textarea), dnd-kit (sortable), axios upload progress, Vitest, React Testing Library. Backend: Express, Mongoose, Jest.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-dashboard-redesign-design.md` (sections 5.1, 5.4, 5.3 media field, 5.2 thumbnails, 6)

**Series:** Plan 3 of 5. Plans 1 and 2 are merged on `main`.

## Global Constraints

- Public API (`/api/v1/public/*`) request and response shapes must not change.
- Admin endpoint changes are additive, except media `search`, which switches from `$text` to an escaped case-insensitive regex (same parameter, better matching, works on Cosmos DB).
- Upload limit is 10 MB per file (backend `MAX_FILE_SIZE`); accepted types mirror backend `ALL_ALLOWED_MIME_TYPES` plus `.gpx` by extension.
- At most 3 uploads run at the same time.
- Colors only from Tailwind token utilities; no hard-coded hex values in new components.
- Every screen works at 360px width without horizontal scrolling.
- Every mutation shows a toast on success; failures show the server message.
- `localStorage` is used only for the per-viewer "setup checklist dismissed" flag (key `thecms-setup-dismissed`), wrapped in try/catch.
- Copy is English. Never use an em dash in UI copy, code comments or docs.

## Decisions (deviations from the spec, for the reviewer)

1. **Home "Inbox" card shows the unread count and a link, not the latest messages.** There is no cross-form submissions endpoint yet; Plan 4 builds the Inbox and adds it, then fills this card.
2. **Setup checklist "Create a content model" links to the legacy model form** (`/content-types/new`). Plan 4 replaces it with the template picker.
3. **Media detail metadata is saved with an explicit Save button**, not autosaved: alt text, description and tags are few and deliberate edits.
4. **Keyboard reordering of media uses "Move earlier" and "Move later" buttons.** dnd-kit handles pointer drag; buttons give a reliable keyboard and screen reader path.

## Review Focus

1. **Files over 10 MB or of an unsupported type** must be rejected before upload with a clear message, and never block the other files in the same drop. Tested in Task 3.
2. **A media field whose stored id no longer exists** (deleted file) must render a "Missing file" tile that can be removed, not crash or show a blank. Tested in Task 6.
3. **Deleting a media item that entries use** must warn with the number of entries before confirming. Tested in Task 5.
4. **Search input with regex characters** (`photo (1).jpg`) must match literally. Tested in Task 1.
5. **A field that accepts only some types** (for example GPX) must not let the picker choose other types. Tested in Task 6.

---

## File Structure

### Backend (`packages/backend/src`)

| File | Change |
|---|---|
| `modules/media/media.schema.ts` | `ids` query param; `search` max 100 |
| `modules/media/media.service.ts` | `ids` filter; regex search |
| `modules/media/media.controller.ts` | Pass `ids` |
| `modules/media/media-list.test.ts` | New tests |

### Frontend (`packages/admin-dashboard/src`)

| File | Responsibility |
|---|---|
| `features/media/media-utils.ts` | Type category, preview URL, size format, upload validation, accept matching |
| `features/media/media-api.ts`, `queries.ts` | API calls and hooks |
| `features/media/useUploadQueue.ts` | Concurrent uploads with progress |
| `features/media/useFileDrop.ts` | Window-level file drag detection |
| `features/media/components/{UploadTray,MediaTile,MediaGrid,MediaFilters,MediaDetailSheet,MediaPickerDialog}.tsx` | UI |
| `features/media/pages/MediaLibraryPage.tsx` | Library |
| `features/media/test-fixtures.ts` | Test data |
| `features/content/editor/fields/MediaField.tsx` | New media field (replaces legacy picker) |
| `features/content/editor/fields/LegacyFields.tsx` | Keep only rich text |
| `features/content/pages/ContentListPage.tsx` | Thumbnails |
| `components/RichTextEditor.tsx` | Use the new picker |
| `features/sites/sites-api.ts` | `listSites`, `useSites` (minimal, for Home) |
| `features/home/home-utils.ts`, `components/*.tsx`, `pages/HomePage.tsx` | Home |
| `modules/registry.tsx` | New Home and Media routes |
| Delete: `pages/Dashboard.tsx`, `pages/Media/MediaLibrary.tsx`, `pages/Media/MediaUpload.tsx`, `components/MediaPicker.tsx`, `components/MediaPickerDialog.tsx`, `services/media.ts` | Replaced |

---

## Task 1: Media batch lookup and literal search

**Files:**
- Modify: `packages/backend/src/modules/media/media.schema.ts`, `media.service.ts`, `media.controller.ts`
- Test: `packages/backend/src/modules/media/media-list.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/media?ids=<id>,<id>` returns those media (any order, unknown ids skipped, max 100 ids); `search` matches `originalName`, `altText`, `description` and `tags` case-insensitively and literally.

- [ ] **Step 1: Write the failing tests `media-list.test.ts`**

```ts
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { MediaModel } from '../../models/media.model';
import { MediaService } from './media.service';
import mediaRoutes from './media.routes';

useTestDb();

const app = express();
app.use('/media', mediaRoutes);

async function seed() {
  const base = { mimeType: 'image/jpeg', size: 10, blobUrl: 'http://x/a.jpg' };
  const a = await MediaModel.create({ ...base, filename: 'a.jpg', originalName: 'photo (1).jpg' });
  const b = await MediaModel.create({ ...base, filename: 'b.jpg', originalName: 'Šumava.jpg', altText: 'Forest trail' });
  const c = await MediaModel.create({ ...base, filename: 'c.gpx', originalName: 'route.gpx', mimeType: 'application/gpx+xml', tags: ['bike'] });
  return { a, b, c };
}

describe('MediaService.listMedia', () => {
  it('returns only the requested ids', async () => {
    const { a, c } = await seed();
    const res = await MediaService.listMedia({ ids: [a.id, c.id, '66f1a2b3c4d5e6f7a8b9c0d1'] });
    expect(res.media.map((m) => m.id).sort()).toEqual([a.id, c.id].sort());
  });

  it('searches names literally and case-insensitively', async () => {
    await seed();
    expect((await MediaService.listMedia({ search: 'photo (1)' })).media.map((m) => m.originalName)).toEqual(['photo (1).jpg']);
    expect((await MediaService.listMedia({ search: 'šumava' })).media).toHaveLength(1);
  });

  it('searches alt text, description and tags', async () => {
    await seed();
    expect((await MediaService.listMedia({ search: 'forest' })).media.map((m) => m.originalName)).toEqual(['Šumava.jpg']);
    expect((await MediaService.listMedia({ search: 'bike' })).media.map((m) => m.originalName)).toEqual(['route.gpx']);
  });
});

describe('GET /media', () => {
  it('accepts comma-separated ids', async () => {
    const { a, b } = await seed();
    const res = await request(app).get(`/media?ids=${a.id},${b.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('rejects malformed ids and overlong search with 400', async () => {
    expect((await request(app).get('/media?ids=nope')).status).toBe(400);
    expect((await request(app).get(`/media?search=${'a'.repeat(101)}`)).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- media-list`
Expected: FAIL: `ids` ignored (all 3 returned), `$text` search errors without a text index, 400 cases return 200.

- [ ] **Step 3: Implement**

In `media.schema.ts`, inside `listMediaSchema.query`, replace the `search` line with:

```ts
    search: z.string().trim().max(100, 'Search must be at most 100 characters').optional().describe('Search name, alt text, description and tags'),
    ids: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined))
      .refine((ids) => !ids || (ids.length <= 100 && ids.every((id) => /^[a-f0-9]{24}$/i.test(id))), {
        message: 'ids must be up to 100 comma-separated media IDs',
      })
      .describe('Comma-separated media IDs (batch lookup)'),
```

In `media.service.ts`:
- Add `import { escapeRegex } from '../../utils/regex';`.
- Add `ids?: string[];` to `ListMediaOptions` and `ids` to the destructuring in `listMedia`.
- After the tags filter add:

```ts
    // Batch lookup by id
    if (ids && ids.length > 0) {
      query._id = { $in: ids };
    }
```

- Replace the full-text search block and the text-score sort block with:

```ts
    // Literal, case-insensitive search (no $text: limited on Cosmos DB)
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [{ originalName: pattern }, { altText: pattern }, { description: pattern }, { tags: pattern }];
    }
```

and delete the later `if (search) { sort.score = ... }` block.

In `media.controller.ts` `listMedia`, add `ids: validated.query.ids,` to the options object.

- [ ] **Step 4: Run tests and build**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/media
git commit -m "feat(backend): media batch lookup by ids and literal search"
```

---

## Task 2: Media helpers, API and query hooks

All frontend paths are relative to `packages/admin-dashboard/src`.

**Files:**
- Create: `features/media/media-utils.ts`, `features/media/media-api.ts`, `features/media/queries.ts`, `features/media/test-fixtures.ts`
- Test: `features/media/media-utils.test.ts`, `features/media/media-api.test.ts`

**Interfaces:**
- Produces:
  - `MediaCategory = 'image' | 'document' | 'video' | 'gpx'`; `mediaCategory(m: Pick<MediaFile, 'mimeType' | 'originalName'>) => MediaCategory`; `isImage(m) => boolean`
  - `previewUrl(m: MediaFile, size?: 'thumbnail' | 'small' | 'medium' | 'large') => string | undefined` (variant, else thumbnailUrl, else the original for images, else undefined)
  - `originalUrl(m) => string` (cdnUrl ?? blobUrl)
  - `formatBytes(n: number) => string`
  - `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`, `validateUpload(file: File) => string | null`
  - `matchesAccept(m: Pick<MediaFile, 'mimeType' | 'originalName'>, accept?: string[]) => boolean` (`image/*` wildcards; `.gpx` extension)
  - `media-api.ts`: `MediaListParams { page?; limit?; category?: 'image' | 'document' | 'video'; search?; ids?: string[] }`, `listMedia(params) => Promise<PaginatedResponse<MediaFile>>`, `getMedia(id) => Promise<MediaFile>`, `uploadMedia(file, onProgress?: (fraction: number) => void) => Promise<MediaFile>`, `updateMedia(id, { altText?, description?, tags? }) => Promise<MediaFile>`, `deleteMedia(id) => Promise<void>`, `getMediaUsage(id) => Promise<MediaUsageItem[]>` with `MediaUsageItem { id; title; status: EntryStatus; contentType: { id; name; slug } }`
  - `queries.ts`: `mediaKeys`, `useMediaList(params, options?)`, `useMedia(id?)`, `useMediaByIds(ids: string[])` (returns `Map<string, MediaFile>` and `isLoading`), `useMediaUsage(id?)`, `useMediaWrites() => { update(id, body), remove(id), invalidate() }`
  - `test-fixtures.ts`: `makeMedia(over?) => MediaFile`, `mediaPage(items, total?)`

- [ ] **Step 1: Write the fixtures `features/media/test-fixtures.ts`**

```ts
import type { MediaFile, PaginatedResponse } from '@/types'

export function makeMedia(over: Partial<MediaFile> = {}): MediaFile {
  return {
    id: 'm1',
    filename: 'a1b2-sumava.jpg',
    originalName: 'sumava.jpg',
    mimeType: 'image/jpeg',
    size: 245_000,
    blobUrl: 'http://blob/media/a1b2-sumava.jpg',
    width: 1600,
    height: 1067,
    thumbnailUrl: 'http://blob/media/a1b2-sumava-thumbnail.jpg',
    variants: [
      { name: 'thumbnail', width: 150, height: 100, url: 'http://blob/media/a1b2-sumava-thumbnail.jpg', size: 8000 },
      { name: 'small', width: 400, height: 267, url: 'http://blob/media/a1b2-sumava-small.jpg', size: 30000 },
    ],
    tags: [],
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
    ...over,
  }
}

export function mediaPage(items: MediaFile[], total = items.length, page = 1, limit = 24): PaginatedResponse<MediaFile> {
  return { success: true, data: items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } }
}
```

- [ ] **Step 2: Write the failing tests**

`features/media/media-utils.test.ts`:

```ts
import { formatBytes, isImage, matchesAccept, mediaCategory, originalUrl, previewUrl, validateUpload } from './media-utils'
import { makeMedia } from './test-fixtures'

const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type })

describe('mediaCategory', () => {
  it.each([
    ['image/png', 'x.png', 'image'],
    ['video/mp4', 'x.mp4', 'video'],
    ['application/pdf', 'x.pdf', 'document'],
    ['application/gpx+xml', 'x.gpx', 'gpx'],
    ['application/octet-stream', 'ride.GPX', 'gpx'],
  ])('%s %s is %s', (mimeType, originalName, expected) => {
    expect(mediaCategory({ mimeType, originalName })).toBe(expected)
  })
})

describe('previewUrl and originalUrl', () => {
  it('prefers the requested variant, then the thumbnail, then the original image', () => {
    const m = makeMedia()
    expect(previewUrl(m, 'small')).toBe('http://blob/media/a1b2-sumava-small.jpg')
    expect(previewUrl(m, 'large')).toBe('http://blob/media/a1b2-sumava-thumbnail.jpg')
    expect(previewUrl(makeMedia({ variants: [], thumbnailUrl: undefined }), 'small')).toBe('http://blob/media/a1b2-sumava.jpg')
  })
  it('has no preview for documents', () => {
    expect(previewUrl(makeMedia({ mimeType: 'application/pdf', variants: [], thumbnailUrl: undefined }))).toBeUndefined()
  })
  it('uses the CDN URL when present', () => {
    expect(originalUrl(makeMedia({ cdnUrl: 'https://cdn/a.jpg' }))).toBe('https://cdn/a.jpg')
    expect(isImage(makeMedia())).toBe(true)
  })
})

describe('formatBytes', () => {
  it.each([[512, '512 B'], [2048, '2 KB'], [245_000, '239 KB'], [5_500_000, '5.2 MB']])('%d is %s', (n, s) => {
    expect(formatBytes(n)).toBe(s)
  })
})

describe('validateUpload', () => {
  it('accepts supported files up to 10 MB', () => {
    expect(validateUpload(file('a.jpg', 'image/jpeg'))).toBeNull()
    expect(validateUpload(file('ride.gpx', ''))).toBeNull()
  })
  it('rejects large and unsupported files with a message', () => {
    expect(validateUpload(file('big.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1))).toBe('big.jpg is larger than 10 MB.')
    expect(validateUpload(file('run.exe', 'application/x-msdownload'))).toBe('run.exe is not a supported file type.')
  })
})

describe('matchesAccept', () => {
  it('handles wildcards, exact types and the gpx extension', () => {
    const img = { mimeType: 'image/png', originalName: 'a.png' }
    const gpx = { mimeType: 'application/octet-stream', originalName: 'ride.gpx' }
    expect(matchesAccept(img, undefined)).toBe(true)
    expect(matchesAccept(img, ['image/*'])).toBe(true)
    expect(matchesAccept(gpx, ['image/*'])).toBe(false)
    expect(matchesAccept(gpx, ['application/gpx+xml'])).toBe(true)
  })
})
```

`features/media/media-api.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- media-utils media-api`
Expected: FAIL, missing modules.

- [ ] **Step 4: Implement `features/media/media-utils.ts`**

```ts
import type { MediaFile } from '@/types'

export type MediaCategory = 'image' | 'document' | 'video' | 'gpx'
type MediaLike = Pick<MediaFile, 'mimeType' | 'originalName'>

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Mirrors packages/backend/src/config/upload.ts ALL_ALLOWED_MIME_TYPES.
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/gpx+xml', 'application/xml', 'text/xml',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
])

function isGpxName(name: string) {
  return name.toLowerCase().endsWith('.gpx')
}

export function mediaCategory(m: MediaLike): MediaCategory {
  if (m.mimeType === 'application/gpx+xml' || isGpxName(m.originalName)) return 'gpx'
  if (m.mimeType.startsWith('image/')) return 'image'
  if (m.mimeType.startsWith('video/')) return 'video'
  return 'document'
}

export function isImage(m: MediaLike): boolean {
  return mediaCategory(m) === 'image'
}

export function originalUrl(m: Pick<MediaFile, 'cdnUrl' | 'blobUrl'>): string {
  return m.cdnUrl || m.blobUrl
}

export function previewUrl(m: MediaFile, size: 'thumbnail' | 'small' | 'medium' | 'large' = 'small'): string | undefined {
  const variant = m.variants?.find((v) => v.name === size)
  if (variant) return variant.url
  if (m.thumbnailUrl) return m.thumbnailUrl
  return isImage(m) ? originalUrl(m) : undefined
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateUpload(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 10 MB.`
  if (!ALLOWED_TYPES.has(file.type) && !isGpxName(file.name)) return `${file.name} is not a supported file type.`
  return null
}

export function matchesAccept(m: MediaLike, accept?: string[]): boolean {
  if (!accept || accept.length === 0) return true
  return accept.some((rule) => {
    if (rule.endsWith('/*')) return m.mimeType.startsWith(rule.slice(0, -1))
    if (rule === 'application/gpx+xml') return mediaCategory(m) === 'gpx'
    return m.mimeType === rule
  })
}
```

- [ ] **Step 5: Implement `features/media/media-api.ts`**

```ts
import apiClient from '@/lib/api'
import type { ApiResponse, EntryStatus, MediaFile, PaginatedResponse } from '@/types'

export interface MediaListParams {
  page?: number
  limit?: number
  category?: 'image' | 'document' | 'video'
  search?: string
  ids?: string[]
}

export interface MediaUsageItem {
  id: string
  title: string
  status: EntryStatus
  contentType: { id: string; name: string; slug: string }
}

export async function listMedia(params: MediaListParams): Promise<PaginatedResponse<MediaFile>> {
  const query: Record<string, string | number> = {}
  if (params.page) query.page = params.page
  if (params.limit) query.limit = params.limit
  if (params.category) query.category = params.category
  if (params.search) query.search = params.search
  if (params.ids && params.ids.length > 0) query.ids = params.ids.join(',')
  return (await apiClient.get<PaginatedResponse<MediaFile>>('/media', { params: query })).data
}

export async function getMedia(id: string): Promise<MediaFile> {
  return (await apiClient.get<ApiResponse<MediaFile>>(`/media/${id}`)).data.data
}

export async function uploadMedia(file: File, onProgress?: (fraction: number) => void): Promise<MediaFile> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<ApiResponse<MediaFile>>('/media/upload', form, {
    // The client's default JSON content type would serialize FormData; axios adds the boundary.
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
  })
  return res.data.data
}

export async function updateMedia(id: string, body: { altText?: string; description?: string; tags?: string[] }): Promise<MediaFile> {
  return (await apiClient.patch<ApiResponse<MediaFile>>(`/media/${id}`, body)).data.data
}

export async function deleteMedia(id: string): Promise<void> {
  await apiClient.delete(`/media/${id}`)
}

export async function getMediaUsage(id: string): Promise<MediaUsageItem[]> {
  return (await apiClient.get<ApiResponse<MediaUsageItem[]>>(`/media/${id}/usage`)).data.data
}
```

- [ ] **Step 6: Implement `features/media/queries.ts`**

```ts
import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import type { MediaFile } from '@/types'
import { deleteMedia, getMedia, getMediaUsage, listMedia, updateMedia, type MediaListParams } from './media-api'

export const mediaKeys = {
  all: ['media'] as const,
  lists: () => [...mediaKeys.all, 'list'] as const,
  list: (params: MediaListParams) => [...mediaKeys.lists(), params] as const,
  item: (id: string) => [...mediaKeys.all, 'item', id] as const,
  byIds: (ids: string[]) => [...mediaKeys.all, 'ids', [...ids].sort().join(',')] as const,
  usage: (id: string) => [...mediaKeys.all, 'usage', id] as const,
}

export function useMediaList(params: MediaListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: mediaKeys.list(params),
    queryFn: () => listMedia(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useMedia(id?: string) {
  return useQuery({ queryKey: mediaKeys.item(id ?? ''), queryFn: () => getMedia(id!), enabled: !!id })
}

/** Batch lookup; ids missing from the result were deleted. */
export function useMediaByIds(ids: string[]) {
  const unique = useMemo(() => [...new Set(ids.filter(Boolean))], [ids])
  const query = useQuery({
    queryKey: mediaKeys.byIds(unique),
    queryFn: () => listMedia({ ids: unique, limit: 100 }),
    enabled: unique.length > 0,
    staleTime: 60_000,
  })
  const byId = useMemo(() => new Map<string, MediaFile>((query.data?.data ?? []).map((m) => [m.id, m])), [query.data])
  return { byId, isLoading: query.isLoading && unique.length > 0, isFetched: query.isFetched }
}

export function useMediaUsage(id?: string) {
  return useQuery({ queryKey: mediaKeys.usage(id ?? ''), queryFn: () => getMediaUsage(id!), enabled: !!id })
}

export function useMediaWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    return {
      invalidate,
      update: async (id: string, body: Parameters<typeof updateMedia>[1]) => {
        const media = await updateMedia(id, body)
        queryClient.setQueryData(mediaKeys.item(id), media)
        invalidate()
        return media
      },
      remove: async (id: string) => {
        await deleteMedia(id)
        queryClient.removeQueries({ queryKey: mediaKeys.item(id) })
        invalidate()
      },
    }
  }, [queryClient])
}
```

- [ ] **Step 7: Run tests and commit**

Run: `cd packages/admin-dashboard && pnpm test -- media-utils media-api`
Expected: PASS.

```bash
git add packages/admin-dashboard/src/features/media
git commit -m "feat(admin): media helpers, API and query hooks"
```

---

## Task 3: Upload queue, upload tray and file drop

**Files:**
- Create: `features/media/useUploadQueue.ts`, `features/media/useFileDrop.ts`, `features/media/components/UploadTray.tsx`
- Test: `features/media/useUploadQueue.test.tsx`

**Interfaces:**
- Consumes: `validateUpload`, `uploadMedia` (Task 2), `apiErrorMessage` (Plan 2).
- Produces:
  - `UploadItem { id: string; name: string; progress: number; status: 'queued' | 'uploading' | 'done' | 'error'; error?: string; media?: MediaFile }`
  - `useUploadQueue({ onUploaded?: (media: MediaFile) => void; concurrency?: number; upload?: typeof uploadMedia }) => { items: UploadItem[]; add(files: File[]): void; clearFinished(): void }`
  - `useFileDrop(onFiles: (files: File[]) => void, options?: { enabled?: boolean }) => { dragging: boolean }` (window-level; only reacts to drags that carry files)
  - `<UploadTray items onClear />`

- [ ] **Step 1: Write the failing test `features/media/useUploadQueue.test.tsx`**

```tsx
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- useUploadQueue`
Expected: FAIL, missing module.

- [ ] **Step 3: Implement `features/media/useUploadQueue.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaFile } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { uploadMedia } from './media-api'
import { validateUpload } from './media-utils'

export interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  media?: MediaFile
}

interface Options {
  onUploaded?: (media: MediaFile) => void
  concurrency?: number
  upload?: typeof uploadMedia
}

export function useUploadQueue({ onUploaded, concurrency = 3, upload = uploadMedia }: Options = {}) {
  const [items, setItems] = useState<UploadItem[]>([])
  const pendingRef = useRef<{ id: string; file: File }[]>([])
  const activeRef = useRef(0)
  const nextIdRef = useRef(0)
  const optionsRef = useRef({ onUploaded, concurrency, upload })
  useEffect(() => {
    optionsRef.current = { onUploaded, concurrency, upload }
  })

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...change } : item)))
  }, [])

  const pump = useCallback(() => {
    const { concurrency: limit, upload: run } = optionsRef.current
    while (activeRef.current < limit && pendingRef.current.length > 0) {
      const next = pendingRef.current.shift()!
      activeRef.current += 1
      patch(next.id, { status: 'uploading' })
      run(next.file, (progress) => patch(next.id, { progress }))
        .then((media) => {
          patch(next.id, { status: 'done', progress: 1, media })
          optionsRef.current.onUploaded?.(media)
        })
        .catch((error) => patch(next.id, { status: 'error', error: apiErrorMessage(error) }))
        .finally(() => {
          activeRef.current -= 1
          pump()
        })
    }
  }, [patch])

  const add = useCallback(
    (files: File[]) => {
      const created: UploadItem[] = files.map((file) => {
        const error = validateUpload(file)
        const id = `upload-${nextIdRef.current++}`
        if (!error) pendingRef.current.push({ id, file })
        return { id, name: file.name, progress: 0, status: error ? 'error' : 'queued', error: error ?? undefined }
      })
      setItems((prev) => [...prev, ...created])
      pump()
    },
    [pump],
  )

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status === 'queued' || item.status === 'uploading'))
  }, [])

  return { items, add, clearFinished }
}
```

- [ ] **Step 4: Implement `features/media/useFileDrop.ts` and `components/UploadTray.tsx`**

`features/media/useFileDrop.ts`:

```ts
import { useEffect, useRef, useState } from 'react'

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/** Detects files dragged anywhere over the window; calls onFiles on drop. */
export function useFileDrop(onFiles: (files: File[]) => void, { enabled = true }: { enabled?: boolean } = {}) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const onFilesRef = useRef(onFiles)
  useEffect(() => {
    onFilesRef.current = onFiles
  })

  useEffect(() => {
    if (!enabled) return
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current += 1
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) onFilesRef.current(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [enabled])

  return { dragging }
}
```

`features/media/components/UploadTray.tsx`:

```tsx
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UploadItem } from '../useUploadQueue'

export function UploadTray({ items, onClear }: { items: UploadItem[]; onClear: () => void }) {
  if (items.length === 0) return null
  const active = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length
  return (
    <section
      aria-label="Uploads"
      className="fixed right-4 bottom-20 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg md:bottom-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium" aria-live="polite">
          {active > 0 ? `Uploading ${active} file${active === 1 ? '' : 's'}…` : 'Uploads finished'}
        </h2>
        {active === 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
      <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <div className="flex items-center gap-2">
              {item.status === 'done' && <CheckCircle2 aria-hidden className="size-4 text-status-published-fg" />}
              {item.status === 'error' && <AlertCircle aria-hidden className="size-4 text-destructive" />}
              {(item.status === 'queued' || item.status === 'uploading') && <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
            </div>
            {item.status === 'uploading' && (
              <div role="progressbar" aria-label={`Uploading ${item.name}`} aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1 rounded-full bg-muted">
                <div className="h-1 rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />
              </div>
            )}
            {item.error && <p className="mt-0.5 text-xs text-destructive">{item.error}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 5: Run tests and commit**

Run: `cd packages/admin-dashboard && pnpm test -- useUploadQueue`
Expected: PASS.

```bash
git add packages/admin-dashboard/src/features/media
git commit -m "feat(admin): upload queue with progress, upload tray and window file drop"
```

---

## Task 4: Media tile, grid and filters

**Files:**
- Create: `features/media/components/MediaTile.tsx`, `MediaGrid.tsx`, `MediaFilters.tsx`
- Test: `features/media/components/MediaGrid.test.tsx`

**Interfaces:**
- Consumes: media utils (Task 2).
- Produces:
  - `<MediaThumb media size? className? />` (image preview or type icon; exported from `MediaTile.tsx`)
  - `<MediaGrid items label selectedIds? disabled?: (m) => boolean onActivate: (m) => void mode?: 'open' | 'select' />`: `open` renders each tile as a button that opens details; `select` renders toggle buttons with `aria-pressed`.
  - `MediaFilterValue { category?: 'image' | 'document' | 'video'; search: string }`, `<MediaFilters value onChange hideCategories? />` (search debounced 300 ms inside)

- [ ] **Step 1: Write the failing test `MediaGrid.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaGrid } from './MediaGrid'
import { MediaFilters } from './MediaFilters'
import { makeMedia } from '../test-fixtures'

const items = [
  makeMedia(),
  makeMedia({ id: 'm2', originalName: 'route.gpx', mimeType: 'application/gpx+xml', variants: [], thumbnailUrl: undefined }),
]

describe('MediaGrid', () => {
  it('shows image previews and type icons, and opens items', async () => {
    const onActivate = vi.fn()
    const { container } = render(<MediaGrid label="Media" items={items} onActivate={onActivate} />)
    // Decorative previews use alt="" (no img role), so select the element directly.
    expect(container.querySelector('img')).toHaveAttribute('src', 'http://blob/media/a1b2-sumava-small.jpg')
    expect(screen.getByText('GPX')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /route\.gpx/ }))
    expect(onActivate).toHaveBeenCalledWith(items[1])
  })

  it('in select mode shows selection and disabled items', async () => {
    const onActivate = vi.fn()
    render(<MediaGrid label="Media" mode="select" items={items} selectedIds={['m1']} disabled={(m) => m.id === 'm2'} onActivate={onActivate} />)
    expect(screen.getByRole('button', { name: /sumava\.jpg/ })).toHaveAttribute('aria-pressed', 'true')
    const gpx = screen.getByRole('button', { name: /route\.gpx/ })
    expect(gpx).toBeDisabled()
    await userEvent.click(gpx)
    expect(onActivate).not.toHaveBeenCalled()
  })
})

describe('MediaFilters', () => {
  it('changes category and debounces search', async () => {
    const onChange = vi.fn()
    render(<MediaFilters value={{ search: '' }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Images' }))
    expect(onChange).toHaveBeenLastCalledWith({ search: '', category: 'image' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search media' }), 'sum')
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ search: 'sum', category: undefined }))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- MediaGrid`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement the components**

`features/media/components/MediaTile.tsx`:

```tsx
import { FileText, Film, Route } from 'lucide-react'
import type { MediaFile } from '@/types'
import { cn } from '@/lib/utils'
import { mediaCategory, previewUrl } from '../media-utils'

const ICONS = { document: FileText, video: Film, gpx: Route } as const

export function MediaThumb({ media, size = 'small', className }: { media: MediaFile; size?: 'thumbnail' | 'small' | 'medium' | 'large'; className?: string }) {
  const src = previewUrl(media, size)
  const category = mediaCategory(media)
  if (src && category === 'image') {
    return <img src={src} alt={media.altText ?? ''} loading="lazy" className={cn('h-full w-full object-cover', className)} />
  }
  const Icon = category === 'image' ? FileText : ICONS[category]
  const ext = category === 'gpx' ? 'GPX' : (media.originalName.split('.').pop() ?? '').toUpperCase()
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary text-secondary-foreground', className)}>
      <Icon aria-hidden className="size-7" />
      <span className="text-[10px] font-semibold tracking-wide">{ext}</span>
    </div>
  )
}
```

`features/media/components/MediaGrid.tsx`:

```tsx
import { Check } from 'lucide-react'
import type { MediaFile } from '@/types'
import { cn } from '@/lib/utils'
import { MediaThumb } from './MediaTile'

interface MediaGridProps {
  items: MediaFile[]
  label: string
  mode?: 'open' | 'select'
  selectedIds?: string[]
  disabled?: (m: MediaFile) => boolean
  onActivate: (m: MediaFile) => void
}

export function MediaGrid({ items, label, mode = 'open', selectedIds = [], disabled, onActivate }: MediaGridProps) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((m) => {
        const selected = selectedIds.includes(m.id)
        const isDisabled = disabled?.(m) ?? false
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onActivate(m)}
              disabled={isDisabled}
              aria-pressed={mode === 'select' ? selected : undefined}
              title={isDisabled ? 'Not allowed for this field' : m.originalName}
              className={cn(
                'group relative block w-full overflow-hidden rounded-lg border bg-card text-left focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40',
                selected && 'ring-2 ring-primary',
              )}
            >
              <div className="aspect-square">
                <MediaThumb media={m} />
              </div>
              <span className="block truncate px-2 py-1.5 text-xs">{m.originalName}</span>
              {selected && (
                <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check aria-hidden className="size-4" />
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

`features/media/components/MediaFilters.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

export interface MediaFilterValue {
  category?: 'image' | 'document' | 'video'
  search: string
}

const CATEGORIES: { value?: MediaFilterValue['category']; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'video', label: 'Video' },
]

export function MediaFilters({ value, onChange, hideCategories = false }: { value: MediaFilterValue; onChange: (v: MediaFilterValue) => void; hideCategories?: boolean }) {
  const [search, setSearch] = useState(value.search)
  const debounced = useDebouncedValue(search, 300)

  // Mirror outside changes (back/forward, reset) into the input.
  const [synced, setSynced] = useState(value.search)
  if (value.search !== synced) {
    setSynced(value.search)
    if (value.search !== search.trim()) setSearch(value.search)
  }

  useEffect(() => {
    const next = debounced.trim()
    if (next !== value.search) onChange({ search: next, category: value.category })
    // Only react to the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      {!hideCategories && (
        <div role="group" aria-label="File type" className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => {
            const active = value.category === c.value
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ search: value.search, category: c.value })}
                className={cn('shrink-0 rounded-full border px-3 py-1 text-sm', active ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent')}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Search media" placeholder="Search by name, alt text or tag…" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-full pl-9" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/admin-dashboard && pnpm test -- MediaGrid`
Expected: PASS.

```bash
git add packages/admin-dashboard/src/features/media/components
git commit -m "feat(admin): media grid, thumbnails and filters"
```

---

## Task 5: Media library page and detail sheet

**Files:**
- Create: `features/media/components/MediaDetailSheet.tsx`, `features/media/pages/MediaLibraryPage.tsx`
- Modify: `modules/registry.tsx` (media route)
- Delete: `pages/Media/MediaLibrary.tsx`, `pages/Media/MediaUpload.tsx` (only after Task 6 removes their last importer: `components/MediaPicker.tsx`; delete them in Task 6 Step 7)
- Test: `features/media/pages/MediaLibraryPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 to 4, `ConfirmDialog`, `EmptyState`, `ErrorState`, `Pager`, `PageHeader`, `StatusPill`, `formatAbsolute`.
- Produces: `<MediaLibraryPage />` at `/media` with URL params `category`, `q`, `page`, `item` (open detail sheet); `<MediaDetailSheet mediaId onOpenChange />`.

- [ ] **Step 1: Write the failing test `MediaLibraryPage.test.tsx`**

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import * as api from '../media-api'
import { MediaLibraryPage } from './MediaLibraryPage'
import { makeMedia, mediaPage } from '../test-fixtures'

vi.mock('../media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../media-api')>()
  return { ...actual, listMedia: vi.fn(), getMedia: vi.fn(), uploadMedia: vi.fn(), updateMedia: vi.fn(), deleteMedia: vi.fn(), getMediaUsage: vi.fn() }
})

const routes = [
  { path: '/media', element: <MediaLibraryPage /> },
  { path: '/content/:id', element: <p>entry page</p> },
]

beforeEach(() => {
  vi.mocked(api.listMedia).mockResolvedValue(mediaPage([makeMedia(), makeMedia({ id: 'm2', originalName: 'route.gpx', mimeType: 'application/gpx+xml', variants: [], thumbnailUrl: undefined })]))
  vi.mocked(api.getMedia).mockImplementation(async (id) => (id === 'm1' ? makeMedia() : makeMedia({ id })))
  vi.mocked(api.getMediaUsage).mockResolvedValue([])
})

describe('MediaLibraryPage', () => {
  it('lists media and filters by type through the URL', async () => {
    const { router } = renderRoutes(routes, { route: '/media' })
    expect(await screen.findByRole('button', { name: /sumava\.jpg/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Images' }))
    await waitFor(() => expect(router.state.location.search).toBe('?category=image'))
    expect(api.listMedia).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'image', page: 1 }))
  })

  it('uploads files dropped anywhere and refreshes the grid', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'm3', originalName: 'new.png' }))
    renderRoutes(routes, { route: '/media' })
    await screen.findByRole('button', { name: /sumava\.jpg/ })
    const file = new File(['x'], 'new.png', { type: 'image/png' })
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'], files: [file] } })
    expect(await screen.findByText('Drop files to upload')).toBeInTheDocument()
    fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [file] } })
    await waitFor(() => expect(api.uploadMedia).toHaveBeenCalledWith(file, expect.any(Function)))
    expect(await screen.findByText('Uploads finished')).toBeInTheDocument()
    await waitFor(() => expect(api.listMedia).toHaveBeenCalledTimes(2))
  })

  it('opens details, flags missing alt text and saves metadata', async () => {
    vi.mocked(api.updateMedia).mockResolvedValue(makeMedia({ altText: 'Forest trail' }))
    const { router } = renderRoutes(routes, { route: '/media' })
    await userEvent.click(await screen.findByRole('button', { name: /sumava\.jpg/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?item=m1'))
    const sheet = await screen.findByRole('dialog', { name: 'sumava.jpg' })
    expect(within(sheet).getByText('Add alt text so people using screen readers know what the image shows.')).toBeInTheDocument()
    await userEvent.type(within(sheet).getByLabelText('Alt text'), 'Forest trail')
    await userEvent.type(within(sheet).getByLabelText('Tags'), 'bike, šumava')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(api.updateMedia).toHaveBeenCalledWith('m1', { altText: 'Forest trail', description: '', tags: ['bike', 'šumava'] })
  })

  it('shows where the file is used and warns before deleting it', async () => {
    vi.mocked(api.getMediaUsage).mockResolvedValue([
      { id: 'e1', title: 'Přes Šumavu', status: 'PUBLISHED', contentType: { id: 't', name: 'Trip', slug: 'trip' } },
      { id: 'e2', title: 'Krkonoše', status: 'DRAFT', contentType: { id: 't', name: 'Trip', slug: 'trip' } },
    ])
    vi.mocked(api.deleteMedia).mockResolvedValue()
    renderRoutes(routes, { route: '/media?item=m1' })
    const sheet = await screen.findByRole('dialog', { name: 'sumava.jpg' })
    expect(await within(sheet).findByRole('link', { name: 'Přes Šumavu' })).toHaveAttribute('href', '/content/e1')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Delete file' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText(/2 entries use this file/)).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(api.deleteMedia).toHaveBeenCalledWith('m1')
  })

  it('shows an empty state with an upload action', async () => {
    vi.mocked(api.listMedia).mockResolvedValue(mediaPage([]))
    renderRoutes(routes, { route: '/media' })
    expect(await screen.findByText('No media yet')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- MediaLibraryPage`
Expected: FAIL, missing module.

- [ ] **Step 3: Implement `MediaDetailSheet.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { MediaFile } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { formatAbsolute } from '@/lib/format'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatusPill } from '@/components/common/StatusPill'
import { useMedia, useMediaUsage, useMediaWrites } from '../queries'
import { formatBytes, isImage, originalUrl } from '../media-utils'
import { MediaThumb } from './MediaTile'

interface MediaDetailSheetProps {
  mediaId?: string
  onOpenChange: (open: boolean) => void
}

export function MediaDetailSheet({ mediaId, onOpenChange }: MediaDetailSheetProps) {
  const media = useMedia(mediaId)
  return (
    <Sheet open={!!mediaId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {media.data ? (
          <MediaDetails key={media.data.id} media={media.data} onDeleted={() => onOpenChange(false)} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Loading file</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 px-4"><Skeleton className="aspect-video w-full" /><Skeleton className="h-10 w-full" /></div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function MediaDetails({ media, onDeleted }: { media: MediaFile; onDeleted: () => void }) {
  const writes = useMediaWrites()
  const usage = useMediaUsage(media.id)
  const [altText, setAltText] = useState(media.altText ?? '')
  const [description, setDescription] = useState(media.description ?? '')
  const [tags, setTags] = useState((media.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean)
  const dirty = altText !== (media.altText ?? '') || description !== (media.description ?? '') || parsedTags.join(',') !== (media.tags ?? []).join(',')
  const usedIn = usage.data ?? []

  const save = async () => {
    setSaving(true)
    try {
      await writes.update(media.id, { altText, description, tags: parsedTags })
      toast.success('Details saved')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await writes.remove(media.id)
      toast.success(`Deleted ${media.originalName}`)
      onDeleted()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const copy = (url: string, label: string) => {
    void navigator.clipboard?.writeText(url).then(() => toast.success(`${label} URL copied`))
  }

  const urls = [{ label: 'Original', url: originalUrl(media) }, ...(media.variants ?? []).map((v) => ({ label: `${v.name[0].toUpperCase()}${v.name.slice(1)} (${v.width}×${v.height})`, url: v.url }))]

  return (
    <>
      <SheetHeader>
        <SheetTitle className="truncate font-serif text-xl">{media.originalName}</SheetTitle>
        <SheetDescription>
          {[media.width && media.height ? `${media.width}×${media.height}` : null, formatBytes(media.size), media.mimeType].filter(Boolean).join(' · ')}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
          <MediaThumb media={media} size="medium" className="object-contain" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="media-alt">Alt text</Label>
          <Input id="media-alt" value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={200} />
          {isImage(media) && !altText.trim() && (
            <p className="flex items-start gap-1.5 text-sm text-status-draft-fg">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              Add alt text so people using screen readers know what the image shows.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-description">Description</Label>
          <Textarea id="media-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-tags">Tags</Label>
          <Input id="media-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Separate tags with commas" />
        </div>
        <Button onClick={() => void save()} disabled={!dirty || saving} className="self-start">
          {saving ? 'Saving…' : 'Save'}
        </Button>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Links</h3>
          <ul className="flex flex-col gap-1">
            {urls.map((u) => (
              <li key={u.url} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{u.label}</span>
                <Button variant="ghost" size="sm" onClick={() => copy(u.url, u.label)} aria-label={`Copy ${u.label} URL`}>
                  <Copy aria-hidden />
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Used in</h3>
          {usage.isPending ? (
            <Skeleton className="h-8 w-full" />
          ) : usedIn.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not used in any entry.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {usedIn.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  <Link to={`/content/${u.id}`} className="min-w-0 flex-1 truncate hover:underline">{u.title}</Link>
                  <span className="text-xs text-muted-foreground">{u.contentType.name}</span>
                  <StatusPill status={u.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">Uploaded {formatAbsolute(media.createdAt)}</p>
        <Button variant="outline" className="self-start text-destructive" onClick={() => setConfirmDelete(true)}>
          Delete file
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${media.originalName}?`}
        description={
          usedIn.length > 0
            ? `${usedIn.length} ${usedIn.length === 1 ? 'entry uses' : 'entries use'} this file. They will show a missing file until you replace it.`
            : 'This permanently removes the file.'
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void remove()}
      />
    </>
  )
}
```

- [ ] **Step 4: Implement `MediaLibraryPage.tsx`**

```tsx
import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ImagePlus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Pager } from '@/components/common/Pager'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaList, useMediaWrites } from '../queries'
import { useUploadQueue } from '../useUploadQueue'
import { useFileDrop } from '../useFileDrop'
import { MediaGrid } from '../components/MediaGrid'
import { MediaFilters, type MediaFilterValue } from '../components/MediaFilters'
import { MediaDetailSheet } from '../components/MediaDetailSheet'
import { UploadTray } from '../components/UploadTray'

const PAGE_SIZE = 24
const CATEGORIES = ['image', 'document', 'video'] as const

export function MediaLibraryPage() {
  const [sp, setSp] = useSearchParams()
  const category = CATEGORIES.find((c) => c === sp.get('category'))
  const search = (sp.get('q') ?? '').slice(0, 100)
  const pageNo = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1)
  const itemId = sp.get('item') ?? undefined

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp)
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      setSp(next, { replace: true })
    },
    [sp, setSp],
  )

  const list = useMediaList({ category, search: search || undefined, page: pageNo, limit: PAGE_SIZE })
  const writes = useMediaWrites()
  const uploads = useUploadQueue({ onUploaded: () => writes.invalidate() })
  const fileInput = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: File[]) => {
    uploads.add(files)
    if (files.length) toast.message(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}`)
  }, [uploads])
  const { dragging } = useFileDrop(addFiles)

  const filters: MediaFilterValue = useMemo(() => ({ category, search }), [category, search])

  let body: React.ReactNode
  if (list.isPending) {
    body = (
      <div aria-busy="true" aria-label="Loading media" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-square w-full rounded-lg" />)}
      </div>
    )
  } else if (list.isError) {
    body = <ErrorState message="Could not load media." onRetry={() => void list.refetch()} />
  } else if (list.data.data.length === 0) {
    body = category || search
      ? <EmptyState icon={ImagePlus} title="No files match" action={<Button variant="outline" onClick={() => setParams({ category: undefined, q: undefined, page: undefined })}>Clear filters</Button>} />
      : <EmptyState icon={ImagePlus} title="No media yet" description="Drop files anywhere on this page, or choose them from your computer." action={<Button onClick={() => fileInput.current?.click()}>Upload files</Button>} />
  } else {
    body = (
      <>
        <MediaGrid label="Media" items={list.data.data} onActivate={(m) => setParams({ item: m.id })} />
        <Pager page={pageNo} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={(p) => setParams({ page: p > 1 ? String(p) : undefined })} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Media"
        description="Images, documents, videos and GPX tracks. Drop files anywhere to upload."
        actions={
          <Button onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden />
            Upload
          </Button>
        }
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        aria-hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <MediaFilters value={filters} onChange={(v) => setParams({ category: v.category, q: v.search || undefined, page: undefined })} />
      {body}
      <MediaDetailSheet mediaId={itemId} onOpenChange={(open) => !open && setParams({ item: undefined })} />
      <UploadTray items={uploads.items} onClear={uploads.clearFinished} />
      {dragging && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary px-10 py-8 font-serif text-2xl">Drop files to upload</div>
        </div>
      )}
    </>
  )
}
```

The drag overlay text sits in an `aria-hidden` element; the test finds it with `findByText`, which ignores `aria-hidden`, so that is fine.

- [ ] **Step 5: Route the new page**

In `modules/registry.tsx`, replace `import { MediaLibrary } from '@/pages/Media/MediaLibrary'` with `import { MediaLibraryPage } from '@/features/media/pages/MediaLibraryPage'` and the media route element with `<MediaLibraryPage />`.

- [ ] **Step 6: Run tests, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build`
Expected: PASS, build succeeds.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): media library with drop upload, detail sheet and usage-aware delete"
```

---

## Task 6: Shared media picker, new media field, rich text integration

**Files:**
- Create: `features/media/components/MediaPickerDialog.tsx`, `features/content/editor/fields/MediaField.tsx`
- Modify: `features/content/editor/fields/LegacyFields.tsx`, `features/content/editor/fields/FieldControl.tsx`, `components/RichTextEditor.tsx`
- Delete: `components/MediaPicker.tsx`, `components/MediaPickerDialog.tsx`, `pages/Media/MediaLibrary.tsx`, `pages/Media/MediaUpload.tsx`, `services/media.ts`
- Test: `features/media/components/MediaPickerDialog.test.tsx`, `features/content/editor/fields/MediaField.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 to 4; `FieldControlProps`, `describedBy` from `fields/field-aria.ts`; `FieldShell`.
- Produces:
  - `<MediaPickerDialog open onOpenChange onSelect: (media: MediaFile[]) => void multiple? accept?: string[] />`
  - `moveItem<T>(list: T[], from: number, to: number) => T[]` (exported from `MediaField.tsx`'s sibling `features/media/move-item.ts`)
  - `<MediaField {...FieldControlProps} />`

- [ ] **Step 1: Add dnd-kit**

```bash
cd /Users/pavelflajsman/personalGit/thecms
pnpm --filter admin-dashboard add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Write the failing tests**

`features/media/components/MediaPickerDialog.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import * as api from '../media-api'
import { MediaPickerDialog } from './MediaPickerDialog'
import { makeMedia, mediaPage } from '../test-fixtures'

vi.mock('../media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../media-api')>()
  return { ...actual, listMedia: vi.fn(), uploadMedia: vi.fn() }
})

const photo = makeMedia()
const gpx = makeMedia({ id: 'm2', originalName: 'route.gpx', mimeType: 'application/gpx+xml', variants: [], thumbnailUrl: undefined })

beforeEach(() => vi.mocked(api.listMedia).mockResolvedValue(mediaPage([photo, gpx])))

describe('MediaPickerDialog', () => {
  it('selects one item and confirms', async () => {
    const onSelect = vi.fn()
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />)
    await userEvent.click(await screen.findByRole('button', { name: /sumava\.jpg/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose 1 file' }))
    expect(onSelect).toHaveBeenCalledWith([photo])
  })

  it('only allows accepted types', async () => {
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={vi.fn()} accept={['application/gpx+xml']} />)
    expect(await screen.findByRole('button', { name: /sumava\.jpg/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /route\.gpx/ })).toBeEnabled()
  })

  it('limits the list to images for image-only fields', async () => {
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={vi.fn()} accept={['image/*']} />)
    await waitFor(() => expect(api.listMedia).toHaveBeenCalledWith(expect.objectContaining({ category: 'image' })))
  })

  it('selects files uploaded from inside the picker', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'm9', originalName: 'new.jpg' }))
    const onSelect = vi.fn()
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={onSelect} multiple />)
    await userEvent.upload(await screen.findByLabelText('Upload files'), new File(['x'], 'new.jpg', { type: 'image/jpeg' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Choose 1 file' }))
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: 'm9' })])
  })
})
```

`features/content/editor/fields/MediaField.test.tsx`:

```tsx
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { renderWithProviders } from '@/test/render'
import type { Field } from '@/types'
import * as api from '@/features/media/media-api'
import { makeMedia, mediaPage } from '@/features/media/test-fixtures'
import { moveItem } from '@/features/media/move-item'
import { MediaField } from './MediaField'

vi.mock('@/features/media/media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/media/media-api')>()
  return { ...actual, listMedia: vi.fn(), uploadMedia: vi.fn() }
})

const gallery: Field = { name: 'gallery', label: 'Gallery', type: 'MEDIA', required: false, validation: { multiple: true, allowedMimeTypes: ['image/*'] } }
const cover: Field = { name: 'cover', label: 'Cover', type: 'MEDIA', required: false }

function Harness({ field, initial }: { field: Field; initial: unknown }) {
  const [value, setValue] = useState<unknown>(initial)
  return (
    <>
      <MediaField field={field} id="f" value={value} onChange={setValue} onBlur={() => {}} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

const a = makeMedia({ id: 'a', originalName: 'a.jpg' })
const b = makeMedia({ id: 'b', originalName: 'b.jpg' })

beforeEach(() => {
  vi.mocked(api.listMedia).mockImplementation(async (p) => mediaPage([a, b].filter((m) => !p.ids || p.ids.includes(m.id))))
})

it('moveItem reorders', () => {
  expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
})

describe('MediaField', () => {
  it('shows thumbnails in order and reorders with the keyboard buttons', async () => {
    renderWithProviders(<Harness field={gallery} initial={['a', 'b']} />)
    const list = await screen.findByRole('list', { name: 'Gallery files' })
    await waitFor(() => expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('a.jpg'), expect.stringContaining('b.jpg')]))
    await userEvent.click(screen.getByRole('button', { name: 'Move b.jpg earlier' }))
    expect(screen.getByTestId('value')).toHaveTextContent('["b","a"]')
  })

  it('shows a removable tile for a deleted file', async () => {
    renderWithProviders(<Harness field={gallery} initial={['a', 'gone']} />)
    expect(await screen.findByText('Missing file')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove missing file' }))
    expect(screen.getByTestId('value')).toHaveTextContent('["a"]')
  })

  it('uploads files dropped on the field and adds them', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'c', originalName: 'c.jpg' }))
    renderWithProviders(<Harness field={gallery} initial={['a']} />)
    const zone = await screen.findByRole('group', { name: 'Gallery' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('["a","c"]'))
  })

  it('rejects dropped files the field does not accept', async () => {
    renderWithProviders(<Harness field={gallery} initial={[]} />)
    const zone = await screen.findByRole('group', { name: 'Gallery' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'route.gpx', { type: 'application/gpx+xml' })] } })
    expect(await screen.findByText('route.gpx is not allowed in Gallery.')).toBeInTheDocument()
    expect(api.uploadMedia).not.toHaveBeenCalled()
  })

  it('replaces a single file value', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'c', originalName: 'c.jpg' }))
    renderWithProviders(<Harness field={cover} initial="a" />)
    const zone = await screen.findByRole('group', { name: 'Cover' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('"c"'))
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- MediaPickerDialog MediaField`
Expected: FAIL, missing modules.

- [ ] **Step 4: Implement `features/media/move-item.ts` and `MediaPickerDialog.tsx`**

`features/media/move-item.ts`:

```ts
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
```

`features/media/components/MediaPickerDialog.tsx`:

```tsx
import { useState } from 'react'
import { Upload } from 'lucide-react'
import type { MediaFile } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pager } from '@/components/common/Pager'
import { useMediaList, useMediaWrites } from '../queries'
import { useUploadQueue } from '../useUploadQueue'
import { matchesAccept } from '../media-utils'
import { MediaGrid } from './MediaGrid'
import { MediaFilters, type MediaFilterValue } from './MediaFilters'
import { UploadTray } from './UploadTray'

interface MediaPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (media: MediaFile[]) => void
  multiple?: boolean
  /** MIME rules such as "image/*" or "application/gpx+xml". */
  accept?: string[]
}

const PAGE_SIZE = 20

export function MediaPickerDialog({ open, onOpenChange, onSelect, multiple = false, accept }: MediaPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        {open && <PickerBody onSelect={(m) => { onSelect(m); onOpenChange(false) }} multiple={multiple} accept={accept} />}
      </DialogContent>
    </Dialog>
  )
}

function PickerBody({ onSelect, multiple, accept }: { onSelect: (m: MediaFile[]) => void; multiple: boolean; accept?: string[] }) {
  const imagesOnly = !!accept && accept.length > 0 && accept.every((a) => a.startsWith('image/'))
  const [filters, setFilters] = useState<MediaFilterValue>({ search: '', category: imagesOnly ? 'image' : undefined })
  const [pageNo, setPageNo] = useState(1)
  const [selected, setSelected] = useState<MediaFile[]>([])
  const writes = useMediaWrites()
  const list = useMediaList({ category: filters.category, search: filters.search || undefined, page: pageNo, limit: PAGE_SIZE })

  const toggle = (m: MediaFile) => {
    setSelected((prev) => {
      if (prev.some((s) => s.id === m.id)) return prev.filter((s) => s.id !== m.id)
      return multiple ? [...prev, m] : [m]
    })
  }

  const uploads = useUploadQueue({
    onUploaded: (m) => {
      writes.invalidate()
      if (matchesAccept(m, accept)) setSelected((prev) => (multiple ? [...prev, m] : [m]))
    },
  })

  const items = list.data?.data ?? []
  const shown = [...selected.filter((s) => !items.some((i) => i.id === s.id)), ...items]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">Choose {multiple ? 'files' : 'a file'}</DialogTitle>
        <DialogDescription>Pick from your library or upload new files.</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-accent">
          <Upload aria-hidden className="size-4" />
          Upload
          <input type="file" multiple={multiple} aria-label="Upload files" className="sr-only" onChange={(e) => { uploads.add(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </label>
      </div>
      <MediaFilters value={filters} hideCategories={imagesOnly} onChange={(v) => { setFilters(v); setPageNo(1) }} />
      {list.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-square w-full" />)}</div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No files found. Upload one to get started.</p>
      ) : (
        <MediaGrid label="Files" mode="select" items={shown} selectedIds={selected.map((s) => s.id)} disabled={(m) => !matchesAccept(m, accept)} onActivate={toggle} />
      )}
      {list.data && <Pager page={pageNo} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={setPageNo} />}
      <UploadTray items={uploads.items} onClear={uploads.clearFinished} />
      <DialogFooter>
        <Button disabled={selected.length === 0} onClick={() => onSelect(selected)}>
          {selected.length === 0 ? 'Choose' : `Choose ${selected.length} file${selected.length === 1 ? '' : 's'}`}
        </Button>
      </DialogFooter>
    </>
  )
}
```

- [ ] **Step 5: Implement `features/content/editor/fields/MediaField.tsx`**

```tsx
import { useState, type DragEvent } from 'react'
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Upload, X } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MediaFile } from '@/types'
import { Button } from '@/components/ui/button'
import { useMediaByIds, useMediaWrites } from '@/features/media/queries'
import { useUploadQueue } from '@/features/media/useUploadQueue'
import { matchesAccept } from '@/features/media/media-utils'
import { moveItem } from '@/features/media/move-item'
import { MediaThumb } from '@/features/media/components/MediaTile'
import { MediaPickerDialog } from '@/features/media/components/MediaPickerDialog'
import { FieldShell } from './FieldShell'
import { describedBy, type FieldControlProps } from './field-aria'

export function MediaField({ field, id, value, onChange, onBlur, error, disabled }: FieldControlProps) {
  const multiple = !!field.validation?.multiple
  const accept = field.validation?.allowedMimeTypes
  const ids = multiple ? (Array.isArray(value) ? (value as string[]) : []) : typeof value === 'string' && value ? [value] : []
  const { byId, isLoading } = useMediaByIds(ids)
  const writes = useMediaWrites()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const commit = (next: string[]) => {
    onChange(multiple ? next : next[0])
    onBlur()
  }
  const add = (media: MediaFile[]) => commit(multiple ? [...ids, ...media.map((m) => m.id).filter((m) => !ids.includes(m))] : media.slice(-1).map((m) => m.id))

  const uploads = useUploadQueue({
    onUploaded: (m) => {
      writes.invalidate()
      add([m])
    },
  })

  const upload = (files: File[]) => {
    const label = field.label || field.name
    const rejected = files.filter((f) => !matchesAccept({ mimeType: f.type, originalName: f.name }, accept))
    setDropError(rejected.length ? rejected.map((f) => `${f.name} is not allowed in ${label}.`).join(' ') : null)
    const ok = files.filter((f) => !rejected.includes(f))
    uploads.add(multiple ? ok : ok.slice(0, 1))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (disabled) return
    upload(Array.from(e.dataTransfer?.files ?? []))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    commit(moveItem(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <FieldShell field={field} id={id} error={error ?? dropError ?? undefined}>
      <div
        role="group"
        aria-label={field.label || field.name}
        onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-lg border border-dashed p-3 transition-colors ${dragOver ? 'border-primary bg-accent' : 'bg-card'}`}
      >
        {ids.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <ul aria-label={`${field.label || field.name} files`} className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {ids.map((mediaId, index) => (
                  <MediaItem
                    key={mediaId}
                    mediaId={mediaId}
                    media={byId.get(mediaId)}
                    loading={isLoading}
                    sortable={multiple && !disabled}
                    first={index === 0}
                    last={index === ids.length - 1}
                    onMove={(delta) => commit(moveItem(ids, index, index + delta))}
                    onRemove={disabled ? undefined : () => commit(ids.filter((x) => x !== mediaId))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        {!disabled && (
          <div className="flex flex-wrap items-center gap-2">
            <Button id={id} type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} {...describedBy(id, field, error)}>
              <ImagePlus aria-hidden />
              {ids.length && !multiple ? 'Replace' : 'Choose from library'}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-accent">
              <Upload aria-hidden className="size-4" />
              Upload
              <input type="file" multiple={multiple} className="sr-only" aria-label={`Upload to ${field.label || field.name}`} onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            </label>
            <span className="text-xs text-muted-foreground">or drop files here</span>
          </div>
        )}
        {uploads.items.some((u) => u.status === 'uploading' || u.status === 'queued') && (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">Uploading…</p>
        )}
      </div>
      <MediaPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={add} multiple={multiple} accept={accept} />
    </FieldShell>
  )
}

interface MediaItemProps {
  mediaId: string
  media?: MediaFile
  loading: boolean
  sortable: boolean
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onRemove?: () => void
}

function MediaItem({ mediaId, media, loading, sortable, first, last, onMove, onRemove }: MediaItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mediaId, disabled: !sortable })
  const name = media?.originalName ?? (loading ? 'Loading' : 'Missing file')
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="group relative overflow-hidden rounded-md border bg-background">
      <div className="aspect-square">
        {media ? <MediaThumb media={media} size="thumbnail" /> : (
          <div className="grid h-full place-items-center p-2 text-center text-xs text-muted-foreground">{loading ? '' : 'Missing file'}</div>
        )}
      </div>
      <p className="truncate px-1.5 py-1 text-[11px]">{media?.originalName ?? (loading ? '…' : '')}</p>
      <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {sortable ? (
          <span className="flex gap-0.5">
            <button type="button" {...attributes} {...listeners} aria-label={`Drag ${name}`} className="rounded bg-background/90 p-0.5"><GripVertical aria-hidden className="size-3.5" /></button>
            {!first && <button type="button" onClick={() => onMove(-1)} aria-label={`Move ${name} earlier`} className="rounded bg-background/90 p-0.5"><ArrowLeft aria-hidden className="size-3.5" /></button>}
            {!last && <button type="button" onClick={() => onMove(1)} aria-label={`Move ${name} later`} className="rounded bg-background/90 p-0.5"><ArrowRight aria-hidden className="size-3.5" /></button>}
          </span>
        ) : <span />}
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${media ? media.originalName : 'missing file'}`} className="rounded bg-background/90 p-0.5">
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  )
}
```

- [ ] **Step 6: Wire the field and the rich text editor**

In `features/content/editor/fields/LegacyFields.tsx`: delete the `MediaField` function and the `MediaPicker` import.

In `features/content/editor/fields/FieldControl.tsx`: change `import { MediaField, RichTextField } from './LegacyFields'` to `import { RichTextField } from './LegacyFields'` and add `import { MediaField } from './MediaField'`.

In `components/RichTextEditor.tsx`:
- Replace `import { MediaPickerDialog } from './MediaPickerDialog';` with `import { MediaPickerDialog } from '@/features/media/components/MediaPickerDialog';`.
- Change `handleGallerySelect` to take `(media: MediaFile[])` and use `const file = media[0];` (remove the `Array.isArray` line).
- Replace the `<MediaPickerDialog open={galleryOpen} onClose={...} onSelect={handleGallerySelect} allowedMimeTypes={['image/*']} />` element with:

```tsx
      <MediaPickerDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={handleGallerySelect}
        accept={['image/*']}
      />
```

- [ ] **Step 7: Delete the legacy media code**

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q src/components/MediaPicker.tsx src/components/MediaPickerDialog.tsx src/pages/Media/MediaLibrary.tsx src/pages/Media/MediaUpload.tsx src/services/media.ts
grep -rn "components/MediaPicker\|pages/Media/\|services/media" src || echo "no references"
```

Expected: `no references`.

- [ ] **Step 8: Update the editor test mock**

`features/content/pages/EntryEditorPage.test.tsx` and `EntryEditorPage.review.test.tsx` mock `@/components/MediaPicker`, which no longer exists. In both files replace that `vi.mock` line with:

```tsx
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))
```

- [ ] **Step 9: Run tests, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/features src/components/common src/app src/modules`
Expected: PASS, build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard pnpm-lock.yaml
git commit -m "feat(admin): shared media picker, media field with reorder and drop upload"
```

---

## Task 7: Entry thumbnails in the Content list

**Files:**
- Modify: `features/content/pages/ContentListPage.tsx`
- Test: `features/content/pages/ContentListPage.test.tsx`

**Interfaces:**
- Consumes: `useMediaByIds`, `MediaThumb`, `isImage` (Tasks 2 and 4).
- Produces: `coverMediaId(entry: EntryListItem, type?: ContentType) => string | undefined` (first single MEDIA field's value), exported from `ContentListPage.tsx`'s sibling `features/content/cover.ts`.

- [ ] **Step 1: Write the failing tests**

Create `features/content/cover.test.ts`:

```ts
import type { ContentType } from '@/types'
import { coverMediaId } from './cover'
import { makeListItem, tripType } from './test-fixtures'

const withCover: ContentType = {
  ...tripType,
  fields: [...tripType.fields, { name: 'gallery', label: 'Gallery', type: 'MEDIA', required: false, validation: { multiple: true } }, { name: 'cover', label: 'Cover', type: 'MEDIA', required: false }],
}

it('uses the first single media field', () => {
  expect(coverMediaId(makeListItem({ data: { title: 'x', gallery: ['g1'], cover: 'c1' } }), withCover)).toBe('c1')
  expect(coverMediaId(makeListItem({ data: { title: 'x' } }), withCover)).toBeUndefined()
  expect(coverMediaId(makeListItem(), undefined)).toBeUndefined()
})
```

In `ContentListPage.test.tsx`, add `import { makeMedia, mediaPage } from '@/features/media/test-fixtures'`, `import * as mediaApi from '@/features/media/media-api'`, this mock:

```tsx
vi.mock('@/features/media/media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/media/media-api')>()
  return { ...actual, listMedia: vi.fn() }
})
```

and this test inside the `describe`:

```tsx
  it('shows the cover image as a thumbnail', async () => {
    const coverType = { ...tripType, fields: [...tripType.fields, { name: 'cover', label: 'Cover', type: 'MEDIA' as const, required: false }] }
    vi.mocked(api.listContentTypes).mockResolvedValue([coverType, postType])
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem({ data: { title: 'Přes Šumavu', cover: 'm1' } })]))
    vi.mocked(mediaApi.listMedia).mockResolvedValue(mediaPage([makeMedia({ id: 'm1' })]))
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    await waitFor(() => expect(table.querySelector('img')).toHaveAttribute('src', 'http://blob/media/a1b2-sumava-thumbnail.jpg'))
    expect(mediaApi.listMedia).toHaveBeenCalledWith({ ids: ['m1'], limit: 100 })
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- cover ContentListPage`
Expected: FAIL: missing `./cover`; no `img` in the table.

- [ ] **Step 3: Implement**

`features/content/cover.ts`:

```ts
import type { ContentType, EntryListItem } from '@/types'

export function coverMediaId(entry: EntryListItem, type?: ContentType): string | undefined {
  const field = type?.fields.find((f) => f.type === 'MEDIA' && !f.validation?.multiple)
  const value = field ? entry.data[field.name] : undefined
  return typeof value === 'string' && value ? value : undefined
}
```

In `ContentListPage.tsx`:
- Add imports: `import type { MediaFile } from '@/types'` (merge with the existing `EntryListItem` type import), `import { useMediaByIds } from '@/features/media/queries'`, `import { MediaThumb } from '@/features/media/components/MediaTile'`, `import { isImage } from '@/features/media/media-utils'`, `import { coverMediaId } from '../cover'`.
- After `typeById` add:

```tsx
  const coverIds = useMemo(
    () => (list.data?.data ?? []).map((e) => coverMediaId(e, e.contentType ? typeById.get(e.contentType.id) : undefined)).filter((id): id is string => !!id),
    [list.data, typeById],
  )
  const covers = useMediaByIds(coverIds)
  const coverFor = (e: EntryListItem) => {
    const id = coverMediaId(e, e.contentType ? typeById.get(e.contentType.id) : undefined)
    return id ? covers.byId.get(id) : undefined
  }
```

- Change `TypeBadge` to accept an optional cover and render it:

```tsx
function TypeBadge({ entry, cover }: { entry: EntryListItem; cover?: MediaFile }) {
  if (cover && isImage(cover)) {
    return (
      <span className="size-8 shrink-0 overflow-hidden rounded-md border">
        <MediaThumb media={cover} size="thumbnail" />
      </span>
    )
  }
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary font-serif text-sm font-semibold text-secondary-foreground">
      {(entry.contentType?.name ?? '?').charAt(0).toUpperCase()}
    </span>
  )
}
```

- Pass the cover everywhere a badge renders: in the Title column make the cell `(e) => <span className="flex items-center gap-3"><TypeBadge entry={e} cover={coverFor(e)} /><TitleLink entry={e} /></span>`, change `TypeLabel` to render only the type name (remove its `TypeBadge`), and in `mobileRow` use `<TypeBadge entry={e} cover={coverFor(e)} />`.

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/admin-dashboard && pnpm test`
Expected: PASS.

```bash
git add packages/admin-dashboard/src/features/content
git commit -m "feat(admin): cover thumbnails in the content list"
```

---

## Task 8: Home

**Files:**
- Create: `features/sites/sites-api.ts`, `features/home/home-utils.ts`, `features/home/components/SetupChecklist.tsx`, `features/home/components/ConnectSnippet.tsx`, `features/home/pages/HomePage.tsx`
- Modify: `modules/registry.tsx` (home route)
- Delete: `pages/Dashboard.tsx`
- Test: `features/home/home-utils.test.ts`, `features/home/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `useStats` (Plan 1), `useContentTypes`, `useEntryList` (Plan 2), `useAuth`.
- Produces:
  - `sites-api.ts`: `Site` type (re-exported from `@/services/sites`), `useSites()` (React Query over `sitesService.list(1, 100)`).
  - `home-utils.ts`: `SetupStep { id: 'signin' | 'model' | 'entry' | 'site'; title; description; done: boolean; to?: string; cta?: string }`, `getSetupSteps(stats) => SetupStep[]`, `greeting(date: Date, name?: string) => string`, `publicApiBase() => string`, `readSetupDismissed() => boolean`, `writeSetupDismissed() => void`.
  - `<HomePage />` at `/`.

- [ ] **Step 1: Write the failing tests**

`features/home/home-utils.test.ts`:

```ts
import { getSetupSteps, greeting, publicApiBase, readSetupDismissed, writeSetupDismissed } from './home-utils'
import type { DashboardStats } from '@/types'

const stats = (over: Partial<DashboardStats> = {}): DashboardStats => ({
  entries: { total: 0, draft: 0, published: 0, archived: 0, byType: {} },
  contentTypes: 0,
  media: 0,
  sites: 0,
  submissions: { unread: 0 },
  ...over,
})

describe('getSetupSteps', () => {
  it('marks steps done from the stats', () => {
    expect(getSetupSteps(stats()).map((s) => [s.id, s.done])).toEqual([['signin', true], ['model', false], ['entry', false], ['site', false]])
    const done = getSetupSteps(stats({ contentTypes: 1, sites: 1, entries: { total: 3, draft: 3, published: 0, archived: 0, byType: {} } }))
    expect(done.every((s) => s.done)).toBe(true)
  })
  it('links each open step to where it is done', () => {
    expect(getSetupSteps(stats()).map((s) => s.to)).toEqual([undefined, '/content-types/new', '/content/new', '/sites/new'])
  })
})

describe('greeting', () => {
  it.each([
    [new Date(2026, 8, 29, 8), 'Good morning, Pavel'],
    [new Date(2026, 8, 29, 14), 'Good afternoon, Pavel'],
    [new Date(2026, 8, 29, 21), 'Good evening, Pavel'],
  ])('%s', (date, expected) => {
    expect(greeting(date, 'Pavel Flajsman')).toBe(expected)
  })
  it('works without a name', () => {
    expect(greeting(new Date(2026, 8, 29, 8))).toBe('Good morning')
  })
})

describe('setup dismissal', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
  it('remembers dismissal', () => {
    expect(readSetupDismissed()).toBe(false)
    writeSetupDismissed()
    expect(readSetupDismissed()).toBe(true)
  })
  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readSetupDismissed()).toBe(false)
    expect(() => writeSetupDismissed()).not.toThrow()
  })
})

it('publicApiBase ends with /public', () => {
  expect(publicApiBase()).toMatch(/\/api\/v1\/public$/)
})
```

`features/home/pages/HomePage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import type { DashboardStats } from '@/types'
import * as contentApi from '@/features/content/content-api'
import { makeListItem, page, tripType } from '@/features/content/test-fixtures'
import { sitesService } from '@/services/sites'
import { HomePage } from './HomePage'

const statsState = vi.hoisted(() => ({ value: null as unknown as DashboardStats }))
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({ data: statsState.value, isPending: false }),
  useUnreadCount: () => statsState.value.submissions.unread,
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Pavel Flajsman', email: 'p@x' } }) }))
vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, listEntries: vi.fn(), listContentTypes: vi.fn() }
})
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn() } }))

const base: DashboardStats = {
  entries: { total: 0, draft: 0, published: 0, archived: 0, byType: {} },
  contentTypes: 0,
  media: 0,
  sites: 0,
  submissions: { unread: 0 },
}

const routes = [{ path: '/', element: <HomePage /> }]

beforeEach(() => {
  localStorage.clear()
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(contentApi.listEntries).mockResolvedValue(page([makeListItem({ title: 'Krkonoše 2026' })]))
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })
})

describe('HomePage', () => {
  it('guides a new install through setup', async () => {
    statsState.value = base
    renderRoutes(routes)
    expect(await screen.findByRole('heading', { name: 'Welcome to TheCMS' })).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: 'Setup steps' })
    expect(within(steps).getByRole('link', { name: 'Create a model' })).toHaveAttribute('href', '/content-types/new')
    expect(within(steps).getByText('Sign in')).toBeInTheDocument()
  })

  it('shows a working API snippet once a site exists', async () => {
    statsState.value = { ...base, contentTypes: 1, sites: 1 }
    vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [{ id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_secret_123', isActive: true, requestCount: 0, createdAt: '', updatedAt: '' }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
    renderRoutes(routes)
    const code = await screen.findByLabelText('Fetch example')
    expect(code).toHaveTextContent('/api/v1/public/content/trip')
    expect(code).toHaveTextContent('cms_secret_123')
  })

  it('can dismiss the checklist', async () => {
    statsState.value = base
    renderRoutes(routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Hide setup guide' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Pavel/ })).toBeInTheDocument()
  })

  it('shows the work queue for an active install', async () => {
    statsState.value = { ...base, contentTypes: 1, sites: 1, media: 61, entries: { total: 23, draft: 4, published: 18, archived: 1, byType: {} }, submissions: { unread: 3 } }
    renderRoutes(routes)
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Pavel/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /3\s*unread messages/i })).toHaveAttribute('href', '/inbox')
    expect(await screen.findByRole('link', { name: 'Krkonoše 2026' })).toHaveAttribute('href', '/content/e1')
    expect(screen.getByRole('link', { name: '+ Trip' })).toHaveAttribute('href', `/content/new?type=${tripType.id}`)
    expect(contentApi.listEntries).toHaveBeenCalledWith(expect.objectContaining({ status: 'DRAFT', sortBy: 'updatedAt', limit: 5 }))
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- home-utils HomePage`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `features/sites/sites-api.ts` and `features/home/home-utils.ts`**

`features/sites/sites-api.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { sitesService, type Site } from '@/services/sites'

export type { Site }

export const siteKeys = { all: ['sites'] as const }

export function useSites() {
  return useQuery({
    queryKey: siteKeys.all,
    queryFn: async () => (await sitesService.list(1, 100)).data,
    staleTime: 60_000,
  })
}
```

`features/home/home-utils.ts`:

```ts
import type { DashboardStats } from '@/types'

export interface SetupStep {
  id: 'signin' | 'model' | 'entry' | 'site'
  title: string
  description: string
  done: boolean
  to?: string
  cta?: string
}

export function getSetupSteps(stats: DashboardStats): SetupStep[] {
  return [
    { id: 'signin', title: 'Sign in', description: 'You are in.', done: true },
    { id: 'model', title: 'Create a content model', description: 'Define the fields your content has, for example a blog post.', done: stats.contentTypes > 0, to: '/content-types/new', cta: 'Create a model' },
    { id: 'entry', title: 'Write your first entry', description: 'Add content using your model.', done: stats.entries.total > 0, to: '/content/new', cta: 'Write an entry' },
    { id: 'site', title: 'Connect a site', description: 'Get an API key so your website can read published content.', done: stats.sites > 0, to: '/sites/new', cta: 'Connect a site' },
  ]
}

export function greeting(date: Date, name?: string): string {
  const hour = date.getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = name?.trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}

export function publicApiBase(): string {
  const admin = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api/v1'
  return `${admin.replace(/\/$/, '')}/public`
}

const DISMISS_KEY = 'thecms-setup-dismissed'

export function readSetupDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSetupDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Storage unavailable: the guide simply stays hidden for this visit.
  }
}
```

- [ ] **Step 4: Implement the Home components**

`features/home/components/ConnectSnippet.tsx`:

```tsx
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '../home-utils'

export function ConnectSnippet({ apiKey, slug }: { apiKey: string; slug: string }) {
  const code = `fetch('${publicApiBase()}/content/${slug}', {
  headers: { 'X-API-Key': '${apiKey}' },
})
  .then((res) => res.json())
  .then(({ data }) => console.log(data))`
  return (
    <div className="mt-3 rounded-lg border bg-muted/60">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>JavaScript</span>
        <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success('Snippet copied'))}>
          <Copy aria-hidden />
          Copy
        </Button>
      </div>
      <pre aria-label="Fetch example" className="overflow-x-auto p-3 text-xs"><code>{code}</code></pre>
    </div>
  )
}
```

`features/home/components/SetupChecklist.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { ContentType } from '@/types'
import type { Site } from '@/features/sites/sites-api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SetupStep } from '../home-utils'
import { ConnectSnippet } from './ConnectSnippet'

interface SetupChecklistProps {
  steps: SetupStep[]
  firstSite?: Site
  firstType?: ContentType
  onDismiss: () => void
}

export function SetupChecklist({ steps, firstSite, firstType, onDismiss }: SetupChecklistProps) {
  const nextId = steps.find((s) => !s.done)?.id
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Welcome to TheCMS</h1>
          <p className="mt-1 text-muted-foreground">Four steps to your first published content. About 5 minutes.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>Hide setup guide</Button>
      </div>
      <ol aria-label="Setup steps" className="flex flex-col divide-y rounded-xl border bg-card">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3 p-4">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                step.done ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {step.done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('font-medium', step.done && 'text-muted-foreground line-through')}>
                {step.title}
                <span className="sr-only">{step.done ? ' (done)' : ''}</span>
              </p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
              {step.id === 'site' && step.done && firstSite && firstType && <ConnectSnippet apiKey={firstSite.apiKey} slug={firstType.slug} />}
            </div>
            {!step.done && step.to && (
              <Button asChild size="sm" variant={step.id === nextId ? 'default' : 'outline'}>
                <Link to={step.to}>{step.cta}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
```

`features/home/pages/HomePage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStats } from '@/lib/queries/stats'
import { useContentTypes, useEntryList } from '@/features/content/queries'
import { useSites } from '@/features/sites/sites-api'
import { formatRelative } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getSetupSteps, greeting, readSetupDismissed, writeSetupDismissed } from '../home-utils'
import { SetupChecklist } from '../components/SetupChecklist'

export function HomePage() {
  const { user } = useAuth()
  const stats = useStats()
  const types = useContentTypes()
  const sites = useSites()
  const [dismissed, setDismissed] = useState(readSetupDismissed)
  const drafts = useEntryList({ status: 'DRAFT', sortBy: 'updatedAt', sortOrder: 'desc', limit: 5 })

  if (!stats.data) {
    return (
      <div aria-busy="true" aria-label="Loading home" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const steps = getSetupSteps(stats.data)
  if (!dismissed && steps.some((s) => !s.done)) {
    return (
      <SetupChecklist
        steps={steps}
        firstSite={sites.data?.[0]}
        firstType={types.data?.[0]}
        onDismiss={() => {
          writeSetupDismissed()
          setDismissed(true)
        }}
      />
    )
  }

  const s = stats.data
  const tiles = [
    { label: 'entries', value: s.entries.total, to: '/content' },
    { label: 'drafts', value: s.entries.draft, to: '/content?status=DRAFT' },
    { label: 'unread messages', value: s.submissions.unread, to: '/inbox' },
    { label: 'media files', value: s.media, to: '/media' },
  ]

  return (
    <>
      <h1 className="mb-6 font-serif text-3xl font-semibold">{greeting(new Date(), user?.name)}</h1>
      <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link to={t.to} className="block rounded-xl border bg-card p-4 hover:bg-accent">
              <span className="block font-serif text-3xl font-semibold">{t.value}</span>
              <span className="text-sm text-muted-foreground">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-serif text-lg font-semibold">Continue editing</h2>
          {drafts.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : (drafts.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No drafts waiting. Nice.</p>
          ) : (
            <ul className="divide-y">
              {drafts.data!.data.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link to={`/content/${e.id}`} className="min-w-0 flex-1 truncate font-serif text-base hover:underline">{e.title}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{e.contentType?.name} · {formatRelative(e.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-serif text-lg font-semibold">Inbox</h2>
          <p className="text-sm text-muted-foreground">
            {s.submissions.unread === 0 ? 'You are all caught up.' : `${s.submissions.unread} message${s.submissions.unread === 1 ? '' : 's'} waiting for you.`}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/inbox">Open inbox</Link>
          </Button>
        </section>
      </div>
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Create</h2>
        <div className="flex flex-wrap gap-2">
          {(types.data ?? []).map((t) => (
            <Button key={t.id} asChild variant="outline" size="sm">
              <Link to={`/content/new?type=${t.id}`}>+ {t.name}</Link>
            </Button>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link to="/media">
              <Upload aria-hidden />
              Upload media
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
```

The tile for unread messages renders "3" and "unread messages" inside one link, so its accessible name is "3 unread messages".

- [ ] **Step 5: Route Home and delete the legacy dashboard**

In `modules/registry.tsx`: replace `import { Dashboard } from '@/pages/Dashboard'` with `import { HomePage } from '@/features/home/pages/HomePage'` and the home route element with `<HomePage />`. Then:

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q src/pages/Dashboard.tsx
grep -rn "pages/Dashboard" src || echo "no references"
```

- [ ] **Step 6: Run tests, build, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/features src/components/common src/app src/modules`
Expected: PASS, build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): home with setup checklist and work queue"
```

---

## Task 9: Verification in the running app

**Files:** none unless a defect is found (fix with a test when jsdom can express it).

- [ ] **Step 1: Start services** (same stand-ins as Plans 1 and 2: cached mongod, Azurite via npx, backend and admin dev servers).

- [ ] **Step 2: Check and note each result**

1. Home on the existing data shows the work queue: greeting, four tiles (links work), Continue editing lists drafts, Inbox card shows the unread count, Create buttons per model.
2. Home on a fresh database (start mongod with an empty `--dbpath`): the setup checklist shows; after creating a model, an entry and a site, the snippet appears and a pasted `curl` of the same URL with the key returns data; "Hide setup guide" switches to the work queue and stays hidden after reload.
3. Media: upload three images and a GPX by drag-and-drop anywhere and by the Upload button; the tray shows progress and finishes; an 11 MB file and a `.exe` show errors without blocking the rest.
4. Filters (Images, Documents), search `sumava`, pager.
5. Detail sheet: preview, missing alt text hint, save alt text and tags (toast), copy URLs, "Used in" lists the entries using the image; delete warns with the count.
6. Trip editor: the GPX field accepts only GPX in the picker (images disabled); drop a GPX onto the field; Blog post cover image uses the side panel; a multiple image field reorders by drag and by the Move buttons; a deleted file shows "Missing file".
7. Rich text: insert an image from the library through the new picker.
8. Content list shows cover thumbnails.
9. 360px (iframe method): Home, Media and the picker have no horizontal scroll; the tray sits above the bottom tabs.
10. Dark theme: Home, Media, sheet and picker readable.

- [ ] **Step 3: Record and commit**

Append a "Plan 3 verification" table to `TEST_RESULTS.md` and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record Plan 3 verification results"
```

---

## Self-Review Notes

- **Spec coverage:** 5.1 both Home states, checklist auto-ticking from stats, dismiss, snippet with real URL and key, stat tiles, continue editing, quick create → Task 8 (Inbox latest messages deferred, see Decisions). 5.4 grid, filter chips, search, drop anywhere, concurrent uploads with tray, detail drawer with preview, info, alt text hint, description, tags, copy URL per variant, used in, delete with in-use warning, shared grid for the picker → Tasks 3 to 6. 5.3 media field thumbnails, drag to reorder, drop to upload, choose from library, allowedMimeTypes and multiple → Task 6. 5.2 thumbnail → Task 7. Backend search on Cosmos → Task 1.
- **Type consistency:** `MediaListParams`, `useMediaByIds` return `{ byId, isLoading }`, `MediaPickerDialog` props (`open`, `onOpenChange`, `onSelect(MediaFile[])`, `multiple`, `accept`) and `useUploadQueue` shape match across Tasks 2 to 8.
