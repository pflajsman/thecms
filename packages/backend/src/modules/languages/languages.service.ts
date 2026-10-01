import { LanguageModel, type ILanguage } from '../../models/language.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { AppError } from '../../middleware/error.middleware';

export class LanguagesService {
  static list(): Promise<ILanguage[]> {
    return LanguageModel.find().sort({ order: 1 }).exec();
  }

  static async codes(): Promise<string[]> {
    // Sorted by order so error messages and lists are stable.
    return (await LanguageModel.find().sort({ order: 1 }).select('code').lean()).map((l) => l.code);
  }

  static async defaultCode(): Promise<string> {
    const found = await LanguageModel.findOne({ isDefault: true }).select('code').lean();
    return found?.code ?? 'en';
  }

  static async assertExists(code: string): Promise<void> {
    // Before the startup migration runs (fresh test databases), English is the only language.
    const stored = await LanguagesService.codes();
    const codes = stored.length > 0 ? stored : ['en'];
    if (!codes.includes(code)) {
      throw new AppError(`Unknown language '${code}'. Use one of: ${codes.join(', ')}`, 400);
    }
  }

  static async create(input: { code: string; name: string }): Promise<ILanguage> {
    const code = input.code.toLowerCase();
    if (await LanguageModel.exists({ code })) throw new AppError(`Language '${code}' already exists`, 409);
    const count = await LanguageModel.countDocuments();
    return LanguageModel.create({ code, name: input.name, isDefault: count === 0, order: count });
  }

  static async rename(code: string, name: string): Promise<ILanguage> {
    const found = await LanguageModel.findOneAndUpdate({ code }, { $set: { name } }, { new: true });
    if (!found) throw new AppError('Language not found', 404);
    return found;
  }

  static async makeDefault(code: string): Promise<ILanguage> {
    const found = await LanguageModel.findOne({ code });
    if (!found) throw new AppError('Language not found', 404);
    await LanguageModel.updateMany({ code: { $ne: code } }, { $set: { isDefault: false } });
    found.isDefault = true;
    await found.save();
    return found;
  }

  static async remove(code: string, confirm?: string): Promise<{ deletedVersions: number }> {
    const found = await LanguageModel.findOne({ code });
    if (!found) throw new AppError('Language not found', 404);
    if (confirm !== code) throw new AppError(`Type ${code} to confirm`, 400);
    if (found.isDefault) throw new AppError('The default language cannot be deleted', 409);
    if ((await LanguageModel.countDocuments()) <= 1) throw new AppError('The last language cannot be deleted', 409);
    // A product whose text exists only in this language would be left without content.
    const productType = await ContentTypeModel.findOne({ system: 'product' }).select('_id').lean();
    if (productType) {
      const inLanguage = await ContentEntryModel.distinct('itemId', { contentTypeId: productType._id, language: code });
      const elsewhere = await ContentEntryModel.distinct('itemId', { itemId: { $in: inLanguage }, language: { $ne: code } });
      const only = inLanguage.length - elsewhere.length;
      if (only > 0) throw new AppError(`${only} products have content only in ${code}; translate or delete them first`, 409);
    }
    const { deletedCount } = await ContentEntryModel.deleteMany({ language: code });
    await found.deleteOne();
    return { deletedVersions: deletedCount ?? 0 };
  }
}
