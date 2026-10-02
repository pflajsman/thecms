import mongoose from 'mongoose';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import type { FieldDefinition } from '../../types/field-types';
import { AppError } from '../../middleware/error.middleware';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { createVersion } from '../content-entries/entry-versions.service';
import { describeEntry, resolveType } from './read-tools';
import { registerTool, type McpContext } from './tool';

const fieldValues = z.record(z.unknown()).describe('Field values by field name, as list_content_types describes them');

/**
 * The admin form refuses an empty required field before saving, but the shared validator only checks for a missing
 * value; an agent sends JSON directly, so empty text counts as missing here too.
 */
function requireFilled(fields: Pick<FieldDefinition, 'name' | 'label' | 'required'>[], data: Record<string, unknown>): void {
  const empty = fields.filter((f) => f.required && typeof data[f.name] === 'string' && !(data[f.name] as string).trim());
  if (empty.length > 0) throw new AppError(`Validation failed: ${empty.map((f) => `${f.label} is required`).join(', ')}`, 400);
}

/** Draft-only writes: nothing here can change what sites show. */
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
      requireFilled(type.fields, data);
      const entry = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data, language, status: ContentStatus.DRAFT });
      return describeEntry(entry);
    }
  );

  registerTool(
    server,
    ctx,
    'update_draft',
    {
      description: 'Change fields of a DRAFT version. The given values replace those fields; other fields stay. Published and archived versions cannot be changed through MCP.',
      inputSchema: { id: z.string().max(100), data: fieldValues },
    },
    async ({ id, data }) => {
      const entry = mongoose.Types.ObjectId.isValid(id) ? await ContentEntryModel.findById(id) : null;
      if (!entry) throw new AppError('Entry not found', 404);
      if (entry.status !== ContentStatus.DRAFT) {
        throw new AppError(`This version is ${entry.status.toLowerCase()}. Only drafts can be changed through MCP; ask a person to edit it in the admin.`, 409);
      }
      const merged = { ...(entry.data ?? {}), ...data };
      const type = await ContentTypeModel.findById(entry.contentTypeId).select('fields').lean();
      requireFilled(type?.fields ?? [], merged);
      const updated = await ContentEntriesService.updateEntry(id, { data: merged });
      return describeEntry(updated!);
    }
  );

  registerTool(
    server,
    ctx,
    'create_language_version',
    {
      description: 'Create a DRAFT in a language the item does not have yet, copied from the version id. data replaces the copied values of translated fields; shared fields keep their values.',
      inputSchema: { id: z.string().max(100), language: z.string().max(20), data: fieldValues.optional() },
    },
    async ({ id, language, data }) => {
      if (data) {
        const source = mongoose.Types.ObjectId.isValid(id) ? await ContentEntryModel.findById(id).select('contentTypeId data').lean() : null;
        const type = source ? await ContentTypeModel.findById(source.contentTypeId).select('fields').lean() : null;
        requireFilled(type?.fields ?? [], { ...(source?.data ?? {}), ...data });
      }
      return describeEntry(await createVersion(id, language, undefined, data ? { data } : undefined));
    }
  );
}
