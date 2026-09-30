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
import { errorMiddleware } from '../../middleware/error.middleware';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentStatus } from '../../models/content-entry.model';
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
  const type = await ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
  return ContentEntriesService.createEntry({
    contentTypeId: String(type._id),
    data: { title: 'Over the hills' },
    status: ContentStatus.PUBLISHED,
  });
}

it('translates an entry into a new draft version and lists versions in language order', async () => {
  const en = await seed();
  const created = await request(app).post(`/entries/${en.id}/versions`).send({ language: 'cs' });
  expect(created.status).toBe(201);
  expect(created.body.data).toMatchObject({
    language: 'cs',
    status: 'DRAFT',
    itemId: String(en.itemId),
    data: { title: 'Over the hills' },
  });
  expect((await request(app).post(`/entries/${en.id}/versions`).send({ language: 'cs' })).status).toBe(409);
  expect((await request(app).post(`/entries/${en.id}/versions`).send({ language: 'xx' })).status).toBe(400);

  const versions = await request(app).get(`/entries/${created.body.data.id}/versions`);
  expect(versions.body.data.map((v: { language: string; status: string }) => [v.language, v.status])).toEqual([
    ['en', 'PUBLISHED'],
    ['cs', 'DRAFT'],
  ]);
  expect(WebhookService.triggerEvent).toHaveBeenCalledWith(
    'entry.created',
    expect.objectContaining({ entry: expect.objectContaining({ language: 'cs', itemId: en.itemId }) })
  );
});

it('moves a version to another language unless that language is taken', async () => {
  const en = await seed();
  await request(app).post(`/entries/${en.id}/versions`).send({ language: 'cs' });
  expect((await request(app).put(`/entries/${en.id}/language`).send({ language: 'cs' })).status).toBe(409);
  const moved = await request(app).put(`/entries/${en.id}/language`).send({ language: 'de' });
  expect(moved.status).toBe(200);
  expect(moved.body.data).toMatchObject({ id: en.id, language: 'de' });
});

it('returns 404 for versions of an unknown entry', async () => {
  await seed();
  expect((await request(app).get('/entries/507f1f77bcf86cd799439011/versions')).status).toBe(404);
});
