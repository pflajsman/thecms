# Admin Redesign, Plan 4: Content Models, Forms and Inbox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy MUI content type, contact form and submissions pages with a content model builder (templates, drag-and-drop field list with inspector, camelCase API keys, title field, rename and delete guardrails), a form builder with live preview and embed snippet, and a unified Inbox across all forms, backed by a new cross-form submissions endpoint.

**Architecture:** A shared `features/builder` module provides the sortable field list, API key helpers and a responsive inspector (inline on desktop, bottom sheet below 1024px). `features/models` and `features/forms` each hold pure draft logic (create, edit, validate, diff, payload) with tests, plus thin pages. `features/inbox` shows submissions from `GET /api/v1/submissions` in a two-pane layout and reuses the existing per-form status and delete endpoints.

**Tech Stack:** React 19, TanStack Query 5, dnd-kit, shadcn/ui (sheet, select, switch, textarea, dialog), sonner, Vitest, React Testing Library. Backend: Express, Mongoose, zod, Jest.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-dashboard-redesign-design.md` (sections 5.5, 5.6, 5.7, 5.1 Inbox card)

**Series:** Plan 4 of 5. Plans 1 to 3 are merged on `main`.

## Global Constraints

- Public API (`/api/v1/public/*`) request and response shapes must not change.
- Admin endpoint changes are additive only.
- API keys (field names) must match `^[a-zA-Z][a-zA-Z0-9_]*$` and be at most 50 characters; generated keys are camelCase.
- Existing lowercase keys are left as they are; no automatic renaming.
- Colors only from Tailwind token utilities; no hard-coded hex values in new components.
- Every screen works at 360px width without horizontal scrolling.
- Every mutation shows a toast on success; failures show the server message.
- Copy is English. Never use an em dash in UI copy, code comments or docs.

## Decisions (deviations from the spec, for the reviewer)

1. **Inbox deep links resolve only within the current view.** `/inbox/:id` shows the message when it is in the loaded list (the Home card links into the Unread view, where it is). Loading a single submission needs its form id; not worth a new endpoint now.
2. **API keys stay editable after a model has entries**, with a lock icon and warning; renames are confirmed on save with the entry count (spec 5.6 guardrail) rather than forbidden.
3. **Media "Allowed files" offers four choices** (Images, Video, GPX, PDF). Any other rule is kept if already stored.
4. **Date min/max rules are not editable in the builder.** They stay supported by validation when set through the API.

## Review Focus

1. **Renaming a label must not rename the API key of a saved field**, only of fields whose key was never set by hand; otherwise every label tweak would break sites. Tested in Task 3.
2. **Saving a model that has entries with a renamed or removed key** must ask first and name the keys. Tested in Task 4.
3. **Duplicate or invalid API keys** (two fields both `title`, a key starting with a digit) must block save with a message on the field. Tested in Task 3.
4. **A SELECT form field without options** must block save. Tested in Task 5.
5. **Opening an unread message marks it read exactly once**, and a message without an email field must not offer a broken Reply. Tested in Task 6.

---

## File Structure

### Backend (`packages/backend/src`)

| File | Change |
|---|---|
| `modules/contact-forms/contact-forms.service.ts` | `listAllSubmissions` |
| `modules/contact-forms/contact-forms.controller.ts` | `listAllSubmissions` handler |
| `modules/contact-forms/submissions.routes.ts` (create) | `GET /submissions` |
| `routes/index.ts` | Mount `/submissions` |
| `modules/contact-forms/submissions.test.ts` (create) | Tests |

### Frontend (`packages/admin-dashboard/src`)

| File | Responsibility |
|---|---|
| `lib/hooks/useMediaQuery.ts` | Viewport query hook |
| `test/viewport.ts` | Test helper to force desktop or mobile |
| `features/builder/{api-key.ts,FieldList.tsx,InspectorPanel.tsx}` | Shared builder pieces |
| `features/models/{models-api.ts,model-draft.ts,templates.ts}` | Model logic |
| `features/models/components/{ModelFieldInspector,TemplateChooser}.tsx`, `pages/{ModelsListPage,ModelBuilderPage}.tsx` | Model UI |
| `features/forms/{forms-api.ts,form-draft.ts}`, `components/{FormFieldInspector,FormPreview,EmbedPanel}.tsx`, `pages/{FormsListPage,FormBuilderPage}.tsx` | Forms |
| `features/inbox/{inbox-api.ts,inbox-utils.ts}`, `pages/InboxPage.tsx`, `components/MessageView.tsx` | Inbox |
| `features/legacy-redirects.tsx` | Old model and form URLs |
| `features/home/*` (modify) | Checklist link, Inbox card list |
| `modules/registry.tsx` (modify) | Routes |
| Delete: `pages/ContentTypes/*`, `pages/ContactForms/*`, `services/contentTypes.ts`, `services/contactForms.ts`, `features/inbox/pages/InboxPlaceholder.tsx` | Replaced |

---

## Task 1: `GET /api/v1/submissions` (all forms)

**Files:**
- Modify: `packages/backend/src/modules/contact-forms/contact-forms.service.ts`, `contact-forms.controller.ts`, `packages/backend/src/routes/index.ts`
- Create: `packages/backend/src/modules/contact-forms/submissions.routes.ts`
- Test: `packages/backend/src/modules/contact-forms/submissions.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/submissions?formId=&status=UNREAD|READ|ARCHIVED&page=&limit=` (auth) returning `{ success: true, data: InboxItem[], pagination }`, newest first, where `InboxItem` is the submission JSON plus `form: { id, name, slug, fields: { name, label, type }[] } | null`. Invalid `formId` or `status` returns 400.

- [ ] **Step 1: Write the failing tests `submissions.test.ts`**

```ts
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { ContactFormModel, FormFieldType } from '../../models/contact-form.model';
import { FormSubmissionModel, SubmissionStatus } from '../../models/form-submission.model';
import { ContactFormsService } from './contact-forms.service';
import submissionsRoutes from './submissions.routes';

useTestDb();

const app = express();
app.use('/submissions', submissionsRoutes);

async function seed() {
  const fields = [
    { name: 'email', label: 'Email', type: FormFieldType.EMAIL, required: true },
    { name: 'message', label: 'Message', type: FormFieldType.TEXTAREA, required: true },
  ];
  const contact = await ContactFormModel.create({ name: 'Contact', slug: 'contact', recipientEmail: 'me@x.test', fields });
  const tour = await ContactFormModel.create({ name: 'Tour booking', slug: 'tour', recipientEmail: 'me@x.test', fields });
  const at = (m: number) => new Date(Date.UTC(2026, 8, 29, 10, m));
  await FormSubmissionModel.collection.insertMany([
    { formId: contact._id, data: { email: 'a@x.test', message: 'One' }, status: SubmissionStatus.UNREAD, emailSent: true, createdAt: at(1), updatedAt: at(1) },
    { formId: tour._id, data: { email: 'b@x.test', message: 'Two' }, status: SubmissionStatus.READ, emailSent: true, createdAt: at(2), updatedAt: at(2) },
    { formId: contact._id, data: { email: 'c@x.test', message: 'Three' }, status: SubmissionStatus.UNREAD, emailSent: false, emailError: 'SMTP down', createdAt: at(3), updatedAt: at(3) },
  ]);
  return { contact, tour };
}

describe('ContactFormsService.listAllSubmissions', () => {
  it('lists submissions from every form, newest first, with form info', async () => {
    await seed();
    const res = await ContactFormsService.listAllSubmissions({});
    expect(res.submissions.map((s) => s.data.message)).toEqual(['Three', 'Two', 'One']);
    expect(res.submissions[0].form).toEqual({
      id: expect.any(String),
      name: 'Contact',
      slug: 'contact',
      fields: [
        { name: 'email', label: 'Email', type: 'EMAIL' },
        { name: 'message', label: 'Message', type: 'TEXTAREA' },
      ],
    });
    expect(res.pagination.total).toBe(3);
  });

  it('filters by form and status', async () => {
    const { contact } = await seed();
    const res = await ContactFormsService.listAllSubmissions({ formId: contact.id, status: SubmissionStatus.UNREAD });
    expect(res.submissions.map((s) => s.data.message)).toEqual(['Three', 'One']);
  });

  it('returns form null for submissions of a deleted form', async () => {
    const { tour } = await seed();
    await ContactFormModel.deleteOne({ _id: tour._id });
    const res = await ContactFormsService.listAllSubmissions({});
    expect(res.submissions.find((s) => s.data.message === 'Two')?.form).toBeNull();
  });
});

describe('GET /submissions', () => {
  it('responds with the list envelope', async () => {
    await seed();
    const res = await request(app).get('/submissions?status=UNREAD&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(2);
  });

  it('rejects an invalid formId or status with 400', async () => {
    expect((await request(app).get('/submissions?formId=nope')).status).toBe(400);
    expect((await request(app).get('/submissions?status=SPAM')).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- submissions`
Expected: FAIL: cannot find `./submissions.routes`; `listAllSubmissions` missing.

- [ ] **Step 3: Implement the service method**

In `contact-forms.service.ts`, add after `listSubmissions`:

```ts
  /**
   * List submissions across all forms (admin Inbox)
   */
  static async listAllSubmissions(options: {
    formId?: string;
    status?: SubmissionStatus;
    page?: number;
    limit?: number;
  }) {
    const { formId, status, page = 1, limit = 20 } = options;
    const query: any = {};
    if (formId) query.formId = formId;
    if (status) query.status = status;

    const [submissions, total] = await Promise.all([
      FormSubmissionModel.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      FormSubmissionModel.countDocuments(query),
    ]);

    const formIds = [...new Set(submissions.map((s) => String(s.formId)))];
    const forms = await ContactFormModel.find({ _id: { $in: formIds } }).select('name slug fields').lean();
    const formMap = new Map(
      forms.map((f) => [
        String(f._id),
        {
          id: String(f._id),
          name: f.name,
          slug: f.slug,
          fields: f.fields.map((field) => ({ name: field.name, label: field.label, type: field.type })),
        },
      ])
    );

    return {
      submissions: submissions.map((s) => ({ ...s.toJSON(), form: formMap.get(String(s.formId)) ?? null })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
```

- [ ] **Step 4: Implement the controller handler and routes**

In `contact-forms.controller.ts`, add imports `import { z } from 'zod';` (if not present) and `import { SubmissionStatus } from '../../models/form-submission.model';` (if not present), and add this method to the controller class:

```ts
  /**
   * List submissions across all forms
   * GET /api/v1/submissions
   */
  async listAllSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const querySchema = z.object({
      formId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid form ID').optional(),
      status: z.nativeEnum(SubmissionStatus).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Validation error', details: parsed.error.errors });
        return;
      }
      const result = await ContactFormsService.listAllSubmissions(parsed.data);
      res.status(200).json({ success: true, data: result.submissions, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }
```

Create `submissions.routes.ts`:

```ts
import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { contactFormsController } from './contact-forms.controller';

const router: IRouter = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /submissions:
 *   get:
 *     summary: List form submissions across all forms (newest first)
 *     tags: [Contact Forms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: formId, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [UNREAD, READ, ARCHIVED] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: Submissions with form { id, name, slug, fields } or null }
 */
router.get('/', (req, res, next) => contactFormsController.listAllSubmissions(req, res, next));

export default router;
```

Check the controller's exported instance name with `grep -n "export const" packages/backend/src/modules/contact-forms/contact-forms.controller.ts` and use it in the import if it differs from `contactFormsController`.

In `routes/index.ts`, add `import submissionsRoutes from '../modules/contact-forms/submissions.routes';` and `router.use('/submissions', submissionsRoutes);`.

- [ ] **Step 5: Run tests, build, commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS, build succeeds.

```bash
git add packages/backend/src
git commit -m "feat(backend): list form submissions across all forms"
```

---

## Task 2: Shared builder pieces

All frontend paths are relative to `packages/admin-dashboard/src`.

**Files:**
- Create: `lib/hooks/useMediaQuery.ts`, `test/viewport.ts`, `features/builder/api-key.ts`, `features/builder/FieldList.tsx`, `features/builder/InspectorPanel.tsx`
- Test: `features/builder/api-key.test.ts`, `features/builder/FieldList.test.tsx`

**Interfaces:**
- Produces:
  - `useMediaQuery(query: string) => boolean`; `useIsDesktop() => boolean` (`(min-width: 1024px)`)
  - `setViewport(desktop: boolean)` test helper (overrides `window.matchMedia`)
  - `API_KEY_PATTERN`, `toApiKey(label: string) => string`, `uniqueKey(base: string, taken: string[]) => string`, `toSlug(name: string) => string`, `apiKeyError(key: string, others: string[]) => string | null`
  - `FieldListItem { id: string; label: string; apiKey: string; typeLabel: string; isTitle?: boolean; hasError?: boolean }`, `<FieldList label items selectedId? onSelect(id) onReorder(ids: string[]) />`
  - `<InspectorPanel title open onClose children />`: inline `<aside>` on desktop, bottom sheet on smaller screens; renders nothing when `open` is false.

- [ ] **Step 1: Write the failing tests**

`features/builder/api-key.test.ts`:

```ts
import { apiKeyError, toApiKey, toSlug, uniqueKey } from './api-key'

describe('toApiKey', () => {
  it.each([
    ['GPX track', 'gpxTrack'],
    ['GPX URL', 'gpxUrl'],
    ['Distance (km)', 'distanceKm'],
    ['Přes Šumavu', 'presSumavu'],
    ['2nd line', 'field2ndLine'],
    ['   ', ''],
  ])('%j becomes %j', (label, key) => {
    expect(toApiKey(label)).toBe(key)
  })
  it('caps the length at 50', () => {
    expect(toApiKey('word '.repeat(30))).toHaveLength(50)
  })
})

describe('uniqueKey, toSlug, apiKeyError', () => {
  it('adds a number when taken', () => {
    expect(uniqueKey('title', ['title', 'title2'])).toBe('title3')
    expect(uniqueKey('body', ['title'])).toBe('body')
  })
  it('slugifies names', () => {
    expect(toSlug('Blog Post!')).toBe('blog-post')
    expect(toSlug('Přes Šumavu  2026')).toBe('pres-sumavu-2026')
  })
  it('reports invalid and duplicate keys', () => {
    expect(apiKeyError('', [])).toBe('API key is required')
    expect(apiKeyError('2nd', [])).toBe('Start with a letter; use only letters, numbers and underscores')
    expect(apiKeyError('title', ['title'])).toBe('Another field already uses this key')
    expect(apiKeyError('gpxurl', ['title'])).toBeNull()
  })
})
```

`features/builder/FieldList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldList, type FieldListItem } from './FieldList'

const items: FieldListItem[] = [
  { id: 'a', label: 'Title', apiKey: 'title', typeLabel: 'Text', isTitle: true },
  { id: 'b', label: 'Body', apiKey: 'body', typeLabel: 'Rich text' },
  { id: 'c', label: 'Cover', apiKey: 'cover', typeLabel: 'Media', hasError: true },
]

it('selects and reorders fields', async () => {
  const onSelect = vi.fn()
  const onReorder = vi.fn()
  render(<FieldList label="Fields" items={items} selectedId="b" onSelect={onSelect} onReorder={onReorder} />)
  expect(screen.getByRole('button', { name: /Body/ })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByText('Title field')).toBeInTheDocument()
  expect(screen.getByText('Has errors')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Cover/ }))
  expect(onSelect).toHaveBeenCalledWith('c')
  await userEvent.click(screen.getByRole('button', { name: 'Move Body down' }))
  expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b'])
  expect(screen.queryByRole('button', { name: 'Move Title up' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- api-key FieldList`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement the hook and test helper**

`lib/hooks/useMediaQuery.ts`:

```ts
import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener?.('change', onChange)
      return () => mq.removeEventListener?.('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
```

`test/viewport.ts`:

```ts
/** Make `(min-width: …)` media queries match (desktop) or not (mobile) for a test. */
export function setViewport(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
```

- [ ] **Step 4: Implement `features/builder/api-key.ts`**

```ts
export const API_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/
const MAX_KEY = 50

function asciiWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** "GPX track" -> "gpxTrack", "Distance (km)" -> "distanceKm". */
export function toApiKey(label: string): string {
  const words = asciiWords(label)
  if (words.length === 0) return ''
  let key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
  if (/^[0-9]/.test(key)) key = `field${key.charAt(0).toUpperCase()}${key.slice(1)}`
  return key.slice(0, MAX_KEY)
}

export function uniqueKey(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}${n}`)) n += 1
  return `${base}${n}`
}

export function toSlug(name: string): string {
  return asciiWords(name).join('-').toLowerCase().slice(0, 100)
}

export function apiKeyError(key: string, otherKeys: string[]): string | null {
  if (!key) return 'API key is required'
  if (key.length > MAX_KEY || !API_KEY_PATTERN.test(key)) return 'Start with a letter; use only letters, numbers and underscores'
  if (otherKeys.includes(key)) return 'Another field already uses this key'
  return null
}
```

- [ ] **Step 5: Implement `features/builder/FieldList.tsx` and `InspectorPanel.tsx`**

`features/builder/FieldList.tsx`:

```tsx
import { ArrowDown, ArrowUp, GripVertical, Star } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { moveItem } from '@/features/media/move-item'

export interface FieldListItem {
  id: string
  label: string
  apiKey: string
  typeLabel: string
  isTitle?: boolean
  hasError?: boolean
}

interface FieldListProps {
  label: string
  items: FieldListItem[]
  selectedId?: string
  onSelect: (id: string) => void
  onReorder: (ids: string[]) => void
}

export function FieldList({ label, items, selectedId, onSelect, onReorder }: FieldListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const ids = items.map((i) => i.id)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onReorder(moveItem(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              first={index === 0}
              last={index === items.length - 1}
              onSelect={() => onSelect(item.id)}
              onMove={(delta) => onReorder(moveItem(ids, index, index + delta))}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

interface RowProps {
  item: FieldListItem
  selected: boolean
  first: boolean
  last: boolean
  onSelect: () => void
  onMove: (delta: number) => void
}

function Row({ item, selected, first, last, onSelect, onMove }: RowProps) {
  const { listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-1 rounded-lg border bg-card pr-1', selected && 'border-primary ring-2 ring-primary/30')}
    >
      <span {...listeners} aria-hidden className="cursor-grab px-1.5 py-3 text-muted-foreground">
        <GripVertical className="size-4" />
      </span>
      <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.label || 'Untitled field'}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">{item.apiKey || 'no key'}</span>
        </span>
        {item.isTitle && (
          <span className="flex items-center text-status-draft-fg" title="Title field">
            <Star aria-hidden className="size-4 fill-current" />
            <span className="sr-only">Title field</span>
          </span>
        )}
        {item.hasError && (
          <span className="size-2 rounded-full bg-destructive">
            <span className="sr-only">Has errors</span>
          </span>
        )}
        <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">{item.typeLabel}</span>
      </button>
      {!first && (
        <button type="button" onClick={() => onMove(-1)} aria-label={`Move ${item.label || item.apiKey} up`} className="rounded p-1 hover:bg-accent">
          <ArrowUp aria-hidden className="size-3.5" />
        </button>
      )}
      {!last && (
        <button type="button" onClick={() => onMove(1)} aria-label={`Move ${item.label || item.apiKey} down`} className="rounded p-1 hover:bg-accent">
          <ArrowDown aria-hidden className="size-3.5" />
        </button>
      )}
    </li>
  )
}
```

`features/builder/InspectorPanel.tsx`:

```tsx
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useIsDesktop } from '@/lib/hooks/useMediaQuery'

interface InspectorPanelProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

/** Field settings: a side panel on desktop, a bottom sheet on smaller screens. */
export function InspectorPanel({ title, open, onClose, children }: InspectorPanelProps) {
  const desktop = useIsDesktop()
  if (!open) return null
  if (desktop) {
    return (
      <aside aria-label={title} className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Close field settings" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        {children}
      </aside>
    )
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 6: Run tests and commit**

Run: `cd packages/admin-dashboard && pnpm test -- api-key FieldList`
Expected: PASS.

```bash
git add packages/admin-dashboard/src/lib/hooks/useMediaQuery.ts packages/admin-dashboard/src/test/viewport.ts packages/admin-dashboard/src/features/builder
git commit -m "feat(admin): shared builder field list, inspector panel and API key helpers"
```

---

## Task 3: Model draft logic, templates and API

**Files:**
- Create: `features/models/models-api.ts`, `features/models/model-draft.ts`, `features/models/templates.ts`
- Test: `features/models/model-draft.test.ts`

**Interfaces:**
- Consumes: `toApiKey`, `uniqueKey`, `toSlug`, `apiKeyError` (Task 2).
- Produces:
  - `models-api.ts`: `ModelPayload { name; slug; description?; fields: Field[]; titleField?: string }`, `createModel(body) => Promise<ContentType>`, `updateModel(id, body) => Promise<ContentType>`, `deleteModel(id, force: boolean) => Promise<void>`, `getEntryCount(id) => Promise<number>`, hooks `useEntryCount(id?)`, `useModelWrites() => { create, update, remove }` (invalidate `contentKeys.types()`, the model's `contentKeys.type(id)`, and stats).
  - `model-draft.ts`: `FIELD_TYPE_LABELS: Record<FieldType, string>`, `DraftField = Field & { cid: string; originalName?: string; keyTouched: boolean }`, `ModelDraft { name; slug; slugTouched; description; titleCid?: string; fields: DraftField[]; originalNames: string[] }`, `emptyDraft()`, `draftFromType(ct)`, `draftFromTemplate(t: ModelTemplate)`, `setModelName(d, name)`, `setSlug(d, slug)`, `addField(d, type) => { draft; cid }`, `updateField(d, cid, patch: Partial<Field>)`, `setFieldLabel(d, cid, label)`, `setFieldKey(d, cid, key)`, `removeField(d, cid)`, `reorderFields(d, cids)`, `setTitleField(d, cid)`, `validateModel(d) => ModelErrors` where `ModelErrors = Record<string, string>` with keys `name`, `slug`, `fields`, `label:<cid>`, `key:<cid>`, `toModelPayload(d) => ModelPayload`, `diffKeys(d) => { renamed: { from: string; to: string }[]; removed: string[] }`.
  - `templates.ts`: `ModelTemplate { id: 'blog-post' | 'page' | 'event'; name: string; description: string; fields: Field[]; titleField: string }`, `MODEL_TEMPLATES: ModelTemplate[]`.

- [ ] **Step 1: Write the failing test `features/models/model-draft.test.ts`**

```ts
import type { ContentType } from '@/types'
import {
  addField,
  diffKeys,
  draftFromTemplate,
  draftFromType,
  emptyDraft,
  removeField,
  reorderFields,
  setFieldKey,
  setFieldLabel,
  setModelName,
  setSlug,
  setTitleField,
  toModelPayload,
  updateField,
  validateModel,
} from './model-draft'
import { MODEL_TEMPLATES } from './templates'

const trip: ContentType = {
  id: 't1',
  name: 'Trip',
  slug: 'trip',
  titleField: 'title',
  fields: [
    { name: 'title', label: 'Title', type: 'TEXT', required: true },
    { name: 'gpxurl', label: 'GPX track', type: 'MEDIA', required: false },
  ],
  createdAt: '',
  updatedAt: '',
}

describe('model name and slug', () => {
  it('derives the slug from the name until the slug is edited', () => {
    let d = setModelName(emptyDraft(), 'Blog Post')
    expect(d.slug).toBe('blog-post')
    d = setSlug(d, 'posts')
    d = setModelName(d, 'Blog Posts')
    expect(d.slug).toBe('posts')
  })
})

describe('fields', () => {
  it('new fields get a camelCase key from the label, unique in the model', () => {
    let { draft, cid } = addField(emptyDraft(), 'TEXT')
    draft = setFieldLabel(draft, cid, 'GPX URL')
    expect(draft.fields[0].name).toBe('gpxUrl')
    const second = addField(draft, 'TEXT')
    const d2 = setFieldLabel(second.draft, second.cid, 'GPX url')
    expect(d2.fields[1].name).toBe('gpxUrl2')
  })

  it('never renames the key of a saved field or a hand-edited key when the label changes', () => {
    let d = draftFromType(trip)
    const cid = d.fields[1].cid
    d = setFieldLabel(d, cid, 'GPX file')
    expect(d.fields[1].name).toBe('gpxurl')
    const added = addField(d, 'NUMBER')
    d = setFieldKey(added.draft, added.cid, 'km')
    d = setFieldLabel(d, added.cid, 'Distance')
    expect(d.fields[2].name).toBe('km')
  })

  it('reorders, removes and moves the title', () => {
    let d = draftFromType(trip)
    const [a, b] = d.fields.map((f) => f.cid)
    d = reorderFields(d, [b, a])
    expect(d.fields.map((f) => f.name)).toEqual(['gpxurl', 'title'])
    d = removeField(d, a)
    expect(d.fields.map((f) => f.name)).toEqual(['gpxurl'])
    expect(d.titleCid).toBeUndefined()
  })
})

describe('validateModel', () => {
  it('requires a name, a valid slug and at least one field', () => {
    const errors = validateModel({ ...emptyDraft(), slug: 'Bad Slug' })
    expect(errors).toMatchObject({ name: 'Name must be at least 2 characters', slug: 'Use lowercase letters, numbers and hyphens', fields: 'Add at least one field' })
  })

  it('flags missing labels and duplicate or invalid keys on the field', () => {
    let d = setModelName(emptyDraft(), 'Trip')
    const a = addField(d, 'TEXT')
    d = setFieldLabel(a.draft, a.cid, 'Title')
    const b = addField(d, 'TEXT')
    d = setFieldKey(b.draft, b.cid, 'title')
    d = setFieldLabel(d, b.cid, '')
    const c = addField(d, 'TEXT')
    d = setFieldKey(c.draft, c.cid, '2nd')
    const errors = validateModel(d)
    expect(errors[`key:${b.cid}`]).toBe('Another field already uses this key')
    expect(errors[`label:${b.cid}`]).toBe('Label is required')
    expect(errors[`key:${c.cid}`]).toBe('Start with a letter; use only letters, numbers and underscores')
    expect(errors[`key:${a.cid}`]).toBe('Another field already uses this key')
  })
})

describe('payload and diff', () => {
  it('builds the API payload with the title field name and clean validation', () => {
    let d = draftFromType(trip)
    d = updateField(d, d.fields[0].cid, { validation: { maxLength: 150, minLength: undefined, pattern: '' } })
    const payload = toModelPayload(d)
    expect(payload).toEqual({
      name: 'Trip',
      slug: 'trip',
      description: '',
      titleField: 'title',
      fields: [
        { name: 'title', label: 'Title', type: 'TEXT', required: true, validation: { maxLength: 150 } },
        { name: 'gpxurl', label: 'GPX track', type: 'MEDIA', required: false },
      ],
    })
  })

  it('only sends a TEXT titleField', () => {
    let d = draftFromType(trip)
    d = setTitleField(d, d.fields[1].cid)
    expect(toModelPayload(d).titleField).toBeUndefined()
  })

  it('reports renamed and removed keys of saved fields', () => {
    let d = draftFromType(trip)
    d = setFieldKey(d, d.fields[1].cid, 'gpxUrl')
    const added = addField(d, 'TEXT')
    d = setFieldLabel(added.draft, added.cid, 'Summary')
    expect(diffKeys(d)).toEqual({ renamed: [{ from: 'gpxurl', to: 'gpxUrl' }], removed: [] })
    d = removeField(d, d.fields[0].cid)
    expect(diffKeys(d).removed).toEqual(['title'])
  })
})

describe('templates', () => {
  it('each template is a valid model with its title field', () => {
    for (const t of MODEL_TEMPLATES) {
      const d = draftFromTemplate(t)
      expect(validateModel(d)).toEqual({})
      expect(toModelPayload(d).titleField).toBe(t.titleField)
      expect(diffKeys(d)).toEqual({ renamed: [], removed: [] })
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- model-draft`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `features/models/templates.ts`**

```ts
import type { Field } from '@/types'

export interface ModelTemplate {
  id: 'blog-post' | 'page' | 'event'
  name: string
  description: string
  fields: Field[]
  titleField: string
}

export const MODEL_TEMPLATES: ModelTemplate[] = [
  {
    id: 'blog-post',
    name: 'Blog post',
    description: 'Title, excerpt, cover image and body.',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true, validation: { maxLength: 150 } },
      { name: 'excerpt', label: 'Excerpt', type: 'TEXT', required: false, description: 'Short summary for lists and previews.', validation: { maxLength: 300 } },
      { name: 'coverImage', label: 'Cover image', type: 'MEDIA', required: false, validation: { allowedMimeTypes: ['image/*'] } },
      { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false },
    ],
  },
  {
    id: 'page',
    name: 'Page',
    description: 'A standalone page such as About or Contact.',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true },
      { name: 'key', label: 'Page key', type: 'TEXT', required: true, description: 'Used by your site to find this page, for example "about".', validation: { pattern: '^[a-z0-9-]+$' } },
      { name: 'subtitle', label: 'Subtitle', type: 'TEXT', required: false },
      { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false },
    ],
  },
  {
    id: 'event',
    name: 'Event',
    description: 'Date, location, image and description.',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true },
      { name: 'date', label: 'Date', type: 'DATE', required: true },
      { name: 'location', label: 'Location', type: 'TEXT', required: false },
      { name: 'image', label: 'Image', type: 'MEDIA', required: false, validation: { allowedMimeTypes: ['image/*'] } },
      { name: 'description', label: 'Description', type: 'RICH_TEXT', required: false },
    ],
  },
]
```

- [ ] **Step 4: Implement `features/models/model-draft.ts`**

```ts
import type { ContentType, Field, FieldType, ValidationRules } from '@/types'
import { apiKeyError, toApiKey, toSlug, uniqueKey } from '@/features/builder/api-key'
import type { ModelTemplate } from './templates'
import type { ModelPayload } from './models-api'

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: 'Text',
  RICH_TEXT: 'Rich text',
  NUMBER: 'Number',
  DATE: 'Date',
  BOOLEAN: 'Yes / No',
  MEDIA: 'Media',
  RELATION: 'Reference',
}

export type DraftField = Field & { cid: string; originalName?: string; keyTouched: boolean }

export interface ModelDraft {
  name: string
  slug: string
  slugTouched: boolean
  description: string
  titleCid?: string
  fields: DraftField[]
  /** Keys of the fields as last saved; used to detect removals. */
  originalNames: string[]
}

export type ModelErrors = Record<string, string>

let cidCounter = 0
const nextCid = () => `f${++cidCounter}`

export function emptyDraft(): ModelDraft {
  return { name: '', slug: '', slugTouched: false, description: '', fields: [], originalNames: [] }
}

export function draftFromType(ct: ContentType): ModelDraft {
  const fields = ct.fields.map((f) => ({ ...f, cid: nextCid(), originalName: f.name, keyTouched: true }))
  return {
    name: ct.name,
    slug: ct.slug,
    slugTouched: true,
    description: ct.description ?? '',
    titleCid: fields.find((f) => f.name === ct.titleField)?.cid,
    fields,
    originalNames: ct.fields.map((f) => f.name),
  }
}

export function draftFromTemplate(t: ModelTemplate): ModelDraft {
  const fields = t.fields.map((f) => ({ ...f, cid: nextCid(), keyTouched: true }))
  return {
    name: t.name,
    slug: toSlug(t.name),
    slugTouched: false,
    description: '',
    titleCid: fields.find((f) => f.name === t.titleField)?.cid,
    fields,
    originalNames: [],
  }
}

export function setModelName(d: ModelDraft, name: string): ModelDraft {
  return { ...d, name, slug: d.slugTouched ? d.slug : toSlug(name) }
}

export function setSlug(d: ModelDraft, slug: string): ModelDraft {
  return { ...d, slug, slugTouched: true }
}

const DEFAULT_LABELS: Record<FieldType, string> = {
  TEXT: 'Text',
  RICH_TEXT: 'Rich text',
  NUMBER: 'Number',
  DATE: 'Date',
  BOOLEAN: 'Yes or no',
  MEDIA: 'Media',
  RELATION: 'Reference',
}

export function addField(d: ModelDraft, type: FieldType): { draft: ModelDraft; cid: string } {
  const cid = nextCid()
  const label = DEFAULT_LABELS[type]
  const name = uniqueKey(toApiKey(label), d.fields.map((f) => f.name))
  const field: DraftField = { cid, name, label, type, required: false, keyTouched: false }
  const titleCid = d.titleCid ?? (type === 'TEXT' && !d.fields.some((f) => f.type === 'TEXT') ? cid : undefined)
  return { draft: { ...d, fields: [...d.fields, field], titleCid }, cid }
}

function mapField(d: ModelDraft, cid: string, fn: (f: DraftField) => DraftField): ModelDraft {
  return { ...d, fields: d.fields.map((f) => (f.cid === cid ? fn(f) : f)) }
}

export function updateField(d: ModelDraft, cid: string, patch: Partial<Field>): ModelDraft {
  return mapField(d, cid, (f) => ({ ...f, ...patch }))
}

export function setFieldLabel(d: ModelDraft, cid: string, label: string): ModelDraft {
  const others = d.fields.filter((f) => f.cid !== cid).map((f) => f.name)
  return mapField(d, cid, (f) => {
    // Saved fields and hand-edited keys keep their key: renaming them breaks sites.
    if (f.keyTouched || f.originalName) return { ...f, label }
    return { ...f, label, name: uniqueKey(toApiKey(label) || 'field', others) }
  })
}

export function setFieldKey(d: ModelDraft, cid: string, name: string): ModelDraft {
  return mapField(d, cid, (f) => ({ ...f, name: name.trim(), keyTouched: true }))
}

export function removeField(d: ModelDraft, cid: string): ModelDraft {
  return { ...d, fields: d.fields.filter((f) => f.cid !== cid), titleCid: d.titleCid === cid ? undefined : d.titleCid }
}

export function reorderFields(d: ModelDraft, cids: string[]): ModelDraft {
  const byCid = new Map(d.fields.map((f) => [f.cid, f]))
  return { ...d, fields: cids.map((c) => byCid.get(c)!).filter(Boolean) }
}

export function setTitleField(d: ModelDraft, cid: string): ModelDraft {
  return { ...d, titleCid: cid }
}

export function validateModel(d: ModelDraft): ModelErrors {
  const errors: ModelErrors = {}
  const name = d.name.trim()
  if (name.length < 2) errors.name = 'Name must be at least 2 characters'
  else if (name.length > 100) errors.name = 'Name must be at most 100 characters'
  if (!/^[a-z0-9-]{2,100}$/.test(d.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens'
  if (d.fields.length === 0) errors.fields = 'Add at least one field'
  for (const f of d.fields) {
    if (!f.label.trim()) errors[`label:${f.cid}`] = 'Label is required'
    const others = d.fields.filter((o) => o.cid !== f.cid).map((o) => o.name)
    const keyError = apiKeyError(f.name, others)
    if (keyError) errors[`key:${f.cid}`] = keyError
  }
  return errors
}

function cleanValidation(v?: ValidationRules): ValidationRules | undefined {
  if (!v) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, value] of Object.entries(v)) {
    if (value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value))) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (value === false) continue
    out[k] = value
  }
  return Object.keys(out).length ? (out as ValidationRules) : undefined
}

export function toModelPayload(d: ModelDraft): ModelPayload {
  const titleField = d.fields.find((f) => f.cid === d.titleCid && f.type === 'TEXT')?.name
  return {
    name: d.name.trim(),
    slug: d.slug,
    description: d.description.trim(),
    ...(titleField ? { titleField } : {}),
    fields: d.fields.map((f) => {
      const field: Field = { name: f.name, label: f.label.trim(), type: f.type, required: !!f.required }
      if (f.description?.trim()) field.description = f.description.trim()
      if (f.defaultValue !== undefined) field.defaultValue = f.defaultValue
      const clean = cleanValidation(f.validation)
      if (clean) field.validation = clean
      return field
    }),
  }
}

export function diffKeys(d: ModelDraft): { renamed: { from: string; to: string }[]; removed: string[] } {
  const renamed = d.fields.filter((f) => f.originalName && f.originalName !== f.name).map((f) => ({ from: f.originalName!, to: f.name }))
  const kept = new Set(d.fields.map((f) => f.originalName).filter(Boolean))
  const removed = d.originalNames.filter((n) => !kept.has(n))
  return { renamed, removed }
}
```

- [ ] **Step 5: Implement `features/models/models-api.ts`**

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { statsKeys } from '@/lib/queries/stats'
import { contentKeys } from '@/features/content/queries'
import type { ApiResponse, ContentType, Field } from '@/types'

export interface ModelPayload {
  name: string
  slug: string
  description?: string
  fields: Field[]
  titleField?: string
}

export async function createModel(body: ModelPayload): Promise<ContentType> {
  return (await apiClient.post<ApiResponse<ContentType>>('/content-types', body)).data.data
}

export async function updateModel(id: string, body: ModelPayload): Promise<ContentType> {
  return (await apiClient.put<ApiResponse<ContentType>>(`/content-types/${id}`, body)).data.data
}

export async function deleteModel(id: string, force: boolean): Promise<void> {
  await apiClient.delete(`/content-types/${id}`, { params: force ? { force: 'true' } : undefined })
}

export async function getEntryCount(id: string): Promise<number> {
  const res = await apiClient.get<{ data?: { count?: number } }>(`/content-types/${id}/entry-count`)
  return res.data?.data?.count ?? 0
}

export function useEntryCount(id?: string) {
  return useQuery({ queryKey: [...contentKeys.type(id ?? ''), 'entry-count'], queryFn: () => getEntryCount(id!), enabled: !!id })
}

export function useModelWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = (id?: string) => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.types() })
      if (id) void queryClient.invalidateQueries({ queryKey: contentKeys.type(id) })
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    return {
      create: async (body: ModelPayload) => {
        const ct = await createModel(body)
        queryClient.setQueryData(contentKeys.type(ct.id), ct)
        refresh(ct.id)
        return ct
      },
      update: async (id: string, body: ModelPayload) => {
        const ct = await updateModel(id, body)
        queryClient.setQueryData(contentKeys.type(id), ct)
        refresh(id)
        return ct
      },
      remove: async (id: string, force: boolean) => {
        await deleteModel(id, force)
        queryClient.removeQueries({ queryKey: contentKeys.type(id) })
        refresh()
      },
    }
  }, [queryClient])
}
```

- [ ] **Step 6: Run tests, lint and commit**

Run: `cd packages/admin-dashboard && pnpm test -- model-draft && pnpm exec eslint src/features/models src/features/builder`
Expected: PASS, no lint errors.

```bash
git add packages/admin-dashboard/src/features/models
git commit -m "feat(admin): content model draft logic, templates and API"
```

---

## Task 4: Content model pages

**Files:**
- Create: `features/models/components/ModelFieldInspector.tsx`, `features/models/components/TemplateChooser.tsx`, `features/models/pages/ModelsListPage.tsx`, `features/models/pages/ModelBuilderPage.tsx`, `features/legacy-redirects.tsx`
- Modify: `modules/registry.tsx`, `features/home/home-utils.ts`, `features/home/home-utils.test.ts`
- Delete: `pages/ContentTypes/*`, `services/contentTypes.ts`
- Test: `features/models/pages/ModelBuilderPage.test.tsx`, `features/models/pages/ModelsListPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 and 3; `useContentTypes`, `useContentType`, `contentKeys` (Plan 2); `useStats` (Plan 1); `useUnsavedGuard`, `stableStringify` (Plan 2); `ConfirmDialog`, `PageHeader`, `EmptyState`, `ErrorState`.
- Produces: routes `/models`, `/models/:id` (`new`, with optional `?template=`), redirects `/content-types` → `/models`, `/content-types/new` → `/models/new`, `/content-types/:id/edit` → `/models/:id`; checklist "Create a model" links to `/models/new`.

- [ ] **Step 1: Write the failing tests**

`features/models/pages/ModelBuilderPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import { setViewport } from '@/test/viewport'
import type { ContentType } from '@/types'
import * as contentApi from '@/features/content/content-api'
import * as modelsApi from '../models-api'
import { ModelBuilderPage } from './ModelBuilderPage'

vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, getContentType: vi.fn(), listContentTypes: vi.fn() }
})
vi.mock('../models-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../models-api')>()
  return { ...actual, createModel: vi.fn(), updateModel: vi.fn(), deleteModel: vi.fn(), getEntryCount: vi.fn() }
})

const trip: ContentType = {
  id: 't1',
  name: 'Trip',
  slug: 'trip',
  titleField: 'title',
  fields: [
    { name: 'title', label: 'Title', type: 'TEXT', required: true },
    { name: 'gpxurl', label: 'GPX track', type: 'MEDIA', required: false },
  ],
  createdAt: '',
  updatedAt: '',
}

const routes = [
  { path: '/models/:id', element: <ModelBuilderPage /> },
  { path: '/models', element: <p>models list</p> },
]

beforeEach(() => {
  setViewport(true)
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([trip])
  vi.mocked(contentApi.getContentType).mockResolvedValue(trip)
  vi.mocked(modelsApi.getEntryCount).mockResolvedValue(8)
})

describe('new model', () => {
  it('starts from a template and saves it', async () => {
    vi.mocked(modelsApi.createModel).mockImplementation(async (body) => ({ ...trip, ...body, id: 'new1' }) as ContentType)
    const { router } = renderRoutes(routes, { route: '/models/new' })
    await userEvent.click(await screen.findByRole('button', { name: /Blog post/ }))
    expect(screen.getByLabelText('Name')).toHaveValue('Blog post')
    expect(within(screen.getByRole('list', { name: 'Fields' })).getAllByRole('listitem')).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/models/new1'))
    expect(modelsApi.createModel).toHaveBeenCalledWith(expect.objectContaining({ name: 'Blog post', slug: 'blog-post', titleField: 'title' }))
  })

  it('adds a field from the palette with a camelCase key from its label', async () => {
    renderRoutes(routes, { route: '/models/new?template=scratch' })
    await userEvent.type(await screen.findByLabelText('Name'), 'Trip')
    await userEvent.click(screen.getByRole('button', { name: 'Add Text field' }))
    const inspector = screen.getByRole('complementary', { name: 'Field settings' })
    const label = within(inspector).getByLabelText('Label')
    await userEvent.clear(label)
    await userEvent.type(label, 'GPX URL')
    expect(within(inspector).getByLabelText('API key')).toHaveValue('gpxUrl')
  })

  it('blocks save with errors shown on the field', async () => {
    renderRoutes(routes, { route: '/models/new?template=scratch' })
    await userEvent.type(await screen.findByLabelText('Name'), 'Trip')
    await userEvent.click(screen.getByRole('button', { name: 'Add Text field' }))
    const key = within(screen.getByRole('complementary', { name: 'Field settings' })).getByLabelText('API key')
    await userEvent.clear(key)
    await userEvent.type(key, '9lives')
    await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
    expect(await screen.findByText('Start with a letter; use only letters, numbers and underscores')).toBeInTheDocument()
    expect(modelsApi.createModel).not.toHaveBeenCalled()
  })
})

describe('existing model with entries', () => {
  it('confirms renamed keys with the entry count before saving', async () => {
    vi.mocked(modelsApi.updateModel).mockImplementation(async (_id, body) => ({ ...trip, ...body }) as ContentType)
    renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: /GPX track/ }))
    const inspector = screen.getByRole('complementary', { name: 'Field settings' })
    expect(within(inspector).getByText(/Sites reading this key stop receiving it if you rename it/)).toBeInTheDocument()
    const key = within(inspector).getByLabelText('API key')
    await userEvent.clear(key)
    await userEvent.type(key, 'gpxUrl')
    await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('8 entries')
    expect(dialog).toHaveTextContent('gpxurl → gpxUrl')
    expect(modelsApi.updateModel).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(modelsApi.updateModel).toHaveBeenCalledWith('t1', expect.objectContaining({ fields: expect.arrayContaining([expect.objectContaining({ name: 'gpxUrl' })]) }))
  })

  it('requires typing the model name to delete a model with entries', async () => {
    vi.mocked(modelsApi.deleteModel).mockResolvedValue()
    const { router } = renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete model' }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/type/i), 'Trip')
    await userEvent.click(confirm)
    expect(modelsApi.deleteModel).toHaveBeenCalledWith('t1', true)
    await waitFor(() => expect(router.state.location.pathname).toBe('/models'))
  })

  it('opens the field inspector in a bottom sheet on small screens', async () => {
    setViewport(false)
    renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: /GPX track/ }))
    expect(await screen.findByRole('dialog', { name: 'Field settings' })).toBeInTheDocument()
  })
})
```

`features/models/pages/ModelsListPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { renderRoutes } from '@/test/render'
import * as contentApi from '@/features/content/content-api'
import { tripType } from '@/features/content/test-fixtures'
import { ModelsListPage } from './ModelsListPage'

vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, listContentTypes: vi.fn() }
})
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({ data: { entries: { byType: { [tripType.id]: 8 } } } }),
  useUnreadCount: () => 0,
}))

it('lists models with field and entry counts', async () => {
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([tripType])
  renderRoutes([{ path: '/models', element: <ModelsListPage /> }], { route: '/models' })
  expect(await screen.findByRole('link', { name: /Trip/ })).toHaveAttribute('href', `/models/${tripType.id}`)
  expect(screen.getByText('3 fields · 8 entries')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New model' })).toHaveAttribute('href', '/models/new')
})

it('shows an empty state that starts from templates', async () => {
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([])
  renderRoutes([{ path: '/models', element: <ModelsListPage /> }], { route: '/models' })
  expect(await screen.findByText('No content models yet')).toBeInTheDocument()
})
```

In `features/home/home-utils.test.ts`, change the expected links to `[undefined, '/models/new', '/content/new', '/sites/new']`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- ModelBuilderPage ModelsListPage home-utils`
Expected: FAIL: missing pages; home-utils link mismatch.

- [ ] **Step 3: Implement `TemplateChooser.tsx`**

```tsx
import { FileText, LayoutTemplate, CalendarDays, Plus } from 'lucide-react'
import { MODEL_TEMPLATES, type ModelTemplate } from '../templates'

const ICONS = { 'blog-post': FileText, page: LayoutTemplate, event: CalendarDays } as const

export function TemplateChooser({ onChoose }: { onChoose: (t: ModelTemplate | null) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {MODEL_TEMPLATES.map((t) => {
        const Icon = ICONS[t.id]
        return (
          <li key={t.id}>
            <button type="button" onClick={() => onChoose(t)} className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent">
              <Icon aria-hidden className="mt-0.5 size-5 text-primary" />
              <span>
                <span className="block font-serif text-lg font-semibold">{t.name}</span>
                <span className="block text-sm text-muted-foreground">{t.description}</span>
              </span>
            </button>
          </li>
        )
      })}
      <li>
        <button type="button" onClick={() => onChoose(null)} className="flex w-full items-start gap-3 rounded-xl border border-dashed bg-card p-4 text-left hover:bg-accent">
          <Plus aria-hidden className="mt-0.5 size-5 text-muted-foreground" />
          <span>
            <span className="block font-serif text-lg font-semibold">Start from scratch</span>
            <span className="block text-sm text-muted-foreground">Add your own fields.</span>
          </span>
        </button>
      </li>
    </ul>
  )
}
```

- [ ] **Step 4: Implement `ModelFieldInspector.tsx`**

```tsx
import { Lock, Star, Trash2 } from 'lucide-react'
import type { ContentType, Field, ValidationRules } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FIELD_TYPE_LABELS, type DraftField } from '../model-draft'

interface ModelFieldInspectorProps {
  field: DraftField
  isTitle: boolean
  locked: boolean
  errors: { label?: string; key?: string }
  models: ContentType[]
  onLabel: (label: string) => void
  onKey: (key: string) => void
  onChange: (patch: Partial<Field>) => void
  onMakeTitle: () => void
  onRemove: () => void
}

const FILE_CHOICES = [
  { value: 'image/*', label: 'Images' },
  { value: 'video/*', label: 'Video' },
  { value: 'application/gpx+xml', label: 'GPX' },
  { value: 'application/pdf', label: 'PDF' },
]

function num(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function ModelFieldInspector({ field, isTitle, locked, errors, models, onLabel, onKey, onChange, onMakeTitle, onRemove }: ModelFieldInspectorProps) {
  const v: ValidationRules = field.validation ?? {}
  const setRule = (patch: Partial<ValidationRules>) => onChange({ validation: { ...v, ...patch } })
  const numberInput = (id: string, label: string, value: number | undefined, key: keyof ValidationRules) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value ?? ''} onChange={(e) => setRule({ [key]: num(e.target.value) } as Partial<ValidationRules>)} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{FIELD_TYPE_LABELS[field.type]} field</p>
      <div className="space-y-1.5">
        <Label htmlFor="fi-label">Label</Label>
        <Input id="fi-label" value={field.label} onChange={(e) => onLabel(e.target.value)} aria-invalid={errors.label ? true : undefined} />
        {errors.label && <p className="text-sm text-destructive">{errors.label}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fi-key" className="flex items-center gap-1.5">
          API key
          {locked && <Lock aria-hidden className="size-3.5 text-muted-foreground" />}
        </Label>
        <Input id="fi-key" value={field.name} onChange={(e) => onKey(e.target.value)} className="font-mono" aria-invalid={errors.key ? true : undefined} />
        {errors.key ? (
          <p className="text-sm text-destructive">{errors.key}</p>
        ) : locked ? (
          <p className="text-sm text-status-draft-fg">Sites reading this key stop receiving it if you rename it.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Created from the label. Your site reads the value by this key.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fi-description">Help text</Label>
        <Textarea id="fi-description" rows={2} value={field.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="fi-required">Required</Label>
        <Switch id="fi-required" checked={!!field.required} onCheckedChange={(checked) => onChange({ required: checked })} />
      </div>

      {field.type === 'TEXT' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {numberInput('fi-min', 'Min length', v.minLength, 'minLength')}
            {numberInput('fi-max', 'Max length', v.maxLength, 'maxLength')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fi-pattern">Pattern (regular expression)</Label>
            <Input id="fi-pattern" className="font-mono" value={v.pattern ?? ''} onChange={(e) => setRule({ pattern: e.target.value })} />
          </div>
          <Button type="button" variant={isTitle ? 'secondary' : 'outline'} size="sm" className="self-start" onClick={onMakeTitle} disabled={isTitle}>
            <Star aria-hidden className={cn('size-4', isTitle && 'fill-current')} />
            {isTitle ? 'This is the title' : 'Use as title'}
          </Button>
        </>
      )}
      {field.type === 'RICH_TEXT' && numberInput('fi-max', 'Max length', v.maxLength, 'maxLength')}
      {field.type === 'NUMBER' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {numberInput('fi-min', 'Minimum', v.min, 'min')}
            {numberInput('fi-max', 'Maximum', v.max, 'max')}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="fi-integer">Whole numbers only</Label>
            <Switch id="fi-integer" checked={!!v.integer} onCheckedChange={(checked) => setRule({ integer: checked })} />
          </div>
        </>
      )}
      {(field.type === 'MEDIA' || field.type === 'RELATION') && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="fi-multiple">Allow several</Label>
          <Switch id="fi-multiple" checked={!!v.multiple} onCheckedChange={(checked) => setRule({ multiple: checked })} />
        </div>
      )}
      {field.type === 'MEDIA' && (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Allowed files</legend>
          <div className="flex flex-wrap gap-1.5">
            {FILE_CHOICES.map((c) => {
              const on = v.allowedMimeTypes?.includes(c.value) ?? false
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRule({ allowedMimeTypes: on ? v.allowedMimeTypes!.filter((x) => x !== c.value) : [...(v.allowedMimeTypes ?? []), c.value] })}
                  className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent')}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">None selected means any supported file.</p>
        </fieldset>
      )}
      {field.type === 'RELATION' && (
        <div className="space-y-1.5">
          <Label htmlFor="fi-target">Entries from</Label>
          <Select value={v.targetContentType ?? 'any'} onValueChange={(value) => setRule({ targetContentType: value === 'any' ? undefined : value })}>
            <SelectTrigger id="fi-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any content model</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" className="self-start text-destructive" onClick={onRemove}>
        <Trash2 aria-hidden />
        Remove field
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Implement `ModelBuilderPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { ContentType, FieldType } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { stableStringify } from '@/features/content/editor/useEntryForm'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { useContentType, useContentTypes } from '@/features/content/queries'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { FieldList } from '@/features/builder/FieldList'
import { InspectorPanel } from '@/features/builder/InspectorPanel'
import { useEntryCount, useModelWrites } from '../models-api'
import {
  FIELD_TYPE_LABELS,
  addField,
  diffKeys,
  draftFromTemplate,
  draftFromType,
  emptyDraft,
  removeField,
  reorderFields,
  setFieldKey,
  setFieldLabel,
  setModelName,
  setSlug,
  setTitleField,
  toModelPayload,
  updateField,
  validateModel,
  type ModelDraft,
} from '../model-draft'
import { MODEL_TEMPLATES } from '../templates'
import { TemplateChooser } from '../components/TemplateChooser'
import { ModelFieldInspector } from '../components/ModelFieldInspector'

const PALETTE: FieldType[] = ['TEXT', 'RICH_TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'MEDIA', 'RELATION']

export function ModelBuilderPage() {
  const { id = 'new' } = useParams()
  const [params, setParams] = useSearchParams()
  const isNew = id === 'new'
  const typeQuery = useContentType(isNew ? undefined : id)

  if (isNew) {
    const templateId = params.get('template')
    if (!templateId) {
      return (
        <>
          <PageHeader title="New content model" description="Start from a template or from scratch. You can change everything later." breadcrumb={<Link to="/models">Content models</Link>} />
          <TemplateChooser onChoose={(t) => setParams({ template: t ? t.id : 'scratch' })} />
        </>
      )
    }
    const template = MODEL_TEMPLATES.find((t) => t.id === templateId)
    return <ModelBuilder key={`new:${templateId}`} initial={template ? draftFromTemplate(template) : emptyDraft()} />
  }

  if (typeQuery.isError) return <ErrorState message="Could not load this content model." onRetry={() => void typeQuery.refetch()} />
  if (!typeQuery.data) return <Skeleton className="h-64 w-full" />
  return <ModelBuilder key={typeQuery.data.id} model={typeQuery.data} initial={draftFromType(typeQuery.data)} />
}

function ModelBuilder({ model, initial }: { model?: ContentType; initial: ModelDraft }) {
  const navigate = useNavigate()
  const writes = useModelWrites()
  const models = useContentTypes()
  const entryCount = useEntryCount(model?.id)
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(toModelPayload(initial)))
  const [selected, setSelected] = useState<string | undefined>()
  const [showErrors, setShowErrors] = useState(false)
  const [confirm, setConfirm] = useState<'save' | 'delete' | null>(null)
  const [saving, setSaving] = useState(false)

  const errors = useMemo(() => validateModel(draft), [draft])
  const visible = showErrors ? errors : {}
  const dirty = stableStringify(toModelPayload(draft)) !== baseline
  const blocker = useUnsavedGuard(dirty)
  const count = entryCount.data ?? 0
  const diff = diffKeys(draft)
  const selectedField = draft.fields.find((f) => f.cid === selected)

  const save = async () => {
    setConfirm(null)
    setSaving(true)
    try {
      const payload = toModelPayload(draft)
      const saved = model ? await writes.update(model.id, payload) : await writes.create(payload)
      setBaseline(stableStringify(payload))
      toast.success(model ? 'Model saved' : 'Model created')
      if (!model) navigate(`/models/${saved.id}`, { replace: true, state: { skipGuard: true } })
      else {
        setDraft(draftFromType(saved))
        setSelected(undefined)
      }
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const requestSave = () => {
    setShowErrors(true)
    const keys = Object.keys(errors)
    if (keys.length) {
      const fieldKey = keys.find((k) => k.includes(':'))
      if (fieldKey) setSelected(fieldKey.split(':')[1])
      toast.error('Fix the highlighted fields before saving')
      return
    }
    if (model && count > 0 && (diff.renamed.length || diff.removed.length)) {
      setConfirm('save')
      return
    }
    void save()
  }

  const remove = async () => {
    setConfirm(null)
    try {
      await writes.remove(model!.id, count > 0)
      toast.success(`Deleted ${model!.name}`)
      navigate('/models', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const fieldError = (cid: string) => ({ label: visible[`label:${cid}`], key: visible[`key:${cid}`] })

  return (
    <>
      <PageHeader
        title={draft.name.trim() || 'New content model'}
        breadcrumb={<Link to="/models">Content models</Link>}
        description={model ? `${draft.fields.length} fields · ${count} ${count === 1 ? 'entry' : 'entries'}` : undefined}
        actions={
          <>
            {model && (
              <Button variant="outline" onClick={() => setConfirm('delete')}>
                Delete model
              </Button>
            )}
            <Button onClick={requestSave} disabled={saving || (!!model && !dirty)}>
              {saving ? 'Saving…' : 'Save model'}
            </Button>
          </>
        }
      />

      <section className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="model-name">Name</Label>
          <Input id="model-name" value={draft.name} onChange={(e) => setDraft(setModelName(draft, e.target.value))} aria-invalid={visible.name ? true : undefined} />
          {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model-slug">Slug</Label>
          <Input id="model-slug" className="font-mono" value={draft.slug} onChange={(e) => setDraft(setSlug(draft, e.target.value))} aria-invalid={visible.slug ? true : undefined} />
          {visible.slug ? <p className="text-sm text-destructive">{visible.slug}</p> : <p className="text-sm text-muted-foreground">Your site loads entries at /content/{draft.slug || 'slug'}.</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="model-description">Description</Label>
          <Textarea id="model-description" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="mb-2 font-serif text-lg font-semibold">Fields</h2>
          {visible.fields && <p className="mb-2 text-sm text-destructive">{visible.fields}</p>}
          <FieldList
            label="Fields"
            items={draft.fields.map((f) => ({
              id: f.cid,
              label: f.label,
              apiKey: f.name,
              typeLabel: FIELD_TYPE_LABELS[f.type],
              isTitle: f.cid === draft.titleCid && f.type === 'TEXT',
              hasError: !!(visible[`label:${f.cid}`] || visible[`key:${f.cid}`]),
            }))}
            selectedId={selected}
            onSelect={setSelected}
            onReorder={(cids) => setDraft(reorderFields(draft, cids))}
          />
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add field</p>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Add ${FIELD_TYPE_LABELS[type]} field`}
                  onClick={() => {
                    const { draft: next, cid } = addField(draft, type)
                    setDraft(next)
                    setSelected(cid)
                  }}
                >
                  + {FIELD_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          </div>
        </section>
        <InspectorPanel title="Field settings" open={!!selectedField} onClose={() => setSelected(undefined)}>
          {selectedField && (
            <ModelFieldInspector
              key={selectedField.cid}
              field={selectedField}
              isTitle={selectedField.cid === draft.titleCid}
              locked={!!selectedField.originalName && count > 0}
              errors={fieldError(selectedField.cid)}
              models={(models.data ?? []).filter((m) => m.id !== model?.id)}
              onLabel={(label) => setDraft(setFieldLabel(draft, selectedField.cid, label))}
              onKey={(key) => setDraft(setFieldKey(draft, selectedField.cid, key))}
              onChange={(patch) => setDraft(updateField(draft, selectedField.cid, patch))}
              onMakeTitle={() => setDraft(setTitleField(draft, selectedField.cid))}
              onRemove={() => {
                setDraft(removeField(draft, selectedField.cid))
                setSelected(undefined)
              }}
            />
          )}
        </InspectorPanel>
      </div>

      <UnsavedChangesDialog blocker={blocker} />
      <ConfirmDialog
        open={confirm === 'save'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Change API keys?"
        description={
          <span className="block space-y-2">
            <span className="block">
              {count} {count === 1 ? 'entry uses' : 'entries use'} this model. Sites reading these keys stop receiving their values:
            </span>
            <span className="block font-mono text-xs">
              {[...diff.renamed.map((r) => `${r.from} → ${r.to}`), ...diff.removed.map((r) => `${r} (removed)`)].join(', ')}
            </span>
          </span>
        }
        confirmLabel="Save changes"
        onConfirm={() => void save()}
      />
      {model && (
        <ConfirmDialog
          open={confirm === 'delete'}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`Delete ${model.name}?`}
          description={count > 0 ? `This also deletes its ${count} ${count === 1 ? 'entry' : 'entries'}. This cannot be undone.` : 'This cannot be undone.'}
          confirmText={count > 0 ? model.name : undefined}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
```

The rename confirmation uses "→" (U+2192), not a dash.

- [ ] **Step 6: Implement `ModelsListPage.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { Boxes, Plus } from 'lucide-react'
import { useContentTypes } from '@/features/content/queries'
import { useStats } from '@/lib/queries/stats'
import { formatRelative } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function ModelsListPage() {
  const types = useContentTypes()
  const stats = useStats()
  const action = (
    <Button asChild>
      <Link to="/models/new">
        <Plus aria-hidden />
        New model
      </Link>
    </Button>
  )

  let body: React.ReactNode
  if (types.isPending) body = <Skeleton className="h-32 w-full" />
  else if (types.isError) body = <ErrorState message="Could not load content models." onRetry={() => void types.refetch()} />
  else if (types.data.length === 0)
    body = <EmptyState icon={Boxes} title="No content models yet" description="A model defines the fields of your content. Start from a template." action={action} />
  else
    body = (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.data.map((t) => {
          const entries = stats.data?.entries.byType?.[t.id] ?? 0
          return (
            <li key={t.id}>
              <Link to={`/models/${t.id}`} className="block rounded-xl border bg-card p-4 hover:bg-accent">
                <span className="block font-serif text-lg font-semibold">{t.name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{t.slug}</span>
                <span className="mt-2 block text-sm text-muted-foreground">
                  {t.fields.length} {t.fields.length === 1 ? 'field' : 'fields'} · {entries} {entries === 1 ? 'entry' : 'entries'}
                </span>
                <span className="block text-xs text-muted-foreground">Edited {formatRelative(t.updatedAt)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    )

  return (
    <>
      <PageHeader title="Content models" description="The shapes of your content: which fields each kind of entry has." actions={action} />
      {body}
    </>
  )
}
```

- [ ] **Step 7: Implement `features/legacy-redirects.tsx` and route everything**

`features/legacy-redirects.tsx`:

```tsx
import { Navigate, useParams } from 'react-router-dom'

export function RedirectWithId({ to }: { to: (id: string) => string }) {
  const params = useParams()
  const id = params.id ?? params.formId ?? ''
  return <Navigate to={to(id)} replace />
}
```

In `modules/registry.tsx`:
- Remove the imports of `ContentTypesList` and `ContentTypeForm`.
- Add `import { Navigate } from 'react-router-dom'`, `import { ModelsListPage } from '@/features/models/pages/ModelsListPage'`, `import { ModelBuilderPage } from '@/features/models/pages/ModelBuilderPage'`, `import { RedirectWithId } from '@/features/legacy-redirects'`.
- Replace the models module routes with:

```tsx
    routes: [
      { path: 'models', element: <ModelsListPage /> },
      { path: 'models/:id', element: <ModelBuilderPage /> },
      { path: 'content-types', element: <Navigate to="/models" replace /> },
      { path: 'content-types/new', element: <Navigate to="/models/new" replace /> },
      { path: 'content-types/:id/edit', element: <RedirectWithId to={(id) => `/models/${id}`} /> },
    ],
```

In `features/home/home-utils.ts`, change the model step's `to` from `'/content-types/new'` to `'/models/new'`.

Delete the legacy model code:

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q -r src/pages/ContentTypes src/services/contentTypes.ts
grep -rn "pages/ContentTypes\|services/contentTypes" src || echo "no references"
```

- [ ] **Step 8: Run tests, build, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/features src/modules src/lib src/test`
Expected: PASS, build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): content model builder with templates, inspector and key guardrails"
```

---

## Task 5: Forms

**Files:**
- Create: `features/forms/forms-api.ts`, `features/forms/form-draft.ts`, `features/forms/components/FormFieldInspector.tsx`, `FormPreview.tsx`, `EmbedPanel.tsx`, `features/forms/pages/FormsListPage.tsx`, `FormBuilderPage.tsx`
- Modify: `modules/registry.tsx`
- Delete: `pages/ContactForms/ContactFormsList.tsx`, `ContactFormForm.tsx`, `FormFieldBuilder.tsx` (keep `SubmissionsList.tsx` until Task 6 replaces its route), `services/contactForms.ts` only in Task 6
- Test: `features/forms/form-draft.test.ts`, `features/forms/pages/FormBuilderPage.test.tsx`

**Interfaces:**
- Consumes: Task 2; `useSites` (Plan 3); `publicApiBase` (Plan 3 `features/home/home-utils.ts`).
- Produces:
  - `forms-api.ts`: `FormPayload { name; slug; description?; recipientEmail; fields: FormFieldDefinition[]; siteId?: string; isActive?: boolean }`, `formKeys`, `listForms()`, `getForm(id)`, `useForms()`, `useForm(id?)`, `useFormWrites() => { create(body), update(id, body), remove(id) }`.
  - `form-draft.ts`: `FORM_FIELD_LABELS: Record<FormFieldType, string>`, `DraftFormField = FormFieldDefinition & { cid: string; keyTouched: boolean }`, `FormDraft { name; slug; slugTouched; description; recipientEmail; siteId?: string; isActive: boolean; fields: DraftFormField[] }`, `newFormDraft()` (fields Name, Email, Message), `draftFromForm(form)`, `setFormName`, `setFormSlug`, `addFormField(d, type) => { draft; cid }`, `updateFormField(d, cid, patch)`, `setFormFieldLabel`, `setFormFieldKey`, `removeFormField`, `reorderFormFields`, `validateForm(d) => Record<string, string>` (keys `name`, `slug`, `recipientEmail`, `fields`, `label:<cid>`, `key:<cid>`, `options:<cid>`), `toFormPayload(d) => FormPayload`.
  - Routes `/forms`, `/forms/:id` (`new`); redirects `/contact-forms` → `/forms`, `/contact-forms/new` → `/forms/new`, `/contact-forms/:id/edit` → `/forms/:id`.

- [ ] **Step 1: Write the failing tests**

`features/forms/form-draft.test.ts`:

```ts
import type { ContactForm } from '@/types'
import { addFormField, draftFromForm, newFormDraft, setFormFieldLabel, setFormName, toFormPayload, updateFormField, validateForm } from './form-draft'

describe('form drafts', () => {
  it('starts with name, email and message fields', () => {
    const d = setFormName(newFormDraft(), 'Contact us')
    expect(d.slug).toBe('contact-us')
    expect(d.fields.map((f) => [f.name, f.type, f.required])).toEqual([
      ['name', 'TEXT', true],
      ['email', 'EMAIL', true],
      ['message', 'TEXTAREA', true],
    ])
  })

  it('requires options for a select field and a valid recipient', () => {
    let d = setFormName(newFormDraft(), 'Booking')
    d = { ...d, recipientEmail: 'not-an-email' }
    const { draft, cid } = addFormField(d, 'SELECT')
    const errors = validateForm(draft)
    expect(errors.recipientEmail).toBe('Enter a valid email address')
    expect(errors[`options:${cid}`]).toBe('Add at least one option')
    const withOptions = updateFormField(draft, cid, { options: ['Morning', ' ', 'Evening'] })
    expect(validateForm(withOptions)[`options:${cid}`]).toBeUndefined()
  })

  it('builds the payload: trims options, omits empty site and validation', () => {
    let d = setFormName({ ...newFormDraft(), recipientEmail: 'me@x.test' }, 'Booking')
    const { draft, cid } = addFormField(d, 'SELECT')
    d = setFormFieldLabel(draft, cid, 'Time slot')
    d = updateFormField(d, cid, { options: [' Morning ', '', 'Evening'], validation: { minLength: undefined } })
    const payload = toFormPayload(d)
    expect(payload.siteId).toBeUndefined()
    expect(payload.fields.at(-1)).toEqual({ name: 'timeSlot', label: 'Time slot', type: 'SELECT', required: false, options: ['Morning', 'Evening'] })
    expect(payload.fields[0]).not.toHaveProperty('options')
  })

  it('keeps keys of saved fields when labels change', () => {
    const form: ContactForm = {
      id: 'f1', name: 'Contact', slug: 'contact', recipientEmail: 'me@x.test', isActive: true, submissionCount: 3, createdAt: '', updatedAt: '',
      fields: [{ name: 'msg', label: 'Message', type: 'TEXTAREA', required: true }],
    }
    const d = draftFromForm(form)
    expect(setFormFieldLabel(d, d.fields[0].cid, 'Your message').fields[0].name).toBe('msg')
  })
})
```

`features/forms/pages/FormBuilderPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import { setViewport } from '@/test/viewport'
import type { ContactForm } from '@/types'
import apiClient from '@/lib/api'
import { sitesService } from '@/services/sites'
import { FormBuilderPage } from './FormBuilderPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn() } }))

const form: ContactForm = {
  id: 'f1', name: 'Contact us', slug: 'contact-us', recipientEmail: 'me@x.test', isActive: true, submissionCount: 5, createdAt: '', updatedAt: '',
  fields: [
    { name: 'email', label: 'Email', type: 'EMAIL', required: true },
    { name: 'message', label: 'Message', type: 'TEXTAREA', required: true, placeholder: 'How can we help?' },
  ],
}

const routes = [
  { path: '/forms/:id', element: <FormBuilderPage /> },
  { path: '/forms', element: <p>forms list</p> },
]

beforeEach(() => {
  setViewport(true)
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [{ id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_key', isActive: true, requestCount: 0, createdAt: '', updatedAt: '' }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: { success: true, data: url === '/contact-forms/f1' ? form : [] } }))
})

it('previews the form live and shows an embed snippet', async () => {
  renderRoutes(routes, { route: '/forms/f1' })
  const preview = await screen.findByRole('region', { name: 'Preview' })
  expect(within(preview).getByLabelText(/Message/)).toHaveAttribute('placeholder', 'How can we help?')
  await userEvent.click(screen.getByRole('button', { name: /Message/ }))
  const label = within(screen.getByRole('complementary', { name: 'Field settings' })).getByLabelText('Label')
  await userEvent.clear(label)
  await userEvent.type(label, 'Your question')
  expect(within(preview).getByLabelText(/Your question/)).toBeInTheDocument()
  const snippet = screen.getByLabelText('Submit example')
  expect(snippet).toHaveTextContent('/api/v1/public/forms/contact-us/submit')
  expect(snippet).toHaveTextContent('cms_key')
})

it('creates a new form with defaults', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { ...form, id: 'f9' } } })
  const { router } = renderRoutes(routes, { route: '/forms/new' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Contact us')
  await userEvent.type(screen.getByLabelText('Send submissions to'), 'me@x.test')
  await userEvent.click(screen.getByRole('button', { name: 'Save form' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/forms/f9'))
  expect(apiClient.post).toHaveBeenCalledWith('/contact-forms', expect.objectContaining({ slug: 'contact-us', recipientEmail: 'me@x.test' }))
})

it('warns that deleting removes the submissions', async () => {
  renderRoutes(routes, { route: '/forms/f1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete form' }))
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('5 submissions')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- form-draft FormBuilderPage`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `features/forms/forms-api.ts`**

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import type { ApiResponse, ContactForm, FormFieldDefinition, PaginatedResponse } from '@/types'

export interface FormPayload {
  name: string
  slug: string
  description?: string
  recipientEmail: string
  fields: FormFieldDefinition[]
  siteId?: string
  isActive?: boolean
}

export const formKeys = {
  all: ['forms'] as const,
  list: () => [...formKeys.all, 'list'] as const,
  item: (id: string) => [...formKeys.all, 'item', id] as const,
}

export async function listForms(): Promise<ContactForm[]> {
  return (await apiClient.get<PaginatedResponse<ContactForm>>('/contact-forms', { params: { page: 1, limit: 100 } })).data.data
}

export async function getForm(id: string): Promise<ContactForm> {
  return (await apiClient.get<ApiResponse<ContactForm>>(`/contact-forms/${id}`)).data.data
}

export function useForms() {
  return useQuery({ queryKey: formKeys.list(), queryFn: listForms })
}

export function useForm(id?: string) {
  return useQuery({ queryKey: formKeys.item(id ?? ''), queryFn: () => getForm(id!), enabled: !!id })
}

export function useFormWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: formKeys.all })
    return {
      create: async (body: FormPayload) => {
        const form = (await apiClient.post<ApiResponse<ContactForm>>('/contact-forms', body)).data.data
        queryClient.setQueryData(formKeys.item(form.id), form)
        refresh()
        return form
      },
      update: async (id: string, body: FormPayload) => {
        const form = (await apiClient.put<ApiResponse<ContactForm>>(`/contact-forms/${id}`, body)).data.data
        queryClient.setQueryData(formKeys.item(id), form)
        refresh()
        return form
      },
      remove: async (id: string) => {
        await apiClient.delete(`/contact-forms/${id}`)
        queryClient.removeQueries({ queryKey: formKeys.item(id) })
        refresh()
      },
    }
  }, [queryClient])
}
```

- [ ] **Step 4: Implement `features/forms/form-draft.ts`**

```ts
import type { ContactForm, FormFieldDefinition, FormFieldType } from '@/types'
import { apiKeyError, toApiKey, toSlug, uniqueKey } from '@/features/builder/api-key'
import type { FormPayload } from './forms-api'

export const FORM_FIELD_LABELS: Record<FormFieldType, string> = {
  TEXT: 'Short text',
  EMAIL: 'Email',
  TEXTAREA: 'Long text',
  SELECT: 'Choice',
  NUMBER: 'Number',
  CHECKBOX: 'Checkbox',
  DATE: 'Date',
}

export type DraftFormField = FormFieldDefinition & { cid: string; keyTouched: boolean; saved?: boolean }

export interface FormDraft {
  name: string
  slug: string
  slugTouched: boolean
  description: string
  recipientEmail: string
  siteId?: string
  isActive: boolean
  fields: DraftFormField[]
}

let counter = 0
const nextCid = () => `ff${++counter}`
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function newFormDraft(): FormDraft {
  return {
    name: '',
    slug: '',
    slugTouched: false,
    description: '',
    recipientEmail: '',
    isActive: true,
    fields: [
      { cid: nextCid(), keyTouched: true, name: 'name', label: 'Name', type: 'TEXT', required: true },
      { cid: nextCid(), keyTouched: true, name: 'email', label: 'Email', type: 'EMAIL', required: true },
      { cid: nextCid(), keyTouched: true, name: 'message', label: 'Message', type: 'TEXTAREA', required: true },
    ],
  }
}

export function draftFromForm(form: ContactForm): FormDraft {
  return {
    name: form.name,
    slug: form.slug,
    slugTouched: true,
    description: form.description ?? '',
    recipientEmail: form.recipientEmail,
    siteId: form.siteId || undefined,
    isActive: form.isActive,
    fields: form.fields.map((f) => ({ ...f, cid: nextCid(), keyTouched: true, saved: true })),
  }
}

export function setFormName(d: FormDraft, name: string): FormDraft {
  return { ...d, name, slug: d.slugTouched ? d.slug : toSlug(name) }
}

export function setFormSlug(d: FormDraft, slug: string): FormDraft {
  return { ...d, slug, slugTouched: true }
}

export function addFormField(d: FormDraft, type: FormFieldType): { draft: FormDraft; cid: string } {
  const cid = nextCid()
  const label = FORM_FIELD_LABELS[type]
  const field: DraftFormField = { cid, keyTouched: false, name: uniqueKey(toApiKey(label), d.fields.map((f) => f.name)), label, type, required: false, ...(type === 'SELECT' ? { options: [] } : {}) }
  return { draft: { ...d, fields: [...d.fields, field] }, cid }
}

function mapField(d: FormDraft, cid: string, fn: (f: DraftFormField) => DraftFormField): FormDraft {
  return { ...d, fields: d.fields.map((f) => (f.cid === cid ? fn(f) : f)) }
}

export function updateFormField(d: FormDraft, cid: string, patch: Partial<FormFieldDefinition>): FormDraft {
  return mapField(d, cid, (f) => ({ ...f, ...patch }))
}

export function setFormFieldLabel(d: FormDraft, cid: string, label: string): FormDraft {
  const others = d.fields.filter((f) => f.cid !== cid).map((f) => f.name)
  return mapField(d, cid, (f) => (f.keyTouched || f.saved ? { ...f, label } : { ...f, label, name: uniqueKey(toApiKey(label) || 'field', others) }))
}

export function setFormFieldKey(d: FormDraft, cid: string, name: string): FormDraft {
  return mapField(d, cid, (f) => ({ ...f, name: name.trim(), keyTouched: true }))
}

export function removeFormField(d: FormDraft, cid: string): FormDraft {
  return { ...d, fields: d.fields.filter((f) => f.cid !== cid) }
}

export function reorderFormFields(d: FormDraft, cids: string[]): FormDraft {
  const byCid = new Map(d.fields.map((f) => [f.cid, f]))
  return { ...d, fields: cids.map((c) => byCid.get(c)!).filter(Boolean) }
}

export function validateForm(d: FormDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!d.name.trim()) errors.name = 'Name is required'
  if (!/^[a-z0-9-]{1,100}$/.test(d.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens'
  if (!EMAIL.test(d.recipientEmail.trim())) errors.recipientEmail = 'Enter a valid email address'
  if (d.fields.length === 0) errors.fields = 'Add at least one field'
  for (const f of d.fields) {
    if (!f.label.trim()) errors[`label:${f.cid}`] = 'Label is required'
    const keyError = apiKeyError(f.name, d.fields.filter((o) => o.cid !== f.cid).map((o) => o.name))
    if (keyError) errors[`key:${f.cid}`] = keyError
    if (f.type === 'SELECT' && !(f.options ?? []).some((o) => o.trim())) errors[`options:${f.cid}`] = 'Add at least one option'
  }
  return errors
}

export function toFormPayload(d: FormDraft): FormPayload {
  return {
    name: d.name.trim(),
    slug: d.slug,
    description: d.description.trim(),
    recipientEmail: d.recipientEmail.trim(),
    isActive: d.isActive,
    ...(d.siteId ? { siteId: d.siteId } : {}),
    fields: d.fields.map((f) => {
      const validation = Object.fromEntries(Object.entries(f.validation ?? {}).filter(([, v]) => v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))))
      const options = f.type === 'SELECT' ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined
      return {
        name: f.name,
        label: f.label.trim(),
        type: f.type,
        required: !!f.required,
        ...(f.placeholder?.trim() ? { placeholder: f.placeholder.trim() } : {}),
        ...(options ? { options } : {}),
        ...(Object.keys(validation).length ? { validation } : {}),
      }
    }),
  }
}
```

- [ ] **Step 5: Implement the form components**

`features/forms/components/FormFieldInspector.tsx`:

```tsx
import { Trash2 } from 'lucide-react'
import type { FormFieldDefinition } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FORM_FIELD_LABELS, type DraftFormField } from '../form-draft'

interface Props {
  field: DraftFormField
  errors: { label?: string; key?: string; options?: string }
  onLabel: (label: string) => void
  onKey: (key: string) => void
  onChange: (patch: Partial<FormFieldDefinition>) => void
  onRemove: () => void
}

function num(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function FormFieldInspector({ field, errors, onLabel, onKey, onChange, onRemove }: Props) {
  const v = field.validation ?? {}
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{FORM_FIELD_LABELS[field.type]} field</p>
      <div className="space-y-1.5">
        <Label htmlFor="ffi-label">Label</Label>
        <Input id="ffi-label" value={field.label} onChange={(e) => onLabel(e.target.value)} aria-invalid={errors.label ? true : undefined} />
        {errors.label && <p className="text-sm text-destructive">{errors.label}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ffi-key">API key</Label>
        <Input id="ffi-key" className="font-mono" value={field.name} onChange={(e) => onKey(e.target.value)} aria-invalid={errors.key ? true : undefined} />
        {errors.key ? <p className="text-sm text-destructive">{errors.key}</p> : <p className="text-sm text-muted-foreground">Your site sends the value under this key.</p>}
      </div>
      {field.type !== 'CHECKBOX' && field.type !== 'DATE' && field.type !== 'SELECT' && (
        <div className="space-y-1.5">
          <Label htmlFor="ffi-placeholder">Placeholder</Label>
          <Input id="ffi-placeholder" value={field.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value })} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="ffi-required">Required</Label>
        <Switch id="ffi-required" checked={!!field.required} onCheckedChange={(checked) => onChange({ required: checked })} />
      </div>
      {field.type === 'SELECT' && (
        <div className="space-y-1.5">
          <Label htmlFor="ffi-options">Options (one per line)</Label>
          <Textarea id="ffi-options" rows={4} value={(field.options ?? []).join('\n')} onChange={(e) => onChange({ options: e.target.value.split('\n') })} aria-invalid={errors.options ? true : undefined} />
          {errors.options && <p className="text-sm text-destructive">{errors.options}</p>}
        </div>
      )}
      {(field.type === 'TEXT' || field.type === 'TEXTAREA') && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ffi-min">Min length</Label>
            <Input id="ffi-min" type="number" value={v.minLength ?? ''} onChange={(e) => onChange({ validation: { ...v, minLength: num(e.target.value) } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ffi-max">Max length</Label>
            <Input id="ffi-max" type="number" value={v.maxLength ?? ''} onChange={(e) => onChange({ validation: { ...v, maxLength: num(e.target.value) } })} />
          </div>
        </div>
      )}
      {field.type === 'NUMBER' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ffi-min">Minimum</Label>
            <Input id="ffi-min" type="number" value={v.min ?? ''} onChange={(e) => onChange({ validation: { ...v, min: num(e.target.value) } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ffi-max">Maximum</Label>
            <Input id="ffi-max" type="number" value={v.max ?? ''} onChange={(e) => onChange({ validation: { ...v, max: num(e.target.value) } })} />
          </div>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="self-start text-destructive" onClick={onRemove}>
        <Trash2 aria-hidden />
        Remove field
      </Button>
    </div>
  )
}
```

`features/forms/components/FormPreview.tsx`:

```tsx
import type { FormFieldDefinition } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function FormPreview({ name, fields }: { name: string; fields: FormFieldDefinition[] }) {
  return (
    <section aria-label="Preview" className="rounded-xl border bg-card p-4">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</h2>
      <p className="mb-4 font-serif text-xl font-semibold">{name || 'Untitled form'}</p>
      <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
        {fields.map((f, i) => {
          const id = `preview-${i}`
          const label = (
            <Label htmlFor={id}>
              {f.label || 'Untitled field'}
              {f.required && <span aria-hidden className="text-destructive"> *</span>}
            </Label>
          )
          if (f.type === 'CHECKBOX') {
            return (
              <div key={id} className="flex items-center gap-2">
                <input id={id} type="checkbox" className="size-4 accent-[var(--primary)]" />
                {label}
              </div>
            )
          }
          return (
            <div key={id} className="space-y-1.5">
              {label}
              {f.type === 'TEXTAREA' ? (
                <Textarea id={id} rows={3} placeholder={f.placeholder} />
              ) : f.type === 'SELECT' ? (
                <select id={id} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Choose…</option>
                  {(f.options ?? []).filter((o) => o.trim()).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <Input id={id} type={f.type === 'EMAIL' ? 'email' : f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'} placeholder={f.placeholder} />
              )}
            </div>
          )
        })}
        <Button type="submit" className="self-start" disabled>
          Send
        </Button>
      </form>
    </section>
  )
}
```

`features/forms/components/EmbedPanel.tsx`:

```tsx
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { FormFieldDefinition } from '@/types'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '@/features/home/home-utils'

export function EmbedPanel({ slug, fields, apiKey }: { slug: string; fields: FormFieldDefinition[]; apiKey?: string }) {
  const key = apiKey ?? 'YOUR_API_KEY'
  const example = Object.fromEntries(fields.map((f) => [f.name, f.type === 'CHECKBOX' ? true : f.type === 'NUMBER' ? 1 : f.type === 'EMAIL' ? 'jana@example.com' : '…']))
  const code = `fetch('${publicApiBase()}/forms/${slug || 'your-form'}/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': '${key}' },
  body: JSON.stringify(${JSON.stringify(example, null, 2).replace(/\n/g, '\n  ')}),
})`
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-1 font-serif text-lg font-semibold">Embed</h2>
      <p className="mb-2 text-sm text-muted-foreground">
        Your site can load this form from <code className="font-mono text-xs">{publicApiBase()}/forms/{slug || 'your-form'}</code> and send answers like this:
      </p>
      <div className="rounded-lg border bg-muted/60">
        <div className="flex items-center justify-end border-b px-2 py-1">
          <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success('Snippet copied'))}>
            <Copy aria-hidden />
            Copy
          </Button>
        </div>
        <pre aria-label="Submit example" className="overflow-x-auto p-3 text-xs"><code>{code}</code></pre>
      </div>
      {!apiKey && <p className="mt-2 text-xs text-muted-foreground">Connect a site to get an API key.</p>}
    </section>
  )
}
```

- [ ] **Step 6: Implement the form pages**

`features/forms/pages/FormBuilderPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { ContactForm, FormFieldType } from '@/types'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldList } from '@/features/builder/FieldList'
import { InspectorPanel } from '@/features/builder/InspectorPanel'
import { useForm, useFormWrites } from '../forms-api'
import {
  FORM_FIELD_LABELS,
  addFormField,
  draftFromForm,
  newFormDraft,
  removeFormField,
  reorderFormFields,
  setFormFieldKey,
  setFormFieldLabel,
  setFormName,
  setFormSlug,
  toFormPayload,
  updateFormField,
  validateForm,
  type FormDraft,
} from '../form-draft'
import { FormFieldInspector } from '../components/FormFieldInspector'
import { FormPreview } from '../components/FormPreview'
import { EmbedPanel } from '../components/EmbedPanel'

const PALETTE: FormFieldType[] = ['TEXT', 'EMAIL', 'TEXTAREA', 'SELECT', 'NUMBER', 'CHECKBOX', 'DATE']

export function FormBuilderPage() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const formQuery = useForm(isNew ? undefined : id)
  if (isNew) return <FormBuilder key="new" initial={newFormDraft()} />
  if (formQuery.isError) return <ErrorState message="Could not load this form." onRetry={() => void formQuery.refetch()} />
  if (!formQuery.data) return <Skeleton className="h-64 w-full" />
  return <FormBuilder key={formQuery.data.id} form={formQuery.data} initial={draftFromForm(formQuery.data)} />
}

function FormBuilder({ form, initial }: { form?: ContactForm; initial: FormDraft }) {
  const navigate = useNavigate()
  const writes = useFormWrites()
  const sites = useSites()
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(toFormPayload(initial)))
  const [selected, setSelected] = useState<string | undefined>()
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors = useMemo(() => validateForm(draft), [draft])
  const visible = showErrors ? errors : {}
  const payload = toFormPayload(draft)
  const dirty = stableStringify(payload) !== baseline
  const blocker = useUnsavedGuard(dirty)
  const selectedField = draft.fields.find((f) => f.cid === selected)
  const site = sites.data?.find((s) => s.id === draft.siteId) ?? sites.data?.[0]

  const save = async () => {
    setShowErrors(true)
    const keys = Object.keys(errors)
    if (keys.length) {
      const fieldKey = keys.find((k) => k.includes(':'))
      if (fieldKey) setSelected(fieldKey.split(':')[1])
      toast.error('Fix the highlighted fields before saving')
      return
    }
    setSaving(true)
    try {
      const saved = form ? await writes.update(form.id, payload) : await writes.create(payload)
      setBaseline(stableStringify(payload))
      toast.success(form ? 'Form saved' : 'Form created')
      if (!form) navigate(`/forms/${saved.id}`, { replace: true, state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await writes.remove(form!.id)
      toast.success(`Deleted ${form!.name}`)
      navigate('/forms', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={draft.name.trim() || 'New form'}
        breadcrumb={<Link to="/forms">Forms</Link>}
        actions={
          <>
            {form && <Button variant="outline" onClick={() => setConfirmDelete(true)}>Delete form</Button>}
            <Button onClick={() => void save()} disabled={saving || (!!form && !dirty)}>{saving ? 'Saving…' : 'Save form'}</Button>
          </>
        }
      />
      <section className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="form-name">Name</Label>
          <Input id="form-name" value={draft.name} onChange={(e) => setDraft(setFormName(draft, e.target.value))} aria-invalid={visible.name ? true : undefined} />
          {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-slug">Slug</Label>
          <Input id="form-slug" className="font-mono" value={draft.slug} onChange={(e) => setDraft(setFormSlug(draft, e.target.value))} aria-invalid={visible.slug ? true : undefined} />
          {visible.slug && <p className="text-sm text-destructive">{visible.slug}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-recipient">Send submissions to</Label>
          <Input id="form-recipient" type="email" value={draft.recipientEmail} onChange={(e) => setDraft({ ...draft, recipientEmail: e.target.value })} aria-invalid={visible.recipientEmail ? true : undefined} />
          {visible.recipientEmail && <p className="text-sm text-destructive">{visible.recipientEmail}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-site">Site</Label>
          <Select value={draft.siteId ?? 'none'} onValueChange={(v) => setDraft({ ...draft, siteId: v === 'none' ? undefined : v })}>
            <SelectTrigger id="form-site"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Any site</SelectItem>
              {(sites.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          <Label htmlFor="form-active">Accept new submissions</Label>
          <Switch id="form-active" checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-serif text-lg font-semibold">Fields</h2>
          {visible.fields && <p className="mb-2 text-sm text-destructive">{visible.fields}</p>}
          <FieldList
            label="Form fields"
            items={draft.fields.map((f) => ({ id: f.cid, label: f.label, apiKey: f.name, typeLabel: FORM_FIELD_LABELS[f.type], hasError: !!(visible[`label:${f.cid}`] || visible[`key:${f.cid}`] || visible[`options:${f.cid}`]) }))}
            selectedId={selected}
            onSelect={setSelected}
            onReorder={(cids) => setDraft(reorderFormFields(draft, cids))}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {PALETTE.map((type) => (
              <Button key={type} type="button" variant="outline" size="sm" aria-label={`Add ${FORM_FIELD_LABELS[type]} field`} onClick={() => { const { draft: next, cid } = addFormField(draft, type); setDraft(next); setSelected(cid) }}>
                + {FORM_FIELD_LABELS[type]}
              </Button>
            ))}
          </div>
          <div className="mt-6">
            <InspectorPanel title="Field settings" open={!!selectedField} onClose={() => setSelected(undefined)}>
              {selectedField && (
                <FormFieldInspector
                  key={selectedField.cid}
                  field={selectedField}
                  errors={{ label: visible[`label:${selectedField.cid}`], key: visible[`key:${selectedField.cid}`], options: visible[`options:${selectedField.cid}`] }}
                  onLabel={(label) => setDraft(setFormFieldLabel(draft, selectedField.cid, label))}
                  onKey={(key) => setDraft(setFormFieldKey(draft, selectedField.cid, key))}
                  onChange={(patch) => setDraft(updateFormField(draft, selectedField.cid, patch))}
                  onRemove={() => { setDraft(removeFormField(draft, selectedField.cid)); setSelected(undefined) }}
                />
              )}
            </InspectorPanel>
          </div>
        </section>
        <div className="flex flex-col gap-6">
          <FormPreview name={draft.name} fields={payload.fields} />
          <EmbedPanel slug={draft.slug} fields={payload.fields} apiKey={site?.apiKey} />
        </div>
      </div>

      <UnsavedChangesDialog blocker={blocker} />
      {form && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${form.name}?`}
          description={form.submissionCount > 0 ? `This also deletes its ${form.submissionCount} ${form.submissionCount === 1 ? 'submission' : 'submissions'}.` : 'This cannot be undone.'}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
```

`features/forms/pages/FormsListPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { useForms } from '../forms-api'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function FormsListPage() {
  const forms = useForms()
  const action = (
    <Button asChild>
      <Link to="/forms/new"><Plus aria-hidden />New form</Link>
    </Button>
  )
  let body: React.ReactNode
  if (forms.isPending) body = <Skeleton className="h-32 w-full" />
  else if (forms.isError) body = <ErrorState message="Could not load forms." onRetry={() => void forms.refetch()} />
  else if (forms.data.length === 0) body = <EmptyState icon={ClipboardList} title="No forms yet" description="Create a contact or booking form your site can show." action={action} />
  else
    body = (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {forms.data.map((f) => (
          <li key={f.id} className="rounded-xl border bg-card p-4">
            <Link to={`/forms/${f.id}`} className="block font-serif text-lg font-semibold hover:underline">{f.name}</Link>
            <span className="block font-mono text-xs text-muted-foreground">{f.slug}</span>
            <p className="mt-2 text-sm text-muted-foreground">
              {f.isActive ? 'Accepting submissions' : 'Paused'} · {f.submissionCount} {f.submissionCount === 1 ? 'submission' : 'submissions'}
            </p>
            <Link to={`/inbox?form=${f.id}&view=all`} className="mt-2 inline-block text-sm text-primary hover:underline">View messages</Link>
          </li>
        ))}
      </ul>
    )
  return (
    <>
      <PageHeader title="Forms" description="Forms your sites can show. Answers arrive in the Inbox." actions={action} />
      {body}
    </>
  )
}
```

- [ ] **Step 7: Route forms and delete the legacy form pages**

In `modules/registry.tsx`:
- Remove the imports of `ContactFormsList` and `ContactFormForm` (keep `SubmissionsList` for now).
- Add `import { FormsListPage } from '@/features/forms/pages/FormsListPage'` and `import { FormBuilderPage } from '@/features/forms/pages/FormBuilderPage'`.
- Replace the forms module routes with:

```tsx
    routes: [
      { path: 'forms', element: <FormsListPage /> },
      { path: 'forms/:id', element: <FormBuilderPage /> },
      { path: 'contact-forms', element: <Navigate to="/forms" replace /> },
      { path: 'contact-forms/new', element: <Navigate to="/forms/new" replace /> },
      { path: 'contact-forms/:id/edit', element: <RedirectWithId to={(id) => `/forms/${id}`} /> },
      { path: 'contact-forms/:formId/submissions', element: <SubmissionsList /> },
    ],
```

Then:

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q src/pages/ContactForms/ContactFormsList.tsx src/pages/ContactForms/ContactFormForm.tsx src/pages/ContactForms/FormFieldBuilder.tsx
grep -rn "ContactFormsList\|ContactFormForm\|FormFieldBuilder" src || echo "no references"
```

- [ ] **Step 8: Run tests, build, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/features src/modules`
Expected: PASS, build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): form builder with live preview and embed snippet"
```

---

## Task 6: Inbox and the Home Inbox card

**Files:**
- Create: `features/inbox/inbox-api.ts`, `features/inbox/inbox-utils.ts`, `features/inbox/components/MessageView.tsx`, `features/inbox/pages/InboxPage.tsx`
- Modify: `modules/registry.tsx`, `features/home/pages/HomePage.tsx`, `features/home/pages/HomePage.test.tsx`
- Delete: `features/inbox/pages/InboxPlaceholder.tsx`, `pages/ContactForms/SubmissionsList.tsx`, `services/contactForms.ts`
- Test: `features/inbox/inbox-utils.test.ts`, `features/inbox/pages/InboxPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 endpoint; `formatRelative`, `formatAbsolute`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `StatusPill`, `useIsDesktop` (Task 2).
- Produces:
  - `InboxForm { id; name; slug; fields: { name; label; type: FormFieldType }[] }`, `InboxItem = FormSubmission & { form: InboxForm | null }`, `InboxView = 'unread' | 'all' | 'archived'`, `inboxKeys`, `listInbox({ formId?, status?, page?, limit? })`, `useInbox(params)`, `useSubmissionWrites() => { setStatus(item, status), remove(item) }` (invalidates inbox and stats).
  - `inbox-utils.ts`: `displayFields(item) => { label: string; value: string }[]`, `senderName(item) => string`, `replyAddress(item) => string | undefined`, `preview(item) => string`, `viewStatus(view) => SubmissionStatus | undefined`.
  - Routes `/inbox`, `/inbox/:submissionId` with query `view` (default `unread`) and `form`; redirect `/contact-forms/:formId/submissions` → `/inbox?form=<id>&view=all`.
  - Home Inbox card lists up to 3 latest unread messages linking to `/inbox/:id`.

- [ ] **Step 1: Write the failing tests**

`features/inbox/inbox-utils.test.ts`:

```ts
import { displayFields, preview, replyAddress, senderName, viewStatus } from './inbox-utils'
import type { InboxItem } from './inbox-api'

const item = (over: Partial<InboxItem> = {}): InboxItem => ({
  id: 's1',
  formId: 'f1',
  data: { name: 'Jana Nováková', email: 'jana@x.test', message: 'Dotaz k trase přes Šumavu, je sjízdná na silničce?', extra: 'kept' },
  status: 'UNREAD',
  emailSent: true,
  createdAt: '2026-09-29T10:00:00Z',
  updatedAt: '2026-09-29T10:00:00Z',
  form: {
    id: 'f1', name: 'Contact', slug: 'contact',
    fields: [
      { name: 'name', label: 'Name', type: 'TEXT' },
      { name: 'email', label: 'Email', type: 'EMAIL' },
      { name: 'message', label: 'Message', type: 'TEXTAREA' },
    ],
  },
  ...over,
})

it('lists fields in form order with labels, then extra data', () => {
  expect(displayFields(item())).toEqual([
    { label: 'Name', value: 'Jana Nováková' },
    { label: 'Email', value: 'jana@x.test' },
    { label: 'Message', value: 'Dotaz k trase přes Šumavu, je sjízdná na silničce?' },
    { label: 'extra', value: 'kept' },
  ])
})

it('formats booleans and missing values', () => {
  const i = item({ data: { agree: true, empty: '' }, form: null })
  expect(displayFields(i)).toEqual([{ label: 'agree', value: 'Yes' }, { label: 'empty', value: '' }])
})

it('finds the sender and reply address', () => {
  expect(senderName(item())).toBe('Jana Nováková')
  expect(replyAddress(item())).toBe('jana@x.test')
  const noEmail = item({ data: { message: 'hi' }, form: { id: 'f', name: 'F', slug: 'f', fields: [{ name: 'message', label: 'Message', type: 'TEXTAREA' }] } })
  expect(replyAddress(noEmail)).toBeUndefined()
  expect(senderName(noEmail)).toBe('Anonymous')
})

it('previews the longest text value', () => {
  expect(preview(item())).toBe('Dotaz k trase přes Šumavu, je sjízdná na silničce?')
})

it('maps views to statuses', () => {
  expect([viewStatus('unread'), viewStatus('all'), viewStatus('archived')]).toEqual(['UNREAD', undefined, 'ARCHIVED'])
})
```

`features/inbox/pages/InboxPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import { setViewport } from '@/test/viewport'
import apiClient from '@/lib/api'
import type { InboxItem } from '../inbox-api'
import { InboxPage } from './InboxPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

const form = { id: 'f1', name: 'Contact', slug: 'contact', fields: [{ name: 'email', label: 'Email', type: 'EMAIL' as const }, { name: 'message', label: 'Message', type: 'TEXTAREA' as const }] }
const items: InboxItem[] = [
  { id: 's1', formId: 'f1', data: { email: 'jana@x.test', message: 'Dotaz k trase' }, status: 'UNREAD', emailSent: false, emailError: 'SMTP down', createdAt: '2026-09-29T10:00:00Z', updatedAt: '', form },
  { id: 's2', formId: 'f1', data: { message: 'No email here' }, status: 'READ', emailSent: true, createdAt: '2026-09-28T10:00:00Z', updatedAt: '', form },
]

const routes = [
  { path: '/inbox', element: <InboxPage /> },
  { path: '/inbox/:submissionId', element: <InboxPage /> },
]

beforeEach(() => {
  setViewport(true)
  vi.mocked(apiClient.get).mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
    if (url === '/submissions') {
      const status = config?.params?.status
      const data = status ? items.filter((i) => i.status === status) : items
      return { data: { success: true, data, pagination: { page: 1, limit: 30, total: data.length, totalPages: 1 } } }
    }
    return { data: { success: true, data: [] } }
  })
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { success: true } })
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } })
})

describe('InboxPage', () => {
  it('shows unread messages by default and opens one, marking it read once', async () => {
    const { router } = renderRoutes(routes, { route: '/inbox' })
    const list = await screen.findByRole('list', { name: 'Messages' })
    expect(within(list).getAllByRole('link')).toHaveLength(1)
    await userEvent.click(within(list).getByRole('link', { name: /jana@x\.test/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/inbox/s1'))
    const message = screen.getByRole('article', { name: /jana@x\.test/ })
    expect(within(message).getByText('Dotaz k trase')).toBeInTheDocument()
    expect(within(message).getByText(/Notification email failed: SMTP down/)).toBeInTheDocument()
    expect(within(message).getByRole('link', { name: 'Reply' })).toHaveAttribute('href', expect.stringContaining('mailto:jana@x.test'))
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(1))
    expect(apiClient.patch).toHaveBeenCalledWith('/contact-forms/f1/submissions/s1', { status: 'READ' })
  })

  it('offers no Reply link without an email and archives', async () => {
    renderRoutes(routes, { route: '/inbox/s2?view=all' })
    const message = await screen.findByRole('article', { name: /Anonymous/ })
    expect(within(message).queryByRole('link', { name: 'Reply' })).not.toBeInTheDocument()
    await userEvent.click(within(message).getByRole('button', { name: 'Archive' }))
    expect(apiClient.patch).toHaveBeenCalledWith('/contact-forms/f1/submissions/s2', { status: 'ARCHIVED' })
    expect(apiClient.patch).not.toHaveBeenCalledWith(expect.anything(), { status: 'READ' })
  })

  it('confirms before deleting', async () => {
    renderRoutes(routes, { route: '/inbox/s2?view=all' })
    const message = await screen.findByRole('article', { name: /Anonymous/ })
    await userEvent.click(within(message).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(apiClient.delete).toHaveBeenCalledWith('/contact-forms/f1/submissions/s2')
  })

  it('shows a caught-up state when nothing is unread', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [], pagination: { page: 1, limit: 30, total: 0, totalPages: 1 } } })
    renderRoutes(routes, { route: '/inbox' })
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument()
  })

  it('on small screens shows the list or the message, not both', async () => {
    setViewport(false)
    renderRoutes(routes, { route: '/inbox/s1' })
    expect(await screen.findByRole('article', { name: /jana@x\.test/ })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Messages' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to messages' })).toHaveAttribute('href', '/inbox')
  })
})
```

In `features/home/pages/HomePage.test.tsx`, add this mock at the top level:

```tsx
vi.mock('@/features/inbox/inbox-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/inbox/inbox-api')>()
  return { ...actual, listInbox: vi.fn().mockResolvedValue({ success: true, data: [{ id: 's1', formId: 'f1', data: { email: 'jana@x.test', message: 'Dotaz' }, status: 'UNREAD', emailSent: true, createdAt: '2026-09-29T10:00:00Z', updatedAt: '', form: null }], pagination: { page: 1, limit: 3, total: 1, totalPages: 1 } }) }
})
```

and in the "shows the work queue" test add:

```tsx
    expect(await screen.findByRole('link', { name: /jana@x\.test/ })).toHaveAttribute('href', '/inbox/s1')
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- inbox-utils InboxPage HomePage`
Expected: FAIL, missing modules; Home has no message link.

- [ ] **Step 3: Implement `features/inbox/inbox-api.ts` and `inbox-utils.ts`**

`features/inbox/inbox-api.ts`:

```ts
import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { statsKeys } from '@/lib/queries/stats'
import type { FormFieldType, FormSubmission, PaginatedResponse, SubmissionStatus } from '@/types'

export interface InboxForm {
  id: string
  name: string
  slug: string
  fields: { name: string; label: string; type: FormFieldType }[]
}

export type InboxItem = FormSubmission & { form: InboxForm | null }
export type InboxView = 'unread' | 'all' | 'archived'

export interface InboxParams {
  formId?: string
  status?: SubmissionStatus
  page?: number
  limit?: number
}

export const inboxKeys = {
  all: ['inbox'] as const,
  list: (p: InboxParams) => [...inboxKeys.all, p] as const,
}

export async function listInbox(params: InboxParams): Promise<PaginatedResponse<InboxItem>> {
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  return (await apiClient.get<PaginatedResponse<InboxItem>>('/submissions', { params: query })).data
}

export function useInbox(params: InboxParams) {
  return useQuery({ queryKey: inboxKeys.list(params), queryFn: () => listInbox(params), placeholderData: keepPreviousData })
}

export function useSubmissionWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.all })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
    }
    return {
      setStatus: async (item: InboxItem, status: SubmissionStatus) => {
        await apiClient.patch(`/contact-forms/${item.formId}/submissions/${item.id}`, { status })
        refresh()
      },
      remove: async (item: InboxItem) => {
        await apiClient.delete(`/contact-forms/${item.formId}/submissions/${item.id}`)
        refresh()
      },
    }
  }, [queryClient])
}
```

`features/inbox/inbox-utils.ts`:

```ts
import type { SubmissionStatus } from '@/types'
import type { InboxItem, InboxView } from './inbox-api'

function text(value: unknown): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export function displayFields(item: InboxItem): { label: string; value: string }[] {
  const known = item.form?.fields ?? []
  const rows = known.filter((f) => f.name in item.data).map((f) => ({ label: f.label, value: text(item.data[f.name]) }))
  const extra = Object.keys(item.data).filter((k) => !known.some((f) => f.name === k)).map((k) => ({ label: k, value: text(item.data[k]) }))
  return [...rows, ...extra]
}

export function replyAddress(item: InboxItem): string | undefined {
  const emailField = item.form?.fields.find((f) => f.type === 'EMAIL')?.name
  const value = emailField ? item.data[emailField] : item.data.email
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : undefined
}

export function senderName(item: InboxItem): string {
  const name = item.data.name ?? item.data.fullName
  if (typeof name === 'string' && name.trim()) return name.trim()
  return replyAddress(item) ?? 'Anonymous'
}

export function preview(item: InboxItem): string {
  const values = Object.values(item.data).filter((v): v is string => typeof v === 'string')
  const longest = values.sort((a, b) => b.length - a.length)[0] ?? ''
  return longest.length > 140 ? `${longest.slice(0, 140)}…` : longest
}

export function viewStatus(view: InboxView): SubmissionStatus | undefined {
  return view === 'unread' ? 'UNREAD' : view === 'archived' ? 'ARCHIVED' : undefined
}
```

- [ ] **Step 4: Implement `features/inbox/components/MessageView.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { formatAbsolute } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useSubmissionWrites, type InboxItem } from '../inbox-api'
import { displayFields, replyAddress, senderName } from '../inbox-utils'

interface MessageViewProps {
  item: InboxItem
  backTo?: string
  onDeleted: () => void
}

export function MessageView({ item, backTo, onDeleted }: MessageViewProps) {
  const writes = useSubmissionWrites()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sender = senderName(item)
  const reply = replyAddress(item)

  const run = async (fn: () => Promise<void>, message: string) => {
    try {
      await fn()
      toast.success(message)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <article aria-label={`Message from ${sender}`} className="rounded-xl border bg-card p-4 md:p-6">
      {backTo && (
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to={backTo}>
            <ArrowLeft aria-hidden />
            Back to messages
          </Link>
        </Button>
      )}
      <header className="mb-4">
        <h2 className="font-serif text-2xl font-semibold">{sender}</h2>
        <p className="text-sm text-muted-foreground">
          {item.form?.name ?? 'Deleted form'} · {formatAbsolute(item.createdAt)}
        </p>
      </header>
      {!item.emailSent && item.emailError && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-status-draft-bg px-3 py-2 text-sm text-status-draft-fg">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          Notification email failed: {item.emailError}
        </p>
      )}
      <dl className="flex flex-col gap-3">
        {displayFields(item).map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="whitespace-pre-wrap break-words">{row.value || <span className="text-muted-foreground">Empty</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        {reply && (
          <Button asChild>
            <a href={`mailto:${reply}?subject=${encodeURIComponent(`Re: ${item.form?.name ?? 'your message'}`)}`}>Reply</a>
          </Button>
        )}
        {item.status === 'UNREAD' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'READ'), 'Marked as read')}>Mark read</Button>
        ) : item.status === 'READ' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'UNREAD'), 'Marked as unread')}>Mark unread</Button>
        ) : null}
        {item.status === 'ARCHIVED' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'READ'), 'Moved back to inbox')}>Restore</Button>
        ) : (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'ARCHIVED'), 'Archived')}>Archive</Button>
        )}
        <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this message?"
        description="This permanently removes the message."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void run(async () => {
            await writes.remove(item)
            onDeleted()
          }, 'Message deleted')
        }}
      />
    </article>
  )
}
```

- [ ] **Step 5: Implement `features/inbox/pages/InboxPage.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Inbox, MailCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import { useIsDesktop } from '@/lib/hooks/useMediaQuery'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForms } from '@/features/forms/forms-api'
import { useInbox, useSubmissionWrites, type InboxView } from '../inbox-api'
import { preview, senderName, viewStatus } from '../inbox-utils'
import { MessageView } from '../components/MessageView'

const VIEWS: { id: InboxView; label: string }[] = [
  { id: 'unread', label: 'Unread' },
  { id: 'all', label: 'All' },
  { id: 'archived', label: 'Archived' },
]

export function InboxPage() {
  const { submissionId } = useParams()
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const view = (VIEWS.find((v) => v.id === sp.get('view'))?.id ?? 'unread') as InboxView
  const formId = sp.get('form') ?? undefined
  const forms = useForms()
  const inbox = useInbox({ status: viewStatus(view), formId, limit: 30 })
  const writes = useSubmissionWrites()
  const items = inbox.data?.data ?? []
  const selected = items.find((i) => i.id === submissionId)
  const query = sp.toString() ? `?${sp.toString()}` : ''

  // Opening an unread message marks it read, once per message.
  const marked = useRef(new Set<string>())
  useEffect(() => {
    if (selected && selected.status === 'UNREAD' && !marked.current.has(selected.id)) {
      marked.current.add(selected.id)
      void writes.setStatus(selected, 'READ')
    }
  }, [selected, writes])

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(sp)
    if (value) next.set(key, value)
    else next.delete(key)
    setSp(next, { replace: true })
  }

  const showList = desktop || !submissionId
  const showMessage = desktop || !!submissionId

  const list = inbox.isPending ? (
    <Skeleton className="h-40 w-full" />
  ) : inbox.isError ? (
    <ErrorState message="Could not load messages." onRetry={() => void inbox.refetch()} />
  ) : items.length === 0 ? (
    view === 'unread' ? (
      <EmptyState icon={MailCheck} title="You are all caught up" description="New messages from your forms appear here." />
    ) : (
      <EmptyState icon={Inbox} title={view === 'archived' ? 'Nothing archived' : 'No messages yet'} action={view === 'all' ? <Link to="/forms" className="text-sm text-primary hover:underline">Set up a form</Link> : undefined} />
    )
  ) : (
    <ul aria-label="Messages" className="flex flex-col divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/inbox/${item.id}${query}`}
            aria-current={item.id === submissionId ? 'true' : undefined}
            className={cn('block px-4 py-3 hover:bg-accent', item.id === submissionId && 'bg-accent')}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={cn('truncate', item.status === 'UNREAD' && 'font-semibold')}>{senderName(item)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.createdAt)}</span>
            </span>
            <span className="block truncate text-sm text-muted-foreground">{preview(item)}</span>
            <span className="block text-xs text-muted-foreground">{item.form?.name ?? 'Deleted form'}</span>
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <PageHeader title="Inbox" description="Messages sent through your forms." />
      {showList && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="View" className="flex gap-1.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === view}
                onClick={() => setParam('view', v.id === 'unread' ? undefined : v.id)}
                className={cn('rounded-full border px-3 py-1 text-sm', v.id === view ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent')}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Select value={formId ?? 'all'} onValueChange={(v) => setParam('form', v === 'all' ? undefined : v)}>
            <SelectTrigger aria-label="Form" className="w-48 rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All forms</SelectItem>
              {(forms.data ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className={cn(desktop && 'grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4')}>
        {showList && <div>{list}</div>}
        {showMessage && (
          <div>
            {selected ? (
              <MessageView item={selected} backTo={desktop ? undefined : `/inbox${query}`} onDeleted={() => navigate(`/inbox${query}`, { replace: true })} />
            ) : desktop && items.length > 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Select a message to read it.</p>
            ) : submissionId && !inbox.isPending ? (
              <EmptyState icon={Inbox} title="Message not found" description="It may be in another view or deleted." action={<Link to="/inbox?view=all" className="text-sm text-primary hover:underline">Show all messages</Link>} />
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 6: Home Inbox card, routes and cleanup**

In `features/home/pages/HomePage.tsx`:
- Add imports `import { useInbox } from '@/features/inbox/inbox-api'` and `import { senderName } from '@/features/inbox/inbox-utils'`.
- Next to `drafts` add `const unread = useInbox({ status: 'UNREAD', limit: 3 })`.
- In the Inbox card, replace the paragraph and button with:

```tsx
          {(unread.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">You are all caught up.</p>
          ) : (
            <ul className="divide-y">
              {unread.data!.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link to={`/inbox/${m.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{senderName(m)}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.form?.name ?? ''} · {formatRelative(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/inbox">Open inbox</Link>
          </Button>
```

In `modules/registry.tsx`:
- Remove the `InboxPlaceholder` and `SubmissionsList` imports; add `import { InboxPage } from '@/features/inbox/pages/InboxPage'`.
- Inbox module routes: `[{ path: 'inbox', element: <InboxPage /> }, { path: 'inbox/:submissionId', element: <InboxPage /> }]`.
- In the forms module, replace the `contact-forms/:formId/submissions` route element with `<RedirectWithId to={(id) => \`/inbox?form=${id}&view=all\`} />`.

Delete:

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
git rm -q src/features/inbox/pages/InboxPlaceholder.tsx src/pages/ContactForms/SubmissionsList.tsx src/services/contactForms.ts
grep -rn "InboxPlaceholder\|SubmissionsList\|services/contactForms\|pages/ContactForms" src || echo "no references"
```

- [ ] **Step 7: Run tests, build, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm exec eslint src/features src/modules src/lib`
Expected: PASS, build succeeds, no lint errors.

```bash
git add -A packages/admin-dashboard/src
git commit -m "feat(admin): unified inbox across forms and inbox card on home"
```

---

## Task 7: Verification in the running app

**Files:** none unless a defect is found (fix with a test when jsdom can express it).

- [ ] **Step 1: Start services** (cached mongod, Azurite via npx, backend and admin dev servers, as in Plans 1 to 3).

- [ ] **Step 2: Check and note each result**

1. `/models`: cards with field and entry counts; `/content-types` redirects here.
2. New model from the Blog post template: fields listed, title star on Title, save creates it and the URL becomes `/models/<id>`; `/content/new?type=<id>` shows its editor.
3. Builder: add a Text field, label "GPX URL" gives key `gpxUrl`; drag a field to reorder; Move up/down; make another text field the title; set media allowed files; save.
4. Trip model (has entries): rename key `gpxurl` → `gpxUrl`: save asks with the entry count; cancel keeps it; delete asks for typing "Trip" (cancel).
5. Checklist link on a fresh database goes to `/models/new`.
6. `/forms`: cards; open Contact us: preview updates while editing a label; add a Choice field without options: save blocked with "Add at least one option"; add options, save; the embed snippet `curl` with the site key posts a submission that appears in the Inbox.
7. `/inbox`: Unread by default; opening marks read (badge drops); Reply opens mail with the address; Archive, Restore, Delete (confirm); form filter; `/contact-forms/<id>/submissions` redirects to the Inbox filtered to that form.
8. Home Inbox card lists the latest unread messages.
9. 360px (iframe method): models list and builder (inspector as bottom sheet), forms builder, inbox list then message with "Back to messages"; no horizontal scroll.
10. Dark theme: builder, forms, inbox readable.

- [ ] **Step 3: Record and commit**

Append a "Plan 4 verification" table to `TEST_RESULTS.md` and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record Plan 4 verification results"
```

---

## Self-Review Notes

- **Spec coverage:** 5.6 model list cards (name, slug, field count, entry count, last updated), templates, field list with drag handles and keyboard moves, palette of seven types, inspector (label, camelCase key, lock icon when entries exist, description, required, type rules, use as title), rename/delete guardrails with entry count, delete requiring the model name → Tasks 2 to 4. 5.7 forms list, builder with list plus inspector, seven types, live preview, settings (name, slug, recipient, site, active), embed panel → Task 5. 5.5 two-pane inbox with list/detail on mobile, form filter, Unread/All/Archived, reading pane (fields, time, email delivery status, mark read/unread, archive, delete, reply), open marks read, unread badge (stats invalidation) → Task 6. 5.1 Inbox card latest unread → Task 6. Route map for models, forms and inbox with redirects → Tasks 4 to 6.
- **Type consistency:** `DraftField`/`ModelDraft` helpers, `FormDraft` helpers, `InboxItem`, `useSubmissionWrites().setStatus(item, status)`, `FieldList` props and `InspectorPanel` props match across tasks.
