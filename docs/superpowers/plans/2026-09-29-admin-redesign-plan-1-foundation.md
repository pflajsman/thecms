# Admin Redesign, Plan 1: Backend Additions and Frontend Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four backend additions from the spec (entry titles, cross-type entry list, stats, media usage) with tests, and replace the admin dashboard shell with the new Tailwind + shadcn/ui foundation (tokens, theme, module registry, sidebar, mobile tabs, command palette, sign-in) while existing MUI pages keep working inside it.

**Architecture:** Backend changes are additive: new fields (`ContentType.titleField`, `ContentEntry.title`), one pure title utility, new service functions, and new routes. The frontend gets Tailwind v4 and shadcn/ui next to MUI; a module registry drives navigation and routing; legacy MUI pages are mounted as module routes under their old URLs and reachable from the new navigation.

**Tech Stack:** Backend: Express 4, Mongoose 6, Zod 3, Jest + ts-jest, mongodb-memory-server, supertest. Frontend: React 19, Vite 7, Tailwind CSS v4, shadcn/ui (Radix), lucide-react, cmdk, sonner, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-dashboard-redesign-design.md`

**Series:** This is Plan 1 of 5. Later plans are written after this one lands, against the real code:
- Plan 2: Content list and entry editor (spec 5.2, 5.3; migration step 2 frontend).
- Plan 3: Home and Media (spec 5.1, 5.4).
- Plan 4: Content models, Forms, Inbox (spec 5.5 to 5.7).
- Plan 5: Sites & API keys, Webhooks, MUI removal and final accessibility pass (spec 5.8, 5.9, migration step 8).

## Global Constraints

- Public API (`/api/v1/public/*`) request and response shapes must not change.
- Existing admin endpoints must keep their current request and response shapes; only additive fields are allowed.
- Node >= 20, pnpm >= 8 (root `package.json` engines).
- Entry search uses a case-insensitive escaped regex on `title`, never `$text`.
- Title fallback text is exactly `Untitled`.
- Status labels shown to users: "Published", "Draft", "Archived" (and "New", "Read" for submissions); never raw enums.
- Theme preference is stored in `localStorage` key `thecms-theme` with values `light`, `dark`, `system`; every access is wrapped in try/catch.
- Colors come only from CSS variable tokens in `src/styles/tokens.css`; no hard-coded hex values in components.
- Mobile layout breakpoint: below 768px (Tailwind `md`).
- Every screen must work at 360px width without horizontal scrolling.
- Copy is English. Never use an em dash in UI copy, code comments or docs.

## Review Focus

1. **Path prefix collisions:** `/content-types/...` must not mark "Content" (`/content`) as active. Tested in Task 8.
2. **Search input with regex characters or overlong text:** `C++ (draft)` must match literally, not throw or match everything; input over 100 chars is rejected with 400. Tested in Task 4.
3. **Entries whose content type was deleted:** the cross-type list must still return them with `contentType: null`, not crash. Tested in Task 4.
4. **Title recompute must not change `updatedAt`:** otherwise changing a model's title field reorders every "last edited" list. Tested in Task 2.
5. **Storage unavailable (private mode, blocked site data):** the theme falls back to `system` and toggling still works in memory. Tested in Task 7.

---

## File Structure

### Backend (`packages/backend`)

| File | Responsibility |
|---|---|
| `jest.config.js` (create) | Jest + ts-jest config |
| `src/test/db.ts` (create) | Opt-in in-memory MongoDB lifecycle for tests |
| `src/utils/entryTitle.ts` (create) | Pure: resolve title field, compute entry title |
| `src/utils/regex.ts` (create) | Pure: escape user input for regex |
| `src/models/content-type.model.ts` (modify) | Add `titleField` |
| `src/models/content-entry.model.ts` (modify) | Add indexed `title` |
| `src/modules/content-types/content-types.schema.ts` (modify) | Accept and validate `titleField` |
| `src/modules/content-types/content-types.service.ts` (modify) | Recompute titles after update |
| `src/modules/content-entries/entry-titles.service.ts` (create) | Recompute stored titles for a content type |
| `src/modules/content-entries/content-entries.service.ts` (modify) | Set title on create/update; `listAllEntries` |
| `src/modules/content-entries/content-entries.schema.ts` (modify) | `listAllEntriesSchema` |
| `src/modules/content-entries/content-entries.controller.ts` (modify) | `listAllEntries` handler |
| `src/modules/content-entries/content-entries.routes.ts` (modify) | `GET /` |
| `src/scripts/backfill-entry-titles.ts` (create) | One-off title backfill |
| `src/modules/stats/stats.service.ts`, `stats.controller.ts`, `stats.routes.ts` (create) | `GET /stats` |
| `src/modules/media/media-usage.service.ts` (create) | Find entries referencing a media item |
| `src/modules/media/media.controller.ts`, `media.routes.ts` (modify) | `GET /media/:id/usage` |
| `src/routes/index.ts` (modify) | Mount `/stats` |

### Frontend (`packages/admin-dashboard`)

| File | Responsibility |
|---|---|
| `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `components.json`, `index.html` (modify/create) | Tailwind, alias `@/`, Vitest, shadcn, no-flash theme script |
| `src/styles/tokens.css`, `src/styles/globals.css` (create) | Design tokens and Tailwind entry |
| `src/lib/utils.ts` (create) | `cn()` |
| `src/lib/format.ts` (create) | `getInitials()` |
| `src/test/setup.ts`, `src/test/render.tsx` (create) | Test environment and render helper |
| `src/components/ui/*` (generated) | shadcn components |
| `src/app/theme/*` (create) | Theme preference utils, provider, hook |
| `src/modules/types.ts`, `src/modules/nav.ts`, `src/modules/registry.tsx` (create) | Module registry and nav helpers |
| `src/lib/queries/stats.ts` (create) | `useStats`, `useUnreadCount` |
| `src/types/index.ts` (modify) | `DashboardStats`, `title`, `titleField` |
| `src/components/common/{PageHeader,EmptyState,StatusPill,ConfirmDialog,Logo}.tsx` (create) | Shared components |
| `src/app/shell/*` (create) | AppShell, Sidebar, MobileTabs, TopBar, UserMenu, CommandPalette, SignInScreen, ShellSkeleton |
| `src/features/inbox/pages/InboxPlaceholder.tsx`, `src/features/webhooks/pages/WebhooksPlaceholder.tsx` (create) | Temporary screens until Plans 4 and 5 |
| `src/App.tsx`, `src/main.tsx` (modify) | Providers and registry-driven routes |
| `src/components/Layout.tsx`, `src/components/Logo.tsx`, `src/index.css`, `src/App.css` (delete) | Replaced by the new shell |

---

## Task 0: Toolchain

**Files:** none (environment only)

- [ ] **Step 1: Enable pnpm and install**

pnpm is not installed on this machine. Use Corepack (ships with Node 24):

```bash
cd /Users/pavelflajsman/personalGit/thecms
corepack enable pnpm
pnpm -v            # expect 8.x or newer
pnpm install
```

If `corepack enable` fails with a permissions error, use `npx pnpm@9` in place of `pnpm` for every command in this plan.

Expected: install completes; `packages/backend/node_modules` and `packages/admin-dashboard/node_modules` exist.

- [ ] **Step 2: Confirm the current baseline builds**

```bash
pnpm --filter @thecms/backend build
pnpm --filter admin-dashboard build
```

Expected: both succeed. If either fails before any change, stop and report; do not fix unrelated breakage silently.

---

## Task 1: Backend test harness and title utility

**Files:**
- Create: `packages/backend/jest.config.js`
- Create: `packages/backend/src/test/db.ts`
- Create: `packages/backend/src/utils/entryTitle.ts`
- Create: `packages/backend/src/utils/regex.ts`
- Test: `packages/backend/src/utils/entryTitle.test.ts`, `packages/backend/src/utils/regex.test.ts`

**Interfaces:**
- Produces: `resolveTitleField(fields, titleField?) => string | undefined`, `computeEntryTitle(data, fields, titleField?) => string`, `UNTITLED = 'Untitled'`, `escapeRegex(input: string) => string`, `useTestDb()` (registers beforeAll/afterEach/afterAll).

- [ ] **Step 1: Add test dependencies**

```bash
cd /Users/pavelflajsman/personalGit/thecms
pnpm --filter @thecms/backend add -D mongodb-memory-server@^9 supertest @types/supertest
```

- [ ] **Step 2: Create `packages/backend/jest.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 60000,
};
```

- [ ] **Step 3: Create `packages/backend/src/test/db.ts`**

```ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Registers an in-memory MongoDB for the calling test file.
 * Call once at the top level of a test file that needs the database.
 */
export function useTestDb(): void {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
}
```

- [ ] **Step 4: Write failing tests `packages/backend/src/utils/entryTitle.test.ts`**

```ts
import { computeEntryTitle, resolveTitleField, UNTITLED } from './entryTitle';
import { FieldType } from '../types/field-types';

const fields = [
  { name: 'cover', type: FieldType.MEDIA },
  { name: 'headline', type: FieldType.TEXT },
  { name: 'subtitle', type: FieldType.TEXT },
  { name: 'distanceKm', type: FieldType.NUMBER },
];

describe('resolveTitleField', () => {
  it('uses the explicit titleField when it names a TEXT field', () => {
    expect(resolveTitleField(fields, 'subtitle')).toBe('subtitle');
  });

  it('falls back to the first TEXT field when titleField is unset', () => {
    expect(resolveTitleField(fields)).toBe('headline');
  });

  it('ignores a titleField that is not a TEXT field', () => {
    expect(resolveTitleField(fields, 'distanceKm')).toBe('headline');
  });

  it('ignores a titleField that does not exist', () => {
    expect(resolveTitleField(fields, 'missing')).toBe('headline');
  });

  it('returns undefined when there is no TEXT field', () => {
    expect(resolveTitleField([{ name: 'n', type: FieldType.NUMBER }])).toBeUndefined();
  });
});

describe('computeEntryTitle', () => {
  it('returns the trimmed title value', () => {
    expect(computeEntryTitle({ headline: '  Přes Šumavu  ' }, fields)).toBe('Přes Šumavu');
  });

  it('returns Untitled for empty or whitespace values', () => {
    expect(computeEntryTitle({ headline: '   ' }, fields)).toBe(UNTITLED);
    expect(computeEntryTitle({}, fields)).toBe(UNTITLED);
    expect(computeEntryTitle(undefined, fields)).toBe(UNTITLED);
  });

  it('returns Untitled for non-string values', () => {
    expect(computeEntryTitle({ headline: 42 }, fields)).toBe(UNTITLED);
  });

  it('returns Untitled when the type has no TEXT field', () => {
    expect(computeEntryTitle({ n: 'x' }, [{ name: 'n', type: FieldType.NUMBER }])).toBe(UNTITLED);
  });

  it('truncates to 200 characters', () => {
    expect(computeEntryTitle({ headline: 'a'.repeat(250) }, fields)).toHaveLength(200);
  });

  it('respects an explicit titleField', () => {
    expect(computeEntryTitle({ headline: 'A', subtitle: 'B' }, fields, 'subtitle')).toBe('B');
  });
});
```

- [ ] **Step 5: Write failing tests `packages/backend/src/utils/regex.test.ts`**

```ts
import { escapeRegex } from './regex';

describe('escapeRegex', () => {
  it('escapes every regex metacharacter', () => {
    const input = 'C++ (draft) [1] {2} a.b*c?d^e$f|g\\h';
    const re = new RegExp(escapeRegex(input));
    expect(re.test(input)).toBe(true);
    expect(re.test('C (draft)')).toBe(false);
  });

  it('leaves plain text unchanged', () => {
    expect(escapeRegex('Krkonoše 2026')).toBe('Krkonoše 2026');
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- src/utils`
Expected: FAIL, "Cannot find module './entryTitle'" and "./regex".

- [ ] **Step 7: Implement `packages/backend/src/utils/entryTitle.ts`**

```ts
import { FieldDefinition, FieldType } from '../types/field-types';

export const UNTITLED = 'Untitled';
const MAX_TITLE_LENGTH = 200;

type TitleFieldSource = Pick<FieldDefinition, 'name' | 'type'>;

/**
 * The field whose value is an entry's title: the explicit titleField when it
 * names a TEXT field, otherwise the first TEXT field.
 */
export function resolveTitleField(
  fields: TitleFieldSource[],
  titleField?: string
): string | undefined {
  if (titleField && fields.some((f) => f.name === titleField && f.type === FieldType.TEXT)) {
    return titleField;
  }
  return fields.find((f) => f.type === FieldType.TEXT)?.name;
}

export function computeEntryTitle(
  data: Record<string, unknown> | undefined,
  fields: TitleFieldSource[],
  titleField?: string
): string {
  const key = resolveTitleField(fields, titleField);
  const raw = key ? data?.[key] : undefined;
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text ? text.slice(0, MAX_TITLE_LENGTH) : UNTITLED;
}
```

- [ ] **Step 8: Implement `packages/backend/src/utils/regex.ts`**

```ts
/** Escape user input so it matches literally inside a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/utils`
Expected: PASS (13 tests).

- [ ] **Step 10: Commit**

```bash
git add packages/backend/jest.config.js packages/backend/src/test packages/backend/src/utils packages/backend/package.json pnpm-lock.yaml
git commit -m "test(backend): add jest harness and entry title utilities"
```

---

## Task 2: Store entry titles and honor `titleField`

**Files:**
- Modify: `packages/backend/src/models/content-type.model.ts`
- Modify: `packages/backend/src/models/content-entry.model.ts`
- Modify: `packages/backend/src/modules/content-types/content-types.schema.ts`
- Modify: `packages/backend/src/modules/content-types/content-types.service.ts:72-92`
- Create: `packages/backend/src/modules/content-entries/entry-titles.service.ts`
- Modify: `packages/backend/src/modules/content-entries/content-entries.service.ts` (`createEntry`, `updateEntry`)
- Test: `packages/backend/src/modules/content-entries/entry-titles.test.ts`

**Interfaces:**
- Consumes: `computeEntryTitle` (Task 1), `useTestDb` (Task 1).
- Produces: `IContentType.titleField?: string`, `IContentEntry.title: string`, `recomputeTitlesForType(contentType: { _id: unknown; fields: FieldDefinition[]; titleField?: string }) => Promise<number>` (returns number of entries changed).

- [ ] **Step 1: Write failing tests `packages/backend/src/modules/content-entries/entry-titles.test.ts`**

```ts
jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { ContentEntriesService } from './content-entries.service';
import { contentTypesService } from '../content-types/content-types.service';
import { ContentEntryModel } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';

useTestDb();

async function createTripType() {
  return contentTypesService.createContentType({
    name: 'Trip',
    slug: 'trip',
    fields: [
      { name: 'headline', label: 'Headline', type: FieldType.TEXT, required: false },
      { name: 'summary', label: 'Summary', type: FieldType.TEXT, required: false },
    ],
  } as any);
}

describe('entry titles', () => {
  it('sets title from the first TEXT field on create', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({
      contentTypeId: type.id,
      data: { headline: 'Přes Šumavu', summary: 'Two days' },
    });
    expect(entry.title).toBe('Přes Šumavu');
  });

  it('uses Untitled when the title value is empty', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({ contentTypeId: type.id, data: {} });
    expect(entry.title).toBe('Untitled');
  });

  it('recomputes title when data is updated', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({
      contentTypeId: type.id,
      data: { headline: 'Old' },
    });
    const updated = await ContentEntriesService.updateEntry(entry.id, { data: { headline: 'New' } });
    expect(updated?.title).toBe('New');
  });

  it('recomputes stored titles when the type titleField changes, without touching updatedAt', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({
      contentTypeId: type.id,
      data: { headline: 'Headline A', summary: 'Summary A' },
    });
    const before = await ContentEntryModel.findById(entry.id).lean();

    await contentTypesService.updateContentType(type.id, { titleField: 'summary' } as any);

    const after = await ContentEntryModel.findById(entry.id).lean();
    expect(after?.title).toBe('Summary A');
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });

  it('rejects a titleField that is not a TEXT field on create', async () => {
    const { createContentTypeSchema } = await import('../content-types/content-types.schema');
    const result = createContentTypeSchema.safeParse({
      name: 'Trip',
      slug: 'trip',
      titleField: 'distance',
      fields: [
        { name: 'headline', label: 'Headline', type: 'TEXT', required: false },
        { name: 'distance', label: 'Distance', type: 'NUMBER', required: false },
      ],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- entry-titles`
Expected: FAIL (`entry.title` undefined; `titleField` rejected by `.strict()` or unrecognized).

- [ ] **Step 3: Add `titleField` to the content type model**

In `packages/backend/src/models/content-type.model.ts`, add to `IContentType` after `fields`:

```ts
  titleField?: string;
```

and to `ContentTypeSchema` after the `fields` property:

```ts
    titleField: {
      type: String,
      trim: true,
    },
```

- [ ] **Step 4: Add `title` to the content entry model**

In `packages/backend/src/models/content-entry.model.ts`, add to `IContentEntry` after `data`:

```ts
  title: string;
```

and to `ContentEntrySchema` after `data`:

```ts
    title: {
      type: String,
      trim: true,
      default: 'Untitled',
      index: true,
    },
```

- [ ] **Step 5: Accept and validate `titleField` in the content type schemas**

In `packages/backend/src/modules/content-types/content-types.schema.ts`:

Add this helper above `createContentTypeSchema`:

```ts
const titleFieldSchema = z
  .string()
  .max(50, 'titleField must be less than 50 characters')
  .optional();

function checkTitleField(
  data: { titleField?: string; fields?: { name: string; type: string }[] },
  ctx: z.RefinementCtx
): void {
  if (!data.titleField || !data.fields) return;
  const ok = data.fields.some((f) => f.name === data.titleField && f.type === FieldType.TEXT);
  if (!ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['titleField'],
      message: 'titleField must name a TEXT field of this content type',
    });
  }
}
```

Add `titleField: titleFieldSchema,` to both the create and update object shapes (next to `description`). Append `.superRefine(checkTitleField)` to the end of `createContentTypeSchema` (after `.strict()`) and to the end of `updateContentTypeSchema` (after its existing `.refine(...)`).

- [ ] **Step 6: Create `packages/backend/src/modules/content-entries/entry-titles.service.ts`**

```ts
import { ContentEntryModel } from '../../models/content-entry.model';
import { FieldDefinition } from '../../types/field-types';
import { computeEntryTitle } from '../../utils/entryTitle';

interface TitleSource {
  _id: unknown;
  fields: FieldDefinition[];
  titleField?: string;
}

/**
 * Recompute the stored `title` of every entry of a content type.
 * Writes through the native driver so `updatedAt` is not touched: a title
 * recompute is not an edit.
 */
export async function recomputeTitlesForType(contentType: TitleSource): Promise<number> {
  const entries = await ContentEntryModel.find({ contentTypeId: contentType._id })
    .select('_id data title')
    .lean();

  const ops = entries.flatMap((entry) => {
    const title = computeEntryTitle(entry.data, contentType.fields, contentType.titleField);
    if (title === entry.title) return [];
    return [{ updateOne: { filter: { _id: entry._id }, update: { $set: { title } } } }];
  });

  if (ops.length > 0) {
    await ContentEntryModel.collection.bulkWrite(ops);
  }
  return ops.length;
}
```

- [ ] **Step 7: Recompute titles after a content type update**

In `packages/backend/src/modules/content-types/content-types.service.ts`, import at the top:

```ts
import { recomputeTitlesForType } from '../content-entries/entry-titles.service';
```

In `updateContentType`, replace the final `return contentType;` with:

```ts
    if (contentType && (data.titleField !== undefined || data.fields !== undefined)) {
      await recomputeTitlesForType(contentType);
    }

    return contentType;
```

- [ ] **Step 8: Set the title on create and update**

In `packages/backend/src/modules/content-entries/content-entries.service.ts`, import:

```ts
import { computeEntryTitle } from '../../utils/entryTitle';
```

In `createEntry`, add to the `new ContentEntryModel({...})` object:

```ts
      title: computeEntryTitle(entryData.data, contentType.fields, contentType.titleField),
```

In `updateEntry`, directly after `entry.data = updateData.data;` add:

```ts
      entry.title = computeEntryTitle(updateData.data, contentType.fields, contentType.titleField);
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test`
Expected: PASS (all tests in Tasks 1 and 2).

- [ ] **Step 10: Type-check and commit**

```bash
pnpm --filter @thecms/backend build
git add packages/backend/src
git commit -m "feat(backend): store entry titles and support content type titleField"
```

---

## Task 3: Title backfill script

**Files:**
- Create: `packages/backend/src/scripts/backfill-entry-titles.ts`
- Modify: `packages/backend/package.json` (script)
- Test: `packages/backend/src/scripts/backfill-entry-titles.test.ts`

**Interfaces:**
- Consumes: `recomputeTitlesForType` (Task 2).
- Produces: `backfillEntryTitles() => Promise<{ types: number; updated: number }>`.

- [ ] **Step 1: Write the failing test**

```ts
jest.mock('../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../test/db';
import { ContentTypeModel } from '../models/content-type.model';
import { ContentEntryModel } from '../models/content-entry.model';
import { FieldType } from '../types/field-types';
import { backfillEntryTitles } from './backfill-entry-titles';

useTestDb();

it('fills titles for entries created before titles existed', async () => {
  const type = await ContentTypeModel.create({
    name: 'Post',
    slug: 'post',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
  // Simulate a legacy document: insert without the title field.
  await ContentEntryModel.collection.insertOne({
    contentTypeId: type._id,
    data: { title: 'Legacy post' },
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const result = await backfillEntryTitles();

  const entry = await ContentEntryModel.findOne({ contentTypeId: type._id }).lean();
  expect(entry?.title).toBe('Legacy post');
  expect(result).toEqual({ types: 1, updated: 1 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- backfill`
Expected: FAIL, cannot find module `./backfill-entry-titles`.

- [ ] **Step 3: Implement `packages/backend/src/scripts/backfill-entry-titles.ts`**

```ts
/**
 * Backfill ContentEntry.title for all entries.
 * Run with: pnpm --filter @thecms/backend backfill:titles
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { ContentTypeModel } from '../models/content-type.model';
import { recomputeTitlesForType } from '../modules/content-entries/entry-titles.service';

export async function backfillEntryTitles(): Promise<{ types: number; updated: number }> {
  const types = await ContentTypeModel.find().select('_id fields titleField').lean();
  let updated = 0;
  for (const type of types) {
    updated += await recomputeTitlesForType(type);
  }
  return { types: types.length, updated };
}

async function main(): Promise<void> {
  dotenv.config();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI environment variable is not defined');

  await mongoose.connect(mongoUri);
  const { types, updated } = await backfillEntryTitles();
  console.log(`Backfilled titles: ${updated} entries across ${types} content types`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}
```

Note: legacy documents have no `title`, so `entry.title` is `undefined` in `recomputeTitlesForType`, which differs from the computed title, so they are written.

- [ ] **Step 4: Add the script to `packages/backend/package.json`**

```json
    "backfill:titles": "tsx src/scripts/backfill-entry-titles.ts",
```

- [ ] **Step 5: Run tests, then commit**

Run: `cd packages/backend && pnpm test`
Expected: PASS.

```bash
git add packages/backend/src/scripts packages/backend/package.json
git commit -m "feat(backend): add entry title backfill script"
```

---

## Task 4: `GET /api/v1/entries` (cross-type list)

**Files:**
- Modify: `packages/backend/src/modules/content-entries/content-entries.schema.ts`
- Modify: `packages/backend/src/modules/content-entries/content-entries.service.ts`
- Modify: `packages/backend/src/modules/content-entries/content-entries.controller.ts`
- Modify: `packages/backend/src/modules/content-entries/content-entries.routes.ts`
- Test: `packages/backend/src/modules/content-entries/list-all-entries.test.ts`

**Interfaces:**
- Consumes: `escapeRegex` (Task 1), `title` field (Task 2).
- Produces: `ContentEntriesService.listAllEntries(options: ListAllEntriesOptions) => Promise<PaginatedEntryListItems>`; HTTP `GET /api/v1/entries?contentTypeId=&status=&search=&sortBy=updatedAt|createdAt|title&sortOrder=asc|desc&page=&limit=` returning `{ success: true, data: EntryListItem[], pagination: { page, limit, total, totalPages } }` where each item is the entry JSON plus `contentType: { id, name, slug } | null`.

- [ ] **Step 1: Write failing tests `list-all-entries.test.ts`**

```ts
jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { ContentEntriesService } from './content-entries.service';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentStatus } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';
import entriesRoutes from './content-entries.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/entries', entriesRoutes);

async function seed() {
  const fields = [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }];
  const post = await ContentTypeModel.create({ name: 'Blog post', slug: 'blog-post', fields });
  const trip = await ContentTypeModel.create({ name: 'Trip', slug: 'trip', fields });
  const mk = (typeId: string, title: string, status = ContentStatus.DRAFT) =>
    ContentEntriesService.createEntry({ contentTypeId: typeId, data: { title }, status });
  await mk(post.id, 'Jak jsem stavěl CMS');
  await mk(post.id, 'C++ (draft) notes');
  await mk(trip.id, 'Přes Šumavu na kole', ContentStatus.PUBLISHED);
  await mk(trip.id, 'Krkonoše 2026');
  return { post, trip };
}

describe('ContentEntriesService.listAllEntries', () => {
  it('lists entries across all types with content type info', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({});
    expect(res.pagination.total).toBe(4);
    expect(res.entries[0].contentType).toEqual(
      expect.objectContaining({ name: expect.any(String), slug: expect.any(String) })
    );
  });

  it('filters by one or more content types', async () => {
    const { trip, post } = await seed();
    expect((await ContentEntriesService.listAllEntries({ contentTypeIds: [trip.id] })).pagination.total).toBe(2);
    expect(
      (await ContentEntriesService.listAllEntries({ contentTypeIds: [trip.id, post.id] })).pagination.total
    ).toBe(4);
  });

  it('filters by status', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({ status: ContentStatus.PUBLISHED });
    expect(res.entries.map((e) => e.title)).toEqual(['Přes Šumavu na kole']);
  });

  it('searches title case-insensitively', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({ search: 'šumavu' });
    expect(res.entries.map((e) => e.title)).toEqual(['Přes Šumavu na kole']);
  });

  it('treats regex characters in search literally', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({ search: 'C++ (draft)' });
    expect(res.entries.map((e) => e.title)).toEqual(['C++ (draft) notes']);
  });

  it('sorts by title ascending and paginates', async () => {
    await seed();
    const page1 = await ContentEntriesService.listAllEntries({ sortBy: 'title', sortOrder: 'asc', limit: 2, page: 1 });
    const page2 = await ContentEntriesService.listAllEntries({ sortBy: 'title', sortOrder: 'asc', limit: 2, page: 2 });
    expect(page1.entries.map((e) => e.title)).toEqual(['C++ (draft) notes', 'Jak jsem stavěl CMS']);
    expect(page2.entries.map((e) => e.title)).toEqual(['Krkonoše 2026', 'Přes Šumavu na kole']);
    expect(page1.pagination.totalPages).toBe(2);
  });

  it('returns contentType null for entries whose type was deleted', async () => {
    const { trip } = await seed();
    await ContentTypeModel.deleteOne({ _id: trip._id });
    const res = await ContentEntriesService.listAllEntries({});
    expect(res.pagination.total).toBe(4);
    expect(res.entries.filter((e) => e.contentType === null)).toHaveLength(2);
  });
});

describe('GET /entries', () => {
  it('is routed to the list handler, not /:id', async () => {
    await seed();
    const res = await request(app).get('/entries?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(4);
  });

  it('accepts repeated contentTypeId params', async () => {
    const { trip, post } = await seed();
    const res = await request(app).get(`/entries?contentTypeId=${trip.id}&contentTypeId=${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(4);
  });

  it('rejects an invalid contentTypeId with 400', async () => {
    const res = await request(app).get('/entries?contentTypeId=not-an-id');
    expect(res.status).toBe(400);
  });

  it('rejects search longer than 100 characters with 400', async () => {
    const res = await request(app).get(`/entries?search=${'a'.repeat(101)}`);
    expect(res.status).toBe(400);
  });

  it('rejects an unknown sortBy with 400', async () => {
    const res = await request(app).get('/entries?sortBy=data.secret');
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- list-all-entries`
Expected: FAIL, `listAllEntries is not a function`; route tests get 404/400 from `/:id`.

- [ ] **Step 3: Add `listAllEntriesSchema` to `content-entries.schema.ts`**

Add before the "Type exports" section:

```ts
const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid content type ID');

/**
 * Schema for listing entries across all content types
 */
export const listAllEntriesSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, { message: 'Page must be greater than 0' }),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, { message: 'Limit must be between 1 and 100' }),
    status: z.nativeEnum(ContentStatus).optional(),
    contentTypeId: z
      .union([objectIdSchema, z.array(objectIdSchema)])
      .optional()
      .transform((val) => (val === undefined ? undefined : Array.isArray(val) ? val : [val])),
    search: z.string().trim().max(100, 'Search must be at most 100 characters').optional(),
    sortBy: z.enum(['updatedAt', 'createdAt', 'title']).optional().default('updatedAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});
```

and to the type exports:

```ts
export type ListAllEntriesInput = z.infer<typeof listAllEntriesSchema>;
```

- [ ] **Step 4: Add `listAllEntries` to the service**

In `content-entries.service.ts`, import `escapeRegex`:

```ts
import { escapeRegex } from '../../utils/regex';
```

Add these types after `PaginatedEntries`:

```ts
export interface ListAllEntriesOptions {
  page?: number;
  limit?: number;
  status?: ContentStatus;
  contentTypeIds?: string[];
  search?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface EntryContentTypeRef {
  id: string;
  name: string;
  slug: string;
}

export type EntryListItem = ReturnType<IContentEntry['toJSON']> & {
  title: string;
  contentType: EntryContentTypeRef | null;
};

export interface PaginatedEntryListItems {
  entries: EntryListItem[];
  pagination: PaginatedEntries['pagination'];
}
```

Add this static method to `ContentEntriesService` (after `listEntries`):

```ts
  /**
   * List entries across all content types (admin Content list, pickers, search)
   */
  static async listAllEntries(options: ListAllEntriesOptions = {}): Promise<PaginatedEntryListItems> {
    const {
      page = 1,
      limit = 20,
      status,
      contentTypeIds,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = options;

    // `any` matches the existing query-building style in this service.
    const query: any = {};
    if (contentTypeIds && contentTypeIds.length > 0) query.contentTypeId = { $in: contentTypeIds };
    if (status) query.status = status;
    if (search) query.title = { $regex: escapeRegex(search), $options: 'i' };

    const direction = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: direction, _id: direction };

    const [entries, total] = await Promise.all([
      ContentEntryModel.find(query).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      ContentEntryModel.countDocuments(query),
    ]);

    const typeIds = [...new Set(entries.map((e) => String(e.contentTypeId)))];
    const types = await ContentTypeModel.find({ _id: { $in: typeIds } }).select('name slug').lean();
    const typeMap = new Map<string, EntryContentTypeRef>(
      types.map((t) => [String(t._id), { id: String(t._id), name: t.name, slug: t.slug }])
    );

    return {
      entries: entries.map((e) => ({
        ...e.toJSON(),
        title: e.title,
        contentType: typeMap.get(String(e.contentTypeId)) ?? null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
```

- [ ] **Step 5: Add the controller handler**

In `content-entries.controller.ts`, add `listAllEntriesSchema` to the schema import list, and add this method to `ContentEntriesController` (before `getEntry`):

```ts
  /**
   * List entries across all content types
   * GET /api/v1/entries
   */
  async listAllEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query } = listAllEntriesSchema.parse({ query: req.query });

      const result = await ContentEntriesService.listAllEntries({
        page: query.page,
        limit: query.limit,
        status: query.status,
        contentTypeIds: query.contentTypeId,
        search: query.search || undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      res.status(200).json({
        success: true,
        data: result.entries,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }
```

- [ ] **Step 6: Register the route before `/:id`**

In `content-entries.routes.ts`, directly after `router.use(authMiddleware);` add:

```ts
/**
 * @swagger
 * /entries:
 *   get:
 *     summary: List entries across all content types
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: contentTypeId, schema: { type: array, items: { type: string } }, style: form, explode: true }
 *       - { in: query, name: status, schema: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED] } }
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [updatedAt, createdAt, title], default: updatedAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Paginated entries with contentType { id, name, slug } or null
 */
router.get('/', (req, res, next) => contentEntriesController.listAllEntries(req, res, next));
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test`
Expected: PASS.

- [ ] **Step 8: Build and commit**

```bash
pnpm --filter @thecms/backend build
git add packages/backend/src/modules/content-entries
git commit -m "feat(backend): add cross-type GET /entries with title search"
```

---

## Task 5: `GET /api/v1/stats`

**Files:**
- Create: `packages/backend/src/modules/stats/stats.service.ts`
- Create: `packages/backend/src/modules/stats/stats.controller.ts`
- Create: `packages/backend/src/modules/stats/stats.routes.ts`
- Modify: `packages/backend/src/routes/index.ts`
- Test: `packages/backend/src/modules/stats/stats.test.ts`

**Interfaces:**
- Produces: `getDashboardStats() => Promise<DashboardStats>`; HTTP `GET /api/v1/stats` returning `{ success: true, data: DashboardStats }` with

```ts
interface DashboardStats {
  entries: { total: number; draft: number; published: number; archived: number };
  contentTypes: number;
  media: number;
  sites: number;
  submissions: { unread: number };
}
```

- [ ] **Step 1: Write failing tests `stats.test.ts`**

```ts
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { useTestDb } from '../../test/db';
import { getDashboardStats } from './stats.service';
import statsRoutes from './stats.routes';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { FormSubmissionModel, SubmissionStatus } from '../../models/form-submission.model';
import { FieldType } from '../../types/field-types';

useTestDb();

it('returns zeros on an empty install', async () => {
  expect(await getDashboardStats()).toEqual({
    entries: { total: 0, draft: 0, published: 0, archived: 0 },
    contentTypes: 0,
    media: 0,
    sites: 0,
    submissions: { unread: 0 },
  });
});

it('counts entries by status, types and unread submissions', async () => {
  const type = await ContentTypeModel.create({
    name: 'Post',
    slug: 'post',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
  await ContentEntryModel.create([
    { contentTypeId: type._id, data: {}, status: ContentStatus.DRAFT },
    { contentTypeId: type._id, data: {}, status: ContentStatus.DRAFT },
    { contentTypeId: type._id, data: {}, status: ContentStatus.PUBLISHED },
    { contentTypeId: type._id, data: {}, status: ContentStatus.ARCHIVED },
  ]);
  const formId = new mongoose.Types.ObjectId();
  await FormSubmissionModel.collection.insertMany([
    { formId, data: {}, status: SubmissionStatus.UNREAD, emailSent: false },
    { formId, data: {}, status: SubmissionStatus.READ, emailSent: false },
  ]);

  const stats = await getDashboardStats();
  expect(stats.entries).toEqual({ total: 4, draft: 2, published: 1, archived: 1 });
  expect(stats.contentTypes).toBe(1);
  expect(stats.submissions.unread).toBe(1);
});

it('GET /stats responds with the stats envelope', async () => {
  const app = express();
  app.use('/stats', statsRoutes);
  const res = await request(app).get('/stats');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data.entries.total).toBe(0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- stats`
Expected: FAIL, cannot find module `./stats.service`.

- [ ] **Step 3: Implement `stats.service.ts`**

```ts
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { MediaModel } from '../../models/media.model';
import { SiteModel } from '../../models/site.model';
import { FormSubmissionModel, SubmissionStatus } from '../../models/form-submission.model';

export interface DashboardStats {
  entries: { total: number; draft: number; published: number; archived: number };
  contentTypes: number;
  media: number;
  sites: number;
  submissions: { unread: number };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [byStatus, contentTypes, media, sites, unread] = await Promise.all([
    ContentEntryModel.aggregate<{ _id: ContentStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ContentTypeModel.countDocuments(),
    MediaModel.countDocuments(),
    SiteModel.countDocuments(),
    FormSubmissionModel.countDocuments({ status: SubmissionStatus.UNREAD }),
  ]);

  const count = (status: ContentStatus) => byStatus.find((s) => s._id === status)?.count ?? 0;
  const draft = count(ContentStatus.DRAFT);
  const published = count(ContentStatus.PUBLISHED);
  const archived = count(ContentStatus.ARCHIVED);

  return {
    entries: { total: draft + published + archived, draft, published, archived },
    contentTypes,
    media,
    sites,
    submissions: { unread },
  };
}
```

- [ ] **Step 4: Implement `stats.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { getDashboardStats } from './stats.service';

export class StatsController {
  /**
   * Dashboard counts
   * GET /api/v1/stats
   */
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await getDashboardStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const statsController = new StatsController();
```

- [ ] **Step 5: Implement `stats.routes.ts`**

```ts
import { Router, type IRouter } from 'express';
import { statsController } from './stats.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router: IRouter = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Dashboard counts (entries by status, content types, media, sites, unread submissions)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
router.get('/', (req, res, next) => statsController.getStats(req, res, next));

export default router;
```

- [ ] **Step 6: Mount in `src/routes/index.ts`**

Add the import `import statsRoutes from '../modules/stats/stats.routes';` and `router.use('/stats', statsRoutes);` after the contact forms mount.

- [ ] **Step 7: Run tests, build, commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS, build succeeds.

```bash
git add packages/backend/src/modules/stats packages/backend/src/routes/index.ts
git commit -m "feat(backend): add GET /stats for dashboard counts"
```

---

## Task 6: `GET /api/v1/media/:id/usage`

**Files:**
- Create: `packages/backend/src/modules/media/media-usage.service.ts`
- Modify: `packages/backend/src/modules/media/media.controller.ts`
- Modify: `packages/backend/src/modules/media/media.routes.ts:270`
- Test: `packages/backend/src/modules/media/media-usage.test.ts`

**Interfaces:**
- Consumes: `escapeRegex` (Task 1), `title` (Task 2).
- Produces: `findMediaUsage(mediaId: string) => Promise<MediaUsageItem[] | null>` (null when the media item does not exist; throws `Error('Invalid media ID')` for a malformed id); HTTP `GET /api/v1/media/:id/usage` returning `{ success: true, data: MediaUsageItem[] }`, 404 when the media item does not exist, 400 for a malformed id, where

```ts
interface MediaUsageItem {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  contentType: { id: string; name: string; slug: string };
}
```

Matching rules: a MEDIA field whose value equals the media id or is an array containing it; a RICH_TEXT field whose HTML contains the media's blob filename without extension (covers the original and its size variants).

- [ ] **Step 1: Write failing tests `media-usage.test.ts`**

```ts
jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { findMediaUsage } from './media-usage.service';
import { MediaModel } from '../../models/media.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { FieldType } from '../../types/field-types';

useTestDb();

async function seed() {
  const media = await MediaModel.create({
    filename: 'a1b2c3-sumava.jpg',
    originalName: 'sumava.jpg',
    mimeType: 'image/jpeg',
    size: 1000,
    blobUrl: 'http://127.0.0.1:10000/devstoreaccount1/media/a1b2c3-sumava.jpg',
  });
  const type = await ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    fields: [
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: false },
      { name: 'cover', label: 'Cover', type: FieldType.MEDIA, required: false },
      { name: 'gallery', label: 'Gallery', type: FieldType.MEDIA, required: false, validation: { multiple: true } },
      { name: 'body', label: 'Body', type: FieldType.RICH_TEXT, required: false },
    ],
  });
  return { media, type };
}

it('finds entries referencing the media in single, multiple and rich text fields', async () => {
  const { media, type } = await seed();
  const id = media.id;
  await ContentEntriesService.createEntry({ contentTypeId: type.id, data: { title: 'Cover', cover: id } });
  await ContentEntriesService.createEntry({ contentTypeId: type.id, data: { title: 'Gallery', gallery: ['x', id] } });
  await ContentEntriesService.createEntry({
    contentTypeId: type.id,
    data: { title: 'Inline', body: '<p><img src="https://cdn.example.com/media/a1b2c3-sumava-medium.jpg"></p>' },
  });
  await ContentEntriesService.createEntry({ contentTypeId: type.id, data: { title: 'Unrelated' } });

  const usage = await findMediaUsage(id);
  expect(usage?.map((u) => u.title).sort()).toEqual(['Cover', 'Gallery', 'Inline']);
  expect(usage?.[0].contentType).toEqual({ id: type.id, name: 'Trip', slug: 'trip' });
});

it('returns an empty list when nothing references the media', async () => {
  const { media } = await seed();
  expect(await findMediaUsage(media.id)).toEqual([]);
});

it('returns null for a media id that does not exist', async () => {
  expect(await findMediaUsage('66f1a2b3c4d5e6f7a8b9c0d1')).toBeNull();
});

it('throws for a malformed id', async () => {
  await expect(findMediaUsage('nope')).rejects.toThrow('Invalid media ID');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- media-usage`
Expected: FAIL, cannot find module `./media-usage.service`.

- [ ] **Step 3: Implement `media-usage.service.ts`**

```ts
import mongoose from 'mongoose';
import { MediaModel } from '../../models/media.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';
import { escapeRegex } from '../../utils/regex';

export interface MediaUsageItem {
  id: string;
  title: string;
  status: ContentStatus;
  contentType: { id: string; name: string; slug: string };
}

const MAX_USAGE_RESULTS = 100;

export async function findMediaUsage(mediaId: string): Promise<MediaUsageItem[] | null> {
  if (!mongoose.Types.ObjectId.isValid(mediaId)) {
    throw new Error('Invalid media ID');
  }

  const media = await MediaModel.findById(mediaId).select('filename').lean();
  if (!media) return null;

  const stem = escapeRegex(media.filename.replace(/\.[^.]+$/, ''));
  const types = await ContentTypeModel.find({
    'fields.type': { $in: [FieldType.MEDIA, FieldType.RICH_TEXT] },
  })
    .select('name slug fields')
    .lean();

  const clauses: any[] = types.flatMap((type) => {
    const conditions: Record<string, unknown>[] = type.fields.flatMap((field): Record<string, unknown>[] => {
      if (field.type === FieldType.MEDIA) return [{ [`data.${field.name}`]: mediaId }];
      if (field.type === FieldType.RICH_TEXT) return [{ [`data.${field.name}`]: { $regex: stem } }];
      return [];
    });
    return conditions.length ? [{ contentTypeId: type._id, $or: conditions }] : [];
  });
  if (clauses.length === 0) return [];

  const entries = await ContentEntryModel.find({ $or: clauses })
    .select('title status contentTypeId')
    .sort({ updatedAt: -1 })
    .limit(MAX_USAGE_RESULTS)
    .lean();

  const typeMap = new Map(
    types.map((t) => [String(t._id), { id: String(t._id), name: t.name, slug: t.slug }])
  );

  return entries.map((e) => ({
    id: String(e._id),
    title: e.title,
    status: e.status,
    contentType: typeMap.get(String(e.contentTypeId))!,
  }));
}
```

(The `!` is safe: every matched entry was selected by a clause built from one of `types`.)

- [ ] **Step 4: Add the controller method**

In `media.controller.ts`, import `import { findMediaUsage } from './media-usage.service';` and add to the controller class:

```ts
  /**
   * Entries that reference a media item
   * GET /api/v1/media/:id/usage
   */
  async getMediaUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usage = await findMediaUsage(req.params.id);
      if (usage === null) {
        res.status(404).json({ success: false, error: 'Media file not found' });
        return;
      }
      res.status(200).json({ success: true, data: usage });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid media ID') {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }
```

- [ ] **Step 5: Register the route**

In `media.routes.ts`, directly before `router.get('/:id', ...)` (line 270) add:

```ts
/**
 * @swagger
 * /media/{id}/usage:
 *   get:
 *     summary: Entries that reference this media item
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: List of referencing entries }
 *       400: { description: Invalid media ID }
 *       404: { description: Media file not found }
 */
router.get('/:id/usage', (req, res, next) => mediaController.getMediaUsage(req, res, next));
```

- [ ] **Step 6: Run tests, build, commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS, build succeeds.

```bash
git add packages/backend/src/modules/media
git commit -m "feat(backend): add GET /media/:id/usage"
```

---

## Task 7: Frontend tooling, tokens, shadcn and theme

**Files:**
- Modify: `packages/admin-dashboard/package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `src/main.tsx`
- Create: `packages/admin-dashboard/components.json`
- Create: `src/styles/tokens.css`, `src/styles/globals.css`, `src/lib/utils.ts`, `src/lib/format.ts`
- Create: `src/test/setup.ts`, `src/test/render.tsx`
- Create: `src/app/theme/theme-utils.ts`, `src/app/theme/theme-context.ts`, `src/app/theme/ThemeProvider.tsx`, `src/app/theme/useTheme.ts`
- Generated: `src/components/ui/*`
- Test: `src/lib/utils.test.ts`, `src/lib/format.test.ts`, `src/app/theme/theme.test.tsx`

All paths below are relative to `packages/admin-dashboard` unless absolute.

**Interfaces:**
- Produces: `cn(...inputs)`, `getInitials(name?: string) => string`, `ThemePreference = 'light' | 'dark' | 'system'`, `THEME_STORAGE_KEY = 'thecms-theme'`, `readThemePreference()`, `writeThemePreference(p)`, `resolveTheme(pref, systemPrefersDark)`, `<ThemeProvider>`, `useTheme() => { preference, resolved, setPreference }`, `renderWithProviders(ui, { route? })`, shadcn components under `@/components/ui/*`, Tailwind color utilities for every token (e.g. `bg-status-published-bg`, `bg-sidebar`, `font-serif`).

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/pavelflajsman/personalGit/thecms
pnpm --filter admin-dashboard add tailwindcss @tailwindcss/vite class-variance-authority clsx tailwind-merge lucide-react tw-animate-css sonner @fontsource-variable/inter @fontsource-variable/newsreader
pnpm --filter admin-dashboard add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

If `@fontsource-variable/newsreader` is not found on npm, use `@fontsource/newsreader` and change the import in `globals.css` to `@import "@fontsource/newsreader/400.css"; @import "@fontsource/newsreader/600.css";` and the font family to `"Newsreader"`.

- [ ] **Step 2: Add the test script to `package.json`**

In `"scripts"` add:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Replace `vite.config.ts`**

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

- [ ] **Step 4: Add the `@/` alias to both tsconfigs**

`tsconfig.json`, add a `compilerOptions` block (the shadcn CLI reads it):

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`tsconfig.app.json`, inside `compilerOptions` add:

```json
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
```

and change `"types": ["vite/client"]` to `"types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]`.

- [ ] **Step 5: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "stone",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 6: Create `src/lib/utils.ts` and a placeholder `src/styles/globals.css`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`src/styles/globals.css` (temporary, overwritten in Step 8):

```css
@import "tailwindcss";
```

- [ ] **Step 7: Generate shadcn components**

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
pnpm dlx shadcn@latest add button input label badge skeleton separator avatar dropdown-menu dialog alert-dialog sheet tooltip command sonner --yes --overwrite
```

Expected: files in `src/components/ui/`. Then:

1. Make buttons pill-shaped (spec: pill-shaped primary buttons):
   ```bash
   sed -i '' 's/rounded-md/rounded-full/g' src/components/ui/button.tsx
   ```
2. Replace `src/components/ui/sonner.tsx` (the generated one imports `next-themes`, which this app does not use) with:
   ```tsx
   import type { CSSProperties } from 'react'
   import { Toaster as Sonner, type ToasterProps } from 'sonner'
   import { useTheme } from '@/app/theme/useTheme'

   export function Toaster(props: ToasterProps) {
     const { resolved } = useTheme()
     return (
       <Sonner
         theme={resolved}
         className="toaster group"
         style={
           {
             '--normal-bg': 'var(--popover)',
             '--normal-text': 'var(--popover-foreground)',
             '--normal-border': 'var(--border)',
           } as CSSProperties
         }
         {...props}
       />
     )
   }
   ```
3. If the CLI added `next-themes` to `package.json`, remove it: `pnpm remove next-themes`.

- [ ] **Step 8: Write the design tokens and Tailwind entry**

`src/styles/tokens.css`:

```css
/* Warm editorial design tokens. Components use these via Tailwind utilities only. */
:root {
  --radius: 0.625rem;

  --background: #fbf8f3;
  --foreground: #2b2620;
  --card: #ffffff;
  --card-foreground: #2b2620;
  --popover: #ffffff;
  --popover-foreground: #2b2620;
  --primary: #1f6f5c;
  --primary-foreground: #ffffff;
  --secondary: #f3ede3;
  --secondary-foreground: #2b2620;
  --muted: #f3ede3;
  --muted-foreground: #6b6257;
  --accent: #efe6d8;
  --accent-foreground: #2b2620;
  --destructive: #b3401f;
  --destructive-foreground: #ffffff;
  --border: #ebe3d6;
  --input: #e6dccb;
  --ring: #1f6f5c;

  --sidebar: #f3ede3;
  --sidebar-foreground: #5d554a;
  --sidebar-border: #e6dccb;
  --sidebar-accent: #2b2620;
  --sidebar-accent-foreground: #fbf8f3;

  --status-published-bg: #dff0ea;
  --status-published-fg: #1a5e4e;
  --status-draft-bg: #f6ead2;
  --status-draft-fg: #7a5512;
  --status-archived-bg: #ecebe8;
  --status-archived-fg: #55524d;
  --status-unread-bg: #f7dfd5;
  --status-unread-fg: #93391a;
}

.dark {
  --background: #1c1916;
  --foreground: #f3ede3;
  --card: #24201c;
  --card-foreground: #f3ede3;
  --popover: #24201c;
  --popover-foreground: #f3ede3;
  --primary: #5cc0a6;
  --primary-foreground: #0f231d;
  --secondary: #2d2823;
  --secondary-foreground: #f3ede3;
  --muted: #2d2823;
  --muted-foreground: #b3a898;
  --accent: #342e28;
  --accent-foreground: #f3ede3;
  --destructive: #e58766;
  --destructive-foreground: #1c1916;
  --border: #3a332c;
  --input: #463d35;
  --ring: #5cc0a6;

  --sidebar: #201c19;
  --sidebar-foreground: #c9bfb1;
  --sidebar-border: #3a332c;
  --sidebar-accent: #f3ede3;
  --sidebar-accent-foreground: #1c1916;

  --status-published-bg: #173a31;
  --status-published-fg: #8fd8c2;
  --status-draft-bg: #3d3018;
  --status-draft-fg: #f0cf8a;
  --status-archived-bg: #2f2c29;
  --status-archived-fg: #c9c4bd;
  --status-unread-bg: #45261b;
  --status-unread-fg: #f4ab8e;
}
```

`src/styles/globals.css` (overwrite):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@fontsource-variable/inter";
@import "@fontsource-variable/newsreader";
@import "./tokens.css";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Newsreader Variable", Georgia, "Times New Roman", serif;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-status-published-bg: var(--status-published-bg);
  --color-status-published-fg: var(--status-published-fg);
  --color-status-draft-bg: var(--status-draft-bg);
  --color-status-draft-fg: var(--status-draft-fg);
  --color-status-archived-bg: var(--status-archived-bg);
  --color-status-archived-fg: var(--status-archived-fg);
  --color-status-unread-bg: var(--status-unread-bg);
  --color-status-unread-fg: var(--status-unread-fg);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

Note: Tailwind puts preflight in `@layer base`. MUI's Emotion styles are unlayered, so they still win on legacy MUI pages.

- [ ] **Step 9: Switch the CSS entry and add the no-flash theme script**

`src/main.tsx`: replace `import './index.css'` with `import './styles/globals.css'`.

Delete `src/index.css`. Check `src/App.css` is unused (`grep -rn "App.css" src`); if unused, delete it.

`index.html`: inside `<head>`, before any other script, add:

```html
    <script>
      try {
        var p = localStorage.getItem('thecms-theme');
        var dark = p === 'dark' || ((!p || p === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.classList.add('dark');
      } catch (e) {}
    </script>
```

Also set `<title>TheCMS</title>`.

- [ ] **Step 10: Create the test setup and render helper**

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
})

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
Element.prototype.hasPointerCapture ??= () => false
```

`src/test/render.tsx`:

```tsx
import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/theme/ThemeProvider'

interface Options {
  route?: string
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }
  return render(ui, { wrapper: Wrapper })
}
```

- [ ] **Step 11: Write failing tests**

`src/lib/utils.test.ts`:

```ts
import { cn } from './utils'

it('merges conflicting Tailwind classes, last wins', () => {
  expect(cn('px-2 text-sm', false && 'hidden', 'px-4')).toBe('text-sm px-4')
})
```

`src/lib/format.test.ts`:

```ts
import { getInitials } from './format'

describe('getInitials', () => {
  it('uses first and last word', () => {
    expect(getInitials('Pavel Flajsman')).toBe('PF')
    expect(getInitials('Ana María de la Cruz')).toBe('AC')
  })
  it('handles single names, extra spaces and empty input', () => {
    expect(getInitials('  jana ')).toBe('J')
    expect(getInitials('')).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })
})
```

`src/app/theme/theme.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'
import { readThemePreference, resolveTheme, THEME_STORAGE_KEY } from './theme-utils'

function Probe() {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setPreference('dark')}>dark</button>
    </div>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  try { localStorage.clear() } catch { /* ignore */ }
})

describe('resolveTheme', () => {
  it('follows the system for system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
  it('returns explicit preferences as-is', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('readThemePreference', () => {
  it('defaults to system for missing or invalid values', () => {
    expect(readThemePreference()).toBe('system')
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    expect(readThemePreference()).toBe('system')
  })
  it('falls back to system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readThemePreference()).toBe('system')
  })
})

describe('ThemeProvider', () => {
  it('applies the dark class and persists the choice', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('still switches theme in memory when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('pref')).toHaveTextContent('system')
    await act(async () => { await userEvent.click(screen.getByText('dark')) })
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })
})
```

- [ ] **Step 12: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test`
Expected: FAIL, cannot resolve `./format`, `./ThemeProvider`, `./useTheme`, `./theme-utils`.

- [ ] **Step 13: Implement `src/lib/format.ts`**

```ts
/** Initials for an avatar: first letter of the first and last word. */
export function getInitials(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}
```

- [ ] **Step 14: Implement the theme files**

`src/app/theme/theme-utils.ts`:

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'thecms-theme'

export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function writeThemePreference(value: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // Storage unavailable (private mode, blocked site data): keep the choice in memory only.
  }
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}
```

`src/app/theme/theme-context.ts`:

```ts
import { createContext } from 'react'
import type { ResolvedTheme, ThemePreference } from './theme-utils'

export interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
```

`src/app/theme/ThemeProvider.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext } from './theme-context'
import { readThemePreference, resolveTheme, writeThemePreference, type ThemePreference } from './theme-utils'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference)
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(preference, systemPrefersDark)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    writeThemePreference(next)
  }, [])

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
```

`src/app/theme/useTheme.ts`:

```ts
import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './theme-context'

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
```

- [ ] **Step 15: Run tests, build, lint**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm lint`
Expected: tests PASS; build succeeds (old MUI UI still renders); lint has no errors (warnings from generated shadcn files are acceptable).

- [ ] **Step 16: Commit**

```bash
git add packages/admin-dashboard pnpm-lock.yaml
git commit -m "feat(admin): add Tailwind, shadcn/ui, design tokens and theme provider"
```

---

## Task 8: Module registry, nav helpers and shared components

**Files:**
- Create: `src/modules/types.ts`, `src/modules/nav.ts`, `src/modules/registry.tsx`
- Create: `src/lib/queries/stats.ts`
- Modify: `src/types/index.ts`
- Create: `src/components/common/Logo.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `StatusPill.tsx`, `ConfirmDialog.tsx`
- Create: `src/features/inbox/pages/InboxPlaceholder.tsx`, `src/features/webhooks/pages/WebhooksPlaceholder.tsx`
- Test: `src/modules/nav.test.ts`, `src/modules/registry.test.tsx`, `src/components/common/common.test.tsx`

**Interfaces:**
- Consumes: `cn` (Task 7), shadcn `button`, `alert-dialog`, `input`, `label` (Task 7), `apiClient` from `src/lib/api.ts`.
- Produces:
  - `AppModule { id; label; icon: LucideIcon; group: 'workspace' | 'setup'; path; routes: RouteObject[]; mobileTab?: boolean; matches?: string[]; useBadge?: () => number | undefined }`
  - `CreateAction { id; label; to; icon: LucideIcon }`
  - `pathMatches(pathname, prefix)`, `isModuleActive(module, pathname)`, `findActiveModule(modules, pathname)`, `groupModules(modules) => { workspace, setup }`, `mobileTabModules(modules)`, `collectRoutes(modules)`
  - `modules: AppModule[]`, `createActions: CreateAction[]` from `@/modules/registry`
  - `useStats()`, `useUnreadCount()`, `statsKeys`
  - `DashboardStats` type
  - `<Logo size?>`, `<PageHeader title description? actions? breadcrumb?>`, `<EmptyState icon title description? action?>`, `<StatusPill status>` with `StatusValue = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'UNREAD' | 'READ'`, `<ConfirmDialog open onOpenChange title description confirmLabel? destructive? confirmText? pending? onConfirm>`

- [ ] **Step 1: Write failing nav tests `src/modules/nav.test.ts`**

```ts
import { House, FileText, Boxes } from 'lucide-react'
import { collectRoutes, findActiveModule, groupModules, isModuleActive, mobileTabModules, pathMatches } from './nav'
import type { AppModule } from './types'

const mod = (over: Partial<AppModule>): AppModule => ({
  id: 'x', label: 'X', icon: House, group: 'workspace', path: '/x', routes: [], ...over,
})

const home = mod({ id: 'home', path: '/', mobileTab: true, routes: [{ index: true }] })
const content = mod({ id: 'content', icon: FileText, path: '/content', matches: ['/entries'], mobileTab: true, routes: [{ path: 'content' }] })
const models = mod({ id: 'models', icon: Boxes, group: 'setup', path: '/models', matches: ['/content-types'], routes: [{ path: 'models' }] })
const all = [home, content, models]

describe('pathMatches', () => {
  it('matches exact paths and child segments only', () => {
    expect(pathMatches('/content', '/content')).toBe(true)
    expect(pathMatches('/content/123', '/content')).toBe(true)
    expect(pathMatches('/content-types', '/content')).toBe(false)
    expect(pathMatches('/contents', '/content')).toBe(false)
  })
  it('treats / as exact only', () => {
    expect(pathMatches('/', '/')).toBe(true)
    expect(pathMatches('/media', '/')).toBe(false)
  })
})

describe('isModuleActive / findActiveModule', () => {
  it('uses legacy matches', () => {
    expect(isModuleActive(content, '/entries/abc/edit')).toBe(true)
  })
  it('does not confuse /content-types with Content', () => {
    expect(findActiveModule(all, '/content-types/new')?.id).toBe('models')
  })
  it('returns Home only for the root', () => {
    expect(findActiveModule(all, '/')?.id).toBe('home')
    expect(findActiveModule(all, '/unknown')).toBeUndefined()
  })
})

describe('grouping', () => {
  it('splits by group preserving order', () => {
    const { workspace, setup } = groupModules(all)
    expect(workspace.map((m) => m.id)).toEqual(['home', 'content'])
    expect(setup.map((m) => m.id)).toEqual(['models'])
  })
  it('selects mobile tabs', () => {
    expect(mobileTabModules(all).map((m) => m.id)).toEqual(['home', 'content'])
  })
  it('flattens routes', () => {
    expect(collectRoutes(all)).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Write failing registry test `src/modules/registry.test.tsx`**

```tsx
import { modules, createActions } from './registry'
import { groupModules, mobileTabModules } from './nav'

describe('module registry', () => {
  it('has unique ids and paths', () => {
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length)
    expect(new Set(modules.map((m) => m.path)).size).toBe(modules.length)
  })

  it('matches the approved information architecture', () => {
    const { workspace, setup } = groupModules(modules)
    expect(workspace.map((m) => m.label)).toEqual(['Home', 'Content', 'Media', 'Inbox'])
    expect(setup.map((m) => m.label)).toEqual(['Content models', 'Forms', 'Sites & API keys', 'Webhooks'])
  })

  it('shows exactly Home, Content, Media and Inbox as mobile tabs', () => {
    expect(mobileTabModules(modules).map((m) => m.id)).toEqual(['home', 'content', 'media', 'inbox'])
  })

  it('offers create actions', () => {
    expect(createActions.map((a) => a.label)).toEqual(['New entry', 'Upload media'])
  })
})
```

- [ ] **Step 3: Write failing component tests `src/components/common/common.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Inbox } from 'lucide-react'
import { StatusPill } from './StatusPill'
import { EmptyState } from './EmptyState'
import { PageHeader } from './PageHeader'
import { ConfirmDialog } from './ConfirmDialog'

describe('StatusPill', () => {
  it.each([
    ['PUBLISHED', 'Published'],
    ['DRAFT', 'Draft'],
    ['ARCHIVED', 'Archived'],
    ['UNREAD', 'New'],
    ['READ', 'Read'],
  ] as const)('renders %s as %s', (status, label) => {
    render(<StatusPill status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('EmptyState and PageHeader', () => {
  it('renders title, description and action', () => {
    render(<EmptyState icon={Inbox} title="No messages" description="Nothing yet." action={<button>Create</button>} />)
    expect(screen.getByRole('status')).toHaveTextContent('No messages')
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
  it('renders the page title as h1', () => {
    render(<PageHeader title="Content" actions={<button>New</button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Content' })).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('confirms a simple action', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog open onOpenChange={() => {}} title="Archive entry?" description="You can restore it later." onConfirm={onConfirm} confirmLabel="Archive" />)
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('requires typing the exact confirm text', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog open onOpenChange={() => {}} title="Delete model?" description="This deletes 8 entries." confirmText="Trip" confirmLabel="Delete" destructive onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/type/i), 'trip')
    expect(confirm).toBeDisabled()
    await userEvent.clear(screen.getByLabelText(/type/i))
    await userEvent.type(screen.getByLabelText(/type/i), 'Trip')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test`
Expected: FAIL, missing modules `./nav`, `./registry`, `./StatusPill`, and others.

- [ ] **Step 5: Implement `src/modules/types.ts` and `src/modules/nav.ts`**

`src/modules/types.ts`:

```ts
import type { LucideIcon } from 'lucide-react'
import type { RouteObject } from 'react-router-dom'

export type ModuleGroup = 'workspace' | 'setup'

export interface AppModule {
  id: string
  label: string
  icon: LucideIcon
  group: ModuleGroup
  /** Canonical path shown in navigation. */
  path: string
  routes: RouteObject[]
  /** Shown in the mobile bottom tab bar. */
  mobileTab?: boolean
  /** Extra path prefixes (legacy URLs) that mark this module active. */
  matches?: string[]
  /** Hook returning a badge count, e.g. unread messages. */
  useBadge?: () => number | undefined
}

export interface CreateAction {
  id: string
  label: string
  to: string
  icon: LucideIcon
}
```

`src/modules/nav.ts`:

```ts
import type { RouteObject } from 'react-router-dom'
import type { AppModule } from './types'

/** True when pathname is prefix itself or a child segment of it. '/' matches only itself. */
export function pathMatches(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isModuleActive(module: Pick<AppModule, 'path' | 'matches'>, pathname: string): boolean {
  return [module.path, ...(module.matches ?? [])].some((prefix) => pathMatches(pathname, prefix))
}

export function findActiveModule<T extends Pick<AppModule, 'path' | 'matches'>>(modules: T[], pathname: string): T | undefined {
  return modules.find((m) => isModuleActive(m, pathname))
}

export function groupModules<T extends Pick<AppModule, 'group'>>(modules: T[]): { workspace: T[]; setup: T[] } {
  return {
    workspace: modules.filter((m) => m.group === 'workspace'),
    setup: modules.filter((m) => m.group === 'setup'),
  }
}

export function mobileTabModules<T extends Pick<AppModule, 'mobileTab'>>(modules: T[]): T[] {
  return modules.filter((m) => m.mobileTab)
}

export function collectRoutes(modules: Pick<AppModule, 'routes'>[]): RouteObject[] {
  return modules.flatMap((m) => m.routes)
}
```

- [ ] **Step 6: Extend frontend types and add the stats query**

In `src/types/index.ts`: add `titleField?: string;` to `ContentType`; add `title?: string;` to `ContentEntry`; append:

```ts
export interface DashboardStats {
  entries: { total: number; draft: number; published: number; archived: number };
  contentTypes: number;
  media: number;
  sites: number;
  submissions: { unread: number };
}
```

`src/lib/queries/stats.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import type { ApiResponse, DashboardStats } from '@/types'

export const statsKeys = { all: ['stats'] as const }

export function useStats() {
  return useQuery({
    queryKey: statsKeys.all,
    queryFn: async () => (await apiClient.get<ApiResponse<DashboardStats>>('/stats')).data.data,
    staleTime: 30_000,
  })
}

export function useUnreadCount(): number | undefined {
  return useStats().data?.submissions.unread
}
```

- [ ] **Step 7: Implement the shared components**

`src/components/common/Logo.tsx`:

```tsx
interface LogoProps {
  size?: number
}

export function Logo({ size = 32 }: LogoProps) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-lg bg-foreground font-serif font-semibold text-background"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      T
    </span>
  )
}
```

`src/components/common/PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: ReactNode
}

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-sm text-muted-foreground">{breadcrumb}</div>}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
```

`src/components/common/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Icon aria-hidden className="mb-3 size-10 text-muted-foreground" />
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
```

`src/components/common/StatusPill.tsx`:

```tsx
import { cn } from '@/lib/utils'

export type StatusValue = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'UNREAD' | 'READ'

const STATUS: Record<StatusValue, { label: string; className: string }> = {
  PUBLISHED: { label: 'Published', className: 'bg-status-published-bg text-status-published-fg' },
  DRAFT: { label: 'Draft', className: 'bg-status-draft-bg text-status-draft-fg' },
  ARCHIVED: { label: 'Archived', className: 'bg-status-archived-bg text-status-archived-fg' },
  UNREAD: { label: 'New', className: 'bg-status-unread-bg text-status-unread-fg' },
  READ: { label: 'Read', className: 'bg-status-archived-bg text-status-archived-fg' },
}

interface StatusPillProps {
  status: StatusValue
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  const { label, className: tone } = STATUS[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tone, className)}>
      {label}
    </span>
  )
}
```

`src/components/common/ConfirmDialog.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** When set, the user must type this exact text before confirming. */
  confirmText?: string
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({ open, onOpenChange, ...rest }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the typed text resets on every open. */}
      <AlertDialogContent>
        <ConfirmBody {...rest} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ConfirmBody({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  confirmText,
  pending = false,
  onConfirm,
}: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>) {
  const [typed, setTyped] = useState('')
  const locked = confirmText !== undefined && typed !== confirmText

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="font-serif text-xl">{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {confirmText !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="confirm-text">
            Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
          </Label>
          <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button variant={destructive ? 'destructive' : 'default'} disabled={locked || pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
```

- [ ] **Step 8: Implement the placeholder screens**

`src/features/inbox/pages/InboxPlaceholder.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

export function InboxPlaceholder() {
  return (
    <>
      <PageHeader title="Inbox" description="Messages sent through your forms." />
      <EmptyState
        icon={Inbox}
        title="The unified inbox is coming"
        description="For now, open a form to read its submissions."
        action={<Button asChild><Link to="/forms">Go to forms</Link></Button>}
      />
    </>
  )
}
```

`src/features/webhooks/pages/WebhooksPlaceholder.tsx`:

```tsx
import { Webhook } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'

export function WebhooksPlaceholder() {
  return (
    <>
      <PageHeader title="Webhooks" description="Notify other services when content changes." />
      <EmptyState
        icon={Webhook}
        title="Webhook management is coming"
        description="Webhooks already work through the API. A screen to manage them arrives in a later update."
      />
    </>
  )
}
```

- [ ] **Step 9: Implement `src/modules/registry.tsx`**

Legacy MUI pages stay on their old URLs so their internal links keep working; each module's canonical `path` renders the same legacy list page.

```tsx
import {
  Boxes,
  ClipboardList,
  FileText,
  House,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Plus,
  Upload,
  Webhook,
} from 'lucide-react'
import type { AppModule, CreateAction } from './types'
import { useUnreadCount } from '@/lib/queries/stats'
import { Dashboard } from '@/pages/Dashboard'
import { ContentEntriesList } from '@/pages/ContentEntries/ContentEntriesList'
import { ContentEntryForm } from '@/pages/ContentEntries/ContentEntryForm'
import { MediaLibrary } from '@/pages/Media/MediaLibrary'
import { ContentTypesList } from '@/pages/ContentTypes/ContentTypesList'
import { ContentTypeForm } from '@/pages/ContentTypes/ContentTypeForm'
import { ContactFormsList } from '@/pages/ContactForms/ContactFormsList'
import { ContactFormForm } from '@/pages/ContactForms/ContactFormForm'
import { SubmissionsList } from '@/pages/ContactForms/SubmissionsList'
import { SitesList } from '@/pages/Sites/SitesList'
import { SiteForm } from '@/pages/Sites/SiteForm'
import { InboxPlaceholder } from '@/features/inbox/pages/InboxPlaceholder'
import { WebhooksPlaceholder } from '@/features/webhooks/pages/WebhooksPlaceholder'

export const modules: AppModule[] = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    group: 'workspace',
    path: '/',
    mobileTab: true,
    routes: [{ index: true, element: <Dashboard /> }],
  },
  {
    id: 'content',
    label: 'Content',
    icon: FileText,
    group: 'workspace',
    path: '/content',
    matches: ['/entries'],
    mobileTab: true,
    routes: [
      { path: 'content', element: <ContentEntriesList /> },
      { path: 'entries', element: <ContentEntriesList /> },
      { path: 'entries/new', element: <ContentEntryForm /> },
      { path: 'entries/:id/edit', element: <ContentEntryForm /> },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    icon: ImageIcon,
    group: 'workspace',
    path: '/media',
    mobileTab: true,
    routes: [{ path: 'media', element: <MediaLibrary /> }],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: Inbox,
    group: 'workspace',
    path: '/inbox',
    mobileTab: true,
    useBadge: useUnreadCount,
    routes: [{ path: 'inbox', element: <InboxPlaceholder /> }],
  },
  {
    id: 'models',
    label: 'Content models',
    icon: Boxes,
    group: 'setup',
    path: '/models',
    matches: ['/content-types'],
    routes: [
      { path: 'models', element: <ContentTypesList /> },
      { path: 'content-types', element: <ContentTypesList /> },
      { path: 'content-types/new', element: <ContentTypeForm /> },
      { path: 'content-types/:id/edit', element: <ContentTypeForm /> },
    ],
  },
  {
    id: 'forms',
    label: 'Forms',
    icon: ClipboardList,
    group: 'setup',
    path: '/forms',
    matches: ['/contact-forms'],
    routes: [
      { path: 'forms', element: <ContactFormsList /> },
      { path: 'contact-forms', element: <ContactFormsList /> },
      { path: 'contact-forms/new', element: <ContactFormForm /> },
      { path: 'contact-forms/:id/edit', element: <ContactFormForm /> },
      { path: 'contact-forms/:formId/submissions', element: <SubmissionsList /> },
    ],
  },
  {
    id: 'sites',
    label: 'Sites & API keys',
    icon: KeyRound,
    group: 'setup',
    path: '/sites',
    routes: [
      { path: 'sites', element: <SitesList /> },
      { path: 'sites/new', element: <SiteForm /> },
      { path: 'sites/:id/edit', element: <SiteForm /> },
    ],
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: Webhook,
    group: 'setup',
    path: '/webhooks',
    routes: [{ path: 'webhooks', element: <WebhooksPlaceholder /> }],
  },
]

export const createActions: CreateAction[] = [
  { id: 'new-entry', label: 'New entry', to: '/content', icon: Plus },
  { id: 'upload-media', label: 'Upload media', to: '/media', icon: Upload },
]
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd packages/admin-dashboard && pnpm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/admin-dashboard/src
git commit -m "feat(admin): add module registry, nav helpers and shared components"
```

---

## Task 9: App shell (sidebar, mobile tabs, top bar, user menu, command palette, sign-in)

**Files:**
- Create: `src/app/shell/command-palette-context.ts`, `CommandPalette.tsx`, `UserMenu.tsx`, `Sidebar.tsx`, `MobileTabs.tsx`, `TopBar.tsx`, `SignInScreen.tsx`, `ShellSkeleton.tsx`, `AppShell.tsx`
- Modify: `src/App.tsx`
- Delete: `src/components/Layout.tsx`, `src/components/Logo.tsx` (after confirming no other importers)
- Test: `src/app/shell/shell.test.tsx`

**Interfaces:**
- Consumes: registry and nav helpers (Task 8), `useTheme` (Task 7), `useAuth` from `src/contexts/AuthContext.tsx` (`{ user: { name, email } | null, login, logout, isAuthenticated, isLoading }`), shadcn components.
- Produces: `<CommandPaletteProvider modules actions>`, `useCommandPalette() => { open, setOpen }`, `<Sidebar modules>`, `<MobileTabs modules actions>`, `<TopBar modules>`, `<UserMenu variant setupModules?>`, `<AppShell>` (route element with `<Outlet/>`).

- [ ] **Step 1: Write failing tests `src/app/shell/shell.test.tsx`**

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Boxes, FileText, House, Image as ImageIcon, Inbox, Plus } from 'lucide-react'
import { renderWithProviders } from '@/test/render'
import type { AppModule, CreateAction } from '@/modules/types'
import { Sidebar } from './Sidebar'
import { MobileTabs } from './MobileTabs'
import { CommandPaletteProvider } from './CommandPalette'
import { AppShell } from './AppShell'

const auth = vi.hoisted(() => ({
  value: {
    user: { name: 'Pavel Flajsman', email: 'pavel@example.com' } as { name: string; email: string } | null,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  },
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }))

const testModules: AppModule[] = [
  { id: 'home', label: 'Home', icon: House, group: 'workspace', path: '/', mobileTab: true, routes: [] },
  { id: 'content', label: 'Content', icon: FileText, group: 'workspace', path: '/content', matches: ['/entries'], mobileTab: true, routes: [] },
  { id: 'media', label: 'Media', icon: ImageIcon, group: 'workspace', path: '/media', mobileTab: true, routes: [] },
  { id: 'inbox', label: 'Inbox', icon: Inbox, group: 'workspace', path: '/inbox', mobileTab: true, useBadge: () => 3, routes: [] },
  { id: 'models', label: 'Content models', icon: Boxes, group: 'setup', path: '/models', matches: ['/content-types'], routes: [] },
]
const testActions: CreateAction[] = [{ id: 'new-entry', label: 'New entry', to: '/content', icon: Plus }]

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

function withPalette(ui: React.ReactElement) {
  return (
    <CommandPaletteProvider modules={testModules} actions={testActions}>
      {ui}
      <Routes><Route path="*" element={<LocationProbe />} /></Routes>
    </CommandPaletteProvider>
  )
}

beforeEach(() => {
  auth.value = { ...auth.value, isAuthenticated: true, isLoading: false }
})

describe('Sidebar', () => {
  it('renders Workspace and Setup groups', () => {
    renderWithProviders(withPalette(<Sidebar modules={testModules} />))
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByText('Workspace')).toBeInTheDocument()
    expect(within(nav).getByText('Setup')).toBeInTheDocument()
  })

  it('marks Content models active on a legacy /content-types URL, not Content', () => {
    renderWithProviders(withPalette(<Sidebar modules={testModules} />), { route: '/content-types/new' })
    expect(screen.getByRole('link', { name: /Content models/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /^Content$/ })).not.toHaveAttribute('aria-current')
  })

  it('shows the unread badge', () => {
    renderWithProviders(withPalette(<Sidebar modules={testModules} />))
    expect(screen.getByRole('link', { name: /Inbox/ })).toHaveTextContent('3')
  })
})

describe('MobileTabs', () => {
  it('renders the four tabs and a create button', () => {
    renderWithProviders(withPalette(<MobileTabs modules={testModules} actions={testActions} />), { route: '/media' })
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    expect(within(nav).getByRole('link', { name: /Media/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})

describe('Command palette', () => {
  it('opens with Ctrl+K and navigates to a module', async () => {
    const user = userEvent.setup()
    renderWithProviders(withPalette(<div />))
    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByPlaceholderText('Search or jump to…')
    await user.type(input, 'Content models')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('location')).toHaveTextContent('/models')
  })
})

describe('AppShell', () => {
  it('shows a skeleton while auth is loading', () => {
    auth.value = { ...auth.value, isLoading: true }
    renderWithProviders(<AppShell />)
    expect(screen.getByLabelText('Loading TheCMS')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the sign-in screen when signed out', async () => {
    auth.value = { ...auth.value, isAuthenticated: false }
    renderWithProviders(<AppShell />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.value.login).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- shell`
Expected: FAIL, missing `./Sidebar`, `./MobileTabs`, `./CommandPalette`, `./AppShell`.

- [ ] **Step 3: Implement `command-palette-context.ts`**

```ts
import { createContext, useContext } from 'react'

interface CommandPaletteContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext)
  if (!context) throw new Error('useCommandPalette must be used inside CommandPaletteProvider')
  return context
}
```

- [ ] **Step 4: Implement `CommandPalette.tsx`**

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { AppModule, CreateAction } from '@/modules/types'
import { CommandPaletteContext } from './command-palette-context'

interface ProviderProps {
  modules: AppModule[]
  actions: CreateAction[]
  children: ReactNode
}

export function CommandPaletteProvider({ modules, actions, children }: ProviderProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen }), [open])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search or jump to a page or action">
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Go to">
            {modules.map((m) => (
              <CommandItem key={m.id} value={m.label} onSelect={() => go(m.path)}>
                <m.icon aria-hidden />
                {m.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Create">
            {actions.map((a) => (
              <CommandItem key={a.id} value={a.label} onSelect={() => go(a.to)}>
                <a.icon aria-hidden />
                {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  )
}
```

If the generated `CommandDialog` does not accept `title` and `description` props, remove them; it then renders its own visually hidden title.

- [ ] **Step 5: Implement `UserMenu.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/app/theme/useTheme'
import type { ThemePreference } from '@/app/theme/theme-utils'
import type { AppModule } from '@/modules/types'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface UserMenuProps {
  variant: 'sidebar' | 'compact'
  /** Setup modules listed in the menu (used on mobile, where the sidebar is hidden). */
  setupModules?: AppModule[]
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function UserMenu({ variant, setupModules }: UserMenuProps) {
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()
  const name = user?.name || user?.email || 'Account'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'sidebar' && 'w-full rounded-lg border-t border-sidebar-border px-2 pt-3',
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">{getInitials(user?.name)}</AvatarFallback>
        </Avatar>
        {variant === 'sidebar' && <span className="hidden min-w-0 flex-1 truncate text-sm lg:inline">{name}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-medium">{name}</div>
          {user?.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
        </DropdownMenuLabel>
        {setupModules && setupModules.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Setup</DropdownMenuLabel>
            {setupModules.map((m) => (
              <DropdownMenuItem key={m.id} asChild>
                <Link to={m.path}>
                  <m.icon aria-hidden />
                  {m.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.value} value={t.value}>
              <t.icon aria-hidden className="size-4" />
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 6: Implement `Sidebar.tsx`**

```tsx
import { Link, useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { AppModule } from '@/modules/types'
import { groupModules, isModuleActive } from '@/modules/nav'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/common/Logo'
import { useCommandPalette } from './command-palette-context'
import { UserMenu } from './UserMenu'

interface SidebarProps {
  modules: AppModule[]
}

export function Sidebar({ modules }: SidebarProps) {
  const { pathname } = useLocation()
  const { setOpen } = useCommandPalette()
  const { workspace, setup } = groupModules(modules)

  return (
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col bg-sidebar px-2 py-4 text-sidebar-foreground md:flex lg:w-60 lg:px-3">
      <Link to="/" className="mb-4 flex items-center gap-2 px-2 text-foreground">
        <Logo />
        <span className="hidden font-serif text-lg font-semibold lg:inline">TheCMS</span>
      </Link>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search or jump to"
        className="mb-3 flex items-center justify-center gap-2 rounded-full border border-sidebar-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent lg:justify-start"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left lg:inline">Search or jump…</span>
        <kbd className="hidden text-xs lg:inline">⌘K</kbd>
      </button>
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-5 overflow-y-auto">
        <NavGroup label="Workspace" modules={workspace} pathname={pathname} />
        <NavGroup label="Setup" modules={setup} pathname={pathname} />
      </nav>
      <UserMenu variant="sidebar" />
    </aside>
  )
}

function NavGroup({ label, modules, pathname }: { label: string; modules: AppModule[]; pathname: string }) {
  if (modules.length === 0) return null
  return (
    <div>
      <p className="mb-1 hidden px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:block">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {modules.map((m) => (
          <li key={m.id}>
            <NavItem module={m} active={isModuleActive(m, pathname)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavItem({ module, active }: { module: AppModule; active: boolean }) {
  const Icon = module.icon
  return (
    <Link
      to={module.path}
      aria-current={active ? 'page' : undefined}
      title={module.label}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
        active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="hidden flex-1 lg:inline">{module.label}</span>
      {module.useBadge && <NavBadge useCount={module.useBadge} />}
    </Link>
  )
}

function NavBadge({ useCount }: { useCount: () => number | undefined }) {
  const count = useCount()
  if (!count) return null
  return (
    <span className="rounded-full bg-status-unread-fg px-1.5 text-[10px] font-semibold leading-4 text-background">
      {count > 99 ? '99+' : count}
    </span>
  )
}
```

- [ ] **Step 7: Implement `MobileTabs.tsx`**

```tsx
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { AppModule, CreateAction } from '@/modules/types'
import { isModuleActive, mobileTabModules } from '@/modules/nav'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MobileTabsProps {
  modules: AppModule[]
  actions: CreateAction[]
}

export function MobileTabs({ modules, actions }: MobileTabsProps) {
  const { pathname } = useLocation()
  const tabs = mobileTabModules(modules)
  const middle = Math.ceil(tabs.length / 2)

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.slice(0, middle).map((m) => (
        <Tab key={m.id} module={m} active={isModuleActive(m, pathname)} />
      ))}
      <CreateMenu actions={actions} />
      {tabs.slice(middle).map((m) => (
        <Tab key={m.id} module={m} active={isModuleActive(m, pathname)} />
      ))}
    </nav>
  )
}

function Tab({ module, active }: { module: AppModule; active: boolean }) {
  const Icon = module.icon
  return (
    <Link
      to={module.path}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]',
        active ? 'font-semibold text-foreground' : 'text-sidebar-foreground',
      )}
    >
      <Icon aria-hidden className="size-5" />
      {module.label}
      {module.useBadge && <TabDot useCount={module.useBadge} />}
    </Link>
  )
}

function TabDot({ useCount }: { useCount: () => number | undefined }) {
  const count = useCount()
  if (!count) return null
  return (
    <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-status-unread-fg px-1 text-[10px] leading-4 text-background">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function CreateMenu({ actions }: { actions: CreateAction[] }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-1 justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Create"
          className="-mt-5 mb-2 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="w-48">
          {actions.map((a) => (
            <DropdownMenuItem key={a.id} onSelect={() => navigate(a.to)}>
              <a.icon aria-hidden />
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

- [ ] **Step 8: Implement `TopBar.tsx`, `SignInScreen.tsx`, `ShellSkeleton.tsx`**

`TopBar.tsx`:

```tsx
import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { AppModule } from '@/modules/types'
import { findActiveModule, groupModules } from '@/modules/nav'
import { Button } from '@/components/ui/button'
import { useCommandPalette } from './command-palette-context'
import { UserMenu } from './UserMenu'

export function TopBar({ modules }: { modules: AppModule[] }) {
  const { pathname } = useLocation()
  const { setOpen } = useCommandPalette()
  const active = findActiveModule(modules, pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <span className="flex-1 truncate font-serif text-lg font-semibold">{active?.label ?? 'TheCMS'}</span>
      <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setOpen(true)}>
        <Search aria-hidden />
      </Button>
      <UserMenu variant="compact" setupModules={groupModules(modules).setup} />
    </header>
  )
}
```

`SignInScreen.tsx`:

```tsx
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common/Logo'

export function SignInScreen() {
  const { login } = useAuth()
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center"><Logo size={56} /></div>
        <h1 className="font-serif text-3xl font-semibold">Welcome to TheCMS</h1>
        <p className="mt-2 text-muted-foreground">Sign in to manage your content.</p>
        <Button className="mt-6 w-full" size="lg" onClick={login}>Sign in</Button>
      </div>
    </main>
  )
}
```

`ShellSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading TheCMS" className="flex min-h-dvh bg-background">
      <div className="hidden w-60 flex-col gap-3 bg-sidebar p-4 md:flex">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-full rounded-full" />
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
      <div className="flex-1 space-y-4 p-6 md:p-8">
        <Skeleton className="h-9 w-48" />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Implement `AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createActions, modules } from '@/modules/registry'
import { CommandPaletteProvider } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileTabs } from './MobileTabs'
import { SignInScreen } from './SignInScreen'
import { ShellSkeleton } from './ShellSkeleton'

export function AppShell() {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) return <ShellSkeleton />
  if (!isAuthenticated) return <SignInScreen />

  return (
    <CommandPaletteProvider modules={modules} actions={createActions}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-background text-foreground">
        <Sidebar modules={modules} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar modules={modules} />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
            <Outlet />
          </main>
        </div>
        <MobileTabs modules={modules} actions={createActions} />
      </div>
    </CommandPaletteProvider>
  )
}
```

- [ ] **Step 10: Run the shell tests**

Run: `cd packages/admin-dashboard && pnpm test -- shell`
Expected: PASS. If the Radix dropdown in `MobileTabs` needs pointer APIs missing in jsdom, the stubs in `src/test/setup.ts` cover `hasPointerCapture` and `scrollIntoView`; add `Element.prototype.releasePointerCapture ??= () => {}` there if a test reports it missing.

- [ ] **Step 11: Rewrite `src/App.tsx` with registry-driven routes**

Keep the MSAL setup exactly as it is today. Keep MUI's `ThemeProvider` for legacy pages, but drop `CssBaseline` and the black `MuiAppBar`/`MuiButton` overrides. Full file:

```tsx
import { BrowserRouter, Navigate, useRoutes, type RouteObject } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { AuthProvider } from './contexts/AuthContext'
import { msalConfig, isEntraConfigured } from './config/msalConfig'
import { setMsalInstance } from './lib/api'
import { ThemeProvider } from './app/theme/ThemeProvider'
import { AppShell } from './app/shell/AppShell'
import { Toaster } from './components/ui/sonner'
import { collectRoutes } from './modules/nav'
import { modules } from './modules/registry'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Legacy MUI pages only. Removed in Plan 5 together with MUI.
const legacyMuiTheme = createTheme({
  palette: {
    primary: { main: '#1f6f5c' },
    background: { default: 'transparent', paper: '#ffffff' },
  },
  shape: { borderRadius: 10 },
})

// Initialize MSAL instance only when Entra is configured
let msalInstance: PublicClientApplication | undefined
if (isEntraConfigured()) {
  msalInstance = new PublicClientApplication(msalConfig)

  // Set the active account after login
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account: any }
      msalInstance!.setActiveAccount(payload.account)
    }
  })

  // Share MSAL instance with the API client
  setMsalInstance(msalInstance)
}

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...collectRoutes(modules), { path: '*', element: <Navigate to="/" replace /> }],
  },
]

function AppRoutes() {
  return useRoutes(routes)
}

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MuiThemeProvider theme={legacyMuiTheme}>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            <Toaster position="bottom-right" />
          </AuthProvider>
        </MuiThemeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function App() {
  if (isEntraConfigured() && msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <AppContent />
      </MsalProvider>
    )
  }
  return <AppContent />
}

export default App
```

Note: the legacy MUI palette color `#1f6f5c` is the one allowed hard-coded value, because MUI cannot read CSS variables in `createTheme` here; it disappears with MUI in Plan 5.

- [ ] **Step 12: Remove the old layout**

```bash
cd /Users/pavelflajsman/personalGit/thecms/packages/admin-dashboard
grep -rn "components/Layout\|components/Logo\|from './Logo'\|from '../components/Logo'" src
```

Expected: no matches outside `src/components/Layout.tsx` itself. Then delete `src/components/Layout.tsx` and `src/components/Logo.tsx`. If another file imports the old `Logo`, switch it to `@/components/common/Logo` first.

- [ ] **Step 13: Run all checks**

Run: `cd packages/admin-dashboard && pnpm test && pnpm build && pnpm lint`
Expected: all tests PASS, build succeeds, no lint errors.

If `eslint-plugin-react-hooks` v7 reports an error for passing a hook as a value (`useBadge: useUnreadCount` in `registry.tsx`, or `useCount` in `Sidebar.tsx` / `MobileTabs.tsx`), add `// eslint-disable-next-line react-hooks/<rule name from the lint output>` on the reported line with the comment `-- badge hook is stable per module`. Do not restructure the badge API.

- [ ] **Step 14: Commit**

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): new app shell with registry-driven navigation and command palette"
```

---

## Task 10: End-to-end verification in the running app

**Files:** none unless a defect is found (fix it in the owning task's files and commit separately).

- [ ] **Step 1: Start the stack**

```bash
cd /Users/pavelflajsman/personalGit/thecms
docker compose up -d mongodb azurite
```

If Docker Compose fails because `./scripts/mongo-init.js` does not exist, create an empty `scripts/mongo-init.js` (a comment line only) and retry; mention it in the task report.

Then in two terminals:

```bash
pnpm --filter @thecms/backend dev
pnpm --filter admin-dashboard dev
```

- [ ] **Step 2: Backfill titles for existing data**

```bash
pnpm --filter @thecms/backend backfill:titles
```

Expected: `Backfilled titles: N entries across M content types`.

- [ ] **Step 3: Check the new endpoints**

With the dev token from `packages/admin-dashboard/src/contexts/AuthContext.tsx` (`DEFAULT_TOKEN`):

```bash
TOKEN='<DEFAULT_TOKEN value>'
curl -s -H "Authorization: Bearer $TOKEN" 'http://localhost:3000/api/v1/entries?limit=3' | head -c 600; echo
curl -s -H "Authorization: Bearer $TOKEN" 'http://localhost:3000/api/v1/stats'; echo
```

Expected: entries with `title` and `contentType`; stats JSON.

- [ ] **Step 4: Check the UI (use the `run` skill or a browser)**

At http://localhost:5173 (or the port Vite prints), confirm each item and note the result:

1. Desktop (1280px): sidebar shows Workspace (Home, Content, Media, Inbox) and Setup (Content models, Forms, Sites & API keys, Webhooks); every item opens a page.
2. Legacy pages render and their internal links work: open Content, choose a type, open an entry, go back; open Content models, create form, back.
3. Active state: on `/content-types/new` only "Content models" is highlighted.
4. Medium width (900px): sidebar collapses to icons; names show as tooltips on hover.
5. Phone (360px): no horizontal scroll on Home, Content, Media; bottom tabs visible; **+** opens New entry and Upload media; avatar menu lists Setup pages and theme options.
6. ⌘K / Ctrl+K opens the palette; typing "forms" and Enter goes to Forms.
7. Theme: switch Light, Dark, System in the avatar menu; reload keeps the choice without a flash of the wrong theme.
8. Inbox badge shows the unread count when there are unread submissions.

- [ ] **Step 5: Check the example site still works**

```bash
pnpm --filter blog-flajsman dev
```

Open it and confirm posts, trips, a trip map, About and the contact form still load.

- [ ] **Step 6: Record the result**

Append a short "Plan 1 verification" section to `TEST_RESULTS.md` listing the checks above with pass or fail, then commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record Plan 1 verification results"
```

---

## Self-Review Notes

- **Spec coverage (Plan 1 scope):** 7.1 → Task 4; 7.2 → Tasks 2 and 3; 7.3 → Task 5; 7.4 → Task 6; section 3 visual system → Task 7; section 4 module registry, desktop shell, mobile shell, command palette, old-URL compatibility → Tasks 8 and 9; 5.10 sign-in and skeleton → Task 9; section 6 toasts (mounted), confirmation dialog, empty states, skip link, reduced motion → Tasks 7 to 9; section 10 testing harnesses → Tasks 1 and 7. Deferred by design: route-map renames of detail pages (`/content/:id`, `/models/:id`, and so on) and redirects move to the plans that rebuild those screens; ⌘K entry search moves to Plan 2 (needs the Content feature's query hooks).
- **Type consistency:** `DashboardStats` is identical in backend Task 5 and frontend Task 8; `EntryListItem.contentType` is `{ id, name, slug } | null` in Task 4; `AppModule` fields used in Task 9 tests match Task 8.
