# Content Language Versions, Plan 1: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The backend stores entries as language versions of an item, migrates existing entries to English on startup, serves version and language admin endpoints, keeps shared fields in sync, and lets the public API pick a language with fallback to the default.

**Architecture:** A new `languages` module holds the configured languages. The existing `contententries` collection gains `language` and `itemId`; a startup migration fills them for existing documents. A small `entry-versions` service owns version creation, language changes and shared-field sync. The public API uses a plain `find` when the default language is requested (unchanged behaviour) and one aggregation that picks a version per item otherwise.

**Tech Stack:** Express, Mongoose 6, Zod, Jest, mongodb-memory-server, supertest.

**Spec:** `docs/superpowers/specs/2026-09-30-content-language-versions-design.md`

**Series:** Plan 1 of 2. Plan 2 covers the admin UI and the example site.

## Global Constraints

- Public API changes are additive: existing fields and existing behaviour without `language` stay the same.
- Admin API changes are additive; errors keep the `{ success: false, error, details? }` shape (use `AppError(message, status)` from `middleware/error.middleware.ts`).
- Language codes match `^[a-z]{2,3}(-[a-z0-9]{2,8})?$`. Exactly one default language.
- Every `find` sort must be served by a single-field index (Azure Cosmos DB rule); `src/test/cosmos-sort-indexes.test.ts` checks the admin lists.
- Existing entry ids keep working everywhere (they become item ids).
- Never use an em dash in code comments or docs.

## Decisions (deviations from the spec, for the reviewer)

1. **No unique database index on `{ itemId, language }`.** Azure Cosmos DB for MongoDB only creates unique indexes on empty collections, and `contententries` is not empty in production. The service checks for an existing version before creating or moving one and returns `409`. A compound non-unique index is not added either (no query sorts on it); lookups use the single-field `itemId` and `language` indexes.
2. **Relation existence is not validated** (spec 3.4 "validation checks that the item exists"). Entry validation is synchronous today and never checked relation targets; adding async validation is outside this plan. Stored relation ids stay valid because existing entry ids become item ids.
3. **Public search** filters to the requested and default languages and keeps one version per item within the returned page; its total counts matching versions. Search relies on a MongoDB text index that Cosmos DB does not support, so it is not a production path today.
4. **`missing=<code>`** lists the default-language versions of items that have no version in `<code>` (items whose only versions are in other non-default languages are not listed).

## Review Focus

1. **Backend restarted twice** (migration runs on every startup): the second run changes nothing and existing ids still resolve. Tested in Task 2.
2. **An item with a published English version and a draft Czech version**, requested with `language=cs`: returns the English version with `fallback: true`. Tested in Task 6.
3. **Paging with mixed coverage** (some items only in the default language): `total` and page sizes count items, not versions. Tested in Task 6.
4. **Editing a shared field in the Czech version** updates the English version, including its title when the title field is shared. Tested in Task 3.
5. **Deleting the default language, the last language, or with a wrong confirmation** is rejected and deletes nothing. Tested in Task 1.

---

## File Structure

All paths relative to `packages/backend/src`.

| File | Responsibility |
|---|---|
| `models/language.model.ts` | Language schema (`code`, `name`, `isDefault`, `order`) |
| `modules/languages/languages.service.ts` | List, default code, assert exists, create, rename, make default, delete |
| `modules/languages/languages.schema.ts`, `languages.controller.ts`, `languages.routes.ts` | Admin endpoints under `/languages` |
| `modules/languages/languages.test.ts` | Tests |
| `models/content-entry.model.ts` | Adds `language`, `itemId` |
| `utils/migrate-languages.ts`, `scripts/migrate-languages.ts` | Startup migration and manual script |
| `types/field-types.ts`, `models/content-type.model.ts`, `modules/content-types/content-types.schema.ts` | Field `localized` flag |
| `utils/localized.ts` | `isLocalized(field)`, `sharedFieldNames(fields)` |
| `modules/content-entries/entry-versions.service.ts` | Versions list/create, change language, shared-field sync, unify a field turned shared |
| `modules/content-entries/*` | Create with language, update syncs shared fields, list filters, new routes |
| `modules/content-types/content-types.service.ts` | Unify fields turned shared on update |
| `modules/stats/stats.service.ts` | Counts items |
| `modules/public/public-content.service.ts`, `public.controller.ts` | Language resolution and fallback |

---

## Task 1: Languages module

**Files:**
- Create: `models/language.model.ts`, `modules/languages/{languages.service,languages.schema,languages.controller,languages.routes}.ts`
- Modify: `routes/index.ts` (mount `/languages`)
- Test: `modules/languages/languages.test.ts`

**Interfaces:**
- Produces:
  - `LANGUAGE_CODE: RegExp`, `LanguageModel`, `ILanguage { code; name; isDefault; order }`.
  - `LanguagesService.list(): Promise<ILanguage[]>` (by `order`), `defaultCode(): Promise<string>` (`'en'` when none), `codes(): Promise<string[]>`, `assertExists(code): Promise<void>` (throws `AppError` 400 "Unknown language 'xx'. Use one of: en, cs"), `create({ code, name })`, `rename(code, name)`, `makeDefault(code)`, `remove(code, confirm)`.
  - Routes: `GET /languages`, `POST /languages`, `PUT /languages/:code`, `PUT /languages/:code/default`, `DELETE /languages/:code?confirm=<code>`, all behind `authMiddleware`.

- [ ] **Step 1: Write the failing test** `modules/languages/languages.test.ts`

```ts
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { ContentEntryModel } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { FieldType } from '../../types/field-types';
import languagesRoutes from './languages.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/languages', languagesRoutes);
app.use(errorMiddleware);

it('creates languages, keeps exactly one default and lists them in order', async () => {
  const en = await request(app).post('/languages').send({ code: 'en', name: 'English' });
  expect(en.status).toBe(201);
  expect(en.body.data).toMatchObject({ code: 'en', isDefault: true, order: 0 });
  const cs = await request(app).post('/languages').send({ code: 'cs', name: 'Čeština' });
  expect(cs.body.data).toMatchObject({ code: 'cs', isDefault: false, order: 1 });
  expect((await request(app).post('/languages').send({ code: 'cs', name: 'Again' })).status).toBe(409);
  expect((await request(app).post('/languages').send({ code: 'Czech!', name: 'x' })).status).toBe(400);

  await request(app).put('/languages/cs/default');
  const list = await request(app).get('/languages');
  expect(list.body.data.map((l: { code: string; isDefault: boolean }) => [l.code, l.isDefault])).toEqual([['en', false], ['cs', true]]);

  const renamed = await request(app).put('/languages/en').send({ name: 'Angličtina' });
  expect(renamed.body.data.name).toBe('Angličtina');
});

it('guards deletion and removes the language versions', async () => {
  await request(app).post('/languages').send({ code: 'en', name: 'English' });
  await request(app).post('/languages').send({ code: 'de', name: 'Deutsch' });
  const type = await ContentTypeModel.create({ name: 'Post', slug: 'post', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }] });
  const itemId = new (await import('mongoose')).default.Types.ObjectId();
  await ContentEntryModel.create([
    { _id: itemId, itemId, language: 'en', contentTypeId: type._id, data: { title: 'Hi' } },
    { itemId, language: 'de', contentTypeId: type._id, data: { title: 'Hallo' } },
  ]);

  expect((await request(app).delete('/languages/en?confirm=en')).status).toBe(409);
  expect((await request(app).delete('/languages/de?confirm=DE')).status).toBe(400);
  expect(await ContentEntryModel.countDocuments({ language: 'de' })).toBe(1);

  const ok = await request(app).delete('/languages/de?confirm=de');
  expect(ok.status).toBe(200);
  expect(ok.body.data).toEqual({ deletedVersions: 1 });
  expect(await ContentEntryModel.countDocuments({ language: 'de' })).toBe(0);
  expect((await request(app).delete('/languages/en?confirm=en')).status).toBe(409);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- languages.test`
Expected: FAIL, cannot find `./languages.routes`.

- [ ] **Step 3: Implement**

`models/language.model.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

export interface ILanguage extends Document {
  code: string;
  name: string;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const LanguageSchema = new Schema<ILanguage>(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true, match: LANGUAGE_CODE },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    isDefault: { type: Boolean, default: false, index: true },
    // Lists sort by order; Cosmos DB needs an index for every sort.
    order: { type: Number, default: 0, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id.toString(), ...rest };
      },
    },
  }
);

export const LanguageModel = mongoose.model<ILanguage>('Language', LanguageSchema);
```

(The unique index on `code` is safe on Cosmos DB because the collection is new and empty when the index is created.)

`modules/languages/languages.service.ts`:

```ts
import { LanguageModel, type ILanguage } from '../../models/language.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { AppError } from '../../middleware/error.middleware';

export class LanguagesService {
  static list(): Promise<ILanguage[]> {
    return LanguageModel.find().sort({ order: 1 }).exec();
  }

  static async codes(): Promise<string[]> {
    return (await LanguageModel.find().select('code').lean()).map((l) => l.code);
  }

  static async defaultCode(): Promise<string> {
    const found = await LanguageModel.findOne({ isDefault: true }).select('code').lean();
    return found?.code ?? 'en';
  }

  static async assertExists(code: string): Promise<void> {
    // Before the startup migration runs (fresh test databases), English is the only language.
    const stored = await LanguagesService.codes();
    const codes = stored.length > 0 ? stored : ['en'];
    if (!codes.includes(code)) {
      throw new AppError(`Unknown language '${code}'. Use one of: ${codes.join(', ')}`, 400);
    }
  }

  static async create(input: { code: string; name: string }): Promise<ILanguage> {
    const code = input.code.toLowerCase();
    if (await LanguageModel.exists({ code })) throw new AppError(`Language '${code}' already exists`, 409);
    const count = await LanguageModel.countDocuments();
    return LanguageModel.create({ code, name: input.name, isDefault: count === 0, order: count });
  }

  static async rename(code: string, name: string): Promise<ILanguage> {
    const found = await LanguageModel.findOneAndUpdate({ code }, { $set: { name } }, { new: true });
    if (!found) throw new AppError('Language not found', 404);
    return found;
  }

  static async makeDefault(code: string): Promise<ILanguage> {
    const found = await LanguageModel.findOne({ code });
    if (!found) throw new AppError('Language not found', 404);
    await LanguageModel.updateMany({ code: { $ne: code } }, { $set: { isDefault: false } });
    found.isDefault = true;
    await found.save();
    return found;
  }

  static async remove(code: string, confirm?: string): Promise<{ deletedVersions: number }> {
    const found = await LanguageModel.findOne({ code });
    if (!found) throw new AppError('Language not found', 404);
    if (confirm !== code) throw new AppError(`Type ${code} to confirm`, 400);
    if (found.isDefault) throw new AppError('The default language cannot be deleted', 409);
    if ((await LanguageModel.countDocuments()) <= 1) throw new AppError('The last language cannot be deleted', 409);
    const { deletedCount } = await ContentEntryModel.deleteMany({ language: code });
    await found.deleteOne();
    return { deletedVersions: deletedCount ?? 0 };
  }
}
```

`modules/languages/languages.schema.ts`:

```ts
import { z } from 'zod';
import { LANGUAGE_CODE } from '../../models/language.model';

const code = z.string().trim().toLowerCase().regex(LANGUAGE_CODE, 'Use a language code such as en, cs or de-at');
const name = z.string().trim().min(1).max(50);

export const createLanguageSchema = z.object({ body: z.object({ code, name }) });
export const renameLanguageSchema = z.object({ params: z.object({ code }), body: z.object({ name }) });
export const languageCodeSchema = z.object({ params: z.object({ code }) });
export const deleteLanguageSchema = z.object({ params: z.object({ code }), query: z.object({ confirm: z.string().optional() }) });
```

`modules/languages/languages.controller.ts` (same style as other controllers):

```ts
import { Request, Response, NextFunction } from 'express';
import { LanguagesService } from './languages.service';

export const languagesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await LanguagesService.list() });
    } catch (error) {
      next(error);
    }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ success: true, data: await LanguagesService.create(req.body) });
    } catch (error) {
      next(error);
    }
  },
  async rename(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await LanguagesService.rename(req.params.code, req.body.name) });
    } catch (error) {
      next(error);
    }
  },
  async makeDefault(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await LanguagesService.makeDefault(req.params.code) });
    } catch (error) {
      next(error);
    }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await LanguagesService.remove(req.params.code, req.query.confirm as string | undefined) });
    } catch (error) {
      next(error);
    }
  },
};
```

`modules/languages/languages.routes.ts`:

```ts
import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { languagesController } from './languages.controller';
import { createLanguageSchema, deleteLanguageSchema, languageCodeSchema, renameLanguageSchema } from './languages.schema';

const router: IRouter = Router();

router.use(authMiddleware);
router.get('/', (req, res, next) => languagesController.list(req, res, next));
router.post('/', validate(createLanguageSchema), (req, res, next) => languagesController.create(req, res, next));
router.put('/:code', validate(renameLanguageSchema), (req, res, next) => languagesController.rename(req, res, next));
router.put('/:code/default', validate(languageCodeSchema), (req, res, next) => languagesController.makeDefault(req, res, next));
router.delete('/:code', validate(deleteLanguageSchema), (req, res, next) => languagesController.remove(req, res, next));

export default router;
```

(Check how `validate` returns 400 and whether it reads `params`/`query` in `middleware/validation.middleware.ts`; if it validates only `body`, validate `params` inside the controller with the same schemas. Ledger what you find.)

`routes/index.ts`: `import languagesRoutes from '../modules/languages/languages.routes';` and `router.use('/languages', languagesRoutes);`.

This task's test creates entries with `language`/`itemId`, which exist only after Task 2. Until then add the two fields to `models/content-entry.model.ts` as in Task 2 Step 3 (first bullet) in this task, and let Task 2 own the migration.

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS, build succeeds.

```bash
git add -A packages/backend
git commit -m "feat(backend): content languages module"
```

---

## Task 2: Entry language fields and startup migration

**Files:**
- Modify: `models/content-entry.model.ts`, `modules/content-entries/content-entries.service.ts` (`createEntry`, `CreateEntryData`), `modules/content-entries/content-entries.schema.ts` (create body `language`), `main.ts`, `package.json` (`migrate:languages`)
- Create: `utils/migrate-languages.ts`, `scripts/migrate-languages.ts`
- Test: `utils/migrate-languages.test.ts`, add to `modules/content-entries/list-all-entries.test.ts` or a new `modules/content-entries/entry-language.test.ts`

**Interfaces:**
- Consumes: `LanguagesService`, `LanguageModel` (Task 1).
- Produces:
  - `IContentEntry.language: string`, `IContentEntry.itemId: mongoose.Types.ObjectId`.
  - `migrateLanguages(): Promise<{ createdDefault: boolean; migratedEntries: number }>`.
  - `CreateEntryData.language?: string`, `CreateEntryData.itemId?: string` (Task 4 uses `itemId`).

- [ ] **Step 1: Write the failing tests**

`utils/migrate-languages.test.ts`:

```ts
import mongoose from 'mongoose';
import { useTestDb } from '../test/db';
import { ContentEntryModel } from '../models/content-entry.model';
import { LanguageModel } from '../models/language.model';
import { migrateLanguages } from './migrate-languages';

useTestDb();

it('creates English as default and assigns existing entries to it, keeping their ids', async () => {
  const typeId = new mongoose.Types.ObjectId();
  // Simulate pre-migration documents: no language, no itemId.
  const raw = await ContentEntryModel.collection.insertMany([
    { contentTypeId: typeId, data: { title: 'Přes Šumavu' }, title: 'Přes Šumavu', status: 'PUBLISHED' },
    { contentTypeId: typeId, data: { title: 'Krkonoše' }, title: 'Krkonoše', status: 'DRAFT' },
  ]);
  const ids = Object.values(raw.insertedIds).map(String);

  expect(await migrateLanguages()).toEqual({ createdDefault: true, migratedEntries: 2 });
  const langs = await LanguageModel.find().lean();
  expect(langs.map((l) => [l.code, l.isDefault])).toEqual([['en', true]]);
  const entries = await ContentEntryModel.find().lean();
  for (const e of entries) {
    expect(e.language).toBe('en');
    expect(String(e.itemId)).toBe(String(e._id));
  }
  expect(entries.map((e) => String(e._id)).sort()).toEqual(ids.sort());

  expect(await migrateLanguages()).toEqual({ createdDefault: false, migratedEntries: 0 });
});

it('uses the configured default when languages already exist', async () => {
  await LanguageModel.create({ code: 'cs', name: 'Čeština', isDefault: true, order: 0 });
  await ContentEntryModel.collection.insertOne({ contentTypeId: new mongoose.Types.ObjectId(), data: {}, title: 'X', status: 'DRAFT' });
  await migrateLanguages();
  expect((await ContentEntryModel.findOne().lean())?.language).toBe('cs');
});
```

`modules/content-entries/entry-language.test.ts`:

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { ContentTypeModel } from '../../models/content-type.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from './content-entries.service';

useTestDb();

async function setup() {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
  ]);
  return ContentTypeModel.create({ name: 'Trip', slug: 'trip', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }] });
}

it('creates entries in the default language with their own item id', async () => {
  const type = await setup();
  const entry = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Hi' } });
  expect(entry.language).toBe('en');
  expect(String(entry.itemId)).toBe(String(entry._id));
});

it('creates an entry in a requested language and rejects unknown ones', async () => {
  const type = await setup();
  const cs = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Ahoj' }, language: 'cs' });
  expect(cs.language).toBe('cs');
  await expect(ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: {}, language: 'de' })).rejects.toMatchObject({ statusCode: 400 });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- migrate-languages entry-language`
Expected: FAIL, missing module and missing fields.

- [ ] **Step 3: Implement**

- `models/content-entry.model.ts`: add to the interface `language: string; itemId: mongoose.Types.ObjectId;` and to the schema:

```ts
    // Content language of this version (see models/language.model.ts).
    language: { type: String, required: true, index: true, trim: true, lowercase: true },
    // Groups the language versions of one entry. Existing entries use their own _id.
    itemId: { type: Schema.Types.ObjectId, required: true, index: true },
```

- `utils/migrate-languages.ts`:

```ts
import { LanguageModel } from '../models/language.model';
import { ContentEntryModel } from '../models/content-entry.model';

/** Idempotent: creates English as the default language when none exist and assigns entries without a language. */
export async function migrateLanguages(): Promise<{ createdDefault: boolean; migratedEntries: number }> {
  let createdDefault = false;
  if ((await LanguageModel.countDocuments()) === 0) {
    await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
    createdDefault = true;
  }
  const defaultCode = (await LanguageModel.findOne({ isDefault: true }).select('code').lean())?.code ?? 'en';

  const pending = await ContentEntryModel.find({ $or: [{ language: { $exists: false } }, { itemId: { $exists: false } }] })
    .select('_id language')
    .lean();
  if (pending.length > 0) {
    await ContentEntryModel.bulkWrite(
      pending.map((e) => ({
        updateOne: { filter: { _id: e._id }, update: { $set: { language: e.language ?? defaultCode, itemId: e._id } } },
      }))
    );
  }
  return { createdDefault, migratedEntries: pending.length };
}
```

- `main.ts`: after `await connectDatabase();` add

```ts
    // Content languages: create the default language and assign existing entries (idempotent).
    const migration = await migrateLanguages();
    if (migration.createdDefault || migration.migratedEntries > 0) {
      console.log(`✅ Content languages migrated (default created: ${migration.createdDefault}, entries: ${migration.migratedEntries})`);
    }
```

- `scripts/migrate-languages.ts` (manual run, same pattern as `backfill-entry-titles.ts`): connect with `MONGODB_URI`, call `migrateLanguages()`, print the result, disconnect. `package.json`: `"migrate:languages": "tsx src/scripts/migrate-languages.ts"`.
- `createEntry`: add `language?: string; itemId?: string` to `CreateEntryData`; resolve `const language = entryData.language ?? (await LanguagesService.defaultCode())`, `await LanguagesService.assertExists(language)`; build the document with `const _id = new mongoose.Types.ObjectId()` and `itemId: entryData.itemId ?? _id`; when `entryData.itemId` is set and a version with that `itemId` and `language` exists, throw `new AppError('This language already exists for this entry', 409)`.
- Create body schema: add `language: z.string().regex(LANGUAGE_CODE).optional()`; pass it from the controller.
- Existing tests that create entries without languages keep passing because `assertExists` treats an empty `languages` collection as `['en']` (Task 1).

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS (all existing tests too), build succeeds.

```bash
git add -A packages/backend
git commit -m "feat(backend): entry language and item id with startup migration"
```

---

## Task 3: Translated and shared fields

**Files:**
- Modify: `types/field-types.ts`, `models/content-type.model.ts`, `modules/content-types/content-types.schema.ts`, `modules/content-types/content-types.service.ts` (`updateContentType`), `modules/content-entries/content-entries.service.ts` (`updateEntry`)
- Create: `utils/localized.ts`, `modules/content-entries/entry-versions.service.ts` (sync functions; Task 4 adds more)
- Test: `modules/content-entries/entry-versions.test.ts`

**Interfaces:**
- Produces:
  - `FieldDefinition.localized?: boolean`.
  - `isLocalized(field: Pick<FieldDefinition, 'type' | 'localized'>): boolean`, `sharedFieldNames(fields: FieldDefinition[]): string[]`.
  - `syncSharedFields(entry: IContentEntry, fields: FieldDefinition[], titleField?: string): Promise<void>`.
  - `unifySharedField(contentTypeId: string, fieldName: string): Promise<void>`.

- [ ] **Step 1: Write the failing test** `modules/content-entries/entry-versions.test.ts`

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import mongoose from 'mongoose';
import { useTestDb } from '../../test/db';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from './content-entries.service';
import { contentTypesService } from '../content-types/content-types.service';
import { isLocalized } from '../../utils/localized';

useTestDb();

const fields = [
  { name: 'title', label: 'Title', type: FieldType.TEXT, required: false },
  { name: 'km', label: 'Distance', type: FieldType.NUMBER, required: false },
];

async function twoVersions(titleShared = false) {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
  ]);
  const type = await ContentTypeModel.create({
    name: 'Trip', slug: 'trip', titleField: 'title',
    fields: titleShared ? [{ ...fields[0], localized: false }, fields[1]] : fields,
  });
  const en = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Over the hills', km: 10 } });
  const cs = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Přes kopce', km: 10 }, language: 'cs', itemId: String(en.itemId) });
  return { type, en, cs };
}

it('defaults: text and rich text are translated, other types are shared', () => {
  expect(isLocalized({ type: FieldType.TEXT })).toBe(true);
  expect(isLocalized({ type: FieldType.RICH_TEXT })).toBe(true);
  expect(isLocalized({ type: FieldType.NUMBER })).toBe(false);
  expect(isLocalized({ type: FieldType.TEXT, localized: false })).toBe(false);
});

it('editing a shared field in one version updates the others, translated fields stay', async () => {
  const { en, cs } = await twoVersions();
  await ContentEntriesService.updateEntry(String(cs._id), { data: { title: 'Přes hory', km: 12 } });
  const after = await ContentEntryModel.findById(en._id).lean();
  expect(after?.data).toEqual({ title: 'Over the hills', km: 12 });
  expect(after?.title).toBe('Over the hills');
});

it('a shared title field also updates the other versions’ titles', async () => {
  const { en, cs } = await twoVersions(true);
  await ContentEntriesService.updateEntry(String(cs._id), { data: { title: 'Společný název', km: 10 } });
  expect((await ContentEntryModel.findById(en._id).lean())?.title).toBe('Společný název');
});

it('removing a shared value removes it from the other versions', async () => {
  const { en, cs } = await twoVersions();
  await ContentEntriesService.updateEntry(String(cs._id), { data: { title: 'Přes kopce' } });
  expect((await ContentEntryModel.findById(en._id).lean())?.data).toEqual({ title: 'Over the hills' });
});

it('turning a translated field into a shared one copies the default-language value', async () => {
  const { type, cs } = await twoVersions();
  await contentTypesService.updateContentType(String(type._id), { fields: [{ ...fields[0], localized: false }, fields[1]] });
  expect((await ContentEntryModel.findById(cs._id).lean())?.data.title).toBe('Over the hills');
});
```

(If the content types service is exported under a different name, import the real export; ledger it.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- entry-versions`
Expected: FAIL, `utils/localized` missing.

- [ ] **Step 3: Implement**

- `types/field-types.ts`: add `localized?: boolean;` to `FieldDefinition` with the comment `/** Translated per language version; defaults to true for TEXT and RICH_TEXT. */`.
- `models/content-type.model.ts` field schema: `localized: { type: Boolean },` (no default: absence means "use the type default").
- `content-types.schema.ts` field schema: `localized: z.boolean().optional(),`.
- `utils/localized.ts`:

```ts
import { FieldType, type FieldDefinition } from '../types/field-types';

/** Translated per language version unless set otherwise; TEXT and RICH_TEXT are translated by default. */
export function isLocalized(field: Pick<FieldDefinition, 'type' | 'localized'>): boolean {
  if (field.localized !== undefined) return field.localized;
  return field.type === FieldType.TEXT || field.type === FieldType.RICH_TEXT;
}

export function sharedFieldNames(fields: FieldDefinition[]): string[] {
  return fields.filter((f) => !isLocalized(f)).map((f) => f.name);
}
```

- `modules/content-entries/entry-versions.service.ts`:

```ts
import mongoose from 'mongoose';
import { ContentEntryModel, type IContentEntry } from '../../models/content-entry.model';
import { LanguagesService } from '../languages/languages.service';
import { sharedFieldNames } from '../../utils/localized';
import type { FieldDefinition } from '../../types/field-types';

/** Copy the saved version's shared fields (and its title when the title field is shared) to its sibling versions. */
export async function syncSharedFields(entry: IContentEntry, fields: FieldDefinition[], titleField?: string): Promise<void> {
  const shared = sharedFieldNames(fields);
  if (shared.length === 0) return;
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  for (const name of shared) {
    if (entry.data?.[name] === undefined) unset[`data.${name}`] = '';
    else set[`data.${name}`] = entry.data[name];
  }
  const titleName = titleField ?? fields.find((f) => f.type === 'TEXT')?.name;
  if (titleName && shared.includes(titleName)) set.title = entry.title;
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  await ContentEntryModel.updateMany({ itemId: entry.itemId, _id: { $ne: entry._id } }, update);
}

/** A field became shared: every item takes the value from its default-language version (else its oldest version). */
export async function unifySharedField(contentTypeId: string, fieldName: string): Promise<void> {
  const defaultCode = await LanguagesService.defaultCode();
  const versions = await ContentEntryModel.find({ contentTypeId: new mongoose.Types.ObjectId(contentTypeId) })
    .select('_id itemId language data createdAt')
    .lean();
  const byItem = new Map<string, typeof versions>();
  for (const v of versions) byItem.set(String(v.itemId), [...(byItem.get(String(v.itemId)) ?? []), v]);
  for (const group of byItem.values()) {
    if (group.length < 2) continue;
    const source =
      group.find((v) => v.language === defaultCode) ??
      [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const value = source.data?.[fieldName];
    const update = value === undefined ? { $unset: { [`data.${fieldName}`]: '' } } : { $set: { [`data.${fieldName}`]: value } };
    await ContentEntryModel.updateMany({ itemId: source.itemId, _id: { $ne: source._id } }, update);
  }
}
```

- `updateEntry`: after `await entry.save()` and only when `updateData.data` was given, `await syncSharedFields(entry, contentType.fields, contentType.titleField)`.
- `updateContentType`: when `data.fields` is present, load the old fields first; after the update, for each field name present in both where `isLocalized(old) && !isLocalized(new)`, `await unifySharedField(id, name)`.

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): translated and shared fields with sync across versions"
```

---

## Task 4: Version endpoints

**Files:**
- Modify: `modules/content-entries/entry-versions.service.ts`, `content-entries.controller.ts`, `content-entries.routes.ts`, `content-entries.schema.ts`
- Test: add to `modules/content-entries/entry-versions.test.ts` (service) and create `modules/content-entries/entry-versions.routes.test.ts` (HTTP)

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces:
  - `listVersions(entryId): Promise<{ id; language; status; title; updatedAt }[]>` (ordered by the languages' `order`).
  - `createVersion(entryId, language, userId?): Promise<IContentEntry>` (DRAFT copy; `409` if taken).
  - `changeLanguage(entryId, language): Promise<IContentEntry>` (`409` if taken).
  - Routes: `GET /entries/:id/versions`, `POST /entries/:id/versions` `{ language }`, `PUT /entries/:id/language` `{ language }`.

- [ ] **Step 1: Write the failing test** `modules/content-entries/entry-versions.routes.test.ts`

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { ContentTypeModel } from '../../models/content-type.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType } from '../../types/field-types';
import { WebhookService } from '../../services/webhook.service';
import { ContentEntriesService } from './content-entries.service';
import entriesRoutes from './content-entries.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/entries', entriesRoutes);
app.use(errorMiddleware);

async function seed() {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
    { code: 'de', name: 'Deutsch', isDefault: false, order: 2 },
  ]);
  const type = await ContentTypeModel.create({ name: 'Trip', slug: 'trip', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }] });
  return ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Over the hills' }, status: 'PUBLISHED' as never });
}

it('translates an entry into a new draft version and lists versions in language order', async () => {
  const en = await seed();
  const created = await request(app).post(`/entries/${en.id}/versions`).send({ language: 'cs' });
  expect(created.status).toBe(201);
  expect(created.body.data).toMatchObject({ language: 'cs', status: 'DRAFT', itemId: String(en.itemId), data: { title: 'Over the hills' } });
  expect((await request(app).post(`/entries/${en.id}/versions`).send({ language: 'cs' })).status).toBe(409);
  expect((await request(app).post(`/entries/${en.id}/versions`).send({ language: 'xx' })).status).toBe(400);

  const versions = await request(app).get(`/entries/${created.body.data.id}/versions`);
  expect(versions.body.data.map((v: { language: string; status: string }) => [v.language, v.status])).toEqual([['en', 'PUBLISHED'], ['cs', 'DRAFT']]);
  expect(WebhookService.triggerEvent).toHaveBeenCalledWith('entry.created', expect.objectContaining({ entry: expect.objectContaining({ language: 'cs', itemId: String(en.itemId) }) }));
});

it('moves a version to another language unless that language is taken', async () => {
  const en = await seed();
  await request(app).post(`/entries/${en.id}/versions`).send({ language: 'cs' });
  expect((await request(app).put(`/entries/${en.id}/language`).send({ language: 'cs' })).status).toBe(409);
  const moved = await request(app).put(`/entries/${en.id}/language`).send({ language: 'de' });
  expect(moved.status).toBe(200);
  expect(moved.body.data).toMatchObject({ id: en.id, language: 'de' });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- entry-versions.routes`
Expected: FAIL, 404 for the new routes.

- [ ] **Step 3: Implement**

Add to `entry-versions.service.ts`:

```ts
import { AppError } from '../../middleware/error.middleware';
import { ContentStatus } from '../../models/content-entry.model';
import { LanguageModel } from '../../models/language.model';
import { WebhookService } from '../../services/webhook.service';
import { WebhookEvent } from '../../models/webhook.model';

async function load(entryId: string): Promise<IContentEntry> {
  if (!mongoose.Types.ObjectId.isValid(entryId)) throw new AppError('Invalid entry ID', 400);
  const entry = await ContentEntryModel.findById(entryId);
  if (!entry) throw new AppError('Content entry not found', 404);
  return entry;
}

async function assertFree(itemId: mongoose.Types.ObjectId, language: string): Promise<void> {
  if (await ContentEntryModel.exists({ itemId, language })) throw new AppError('This language already exists for this entry', 409);
}

export async function listVersions(entryId: string) {
  const entry = await load(entryId);
  const [versions, languages] = await Promise.all([
    ContentEntryModel.find({ itemId: entry.itemId }).select('_id language status title updatedAt').lean(),
    LanguageModel.find().select('code order').lean(),
  ]);
  const order = new Map(languages.map((l) => [l.code, l.order]));
  return versions
    .map((v) => ({ id: String(v._id), language: v.language, status: v.status, title: v.title, updatedAt: v.updatedAt }))
    .sort((a, b) => (order.get(a.language) ?? 999) - (order.get(b.language) ?? 999));
}

export async function createVersion(entryId: string, language: string, userId?: string): Promise<IContentEntry> {
  const source = await load(entryId);
  await LanguagesService.assertExists(language);
  await assertFree(source.itemId, language);
  const version = await ContentEntryModel.create({
    contentTypeId: source.contentTypeId,
    itemId: source.itemId,
    language,
    data: source.data,
    title: source.title,
    status: ContentStatus.DRAFT,
    createdBy: userId,
    updatedBy: userId,
  });
  WebhookService.triggerEvent(WebhookEvent.ENTRY_CREATED, { entry: version.toJSON() }).catch((err) => console.error('Webhook trigger error:', err));
  return version;
}

export async function changeLanguage(entryId: string, language: string): Promise<IContentEntry> {
  const entry = await load(entryId);
  if (entry.language === language) return entry;
  await LanguagesService.assertExists(language);
  await assertFree(entry.itemId, language);
  entry.language = language;
  await entry.save();
  WebhookService.triggerEvent(WebhookEvent.ENTRY_UPDATED, { entry: entry.toJSON() }).catch((err) => console.error('Webhook trigger error:', err));
  return entry;
}
```

(Check the existing webhook payload shape in `createEntry` and include `contentType` the same way if the webhook consumers expect it; ledger it.)

Controller methods `listVersions`, `createVersion` (201), `changeLanguage` in `content-entries.controller.ts` following the existing handlers (`next(error)` on failure). Routes in `content-entries.routes.ts`, next to the existing `/:id` routes and behind the same auth middleware:

```ts
router.get('/:id/versions', (req, res, next) => contentEntriesController.listVersions(req, res, next));
router.post('/:id/versions', validate(versionLanguageSchema), (req, res, next) => contentEntriesController.createVersion(req, res, next));
router.put('/:id/language', validate(versionLanguageSchema), (req, res, next) => contentEntriesController.changeLanguage(req, res, next));
```

`content-entries.schema.ts`: `export const versionLanguageSchema = z.object({ body: z.object({ language: z.string().trim().toLowerCase().regex(LANGUAGE_CODE) }) });`. An unknown but well-formed code (`xx`) reaches `assertExists`, which returns 400.

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): entry version endpoints"
```

---

## Task 5: Admin list filters and item counts

**Files:**
- Modify: `modules/content-entries/content-entries.service.ts` (`listAllEntries`), `content-entries.schema.ts` (`listAllEntriesSchema`), `content-entries.controller.ts`, `modules/stats/stats.service.ts`
- Test: `modules/content-entries/list-all-entries.test.ts`, `modules/stats/stats.test.ts`, `test/cosmos-sort-indexes.test.ts`

**Interfaces:**
- Produces: `ListAllEntriesOptions.language?: string`, `missing?: string`; list items gain `language`, `itemId`, `languages: string[]` (sorted); stats `entries.total` and `byType` count items.

- [ ] **Step 1: Write the failing tests**

Add to `list-all-entries.test.ts` (seed languages `en` default and `cs`; the file's `seed()` creates entries through the service):

```ts
it('filters by language, finds items missing a language and lists each item’s languages', async () => {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  const type = await ContentTypeModel.create({ name: 'Trip', slug: 'trip2', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }] });
  const a = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'A' } });
  await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'A cs' }, language: 'cs', itemId: String(a.itemId) });
  await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'B' } });

  const cs = await request(app).get('/entries').query({ language: 'cs' });
  expect(cs.body.data.map((e: { title: string }) => e.title)).toEqual(['A cs']);
  expect(cs.body.data[0].languages).toEqual(['cs', 'en']);

  const missing = await request(app).get('/entries').query({ missing: 'cs' });
  expect(missing.body.data.map((e: { title: string }) => e.title)).toEqual(['B']);
});
```

Add to `stats.test.ts`:

```ts
it('counts entries as items, not versions', async () => {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  const type = await ContentTypeModel.create({ name: 'T', slug: 't', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }] });
  const a = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'A' } });
  await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'A cs' }, language: 'cs', itemId: String(a.itemId) });
  const stats = await getStats();
  expect(stats.entries.total).toBe(1);
  expect(stats.entries.byType[String(type._id)]).toBe(1);
  expect(stats.entries.draft).toBe(2);
});
```

(Use the stats test file's existing call style for `getStats`, whatever its real export is.)

Add to `test/cosmos-sort-indexes.test.ts`:

```ts
it('languages list is served by a declared index', async () => {
  const sorts = await captureSorts(LanguageModel.collection.name, () => LanguagesService.list());
  expect(sorts).toHaveLength(1);
  expect(servedByIndex(sorts[0], LanguageModel)).toBe(true);
});

it('entry list filtered by language is served by a declared index', async () => {
  const sorts = await captureSorts(ContentEntryModel.collection.name, () => ContentEntriesService.listAllEntries({ language: 'en' }));
  expect(servedByIndex(sorts[0], ContentEntryModel)).toBe(true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- list-all-entries stats cosmos-sort`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement**

`listAllEntries`:

```ts
    if (language) query.language = language;
    if (missing) {
      const covered = await ContentEntryModel.distinct('itemId', { language: missing });
      query.itemId = { $nin: covered };
      if (!language) query.language = await LanguagesService.defaultCode();
    }
```

After loading the page, add each item's languages:

```ts
    const itemIds = entries.map((e) => e.itemId);
    const siblings = await ContentEntryModel.find({ itemId: { $in: itemIds } }).select('itemId language').lean();
    const languagesByItem = new Map<string, string[]>();
    for (const s of siblings) languagesByItem.set(String(s.itemId), [...(languagesByItem.get(String(s.itemId)) ?? []), s.language]);
```

and in the mapped item `languages: [...(languagesByItem.get(String(e.itemId)) ?? [])].sort()`. `listAllEntriesSchema.query` gains `language` and `missing` (`z.string().regex(LANGUAGE_CODE).optional()`); the controller passes them.

`stats.service.ts`: `entries.total = (await ContentEntryModel.distinct('itemId')).length` and `byType` from

```ts
ContentEntryModel.aggregate<{ _id: unknown; count: number }>([
  { $group: { _id: { type: '$contentTypeId', item: '$itemId' } } },
  { $group: { _id: '$_id.type', count: { $sum: 1 } } },
])
```

Status counts stay per version.

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): language filters in the admin entry list; stats count items"
```

---

## Task 6: Public API language and fallback

**Files:**
- Create: `modules/public/public-content.service.ts`
- Modify: `modules/public/public.controller.ts` (`listPublishedEntries`, `getPublishedEntry`, `searchPublishedEntries`)
- Test: `modules/public/public-languages.test.ts`

**Interfaces:**
- Consumes: `LanguagesService`.
- Produces:
  - `resolveLanguage(requested?: string): Promise<{ language: string; defaultLanguage: string }>` (400 for unknown codes).
  - `listPublished(contentTypeId, opts: { language; defaultLanguage; page; limit; sortBy; sortOrder }): Promise<{ entries: PublicEntry[]; pagination }>`.
  - `getPublished(contentTypeId, id, language, defaultLanguage): Promise<PublicEntry | null>`.
  - `PublicEntry` = today's entry JSON plus `language: string` and `fallback: boolean`.

- [ ] **Step 1: Write the failing test** `modules/public/public-languages.test.ts`

```ts
jest.mock('../../middleware/apiKey.middleware', () => ({ apiKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { ContentTypeModel } from '../../models/content-type.model';
import { LanguageModel } from '../../models/language.model';
import { ContentStatus } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import publicRoutes from './public.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/public', publicRoutes);
app.use(errorMiddleware);

async function seed() {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  const type = await ContentTypeModel.create({ name: 'Trip', slug: 'trip', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }] });
  const make = (title: string, language?: string, itemId?: string, status = ContentStatus.PUBLISHED) =>
    ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title }, language, itemId, status });
  const a = await make('A en');
  await make('A cs', 'cs', String(a.itemId));
  const b = await make('B en');
  await make('B cs draft', 'cs', String(b.itemId), ContentStatus.DRAFT);
  await make('C en');
  return { a, b };
}

it('serves the default language without a parameter, unchanged', async () => {
  await seed();
  const res = await request(app).get('/public/content/trip');
  expect(res.body.data.map((e: { title: string }) => e.title).sort()).toEqual(['A en', 'B en', 'C en']);
  expect(res.body.data.every((e: { language: string; fallback: boolean }) => e.language === 'en' && e.fallback === false)).toBe(true);
  expect(res.body.pagination.total).toBe(3);
});

it('prefers the requested language and falls back to the default per item', async () => {
  await seed();
  const res = await request(app).get('/public/content/trip').query({ language: 'cs', sortBy: 'title', sortOrder: 'asc' });
  expect(res.body.data.map((e: { title: string; fallback: boolean }) => [e.title, e.fallback])).toEqual([
    ['A cs', false],
    ['B en', true],
    ['C en', true],
  ]);
  expect(res.body.pagination.total).toBe(3);
});

it('pages items, not versions', async () => {
  await seed();
  const page2 = await request(app).get('/public/content/trip').query({ language: 'cs', sortBy: 'title', sortOrder: 'asc', page: 2, limit: 2 });
  expect(page2.body.data.map((e: { title: string }) => e.title)).toEqual(['C en']);
  expect(page2.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
});

it('resolves a single entry by item id or version id with fallback', async () => {
  const { a, b } = await seed();
  const cs = await request(app).get(`/public/content/trip/${a.itemId}`).query({ language: 'cs' });
  expect(cs.body.data).toMatchObject({ title: 'A cs', language: 'cs', fallback: false });
  const fb = await request(app).get(`/public/content/trip/${b.itemId}`).query({ language: 'cs' });
  expect(fb.body.data).toMatchObject({ title: 'B en', language: 'en', fallback: true });
});

it('rejects an unknown language', async () => {
  await seed();
  const res = await request(app).get('/public/content/trip').query({ language: 'xx' });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('en, cs');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- public-languages`
Expected: FAIL: no `language`/`fallback` fields, Czech ignored.

- [ ] **Step 3: Implement** `modules/public/public-content.service.ts`

```ts
import mongoose from 'mongoose';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { LanguagesService } from '../languages/languages.service';

type Raw = Record<string, unknown> & { _id: mongoose.Types.ObjectId; language: string };

export type PublicEntry = Record<string, unknown> & { id: string; language: string; fallback: boolean };

function toPublic(doc: Raw, requested: string): PublicEntry {
  const { _id, __v, ...rest } = doc;
  void __v;
  return { id: String(_id), ...rest, language: doc.language, fallback: doc.language !== requested };
}

export async function resolveLanguage(requested?: string): Promise<{ language: string; defaultLanguage: string }> {
  const defaultLanguage = await LanguagesService.defaultCode();
  if (!requested) return { language: defaultLanguage, defaultLanguage };
  const language = requested.trim().toLowerCase();
  await LanguagesService.assertExists(language);
  return { language, defaultLanguage };
}

/** One version per item: the requested language if published, else the default language. */
function pickPipeline(contentTypeId: string, language: string, defaultLanguage: string) {
  return [
    {
      $match: {
        contentTypeId: new mongoose.Types.ObjectId(contentTypeId),
        status: ContentStatus.PUBLISHED,
        language: { $in: [language, defaultLanguage] },
      },
    },
    { $group: { _id: '$itemId', versions: { $push: '$$ROOT' } } },
    {
      $project: {
        chosen: {
          $let: {
            vars: { wanted: { $filter: { input: '$versions', as: 'v', cond: { $eq: ['$$v.language', language] } } } },
            in: { $cond: [{ $gt: [{ $size: '$$wanted' }, 0] }, { $arrayElemAt: ['$$wanted', 0] }, { $arrayElemAt: ['$versions', 0] }] },
          },
        },
      },
    },
    { $replaceRoot: { newRoot: '$chosen' } },
  ];
}

export async function listPublished(
  contentTypeId: string,
  opts: { language: string; defaultLanguage: string; page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }
) {
  const { language, defaultLanguage, page, limit, sortBy, sortOrder } = opts;
  const direction = sortOrder === 'asc' ? 1 : -1;

  if (language === defaultLanguage) {
    // Unchanged behaviour for sites that do not ask for a language: a plain indexed find.
    const query = { contentTypeId, status: ContentStatus.PUBLISHED, language };
    const [docs, total] = await Promise.all([
      ContentEntryModel.find(query).sort({ [sortBy]: direction }).skip((page - 1) * limit).limit(limit).lean(),
      ContentEntryModel.countDocuments(query),
    ]);
    return { entries: (docs as unknown as Raw[]).map((d) => toPublic(d, language)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  const pipeline = pickPipeline(contentTypeId, language, defaultLanguage);
  const [docs, counted] = await Promise.all([
    ContentEntryModel.aggregate<Raw>([...pipeline, { $sort: { [sortBy]: direction } }, { $skip: (page - 1) * limit }, { $limit: limit }]),
    ContentEntryModel.aggregate<{ total: number }>([...pipeline, { $count: 'total' }]),
  ]);
  const total = counted[0]?.total ?? 0;
  return { entries: docs.map((d) => toPublic(d, language)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPublished(contentTypeId: string, id: string, language: string, defaultLanguage: string): Promise<PublicEntry | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const direct = await ContentEntryModel.findById(id).select('itemId').lean();
  const itemId = direct?.itemId ?? new mongoose.Types.ObjectId(id);
  const versions = (await ContentEntryModel.find({
    itemId,
    contentTypeId,
    status: ContentStatus.PUBLISHED,
    language: { $in: [language, defaultLanguage] },
  }).lean()) as unknown as Raw[];
  const chosen = versions.find((v) => v.language === language) ?? versions.find((v) => v.language === defaultLanguage);
  return chosen ? toPublic(chosen, language) : null;
}
```

Controller changes:
- `listPublishedEntries`: `const { language, defaultLanguage } = await resolveLanguage(req.query.language as string | undefined)` and return `listPublished(String(contentType._id), { language, defaultLanguage, page, limit, sortBy, sortOrder })`.
- `getPublishedEntry`: replace the `getEntryById` + checks with `getPublished(String(contentType._id), entryId, language, defaultLanguage)`; `404` when `null`.
- `searchPublishedEntries`: resolve the language, pass `language: { $in: [language, defaultLanguage] }` as an extra filter to `searchEntries` (add an optional `languages?: string[]` option there), then keep one version per `itemId` in the page (requested language first) and add `language`/`fallback` via the same `toPublic` rule (Decision 3).

The `$sort` inside the aggregation runs on the grouped result, not on a collection index; this is the query to verify on Cosmos DB after deploy (Task 7 Step 2).

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS (existing public tests too).

```bash
git add -A packages/backend
git commit -m "feat(backend): public API language parameter with fallback"
```

---

## Task 7: Verification on local data

**Files:** none unless a defect is found (fix with a test).

- [ ] **Step 1: Local run**

Start mongod, Azurite and the backend from the worktree. Expected log: `Content languages migrated (default created: true, entries: N)` on the first start and no migration line on a restart.

Then with the dev token:

1. `GET /api/v1/languages` → `[{ code: 'en', isDefault: true }]`.
2. `POST /api/v1/languages { code: 'cs', name: 'Čeština' }`.
3. Pick a published entry id; `PUT /api/v1/entries/<id>/language { language: 'cs' }` → `language: 'cs'`, same id.
4. Public API with the example site's key: `GET /public/content/<type>` without language: the moved entry is absent (no `en` version); with `?language=cs`: present, `fallback: false`; other entries present with `fallback: true`.
5. `POST /entries/<id>/versions { language: 'en' }`, publish it: the public list without language shows it again.
6. `GET /api/v1/stats`: `entries.total` equals the number of items.
7. Move the test entry back (`PUT .../language` to `en` after deleting the extra version) so local data ends as it started.

- [ ] **Step 2: Cosmos DB note**

Record in `TEST_RESULTS.md` that the non-default-language public list uses an aggregation (`$group`, `$sort` on the grouped result) that must be checked against production Cosmos DB after deploy with one request such as `GET /api/v1/public/content/<type>?language=<non-default>`; if Cosmos rejects it, the fix is to sort before grouping on the single-field index.

- [ ] **Step 3: Record and commit**

Append a "Content languages Plan 1 verification" table to `TEST_RESULTS.md`, and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record content languages Plan 1 verification"
```

---

## Self-Review Notes

- **Spec coverage:** 3.1 languages → Task 1; 3.2 entry fields → Task 2 (unique index replaced, Decision 1); 3.3 localized fields and sync → Task 3; 3.4 references → migration keeps ids (Task 2), existence check deferred (Decision 2); 3.5 migration → Task 2; 4 admin API → Tasks 1, 2, 4, 5; 5 public API → Task 6; 6 webhooks → Task 4 test (payload contains `language`/`itemId` via `toJSON`); 9 error handling → Tasks 1, 4; 10 backend testing → every task, Cosmos check → Task 5 and Task 7; 7 admin UI and 8 example site → Plan 2.
- **Type consistency:** `LanguagesService.{list,codes,defaultCode,assertExists,create,rename,makeDefault,remove}`, `migrateLanguages`, `isLocalized`, `sharedFieldNames`, `syncSharedFields`, `unifySharedField`, `listVersions`, `createVersion`, `changeLanguage`, `resolveLanguage`, `listPublished`, `getPublished`, `CreateEntryData.language/itemId` are used with the same names in every task.
