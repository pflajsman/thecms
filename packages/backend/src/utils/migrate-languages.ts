import { LanguageModel } from '../models/language.model';
import { ContentEntryModel } from '../models/content-entry.model';

/**
 * Idempotent: creates English as the default language when none exist and
 * assigns entries without a language to the default, using their own id as item id.
 */
export async function migrateLanguages(): Promise<{ createdDefault: boolean; migratedEntries: number }> {
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
