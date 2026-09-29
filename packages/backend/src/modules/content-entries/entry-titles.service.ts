import { ContentEntryModel } from '../../models/content-entry.model';
import { FieldDefinition } from '../../types/field-types';
import { computeEntryTitle } from '../../utils/entryTitle';

interface TitleSource {
  _id: unknown;
  fields: FieldDefinition[];
  titleField?: string;
}

/**
 * Recompute the stored `title` of every entry of a content type.
 * Writes through the native driver so `updatedAt` is not touched: a title
 * recompute is not an edit.
 */
export async function recomputeTitlesForType(contentType: TitleSource): Promise<number> {
  const entries = await ContentEntryModel.find({ contentTypeId: contentType._id })
    .select('_id data title')
    .lean();

  const ops = entries.flatMap((entry) => {
    const title = computeEntryTitle(entry.data, contentType.fields, contentType.titleField);
    if (title === entry.title) return [];
    return [{ updateOne: { filter: { _id: entry._id }, update: { $set: { title } } } }];
  });

  if (ops.length > 0) {
    await ContentEntryModel.collection.bulkWrite(ops);
  }
  return ops.length;
}
