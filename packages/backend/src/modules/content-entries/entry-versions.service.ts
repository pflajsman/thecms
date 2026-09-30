import mongoose from 'mongoose';
import { ContentEntryModel, type IContentEntry } from '../../models/content-entry.model';
import { LanguagesService } from '../languages/languages.service';
import { sharedFieldNames } from '../../utils/localized';
import { resolveTitleField } from '../../utils/entryTitle';
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
