jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { ContentTypeModel } from '../../models/content-type.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from './content-entries.service';

useTestDb();

async function setup() {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
  ]);
  return ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }],
  });
}

it('creates entries in the default language with their own item id', async () => {
  const type = await setup();
  const entry = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Hi' } });
  expect(entry.language).toBe('en');
  expect(String(entry.itemId)).toBe(String(entry._id));
});

it('creates an entry in a requested language and rejects unknown ones', async () => {
  const type = await setup();
  const cs = await ContentEntriesService.createEntry({
    contentTypeId: String(type._id),
    data: { title: 'Ahoj' },
    language: 'cs',
  });
  expect(cs.language).toBe('cs');
  await expect(
    ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: {}, language: 'de' })
  ).rejects.toMatchObject({ statusCode: 400 });
});

it('rejects a second version of the same item in the same language', async () => {
  const type = await setup();
  const en = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Hi' } });
  await expect(
    ContentEntriesService.createEntry({
      contentTypeId: String(type._id),
      data: { title: 'Again' },
      language: 'en',
      itemId: String(en.itemId),
    })
  ).rejects.toMatchObject({ statusCode: 409 });
});
