import mongoose from 'mongoose';
import { ContentEntryModel } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { LanguageModel } from '../../models/language.model';
import { AppError } from '../../middleware/error.middleware';
import { LanguagesService } from '../languages/languages.service';
import { FieldType } from '../../types/field-types';
import { isLocalized } from '../../utils/localized';
import { resolveTitleField } from '../../utils/entryTitle';

export interface TranslationField {
  name: string;
  label: string;
  type: 'TEXT' | 'RICH_TEXT';
  value: string;
}

export interface TranslationPlan {
  contentType: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  fields: TranslationField[];
}

/** Checks the request and lists the fields to translate: the title field first, then the other translated text fields with text. */
export async function planTranslation(entryId: string, language: string): Promise<TranslationPlan> {
  if (!mongoose.Types.ObjectId.isValid(entryId)) throw new AppError('Invalid entry ID', 400);
  const source = await ContentEntryModel.findById(entryId).lean();
  if (!source) throw new AppError('Content entry not found', 404);
  await LanguagesService.assertExists(language);
  if (source.language === language) throw new AppError('The entry is already in this language', 400);
  if (await ContentEntryModel.exists({ itemId: source.itemId, language })) {
    throw new AppError('This language already exists for this entry', 409, { reason: 'VERSION_EXISTS' });
  }
  const type = await ContentTypeModel.findById(source.contentTypeId).select('name fields titleField').lean();
  if (!type) throw new AppError('Content type not found', 404);

  const languages = await LanguageModel.find({ code: { $in: [source.language, language] } }).select('code name').lean();
  const nameOf = (code: string) => languages.find((l) => l.code === code)?.name ?? code;

  const titleName = resolveTitleField(type.fields, type.titleField);
  const ordered = [...type.fields].sort((a, b) => Number(b.name === titleName) - Number(a.name === titleName));
  const fields: TranslationField[] = [];
  for (const f of ordered) {
    if ((f.type !== FieldType.TEXT && f.type !== FieldType.RICH_TEXT) || !isLocalized(f)) continue;
    const value = source.data?.[f.name];
    if (typeof value !== 'string' || !value.trim()) continue;
    fields.push({ name: f.name, label: f.label || f.name, type: f.type === FieldType.RICH_TEXT ? 'RICH_TEXT' : 'TEXT', value });
  }

  return {
    contentType: type.name,
    from: { code: source.language, name: nameOf(source.language) },
    to: { code: language, name: nameOf(language) },
    fields,
  };
}
