jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { findMediaUsage } from './media-usage.service';
import { MediaModel } from '../../models/media.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { FieldType } from '../../types/field-types';

useTestDb();

async function seed() {
  const media = await MediaModel.create({
    filename: 'a1b2c3-sumava.jpg',
    originalName: 'sumava.jpg',
    mimeType: 'image/jpeg',
    size: 1000,
    blobUrl: 'http://127.0.0.1:10000/devstoreaccount1/media/a1b2c3-sumava.jpg',
  });
  const type = await ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    fields: [
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: false },
      { name: 'cover', label: 'Cover', type: FieldType.MEDIA, required: false },
      { name: 'gallery', label: 'Gallery', type: FieldType.MEDIA, required: false, validation: { multiple: true } },
      { name: 'body', label: 'Body', type: FieldType.RICH_TEXT, required: false },
    ],
  });
  return { media, type };
}

it('finds entries referencing the media in single, multiple and rich text fields', async () => {
  const { media, type } = await seed();
  const id = media.id;
  await ContentEntriesService.createEntry({ contentTypeId: type.id, data: { title: 'Cover', cover: id } });
  await ContentEntriesService.createEntry({ contentTypeId: type.id, data: { title: 'Gallery', gallery: ['x', id] } });
  await ContentEntriesService.createEntry({
    contentTypeId: type.id,
    data: { title: 'Inline', body: '<p><img src="https://cdn.example.com/media/a1b2c3-sumava-medium.jpg"></p>' },
  });
  await ContentEntriesService.createEntry({ contentTypeId: type.id, data: { title: 'Unrelated' } });

  const usage = await findMediaUsage(id);
  expect(usage?.map((u) => u.title).sort()).toEqual(['Cover', 'Gallery', 'Inline']);
  expect(usage?.[0].contentType).toEqual({ id: type.id, name: 'Trip', slug: 'trip' });
});

it('returns an empty list when nothing references the media', async () => {
  const { media } = await seed();
  expect(await findMediaUsage(media.id)).toEqual([]);
});

it('returns null for a media id that does not exist', async () => {
  expect(await findMediaUsage('66f1a2b3c4d5e6f7a8b9c0d1')).toBeNull();
});

it('throws for a malformed id', async () => {
  await expect(findMediaUsage('nope')).rejects.toThrow('Invalid media ID');
});
