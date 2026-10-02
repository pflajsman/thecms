import mongoose from 'mongoose';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import type { FieldDefinition } from '../../types/field-types';
import { AppError } from '../../middleware/error.middleware';
import { isLocalized } from '../../utils/localized';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { createVersion } from '../content-entries/entry-versions.service';
import { describeEntry, resolveType } from './read-tools';
import { registerTool, type McpContext } from './tool';

const fieldValues = z.record(z.unknown()).describe('Field values by field name, as list_content_types describes them');

type Fields = Pick<FieldDefinition, 'name' | 'label' | 'type' | 'required' | 'localized'>[];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Checks an agent's field values before any write: names must exist (the shared validator only warns about unknown
 * ones), and required text must not be empty (the admin form checks that in the browser; the validator only checks
 * for a missing value).
 */
function checkFields(typeName: string, fields: Fields, data: Record<string, unknown>, merged: Record<string, unknown>): void {
  const known = new Set(fields.map((f) => f.name));
  const unknown = Object.keys(data).filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new AppError(`Unknown field '${unknown[0]}'. Fields of ${typeName}: ${fields.map((f) => f.name).join(', ')}`, 400);
  }
  const empty = fields.filter((f) => f.required && typeof merged[f.name] === 'string' && !(merged[f.name] as string).trim());
  if (empty.length > 0) throw new AppError(`Validation failed: ${empty.map((f) => `${f.label} is required`).join(', ')}`, 400);
}

/** Shared fields whose value `data` would change. Saving a version copies shared values to every other version. */
const changedShared = (fields: Fields, data: Record<string, unknown>, current: Record<string, unknown>) =>
  fields.filter((f) => !isLocalized(f) && f.name in data && !same(data[f.name], current[f.name]));

async function loadType(contentTypeId: unknown) {
  const type = await ContentTypeModel.findById(contentTypeId).select('name fields').lean();
  if (!type) throw new AppError('Content type not found', 404);
  return type;
}

/**
 * Draft-only writes: nothing here can change what sites show. A shared field changed in a draft would be copied
 * into the item's other versions, so it is refused while any of them is published or archived.
 */
export function registerWriteTools(server: McpServer, ctx: McpContext): void {
  registerTool(
    server,
    ctx,
    'create_entry',
    {
      description: 'Create a new entry as a DRAFT. language defaults to the default language. A person publishes it in the admin.',
      inputSchema: { contentType: z.string().max(200).describe('Slug or id'), language: z.string().max(20).optional(), data: fieldValues },
    },
    async ({ contentType, language, data }) => {
      const type = await resolveType(contentType);
      checkFields(type.name, type.fields, data, data);
      const entry = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data, language, status: ContentStatus.DRAFT });
      return describeEntry(entry);
    }
  );

  registerTool(
    server,
    ctx,
    'update_draft',
    {
      description:
        'Change fields of a DRAFT version. The given values replace those fields; other fields stay. Published and archived versions cannot be changed through MCP, and neither can shared fields while another version of the entry is published or archived.',
      inputSchema: { id: z.string().max(100), data: fieldValues },
    },
    async ({ id, data }) => {
      const entry = mongoose.Types.ObjectId.isValid(id) ? await ContentEntryModel.findById(id) : null;
      if (!entry) throw new AppError('Entry not found', 404);
      if (entry.status !== ContentStatus.DRAFT) {
        throw new AppError(`This version is ${entry.status.toLowerCase()}. Only drafts can be changed through MCP; ask a person to edit it in the admin.`, 409);
      }
      const type = await loadType(entry.contentTypeId);
      const current = (entry.data ?? {}) as Record<string, unknown>;
      const merged = { ...current, ...data };
      checkFields(type.name, type.fields, data, merged);
      const shared = changedShared(type.fields, data, current);
      if (shared.length > 0 && (await ContentEntryModel.exists({ itemId: entry.itemId, _id: { $ne: entry._id }, status: { $ne: ContentStatus.DRAFT } }))) {
        throw new AppError(
          `${shared[0].label} is shared by all language versions, and another version of this entry is published or archived. Ask a person to change it in the admin.`,
          409
        );
      }
      const updated = await ContentEntriesService.updateEntry(id, { data: merged });
      return describeEntry(updated!);
    }
  );

  registerTool(
    server,
    ctx,
    'create_language_version',
    {
      description:
        'Create a DRAFT in a language the item does not have yet, copied from the version id. data replaces the copied values of translated fields; shared fields always keep the source values.',
      inputSchema: { id: z.string().max(100), language: z.string().max(20), data: fieldValues.optional() },
    },
    async ({ id, language, data }) => {
      if (data) {
        const source = mongoose.Types.ObjectId.isValid(id) ? await ContentEntryModel.findById(id).select('contentTypeId data').lean() : null;
        if (!source) throw new AppError('Entry not found', 404);
        const type = await loadType(source.contentTypeId);
        const current = (source.data ?? {}) as Record<string, unknown>;
        checkFields(type.name, type.fields, data, { ...current, ...data });
        const shared = changedShared(type.fields, data, current);
        if (shared.length > 0) {
          throw new AppError(`${shared[0].label} is shared by all language versions; a new language version keeps the source value.`, 400);
        }
      }
      return describeEntry(await createVersion(id, language, undefined, data ? { data } : undefined));
    }
  );
}
