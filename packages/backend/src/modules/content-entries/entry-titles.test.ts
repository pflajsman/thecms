jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { ContentEntriesService } from './content-entries.service';
import { contentTypesService } from '../content-types/content-types.service';
import { ContentEntryModel } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';

useTestDb();

async function createTripType() {
  return contentTypesService.createContentType({
    name: 'Trip',
    slug: 'trip',
    fields: [
      { name: 'headline', label: 'Headline', type: FieldType.TEXT, required: false },
      { name: 'summary', label: 'Summary', type: FieldType.TEXT, required: false },
    ],
  } as any);
}

describe('entry titles', () => {
  it('sets title from the first TEXT field on create', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({
      contentTypeId: type.id,
      data: { headline: 'Přes Šumavu', summary: 'Two days' },
    });
    expect(entry.title).toBe('Přes Šumavu');
  });

  it('uses Untitled when the title value is empty', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({ contentTypeId: type.id, data: {} });
    expect(entry.title).toBe('Untitled');
  });

  it('recomputes title when data is updated', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({
      contentTypeId: type.id,
      data: { headline: 'Old' },
    });
    const updated = await ContentEntriesService.updateEntry(entry.id, { data: { headline: 'New' } });
    expect(updated?.title).toBe('New');
  });

  it('recomputes stored titles when the type titleField changes, without touching updatedAt', async () => {
    const type = await createTripType();
    const entry = await ContentEntriesService.createEntry({
      contentTypeId: type.id,
      data: { headline: 'Headline A', summary: 'Summary A' },
    });
    const before = await ContentEntryModel.findById(entry.id).lean();

    await contentTypesService.updateContentType(type.id, { titleField: 'summary' } as any);

    const after = await ContentEntryModel.findById(entry.id).lean();
    expect(after?.title).toBe('Summary A');
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });

  it('rejects a titleField that is not a TEXT field on create', async () => {
    const { createContentTypeSchema } = await import('../content-types/content-types.schema');
    const result = createContentTypeSchema.safeParse({
      name: 'Trip',
      slug: 'trip',
      titleField: 'distance',
      fields: [
        { name: 'headline', label: 'Headline', type: 'TEXT', required: false },
        { name: 'distance', label: 'Distance', type: 'NUMBER', required: false },
      ],
    });
    expect(result.success).toBe(false);
  });
});
