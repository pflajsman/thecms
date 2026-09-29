import { computeEntryTitle, resolveTitleField, UNTITLED } from './entryTitle';
import { FieldType } from '../types/field-types';

const fields = [
  { name: 'cover', type: FieldType.MEDIA },
  { name: 'headline', type: FieldType.TEXT },
  { name: 'subtitle', type: FieldType.TEXT },
  { name: 'distanceKm', type: FieldType.NUMBER },
];

describe('resolveTitleField', () => {
  it('uses the explicit titleField when it names a TEXT field', () => {
    expect(resolveTitleField(fields, 'subtitle')).toBe('subtitle');
  });

  it('falls back to the first TEXT field when titleField is unset', () => {
    expect(resolveTitleField(fields)).toBe('headline');
  });

  it('ignores a titleField that is not a TEXT field', () => {
    expect(resolveTitleField(fields, 'distanceKm')).toBe('headline');
  });

  it('ignores a titleField that does not exist', () => {
    expect(resolveTitleField(fields, 'missing')).toBe('headline');
  });

  it('returns undefined when there is no TEXT field', () => {
    expect(resolveTitleField([{ name: 'n', type: FieldType.NUMBER }])).toBeUndefined();
  });
});

describe('computeEntryTitle', () => {
  it('returns the trimmed title value', () => {
    expect(computeEntryTitle({ headline: '  Přes Šumavu  ' }, fields)).toBe('Přes Šumavu');
  });

  it('returns Untitled for empty or whitespace values', () => {
    expect(computeEntryTitle({ headline: '   ' }, fields)).toBe(UNTITLED);
    expect(computeEntryTitle({}, fields)).toBe(UNTITLED);
    expect(computeEntryTitle(undefined, fields)).toBe(UNTITLED);
  });

  it('returns Untitled for non-string values', () => {
    expect(computeEntryTitle({ headline: 42 }, fields)).toBe(UNTITLED);
  });

  it('returns Untitled when the type has no TEXT field', () => {
    expect(computeEntryTitle({ n: 'x' }, [{ name: 'n', type: FieldType.NUMBER }])).toBe(UNTITLED);
  });

  it('truncates to 200 characters', () => {
    expect(computeEntryTitle({ headline: 'a'.repeat(250) }, fields)).toHaveLength(200);
  });

  it('respects an explicit titleField', () => {
    expect(computeEntryTitle({ headline: 'A', subtitle: 'B' }, fields, 'subtitle')).toBe('B');
  });
});
