jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType, type FieldDefinition } from '../../types/field-types';
import { contentTypesService } from '../content-types/content-types.service';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { LanguagesService } from '../languages/languages.service';
import { ensureProductModel } from './product-model';

useTestDb();

it('creates the Product model once, with translated name and description and shared images', async () => {
  const first = await ensureProductModel();
  const again = await ensureProductModel();
  expect(String(again._id)).toBe(String(first._id));
  expect(await ContentTypeModel.countDocuments({ system: 'product' })).toBe(1);
  expect(first).toMatchObject({ slug: 'product', titleField: 'name' });
  expect(first.fields.map((f) => [f.name, f.type])).toEqual([
    ['name', FieldType.TEXT],
    ['description', FieldType.RICH_TEXT],
    ['images', FieldType.MEDIA],
  ]);
});

it('cannot be deleted and keeps its core fields, but accepts new ones', async () => {
  const model = await ensureProductModel();
  await expect(contentTypesService.deleteContentType(String(model._id), { force: true })).rejects.toMatchObject({ statusCode: 409 });
  const plain: FieldDefinition[] = JSON.parse(JSON.stringify(model.fields));
  const without = plain.filter((f) => f.name !== 'images');
  await expect(contentTypesService.updateContentType(String(model._id), { fields: without })).rejects.toMatchObject({ statusCode: 409 });
  const retyped = plain.map((f) => ({ ...f, type: f.name === 'description' ? FieldType.TEXT : f.type }));
  await expect(contentTypesService.updateContentType(String(model._id), { fields: retyped })).rejects.toMatchObject({ statusCode: 409 });
  const extra = [...plain, { name: 'specs', label: 'Specifications', type: FieldType.RICH_TEXT, required: false }];
  const updated = await contentTypesService.updateContentType(String(model._id), { fields: extra });
  expect(updated?.fields.map((f) => f.name)).toContain('specs');
});

it('refuses to delete the last version of a product entry or the only language of one', async () => {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  const model = await ensureProductModel();
  const cs = await ContentEntriesService.createEntry({ contentTypeId: String(model._id), data: { name: 'Tričko' }, language: 'cs' });
  await expect(ContentEntriesService.deleteEntry(String(cs._id))).rejects.toMatchObject({ statusCode: 409 });
  await expect(LanguagesService.remove('cs', 'cs')).rejects.toMatchObject({ statusCode: 409 });
  expect(await ContentEntryModel.countDocuments({ _id: cs._id })).toBe(1);

  const en = await ContentEntriesService.createEntry({ contentTypeId: String(model._id), data: { name: 'T-shirt' }, itemId: String(cs.itemId) });
  expect(await ContentEntriesService.deleteEntry(String(cs._id))).toBe(true);
  expect(await ContentEntryModel.countDocuments({ _id: en._id })).toBe(1);
});
