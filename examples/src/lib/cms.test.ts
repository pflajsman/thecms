import { describe, expect, it } from 'vitest';
import { cms, sortProjects, splitTags, tintFor, toProject } from './cms';
import { entry } from '../test/fixtures';
import { mockApi } from '../test/api-mock';

describe('toProject', () => {
  it('reads fields, uses the shared item id and splits tags', () => {
    const p = toProject(
      entry('item1', { title: 'Lab', summary: 'Short', tags: 'React, TypeScript, React', cover: 'm1', gallery: ['m2', 'm3'], year: '2025', tint: 'Mint' }),
    );
    expect(p).toMatchObject({ id: 'item1', title: 'Lab', summary: 'Short', tags: ['React', 'TypeScript'], cover: 'm1', gallery: ['m2', 'm3'], year: 2025, tint: 'mint' });
  });

  it('falls back to the body text for the summary and ignores unknown tints', () => {
    const p = toProject(entry('item2', { title: 'X', body: '<p>Hello <b>world</b></p>', tint: 'orange' }));
    expect(p.summary).toBe('Hello world');
    expect(p.tint).toBeUndefined();
  });
});

describe('sortProjects', () => {
  it('puts ordered projects first, then newest year', () => {
    const projects = [
      toProject(entry('a', { title: 'A', year: 2020 })),
      toProject(entry('b', { title: 'B', year: 2024 })),
      toProject(entry('c', { title: 'C', order: 2 })),
      toProject(entry('d', { title: 'D', order: 1 })),
    ];
    expect(sortProjects(projects).map((p) => p.id)).toEqual(['d', 'c', 'b', 'a']);
  });
});

describe('tintFor', () => {
  it('keeps a chosen tint and cycles otherwise', () => {
    const p = toProject(entry('a', { title: 'A' }));
    expect(tintFor(p, 0)).toBe('blue');
    expect(tintFor(p, 6)).toBe('lilac');
    expect(tintFor({ ...p, tint: 'sun' }, 0)).toBe('sun');
  });
});

describe('splitTags', () => {
  it('accepts lists and trims', () => {
    expect(splitTags([' Node ', 'Azure'])).toEqual(['Node', 'Azure']);
    expect(splitTags('')).toEqual([]);
  });
});

describe('getPageByKey', () => {
  it('returns null when the page content type does not exist', async () => {
    mockApi({ 'GET /content/page': () => ({ status: 404, body: { success: false, error: 'Content type not found' } }) });
    await expect(cms.getPageByKey('en', 'about')).resolves.toBeNull();
  });

  it('asks for the given language', async () => {
    const { calls } = mockApi({});
    await cms.getPageByKey('cs', 'about');
    expect(calls[0].url.searchParams.get('language')).toBe('cs');
  });
});
