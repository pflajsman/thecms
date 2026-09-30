jest.mock('../../middleware/apiKey.middleware', () => ({
  apiKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { ContentTypeModel } from '../../models/content-type.model';
import { LanguageModel } from '../../models/language.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import publicRoutes from './public.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/public', publicRoutes);
app.use(errorMiddleware);

async function seed() {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', order: 1 },
  ]);
  const type = await ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
  const make = (title: string, language?: string, itemId?: string, status = ContentStatus.PUBLISHED) =>
    ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title }, language, itemId, status });
  const a = await make('A en');
  const aCs = await make('A cs', 'cs', String(a.itemId));
  const b = await make('B en');
  await make('B cs draft', 'cs', String(b.itemId), ContentStatus.DRAFT);
  await make('C en');
  return { type, a, aCs, b };
}

const titles = (res: request.Response) => res.body.data.map((e: { title: string }) => e.title);

it('serves the default language without a parameter, in the existing shape', async () => {
  const { type } = await seed();
  const res = await request(app).get('/public/content/trip');
  expect(titles(res).sort()).toEqual(['A en', 'B en', 'C en']);
  expect(res.body.data.every((e: { language: string; fallback: boolean }) => e.language === 'en' && !e.fallback)).toBe(true);
  expect(res.body.data[0]).toMatchObject({ contentTypeId: String(type._id), status: 'PUBLISHED', data: expect.any(Object) });
  expect(res.body.data[0]._id).toBeUndefined();
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
  expect(res.body.data[0].id).toEqual(expect.any(String));
  expect(res.body.data[0]._id).toBeUndefined();
  expect(res.body.pagination.total).toBe(3);
});

it('pages items, not versions', async () => {
  await seed();
  const page2 = await request(app)
    .get('/public/content/trip')
    .query({ language: 'cs', sortBy: 'title', sortOrder: 'asc', page: 2, limit: 2 });
  expect(titles(page2)).toEqual(['C en']);
  expect(page2.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
});

it('leaves out items with no published version in either language', async () => {
  const { type } = await seed();
  await ContentEntriesService.createEntry({
    contentTypeId: String(type._id),
    data: { title: 'D cs only' },
    language: 'cs',
    status: ContentStatus.DRAFT,
  });
  const res = await request(app).get('/public/content/trip').query({ language: 'cs' });
  expect(res.body.pagination.total).toBe(3);
});

it('resolves a single entry by item id or version id with fallback', async () => {
  const { a, aCs, b } = await seed();
  const cs = await request(app).get(`/public/content/trip/${a.itemId}`).query({ language: 'cs' });
  expect(cs.body.data).toMatchObject({ title: 'A cs', language: 'cs', fallback: false });
  const byVersion = await request(app).get(`/public/content/trip/${aCs.id}`);
  expect(byVersion.body.data).toMatchObject({ title: 'A en', language: 'en', fallback: false });
  const fb = await request(app).get(`/public/content/trip/${b.itemId}`).query({ language: 'cs' });
  expect(fb.body.data).toMatchObject({ title: 'B en', language: 'en', fallback: true });
});

it('returns 404 for a single entry of another type or without a published version', async () => {
  const { a } = await seed();
  await ContentTypeModel.create({
    name: 'Post',
    slug: 'post',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
  expect((await request(app).get(`/public/content/post/${a.itemId}`)).status).toBe(404);
  await ContentEntryModel.updateMany({ itemId: a.itemId }, { $set: { status: ContentStatus.DRAFT } });
  expect((await request(app).get(`/public/content/trip/${a.itemId}`).query({ language: 'cs' })).status).toBe(404);
});

it('rejects an unknown language', async () => {
  await seed();
  const res = await request(app).get('/public/content/trip').query({ language: 'xx' });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('en, cs');
});

it('search returns one version per item in the requested language with fallback', async () => {
  await seed();
  await ContentEntryModel.collection.createIndex({ '$**': 'text' }, { language_override: 'textSearchLanguage' });
  const res = await request(app).get('/public/search').query({ q: 'en cs', language: 'cs' });
  expect(res.status).toBe(200);
  const rows = res.body.data.map((e: { title: string; language: string; fallback: boolean }) => [e.title, e.fallback]);
  expect(rows.sort()).toEqual([
    ['A cs', false],
    ['B en', true],
    ['C en', true],
  ]);
});

it('the non-default list groups only ids and the sort key, not whole documents', async () => {
  await seed();
  const spy = jest.spyOn(ContentEntryModel, 'aggregate');
  const res = await request(app).get('/public/content/trip').query({ language: 'cs', sortBy: 'title', sortOrder: 'asc' });
  expect(res.body.data.map((e: { title: string; data: { title: string } }) => [e.title, e.data.title])).toEqual([
    ['A cs', 'A cs'],
    ['B en', 'B en'],
    ['C en', 'C en'],
  ]);
  const pipelines = spy.mock.calls.map(([p]) => JSON.stringify(p));
  expect(pipelines.length).toBeGreaterThan(0);
  for (const p of pipelines) expect(p).not.toContain('$$ROOT');
  spy.mockRestore();
});
