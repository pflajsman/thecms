import mongoose from 'mongoose';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentStatus, type IContentEntry } from '../../models/content-entry.model';
import { AppError } from '../../middleware/error.middleware';
import { LanguagesService } from '../languages/languages.service';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { listVersions } from '../content-entries/entry-versions.service';
import { contentTypesService } from '../content-types/content-types.service';
import { MediaService } from '../media/media.service';
import { isLocalized } from '../../utils/localized';
import { DATA_NOTE, registerTool, type McpContext } from './tool';

const STATUSES = [ContentStatus.DRAFT, ContentStatus.PUBLISHED, ContentStatus.ARCHIVED] as const;

/** A content type by id or slug. */
export async function resolveType(ref: string) {
  const byId = mongoose.Types.ObjectId.isValid(ref) ? await ContentTypeModel.findById(ref).lean() : null;
  const type = byId ?? (await ContentTypeModel.findOne({ slug: ref }).lean());
  if (!type) throw new AppError(`Unknown content type '${ref}'. Use list_content_types to see the slugs.`, 404);
  return type;
}

export interface EntryDetails {
  id: string;
  itemId: string;
  contentType: string | null;
  language: string;
  status: string;
  title: string;
  data: Record<string, unknown>;
  updatedAt: Date;
  versions: { id: string; language: string; status: string }[];
}

export async function describeEntry(entry: IContentEntry): Promise<EntryDetails> {
  const type = await ContentTypeModel.findById(entry.contentTypeId).select('slug').lean();
  const versions = await listVersions(String(entry._id));
  return {
    id: String(entry._id),
    itemId: String(entry.itemId),
    contentType: type?.slug ?? null,
    language: entry.language,
    status: entry.status,
    title: entry.title,
    data: (entry.data ?? {}) as Record<string, unknown>,
    updatedAt: entry.updatedAt,
    versions: versions.map(({ id, language, status }) => ({ id, language, status })),
  };
}

export function registerReadTools(server: McpServer, ctx: McpContext): void {
  registerTool(server, ctx, 'list_languages', { description: 'Content languages of this TheCMS installation, in order. isDefault marks the default language.' }, async () => ({
    languages: (await LanguagesService.list()).map((l) => ({ code: l.code, name: l.name, isDefault: l.isDefault })),
  }));

  registerTool(
    server,
    ctx,
    'list_content_types',
    { description: 'Content models with their fields. localized=true means each language version has its own value; false means the value is shared by all language versions.' },
    async () => {
      const { data } = await contentTypesService.listContentTypes({ limit: 100 });
      return {
        contentTypes: data.map((t) => ({
          id: String(t._id),
          name: t.name,
          slug: t.slug,
          titleField: t.titleField,
          fields: t.fields.map((f) => ({ name: f.name, label: f.label, type: f.type, required: f.required, localized: isLocalized(f), validation: f.validation })),
        })),
      };
    }
  );

  registerTool(
    server,
    ctx,
    'search_entries',
    {
      description: `Find entries (one row per language version), newest change first. contentType is a slug or id. ${DATA_NOTE}`,
      inputSchema: {
        contentType: z.string().max(200).optional(),
        language: z.string().max(20).optional(),
        status: z.enum(STATUSES).optional(),
        query: z.string().max(100).optional().describe('Text in the title'),
        page: z.number().int().min(1).max(1000).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ contentType, language, status, query, page, pageSize }) => {
      const type = contentType ? await resolveType(contentType) : null;
      const found = await ContentEntriesService.listAllEntries({
        page: page ?? 1,
        limit: pageSize ?? 20,
        status: status as ContentStatus | undefined,
        contentTypeIds: type ? [String(type._id)] : undefined,
        search: query,
        language,
      });
      return {
        items: found.entries.map((e) => {
          const row = e as unknown as { id: string; itemId: unknown; title: string; language: string; status: string; updatedAt: Date };
          return { id: row.id, itemId: String(row.itemId), contentType: e.contentType?.slug ?? null, title: row.title, language: row.language, status: row.status, updatedAt: row.updatedAt };
        }),
        page: found.pagination.page,
        total: found.pagination.total,
      };
    }
  );

  registerTool(
    server,
    ctx,
    'get_entry',
    { description: `One language version with all its fields, and the list of the item's language versions. ${DATA_NOTE}`, inputSchema: { id: z.string().max(100) } },
    async ({ id }) => {
      const entry = await ContentEntriesService.getEntryById(id);
      if (!entry) throw new AppError('Entry not found', 404);
      return describeEntry(entry);
    }
  );

  registerTool(
    server,
    ctx,
    'list_media',
    { description: 'Files in the media library, to reference in image or file fields by id.', inputSchema: { query: z.string().max(100).optional(), page: z.number().int().min(1).max(1000).optional() } },
    async ({ query, page }) => {
      const found = await MediaService.listMedia({ page: page ?? 1, limit: 20, search: query });
      return {
        items: found.media.map((m) => ({ id: String(m._id), url: m.cdnUrl || m.blobUrl, name: m.originalName, mimeType: m.mimeType, ...(m.altText ? { altText: m.altText } : {}) })),
        page: found.pagination.page,
        total: found.pagination.total,
      };
    }
  );
}
