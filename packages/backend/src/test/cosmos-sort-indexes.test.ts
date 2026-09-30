/**
 * Azure Cosmos DB for MongoDB (production) only indexes _id by default. A sort must be served by a
 * declared index whose keys match the sort exactly (a single-field sort needs a single-field index,
 * a multi-field sort needs a matching compound index). Local MongoDB does not enforce this, so this
 * test records the sorts the admin list queries send and checks them against the schema indexes.
 */
import mongoose from 'mongoose';
import { useTestDb } from './db';
import { ContentEntriesService } from '../modules/content-entries/content-entries.service';
import { ContactFormsService } from '../modules/contact-forms/contact-forms.service';
import { ContentEntryModel } from '../models/content-entry.model';
import { FormSubmissionModel } from '../models/form-submission.model';
import { LanguageModel } from '../models/language.model';
import { LanguagesService } from '../modules/languages/languages.service';

useTestDb();

type Sort = Record<string, number>;

function captureSorts(collection: string, run: () => Promise<unknown>): Promise<Sort[]> {
  const sorts: Sort[] = [];
  mongoose.set('debug', (coll: string, method: string, _query: unknown, options?: { sort?: Sort }) => {
    if (coll === collection && method === 'find' && options?.sort) sorts.push(options.sort);
  });
  return run().then(
    () => {
      mongoose.set('debug', false);
      return sorts;
    },
    (error) => {
      mongoose.set('debug', false);
      throw error;
    },
  );
}

function servedByIndex(sort: Sort, model: mongoose.Model<any>): boolean {
  const keys = Object.entries(sort);
  if (keys.length === 1 && keys[0][0] === '_id') return true;
  // schema.indexes() returns [fields, options] pairs; Mongoose 6 types them loosely.
  const indexes = model.schema.indexes() as unknown as [Record<string, number>, unknown][];
  return indexes.some(([index]) => {
    const idx = Object.entries(index);
    if (idx.length !== keys.length) return false;
    const same = idx.every(([k, d], i) => keys[i][0] === k && keys[i][1] === d);
    const reversed = idx.every(([k, d], i) => keys[i][0] === k && keys[i][1] === -d);
    return same || reversed;
  });
}

it.each([
  ['updatedAt', 'desc'],
  ['updatedAt', 'asc'],
  ['createdAt', 'desc'],
  ['title', 'asc'],
] as const)('entry list sorted by %s %s is served by a declared index', async (sortBy, sortOrder) => {
  const sorts = await captureSorts(ContentEntryModel.collection.name, () =>
    ContentEntriesService.listAllEntries({ sortBy, sortOrder }),
  );
  expect(sorts).toHaveLength(1);
  expect({ sort: sorts[0], served: servedByIndex(sorts[0], ContentEntryModel) }).toEqual({ sort: sorts[0], served: true });
});

it('inbox submission list is served by a declared index', async () => {
  const sorts = await captureSorts(FormSubmissionModel.collection.name, () => ContactFormsService.listAllSubmissions({}));
  expect(sorts).toHaveLength(1);
  expect({ sort: sorts[0], served: servedByIndex(sorts[0], FormSubmissionModel) }).toEqual({ sort: sorts[0], served: true });
});

it('languages list is served by a declared index', async () => {
  const sorts = await captureSorts(LanguageModel.collection.name, () => LanguagesService.list());
  expect(sorts).toHaveLength(1);
  expect({ sort: sorts[0], served: servedByIndex(sorts[0], LanguageModel) }).toEqual({ sort: sorts[0], served: true });
});

it.each([{ language: 'en' }, { missing: 'cs' }])('entry list filtered by %o is served by a declared index', async (filter) => {
  const sorts = await captureSorts(ContentEntryModel.collection.name, () => ContentEntriesService.listAllEntries(filter));
  expect(sorts).toHaveLength(1);
  expect({ sort: sorts[0], served: servedByIndex(sorts[0], ContentEntryModel) }).toEqual({ sort: sorts[0], served: true });
});
