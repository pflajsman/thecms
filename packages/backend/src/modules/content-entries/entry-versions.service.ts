import mongoose from 'mongoose';
import { ContentEntryModel, ContentStatus, type IContentEntry } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { LanguageModel } from '../../models/language.model';
import { WebhookEvent } from '../../models/webhook.model';
import { WebhookService } from '../../services/webhook.service';
import { AppError } from '../../middleware/error.middleware';
import { LanguagesService } from '../languages/languages.service';
import { sharedFieldNames } from '../../utils/localized';
import { computeEntryTitle, resolveTitleField } from '../../utils/entryTitle';
import type { FieldDefinition } from '../../types/field-types';

/**
 * Copy the saved version's shared fields (and its title when the title field is shared)
 * to the other versions of the same item.
 */
export async function syncSharedFields(
  entry: IContentEntry,
  fields: FieldDefinition[],
  titleField?: string
): Promise<void> {
  const shared = sharedFieldNames(fields);
  if (shared.length === 0) return;

  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  for (const name of shared) {
    const value = entry.data?.[name];
    if (value === undefined) unset[`data.${name}`] = '';
    else set[`data.${name}`] = value;
  }
  const titleName = resolveTitleField(fields, titleField);
  if (titleName && shared.includes(titleName)) set.title = entry.title;

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;
  await ContentEntryModel.updateMany({ itemId: entry.itemId, _id: { $ne: entry._id } }, update);
}

/**
 * A field became shared: every item takes the value from its default-language version,
 * or from its oldest version when there is none in the default language.
 */
export async function unifySharedField(contentTypeId: string, fieldName: string): Promise<void> {
  const defaultCode = await LanguagesService.defaultCode();
  const versions = await ContentEntryModel.find({ contentTypeId: new mongoose.Types.ObjectId(contentTypeId) })
    .select('_id itemId language data createdAt')
    .lean();

  const byItem = new Map<string, typeof versions>();
  for (const v of versions) {
    const key = String(v.itemId);
    byItem.set(key, [...(byItem.get(key) ?? []), v]);
  }

  for (const group of byItem.values()) {
    if (group.length < 2) continue;
    const source =
      group.find((v) => v.language === defaultCode) ??
      [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const value = source.data?.[fieldName];
    const update =
      value === undefined
        ? { $unset: { [`data.${fieldName}`]: '' } }
        : { $set: { [`data.${fieldName}`]: value } };
    await ContentEntryModel.updateMany({ itemId: source.itemId, _id: { $ne: source._id } }, update);
  }
}

async function loadVersion(entryId: string): Promise<IContentEntry> {
  if (!mongoose.Types.ObjectId.isValid(entryId)) throw new AppError('Invalid entry ID', 400);
  const entry = await ContentEntryModel.findById(entryId);
  if (!entry) throw new AppError('Content entry not found', 404);
  return entry;
}

/**
 * There is no unique index on { itemId, language } (Cosmos DB cannot add one to a non-empty collection),
 * so two concurrent requests can both pass the check. After writing, the version with the lowest _id in
 * that language wins; every other request sees the same winner and undoes its own write.
 */
export async function isFirstInLanguage(entry: IContentEntry): Promise<boolean> {
  const first = await ContentEntryModel.findOne({ itemId: entry.itemId, language: entry.language })
    .sort({ _id: 1 })
    .select('_id')
    .lean();
  return !first || String(first._id) === String(entry._id);
}

const LANGUAGE_TAKEN = 'This language already exists for this entry';

async function assertLanguageFree(itemId: mongoose.Types.ObjectId, language: string): Promise<void> {
  if (await ContentEntryModel.exists({ itemId, language })) {
    throw new AppError(LANGUAGE_TAKEN, 409);
  }
}

async function contentTypeRef(contentTypeId: mongoose.Types.ObjectId) {
  const type = await ContentTypeModel.findById(contentTypeId).select('name slug').lean();
  return type ? { id: type._id, name: type.name, slug: type.slug } : undefined;
}

export interface EntryVersionSummary {
  id: string;
  language: string;
  status: ContentStatus;
  title: string;
  updatedAt: Date;
}

/** Every version of the entry's item, in the configured language order. */
export async function listVersions(entryId: string): Promise<EntryVersionSummary[]> {
  const entry = await loadVersion(entryId);
  const [versions, languages] = await Promise.all([
    ContentEntryModel.find({ itemId: entry.itemId }).select('_id language status title updatedAt').lean(),
    LanguageModel.find().select('code order').lean(),
  ]);
  const order = new Map(languages.map((l) => [l.code, l.order]));
  return versions
    .map((v) => ({ id: String(v._id), language: v.language, status: v.status, title: v.title, updatedAt: v.updatedAt }))
    .sort((a, b) => (order.get(a.language) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.language) ?? Number.MAX_SAFE_INTEGER));
}

/** New DRAFT version in `language`, copied from the given version; `overrides.data` replaces copied values (a translation). */
export async function createVersion(
  entryId: string,
  language: string,
  userId?: string,
  overrides?: { data?: Record<string, unknown> }
): Promise<IContentEntry> {
  const source = await loadVersion(entryId);
  await LanguagesService.assertExists(language);
  await assertLanguageFree(source.itemId, language);
  let data = source.data;
  let title = source.title;
  if (overrides?.data) {
    data = { ...source.data, ...overrides.data };
    const type = await ContentTypeModel.findById(source.contentTypeId).select('fields titleField').lean();
    if (type) title = computeEntryTitle(data, type.fields, type.titleField);
  }
  const version = await ContentEntryModel.create({
    contentTypeId: source.contentTypeId,
    itemId: source.itemId,
    language,
    data,
    title,
    status: ContentStatus.DRAFT,
    createdBy: userId,
    updatedBy: userId,
  });
  if (!(await isFirstInLanguage(version))) {
    await version.deleteOne();
    throw new AppError(LANGUAGE_TAKEN, 409);
  }
  WebhookService.triggerEvent(WebhookEvent.ENTRY_CREATED, {
    entry: version.toJSON(),
    contentType: await contentTypeRef(source.contentTypeId),
  }).catch((err) => console.error('Webhook trigger error:', err));
  return version;
}

/** Move a version to another language that the item does not have yet. */
export async function changeLanguage(entryId: string, language: string): Promise<IContentEntry> {
  const entry = await loadVersion(entryId);
  if (entry.language === language) return entry;
  await LanguagesService.assertExists(language);
  await assertLanguageFree(entry.itemId, language);
  const previous = entry.language;
  entry.language = language;
  await entry.save();
  if (!(await isFirstInLanguage(entry))) {
    entry.language = previous;
    await entry.save();
    throw new AppError(LANGUAGE_TAKEN, 409);
  }
  WebhookService.triggerEvent(WebhookEvent.ENTRY_UPDATED, {
    entry: entry.toJSON(),
    contentType: await contentTypeRef(entry.contentTypeId),
  }).catch((err) => console.error('Webhook trigger error:', err));
  return entry;
}
