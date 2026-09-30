jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from './content-entries.service';
import { contentTypesService } from '../content-types/content-types.service';
import { isLocalized } from '../../utils/localized';

useTestDb();

const fields = [
  { name: 'title', label: 'Title', type: FieldType.TEXT, required: false },
  { name: 'km', label: 'Distance', type: FieldType.NUMBER, required: false },
];

async function twoVersions(titleShared = false) {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
  ]);
  const type = await ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    titleField: 'title',
    fields: titleShared ? [{ ...fields[0], localized: false }, fields[1]] : fields,
  });
  const en = await ContentEntriesService.createEntry({
    contentTypeId: String(type._id),
    data: { title: 'Over the hills', km: 10 },
  });
  const cs = await ContentEntriesService.createEntry({
    contentTypeId: String(type._id),
    data: { title: 'Přes kopce', km: 10 },
    language: 'cs',
    itemId: String(en.itemId),
  });
  return { type, en, cs };
}

it('defaults: text and rich text are translated, other types are shared', () => {
  expect(isLocalized({ type: FieldType.TEXT })).toBe(true);
  expect(isLocalized({ type: FieldType.RICH_TEXT })).toBe(true);
  expect(isLocalized({ type: FieldType.NUMBER })).toBe(false);
  expect(isLocalized({ type: FieldType.TEXT, localized: false })).toBe(false);
  expect(isLocalized({ type: FieldType.NUMBER, localized: true })).toBe(true);
});

it('editing a shared field in one version updates the others, translated fields stay', async () => {
  const { en, cs } = await twoVersions();
  await ContentEntriesService.updateEntry(String(cs._id), { data: { title: 'Přes hory', km: 12 } });
  const after = await ContentEntryModel.findById(en._id).lean();
  expect(after?.data).toEqual({ title: 'Over the hills', km: 12 });
  expect(after?.title).toBe('Over the hills');
});

it('a shared title field also updates the other versions’ titles', async () => {
  const { en, cs } = await twoVersions(true);
  await ContentEntriesService.updateEntry(String(cs._id), { data: { title: 'Společný název', km: 10 } });
  expect((await ContentEntryModel.findById(en._id).lean())?.title).toBe('Společný název');
});

it('removing a shared value removes it from the other versions', async () => {
  const { en, cs } = await twoVersions();
  await ContentEntriesService.updateEntry(String(cs._id), { data: { title: 'Přes kopce' } });
  expect((await ContentEntryModel.findById(en._id).lean())?.data).toEqual({ title: 'Over the hills' });
});

it('turning a translated field into a shared one copies the default-language value', async () => {
  const { type, cs } = await twoVersions();
  await contentTypesService.updateContentType(String(type._id), {
    fields: [{ ...fields[0], localized: false }, fields[1]],
  });
  const after = await ContentEntryModel.findById(cs._id).lean();
  expect(after?.data.title).toBe('Over the hills');
  expect(after?.title).toBe('Over the hills');
});

it('turning a shared field into a translated one keeps each version’s value', async () => {
  const { type, en, cs } = await twoVersions();
  await ContentEntryModel.updateOne({ _id: cs._id }, { $set: { 'data.km': 99 } });
  await contentTypesService.updateContentType(String(type._id), {
    fields: [fields[0], { ...fields[1], localized: true }],
  });
  expect((await ContentEntryModel.findById(en._id).lean())?.data.km).toBe(10);
  expect((await ContentEntryModel.findById(cs._id).lean())?.data.km).toBe(99);
});
