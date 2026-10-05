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
import { LanguageModel } from '../../models/language.model';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { getTestDefaultProject } from '../../utils/project-context';

// Raw driver inserts skip the tenant plugin, so they name the test project themselves.
const TEST_PROJECT = getTestDefaultProject()!;

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
    { projectId: TEST_PROJECT, formId, data: {}, status: SubmissionStatus.UNREAD, emailSent: false },
    { projectId: TEST_PROJECT, formId, data: {}, status: SubmissionStatus.READ, emailSent: false },
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

it('counts entries as items, not versions; status counts count versions', async () => {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', order: 1 },
  ]);
  const type = await ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
  const a = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'A' } });
  await ContentEntriesService.createEntry({
    contentTypeId: String(type._id),
    data: { title: 'A cs' },
    language: 'cs',
    itemId: String(a.itemId),
  });
  const stats = await getDashboardStats();
  expect(stats.entries.total).toBe(1);
  expect(stats.entries.byType[String(type._id)]).toBe(1);
  expect(stats.entries.draft).toBe(2);
});
