import type { Entry } from '../types';

export function entry(itemId: string, data: Record<string, unknown>, language = 'cs'): Entry {
  return {
    id: `${itemId}-${language}`,
    itemId,
    language,
    contentTypeId: 'project-type',
    status: 'PUBLISHED',
    publishedAt: '2026-09-01T10:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    data,
  };
}

export const list = (data: Entry[]) => ({ body: { success: true, data, pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 } } });
