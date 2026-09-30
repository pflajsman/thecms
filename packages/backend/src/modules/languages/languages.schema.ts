import { z } from 'zod';
import { LANGUAGE_CODE } from '../../models/language.model';

const code = z.string().trim().toLowerCase().regex(LANGUAGE_CODE, 'Use a language code such as en, cs or de-at');
const name = z.string().trim().min(1).max(50);

export const createLanguageSchema = z.object({ body: z.object({ code, name }) });
export const renameLanguageSchema = z.object({ params: z.object({ code }), body: z.object({ name }) });
export const languageCodeSchema = z.object({ params: z.object({ code }) });
export const deleteLanguageSchema = z.object({
  params: z.object({ code }),
  query: z.object({ confirm: z.string().optional() }),
});
