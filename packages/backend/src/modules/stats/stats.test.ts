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
    entries: { total: 0, draft: 0, published: 0, archived: 0, byType: {} },
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
  const entry = (status: ContentStatus) => {
    const _id = new mongoose.Types.ObjectId();
    return { _id, itemId: _id, language: 'en', contentTypeId: type._id, data: {}, status };
  };
  await ContentEntryModel.create([
    entry(ContentStatus.DRAFT),
    entry(ContentStatus.DRAFT),
    entry(ContentStatus.PUBLISHED),
    entry(ContentStatus.ARCHIVED),
  ]);
  const formId = new mongoose.Types.ObjectId();
  await FormSubmissionModel.collection.insertMany([
    { formId, data: {}, status: SubmissionStatus.UNREAD, emailSent: false },
    { formId, data: {}, status: SubmissionStatus.READ, emailSent: false },
  ]);

  const stats = await getDashboardStats();
  expect(stats.entries).toEqual({
    total: 4,
    draft: 2,
    published: 1,
    archived: 1,
    byType: { [type.id]: 4 },
  });
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
