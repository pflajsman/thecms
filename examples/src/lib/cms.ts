import { config } from '../config';
import type { ContactForm, Entry, EntryList, Post } from '../types';

/** Low-level fetch against the TheCMS public API. */
async function request<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${config.apiUrl}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { headers: { 'X-API-Key': config.apiKey } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API error ${res.status}`);
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

/** Normalise a raw CMS entry into a typed Post, tolerant of field-name variations. */
export function toPost(entry: Entry): Post {
  const d = entry.data ?? {};
  const body = str(d.body ?? d.content);
  const excerptRaw = str(d.excerpt ?? d.summary) || stripHtml(body).slice(0, 200);
  const tags = Array.isArray(d.tags) ? d.tags.map(str) : str(d.tags) ? [str(d.tags)] : [];

  return {
    id: entry.id,
    title: str(d.title ?? d.name) || 'Bez názvu',
    excerpt: excerptRaw,
    body,
    coverImage: str(d.coverImage ?? d.image) || undefined,
    author: str(d.author) || undefined,
    tags,
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
