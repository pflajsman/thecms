import { config } from '../config';
import type { ContactForm, Entry, EntryList, Page, Post, Trip } from '../types';

/** A non-2xx answer from the API, with the error body (for example `reason: 'PRICE_CHANGED'`). */
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get reason(): string | undefined {
    return typeof this.body.reason === 'string' ? this.body.reason : undefined;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

/** Low-level fetch against the TheCMS public API. */
export async function request<T>(endpoint: string, params: Record<string, unknown> = {}, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${config.apiUrl}${endpoint}`);
  // Content requests ask for the configured language; the CMS falls back to its default language.
  const all = endpoint.startsWith('/content/') ? { language: config.contentLanguage, ...params } : params;
  for (const [k, v] of Object.entries(all)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { 'X-API-Key': config.apiKey, ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(typeof body.error === 'string' ? body.error : `API error ${res.status}`, res.status, body);
  }
  return res.json() as Promise<T>;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/**
 * Case-insensitive field lookup. The admin lowercases content-type field names
 * (e.g. `gpxUrl` is stored as `gpxurl`), so match keys ignoring case. Returns
 * the value of the first matching candidate.
 */
function pick(data: Record<string, unknown>, ...candidates: string[]): unknown {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) lower[k.toLowerCase()] = v;
  for (const c of candidates) {
    const v = lower[c.toLowerCase()];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

/** Normalise a raw CMS entry into a typed Post, tolerant of field-name variations. */
export function toPost(entry: Entry): Post {
  const d = entry.data ?? {};
  const body = str(pick(d, 'body', 'content'));
  const excerptRaw = str(pick(d, 'excerpt', 'summary')) || stripHtml(body).slice(0, 200);
  const tagsVal = pick(d, 'tags');
  const tags = Array.isArray(tagsVal) ? tagsVal.map(str) : str(tagsVal) ? [str(tagsVal)] : [];

  return {
    id: entry.id,
    title: str(pick(d, 'title', 'name')) || 'Bez názvu',
    excerpt: excerptRaw,
    body,
    coverImage: str(pick(d, 'coverImage', 'image')) || undefined,
    author: str(pick(d, 'author')) || undefined,
    tags,
    date: entry.publishedAt || entry.createdAt,
  };
}

function toNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(str(v));
  return Number.isFinite(n) ? n : undefined;
}

/** Normalise a raw CMS entry into a typed Trip. */
export function toTrip(entry: Entry): Trip {
  const d = entry.data ?? {};
  const body = str(pick(d, 'body', 'content'));
  return {
    id: entry.id,
    title: str(pick(d, 'title', 'name')) || 'Bez názvu',
    summary: str(pick(d, 'summary', 'excerpt')) || stripHtml(body).slice(0, 160),
    body,
    gpxUrl: str(pick(d, 'gpxUrl', 'gpx', 'track')) || undefined,
    distanceKm: toNum(pick(d, 'distanceKm', 'distance')),
    date: entry.publishedAt || entry.createdAt,
  };
}

export const cms = {
  async listPosts(page = 1, limit = 10): Promise<{ posts: Post[]; total: number; totalPages: number }> {
    const res = await request<EntryList>(`/content/${config.postsSlug}`, { page, limit });
    return {
      posts: (res.data ?? []).map(toPost),
      total: res.pagination?.total ?? 0,
      totalPages: res.pagination?.totalPages ?? 1,
    };
  },

  async getPost(id: string): Promise<Post> {
    const res = await request<{ data: Entry }>(`/content/${config.postsSlug}/${id}`);
    return toPost(res.data);
  },

  /**
   * Fetch a single static page by its `key` field (e.g. "home", "about").
   * Returns null if the page content type or matching entry doesn't exist,
   * so callers can fall back to built-in defaults.
   */
  async getPageByKey(key: string): Promise<Page | null> {
    const res = await request<EntryList>(`/content/${config.pagesSlug}`, { limit: 50 });
    const entry = (res.data ?? []).find((e) => str(pick(e.data ?? {}, 'key')) === key);
    if (!entry) return null;
    const d = entry.data ?? {};
    return {
      key,
      title: str(pick(d, 'title')),
      subtitle: str(pick(d, 'subtitle', 'tagline')),
      body: str(pick(d, 'body', 'content')),
    };
  },

  async listTrips(page = 1, limit = 20): Promise<{ trips: Trip[]; total: number; totalPages: number }> {
    const res = await request<EntryList>(`/content/${config.tripsSlug}`, { page, limit });
    return {
      trips: (res.data ?? []).map(toTrip),
      total: res.pagination?.total ?? 0,
      totalPages: res.pagination?.totalPages ?? 1,
    };
  },

  async getTrip(id: string): Promise<Trip> {
    const res = await request<{ data: Entry }>(`/content/${config.tripsSlug}/${id}`);
    return toTrip(res.data);
  },

  /**
   * Resolve a media reference to a downloadable file URL + name.
   * Accepts either a full URL (returned as-is) or a media id (resolved via the
   * public media endpoint).
   */
  async resolveMedia(ref: string): Promise<{ url: string; filename: string } | null> {
    const value = (ref || '').trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) {
      return { url: value, filename: value.split('/').pop() || 'track.gpx' };
    }
    if (/^[a-f0-9]{24}$/i.test(value)) {
      // Throws on failure so the UI can show a real error instead of silently
      // pretending there's no track.
      const res = await request<{ data: { url: string; originalName: string } }>(`/media/${value}`);
      return { url: res.data.url, filename: res.data.originalName || 'track.gpx' };
    }
    // Unrecognised format (not a URL, not a 24-char id)
    throw new Error(`Neplatná hodnota gpxUrl: "${value}" (očekává se ID média nebo URL).`);
  },

  async getContactForm(): Promise<ContactForm> {
    const res = await request<{ data: ContactForm }>(`/forms/${config.contactFormSlug}`);
    return res.data;
  },

  async submitContactForm(values: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${config.apiUrl}/forms/${config.contactFormSlug}/submit`, {
      method: 'POST',
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `Odeslání selhalo (${res.status})`);
    }
  },
};
