import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FieldType } from '../../types/field-types';
import { AppError } from '../../middleware/error.middleware';
import { contentTypesService } from '../content-types/content-types.service';
import { createContentTypeSchema, updateContentTypeSchema } from '../content-types/content-types.schema';
import { LanguagesService } from '../languages/languages.service';
import { createLanguageSchema } from '../languages/languages.schema';
import { describeType, resolveType } from './read-tools';
import { registerTool, type McpContext } from './tool';

const field = z.object({
  name: z.string().max(50).describe('Key in entry data: a letter, then letters, digits or _; camelCase by convention'),
  label: z.string().max(100),
  type: z.nativeEnum(FieldType),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
  localized: z.boolean().optional().describe('Own value per language version. Default: true for TEXT and RICH_TEXT, false for the rest'),
  validation: z
    .record(z.unknown())
    .optional()
    .describe('Optional rules: minLength, maxLength, pattern, min, max, integer, minDate, maxDate, allowedMimeTypes, maxFileSize, targetContentType, multiple (MEDIA and RELATION)'),
});
const fields = z.array(field).min(1).max(50);

/** The admin's own validation, with its messages joined into one line the agent can act on. */
function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(`Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.') || 'input'}: ${e.message}`).join('; ')}`, 400);
  }
  return parsed.data;
}

/**
 * Model tools for project Admins. They only add: a language, a content type, or fields at the end of a content type.
 * Renaming, changing or removing fields, types and languages can lose content, so those stay in the admin.
 */
export function registerModelTools(server: McpServer, ctx: McpContext): void {
  registerTool(
    server,
    ctx,
    'create_language',
    {
      description: 'Add a content language, such as cs (Czech). It is added after the existing languages; the default language does not change.',
      inputSchema: { code: z.string().max(20).describe('Language code such as cs, de or de-at'), name: z.string().max(50).describe('Display name, such as Čeština') },
    },
    async ({ code, name }) => {
      const { body } = parse(createLanguageSchema, { body: { code, name } });
      const language = await LanguagesService.create(body);
      return { code: language.code, name: language.name, isDefault: language.isDefault };
    }
  );

  registerTool(
    server,
    ctx,
    'create_content_type',
    {
      description:
        'Create a content type (model). Field types: TEXT, RICH_TEXT, NUMBER, DATE, BOOLEAN, MEDIA (media ids; validation.multiple for several), RELATION (validation.targetContentType). titleField names the TEXT field shown as the entry title.',
      inputSchema: {
        name: z.string().max(100),
        slug: z.string().max(100).describe('Lowercase letters, digits and hyphens; used in public API URLs'),
        description: z.string().max(500).optional(),
        titleField: z.string().max(50).optional(),
        fields,
      },
    },
    async (input) => {
      const data = parse(createContentTypeSchema, input);
      try {
        return describeType(await contentTypesService.createContentType(data));
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) throw new AppError(error.message, 409);
        throw error;
      }
    }
  );

  registerTool(
    server,
    ctx,
    'add_content_type_fields',
    {
      description: 'Add new fields at the end of an existing content type. Existing fields are never changed or removed through MCP.',
      inputSchema: { contentType: z.string().max(200).describe('Slug or id'), fields },
    },
    async ({ contentType, fields: added }) => {
      const type = await resolveType(contentType);
      const taken = added.filter((f) => type.fields.some((existing) => existing.name === f.name));
      if (taken.length > 0) {
        throw new AppError(`${type.name} already has a field '${taken[0].name}'. Changing existing fields is done in the admin.`, 409);
      }
      const data = parse(updateContentTypeSchema, { fields: [...type.fields, ...added] });
      const updated = await contentTypesService.updateContentType(String(type._id), data);
      if (!updated) throw new AppError('Content type not found', 404);
      return describeType(updated);
    }
  );
}
