import { LanguageModel } from '../models/language.model';
import { ContentEntryModel } from '../models/content-entry.model';

/**
 * MongoDB text indexes read a document field named `language` as its stemming language and reject
 * codes they do not know (for example `cs`). Entry versions use `language` for the content language,
 * so text indexes must read the stemming language from a field entries never have.
 */
export const TEXT_LANGUAGE_OVERRIDE = 'textSearchLanguage';

const NAMESPACE_NOT_FOUND = 26;

async function rebuildTextIndexes(): Promise<void> {
  let indexes: Array<Record<string, any>>;
  try {
    indexes = await ContentEntryModel.collection.indexes();
  } catch (error) {
    // Fresh database: no entries collection means no text index to fix.
    if ((error as { code?: number }).code === NAMESPACE_NOT_FOUND) return;
    throw error;
  }
  for (const index of indexes) {
    if (!index.weights || index.language_override === TEXT_LANGUAGE_OVERRIDE) continue;
    const key = Object.fromEntries(Object.keys(index.weights).map((field) => [field, 'text' as const]));
    await ContentEntryModel.collection.dropIndex(index.name);
    await ContentEntryModel.collection.createIndex(key, {
      name: index.name,
      weights: index.weights,
      default_language: index.default_language,
      language_override: TEXT_LANGUAGE_OVERRIDE,
    });
  }
}

/**
 * Idempotent: creates English as the default language when none exist and
 * assigns entries without a language to the default, using their own id as item id.
 */
export async function migrateLanguages(): Promise<{ createdDefault: boolean; migratedEntries: number }> {
  // Build the unique code index before the first language is inserted: Cosmos DB only creates
  // unique indexes on empty collections.
  await LanguageModel.createIndexes();
  await rebuildTextIndexes();

  let createdDefault = false;
  if ((await LanguageModel.countDocuments()) === 0) {
    await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
    createdDefault = true;
  }
  const defaultCode = (await LanguageModel.findOne({ isDefault: true }).select('code').lean())?.code ?? 'en';

  const pending = await ContentEntryModel.find({
    $or: [{ language: { $exists: false } }, { itemId: { $exists: false } }],
  })
    .select('_id language itemId')
    .lean();
  if (pending.length > 0) {
    await ContentEntryModel.bulkWrite(
      pending.map((e) => ({
        updateOne: {
          filter: { _id: e._id },
          update: { $set: { language: e.language ?? defaultCode, itemId: e.itemId ?? e._id } },
        },
      }))
    );
  }
  return { createdDefault, migratedEntries: pending.length };
}
