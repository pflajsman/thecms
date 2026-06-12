/** Shapes returned by TheCMS public API. */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Entry {
  id: string;
  contentTypeId: string;
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

export type FormFieldType =
  | 'TEXT'
  | 'EMAIL'
  | 'TEXTAREA'
  | 'SELECT'
  | 'NUMBER'
  | 'CHECKBOX'
  | 'DATE';

export interface FormField {
  name: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface ContactForm {
  name: string;
  description?: string;
  fields: FormField[];
}

/** A blog post, normalised from an Entry's dynamic data. */
export interface Post {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage?: string;
  author?: string;
  tags: string[];
  date: string;
}

/** Static page text (home intro, about), keyed by `key` (e.g. "home", "about"). */
export interface Page {
  key: string;
  title: string;
  subtitle: string;
  body: string;
}
