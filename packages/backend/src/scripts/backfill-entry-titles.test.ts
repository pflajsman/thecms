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
