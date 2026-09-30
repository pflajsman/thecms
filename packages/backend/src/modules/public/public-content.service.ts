import mongoose from 'mongoose';
import { ContentEntryModel, ContentStatus, type IContentEntry } from '../../models/content-entry.model';
import { LanguagesService } from '../languages/languages.service';

/** A version as the public API returns it: the entry JSON plus the language it is in. */
export type PublicEntry = ReturnType<IContentEntry['toJSON']> & { language: string; fallback: boolean };

export interface PublicListOptions {
  language: string;
  defaultLanguage: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

function toPublic(entry: IContentEntry, requested: string): PublicEntry {
  return { ...entry.toJSON(), language: entry.language, fallback: entry.language !== requested };
}

/** The requested language (or the default one when none is given); 400 for unknown codes. */
export async function resolveLanguage(requested?: unknown): Promise<{ language: string; defaultLanguage: string }> {
  const defaultLanguage = await LanguagesService.defaultCode();
  if (typeof requested !== 'string' || requested.trim() === '') return { language: defaultLanguage, defaultLanguage };
  const language = requested.trim().toLowerCase();
  await LanguagesService.assertExists(language);
  return { language, defaultLanguage };
}

/**
 * Ids of one published version per item, in page order: the requested language when it exists,
 * else the default language. Only ids, the language and the sort key are grouped, not whole documents.
 */
function pickVersionPipeline(contentTypeId: string, language: string, defaultLanguage: string, sortBy: string) {
  return [
    {
      $match: {
        contentTypeId: new mongoose.Types.ObjectId(contentTypeId),
        status: ContentStatus.PUBLISHED,
        language: { $in: [language, defaultLanguage] },
      },
    },
    { $project: { _id: 1, itemId: 1, language: 1, sortKey: `$${sortBy}` } },
    { $group: { _id: '$itemId', versions: { $push: { _id: '$_id', language: '$language', sortKey: '$sortKey' } } } },
    {
      $project: {
        chosen: {
          $let: {
            vars: { wanted: { $filter: { input: '$versions', as: 'v', cond: { $eq: ['$$v.language', language] } } } },
            in: {
              $cond: [
                { $gt: [{ $size: '$$wanted' }, 0] },
                { $arrayElemAt: ['$$wanted', 0] },
                { $arrayElemAt: ['$versions', 0] },
              ],
            },
          },
        },
      },
    },
    { $replaceRoot: { newRoot: '$chosen' } },
  ];
}

export async function listPublished(contentTypeId: string, opts: PublicListOptions) {
  const { language, defaultLanguage, page, limit, sortBy, sortOrder } = opts;
  const direction = sortOrder === 'asc' ? 1 : -1;
  const skip = (page - 1) * limit;

  let entries: IContentEntry[];
  let total: number;
  if (language === defaultLanguage) {
    // Sites that do not ask for a language keep a plain find with a single-field sort.
    const query = { contentTypeId, status: ContentStatus.PUBLISHED, language };
    [entries, total] = await Promise.all([
      ContentEntryModel.find(query).sort({ [sortBy]: direction }).skip(skip).limit(limit).exec(),
      ContentEntryModel.countDocuments(query),
    ]);
  } else {
    // Choosing before sorting and paging keeps totals and page sizes in items, not versions.
    const pipeline = pickVersionPipeline(contentTypeId, language, defaultLanguage, sortBy);
    const [picked, counted] = await Promise.all([
      ContentEntryModel.aggregate<{ _id: mongoose.Types.ObjectId }>([
        ...pipeline,
        { $sort: { sortKey: direction } },
        { $skip: skip },
        { $limit: limit },
      ]),
      ContentEntryModel.aggregate<{ total: number }>([...pipeline, { $count: 'total' }]),
    ]);
    const docs = await ContentEntryModel.find({ _id: { $in: picked.map((p) => p._id) } }).exec();
    const byId = new Map<string, IContentEntry>(docs.map((d) => [String(d._id), d]));
    entries = picked.flatMap((p) => byId.get(String(p._id)) ?? []);
    total = counted[0]?.total ?? 0;
  }

  return {
    entries: entries.map((e) => toPublic(e, language)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** A published version of the item that `id` names (an item id or any version id). */
export async function getPublished(
  contentTypeId: string,
  id: string,
  language: string,
  defaultLanguage: string
): Promise<PublicEntry | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const direct = await ContentEntryModel.findById(id).select('itemId').lean();
  const itemId = direct?.itemId ?? new mongoose.Types.ObjectId(id);
  const versions = await ContentEntryModel.find({
    itemId,
    contentTypeId,
    status: ContentStatus.PUBLISHED,
    language: { $in: [language, defaultLanguage] },
  })
    .populate('contentTypeId')
    .exec();
  const chosen = versions.find((v) => v.language === language) ?? versions.find((v) => v.language === defaultLanguage);
  return chosen ? toPublic(chosen, language) : null;
}

/** Keep one version per item, the requested language first, in the order given. */
export function onePerItem(entries: IContentEntry[], language: string): PublicEntry[] {
  const chosen = new Map<string, IContentEntry>();
  for (const e of entries) {
    const key = String(e.itemId);
    const current = chosen.get(key);
    if (!current || (current.language !== language && e.language === language)) chosen.set(key, e);
  }
  const keep = new Set(chosen.values());
  return entries.filter((e) => keep.has(e)).map((e) => toPublic(e, language));
}
