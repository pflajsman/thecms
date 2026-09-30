jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import mongoose from 'mongoose';
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
  expect(list.body.data.map((l: { code: string; isDefault: boolean }) => [l.code, l.isDefault])).toEqual([
    ['en', false],
    ['cs', true],
  ]);

  const renamed = await request(app).put('/languages/en').send({ name: 'Angličtina' });
  expect(renamed.body.data.name).toBe('Angličtina');
});

it('guards deletion and removes the language versions', async () => {
  await request(app).post('/languages').send({ code: 'en', name: 'English' });
  await request(app).post('/languages').send({ code: 'de', name: 'Deutsch' });
  const type = await ContentTypeModel.create({
    name: 'Post',
    slug: 'post',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
  const itemId = new mongoose.Types.ObjectId();
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
