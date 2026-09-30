import mongoose from 'mongoose';
import { useTestDb } from '../test/db';
import { ContentEntryModel } from '../models/content-entry.model';
import { LanguageModel } from '../models/language.model';
import { migrateLanguages } from './migrate-languages';

useTestDb();

it('creates English as default and assigns existing entries to it, keeping their ids', async () => {
  const typeId = new mongoose.Types.ObjectId();
  // Pre-migration documents: no language, no itemId.
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
  await ContentEntryModel.collection.insertOne({
    contentTypeId: new mongoose.Types.ObjectId(),
    data: {},
    title: 'X',
    status: 'DRAFT',
  });
  await migrateLanguages();
  expect((await ContentEntryModel.findOne().lean())?.language).toBe('cs');
});
