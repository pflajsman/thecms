import { config } from '../config';
import type { Lang } from '../i18n';
import { TINTS, type Entry, type EntryList, type Media, type Page, type Project, type Tint } from '../types';

/** A non-2xx answer from the API. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Low-level GET against the TheCMS public API. */
export async function request<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${config.apiUrl}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { 'X-API-Key': config.apiKey } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new ApiError(typeof body.error === 'string' ? body.error : `API error ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(str(v));
  return Number.isFinite(n) ? n : undefined;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/** Case-insensitive field lookup; returns the value of the first non-empty candidate. */
function pick(data: Record<string, unknown>, ...candidates: string[]): unknown {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) lower[k.toLowerCase()] = v;
  for (const c of candidates) {
    const v = lower[c.toLowerCase()];
    if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) return v;
  }
  return undefined;
}

/** A MEDIA field holds one id, or a list of ids when it allows several. */
function ids(v: unknown): string[] {
  return (Array.isArray(v) ? v : [v]).map(str).filter(Boolean);
}

/** Tags are a comma-separated text field ("React, TypeScript"). */
export function splitTags(v: unknown): string[] {
  const parts = Array.isArray(v) ? v.map(str) : str(v).split(',');
  return [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
}

function toTint(v: unknown): Tint | undefined {
  const value = str(v).toLowerCase();
  return (TINTS as readonly string[]).includes(value) ? (value as Tint) : undefined;
}

/** Normalise a raw CMS entry into a typed Project. */
export function toProject(entry: Entry): Project {
  const d = entry.data ?? {};
  const body = str(pick(d, 'body', 'content', 'description'));
  const [cover, ...rest] = ids(pick(d, 'cover', 'coverImage', 'image'));
  return {
    id: entry.itemId || entry.id,
    title: str(pick(d, 'title', 'name')),
    summary: str(pick(d, 'summary', 'excerpt', 'perex')) || stripHtml(body).slice(0, 180),
    body,
    cover,
    gallery: [...rest, ...ids(pick(d, 'gallery', 'images'))],
    tags: splitTags(pick(d, 'tags', 'stack', 'technologies')),
    year: num(pick(d, 'year')),
    role: str(pick(d, 'role')) || undefined,
    liveUrl: str(pick(d, 'liveUrl', 'url', 'website')) || undefined,
    repoUrl: str(pick(d, 'repoUrl', 'repo', 'github')) || undefined,
    order: num(pick(d, 'order')),
    tint: toTint(pick(d, 'tint', 'color')),
    date: entry.publishedAt || entry.createdAt,
  };
}

/** Projects with an order first (ascending), then the rest, newest year and publication first. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.order !== undefined || b.order !== undefined) {
      if (a.order === undefined) return 1;
      if (b.order === undefined) return -1;
      if (a.order !== b.order) return a.order - b.order;
    }
    if ((b.year ?? 0) !== (a.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
    return b.date.localeCompare(a.date);
  });
}

/** The plate colour of a project: its own tint, or the next one in turn. */
export function tintFor(project: Project, index: number): Tint {
  return project.tint ?? TINTS[index % TINTS.length];
}

export const cms = {
  async listProjects(lang: Lang): Promise<Project[]> {
    const res = await request<EntryList>(`/content/${config.projectsSlug}`, { language: lang, limit: 200 });
    return sortProjects((res.data ?? []).map(toProject));
  },

  /** Accepts the shared item id or any language version id. */
  async getProject(lang: Lang, id: string): Promise<Project> {
    const res = await request<{ data: Entry }>(`/content/${config.projectsSlug}/${id}`, { language: lang });
    return toProject(res.data);
  },

  /**
   * A static page by its `key` field (e.g. "home", "about"). Null when the page
   * content type or the entry does not exist, so callers fall back to built-in copy.
   */
  async getPageByKey(lang: Lang, key: string): Promise<Page | null> {
    let res: EntryList;
    try {
      res = await request<EntryList>(`/content/${config.pagesSlug}`, { language: lang, limit: 50 });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
    const entry = (res.data ?? []).find((e) => str(pick(e.data ?? {}, 'key')) === key);
    if (!entry) return null;
    const d = entry.data ?? {};
    return {
      key,
      title: str(pick(d, 'title')),
      subtitle: str(pick(d, 'subtitle', 'tagline')),
      body: str(pick(d, 'body', 'content')),
      image: ids(pick(d, 'image', 'photo', 'portrait'))[0],
    };
  },

  async getMedia(id: string): Promise<Media> {
    const res = await request<{ data: Media }>(`/media/${id}`);
    return res.data;
  },
};
