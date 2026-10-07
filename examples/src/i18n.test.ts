import { describe, expect, it } from 'vitest';
import { preferredLang, translatePath } from './i18n';

describe('translatePath', () => {
  it('maps each section to the other language', () => {
    expect(translatePath('/cs/projekty/abc', 'en')).toBe('/en/projects/abc');
    expect(translatePath('/en/projects/abc', 'cs')).toBe('/cs/projekty/abc');
    expect(translatePath('/cs/o-mne', 'en')).toBe('/en/about');
    expect(translatePath('/en', 'cs')).toBe('/cs');
  });

  it('sends unknown pages to the home page', () => {
    expect(translatePath('/cs/nic-takoveho', 'en')).toBe('/en');
  });
});

describe('preferredLang', () => {
  it('picks Czech for Czech and Slovak browsers, English otherwise', () => {
    expect(preferredLang(['cs-CZ', 'en'])).toBe('cs');
    expect(preferredLang(['sk'])).toBe('cs');
    expect(preferredLang(['de-DE', 'en-US'])).toBe('en');
    expect(preferredLang([])).toBe('en');
  });
});
