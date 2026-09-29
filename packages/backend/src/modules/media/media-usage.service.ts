import mongoose from 'mongoose';
import { MediaModel } from '../../models/media.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';
import { escapeRegex } from '../../utils/regex';

export interface MediaUsageItem {
  id: string;
  title: string;
  status: ContentStatus;
  contentType: { id: string; name: string; slug: string };
}

const MAX_USAGE_RESULTS = 100;

export async function findMediaUsage(mediaId: string): Promise<MediaUsageItem[] | null> {
  if (!mongoose.Types.ObjectId.isValid(mediaId)) {
    throw new Error('Invalid media ID');
  }

  const media = await MediaModel.findById(mediaId).select('filename').lean();
  if (!media) return null;

  const stem = escapeRegex(media.filename.replace(/\.[^.]+$/, ''));
  const types = await ContentTypeModel.find({
    'fields.type': { $in: [FieldType.MEDIA, FieldType.RICH_TEXT] },
  })
    .select('name slug fields')
    .lean();

  const clauses: any[] = types.flatMap((type) => {
    const conditions: Record<string, unknown>[] = type.fields.flatMap((field): Record<string, unknown>[] => {
      if (field.type === FieldType.MEDIA) return [{ [`data.${field.name}`]: mediaId }];
      if (field.type === FieldType.RICH_TEXT) return [{ [`data.${field.name}`]: { $regex: stem } }];
      return [];
    });
    return conditions.length ? [{ contentTypeId: type._id, $or: conditions }] : [];
  });
  if (clauses.length === 0) return [];

  const entries = await ContentEntryModel.find({ $or: clauses })
    .select('title status contentTypeId')
    .sort({ updatedAt: -1 })
    .limit(MAX_USAGE_RESULTS)
    .lean();

  const typeMap = new Map(
    types.map((t) => [String(t._id), { id: String(t._id), name: t.name, slug: t.slug }])
  );

  return entries.map((e) => ({
    id: String(e._id),
    title: e.title,
    status: e.status,
    contentType: typeMap.get(String(e.contentTypeId))!,
  }));
}
