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

it('rebuilds a text index so the entry language field is not read as a stemming language', async () => {
  await ContentEntryModel.collection.createIndex({ data: 'text' }, { name: 'data_text_search', weights: { data: 1 } });
  await migrateLanguages();
  const text = (await ContentEntryModel.collection.indexes()).find((i) => i.name === 'data_text_search');
  expect(text).toMatchObject({ language_override: 'textSearchLanguage', weights: { data: 1 } });
  await expect(
    ContentEntryModel.collection.insertOne({
      contentTypeId: new mongoose.Types.ObjectId(),
      itemId: new mongoose.Types.ObjectId(),
      language: 'cs',
      data: { title: 'Přes Šumavu' },
    })
  ).resolves.toBeTruthy();
  // A second run leaves the rebuilt index alone.
  await migrateLanguages();
  expect((await ContentEntryModel.collection.indexes()).filter((i) => i.name === 'data_text_search')).toHaveLength(1);
});

it('runs on a fresh database where no collections exist yet, and builds the languages index first', async () => {
  const db = mongoose.connection.db;
  for (const name of ['contententries', 'languages']) {
    if ((await db.listCollections({ name }).toArray()).length > 0) await db.dropCollection(name);
  }
  await expect(migrateLanguages()).resolves.toEqual({ createdDefault: true, migratedEntries: 0 });
  const codeIndex = (await LanguageModel.collection.indexes()).find((i) => i.key.code === 1);
  expect(codeIndex?.unique).toBe(true);
});

it('two instances starting at once both finish and create one default language', async () => {
  const results = await Promise.allSettled([migrateLanguages(), migrateLanguages(), migrateLanguages()]);
  expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
  expect(await LanguageModel.countDocuments({ code: 'en', isDefault: true })).toBe(1);
});
