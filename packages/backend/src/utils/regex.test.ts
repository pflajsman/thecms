import { escapeRegex } from './regex';

describe('escapeRegex', () => {
  it('escapes every regex metacharacter', () => {
    const input = 'C++ (draft) [1] {2} a.b*c?d^e$f|g\\h';
    const re = new RegExp(escapeRegex(input));
    expect(re.test(input)).toBe(true);
    expect(re.test('C (draft)')).toBe(false);
  });

  it('leaves plain text unchanged', () => {
    expect(escapeRegex('Krkonoše 2026')).toBe('Krkonoše 2026');
  });
});
