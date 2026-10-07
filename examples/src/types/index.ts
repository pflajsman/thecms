/** Shapes returned by TheCMS public API. */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Entry {
  /** Id of this language version. */
  id: string;
  /** Id shared by all language versions of the entry. */
  itemId?: string;
  contentTypeId: string;
  language?: string;
  status: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Dynamic fields, keyed by the content type's field names. */
  data: Record<string, unknown>;
}

export interface EntryList {
  data: Entry[];
  pagination: Pagination;
}

export interface Media {
  id: string;
  url: string;
  originalName: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export const TINTS = ['blue', 'lilac', 'blush', 'sun', 'mint'] as const;
export type Tint = (typeof TINTS)[number];

/** A portfolio project, normalised from an Entry's dynamic data. */
export interface Project {
  /** The shared item id, so links work in both languages. */
  id: string;
  title: string;
  summary: string;
  body: string;
  /** Media id of the cover image. */
  cover?: string;
  /** Media ids of further images. */
  gallery: string[];
  tags: string[];
  year?: number;
  role?: string;
  liveUrl?: string;
  repoUrl?: string;
  /** Lower comes first; projects without one follow, newest year first. */
  order?: number;
  /** Background of the project's plate; unset projects take turns. */
  tint?: Tint;
  date: string;
}

/** Static page text (home intro, about), keyed by `key` (e.g. "home", "about"). */
export interface Page {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  /** Media id of the page image (the portrait on About). */
  image?: string;
}
