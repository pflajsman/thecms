import { FieldDefinition, FieldType } from '../types/field-types';

export const UNTITLED = 'Untitled';
const MAX_TITLE_LENGTH = 200;

type TitleFieldSource = Pick<FieldDefinition, 'name' | 'type'>;

/**
 * The field whose value is an entry's title: the explicit titleField when it
 * names a TEXT field, otherwise the first TEXT field.
 */
export function resolveTitleField(
  fields: TitleFieldSource[],
  titleField?: string
): string | undefined {
  if (titleField && fields.some((f) => f.name === titleField && f.type === FieldType.TEXT)) {
    return titleField;
  }
  return fields.find((f) => f.type === FieldType.TEXT)?.name;
}

export function computeEntryTitle(
  data: Record<string, unknown> | undefined,
  fields: TitleFieldSource[],
  titleField?: string
): string {
  const key = resolveTitleField(fields, titleField);
  const raw = key ? data?.[key] : undefined;
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text ? text.slice(0, MAX_TITLE_LENGTH) : UNTITLED;
}
