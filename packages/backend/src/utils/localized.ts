import { FieldType, type FieldDefinition } from '../types/field-types';

/** Translated per language version unless set otherwise; TEXT and RICH_TEXT are translated by default. */
export function isLocalized(field: Pick<FieldDefinition, 'type' | 'localized'>): boolean {
  if (field.localized !== undefined && field.localized !== null) return field.localized;
  return field.type === FieldType.TEXT || field.type === FieldType.RICH_TEXT;
}

/** Names of the fields that are the same in every language version. */
export function sharedFieldNames(fields: Pick<FieldDefinition, 'name' | 'type' | 'localized'>[]): string[] {
  return fields.filter((f) => !isLocalized(f)).map((f) => f.name);
}
