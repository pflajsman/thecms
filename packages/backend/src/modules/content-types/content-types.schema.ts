import { z } from 'zod';
import { FieldType } from '../../types/field-types';

/**
 * Field validation schema
 */
const fieldValidationSchema = z
  .object({
    // Text validation
    minLength: z.number().int().positive().optional(),
    maxLength: z.number().int().positive().optional(),
    pattern: z.string().optional(),

    // Number validation
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),

    // Date validation
    minDate: z.string().datetime().optional(),
    maxDate: z.string().datetime().optional(),

    // Media validation
    allowedMimeTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().int().positive().optional(),

    // Relation validation
    targetContentType: z.string().optional(),
    multiple: z.boolean().optional(),
  })
  .optional();

/**
 * Field definition schema
 */
const fieldDefinitionSchema = z.object({
  name: z
    .string()
    .min(1, 'Field name is required')
    .max(50, 'Field name must be less than 50 characters')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field name must start with a letter and contain only letters, numbers, and underscores')
    .transform((val) => val.trim()),
  type: z.nativeEnum(FieldType, {
    errorMap: () => ({ message: 'Invalid field type' }),
  }),
  label: z
    .string()
    .min(1, 'Field label is required')
    .max(100, 'Field label must be less than 100 characters')
    .transform((val) => val.trim()),
  description: z
    .string()
    .max(500, 'Field description must be less than 500 characters')
    .transform((val) => val.trim())
    .optional(),
  required: z.boolean().default(false),
  unique: z.boolean().default(false).optional(),
  defaultValue: z.any().optional(),
  validation: fieldValidationSchema,
});

/**
 * Create Content Type schema
 */
export const createContentTypeSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters')
      .transform((val) => val.trim()),
    slug: z
      .string()
      .min(2, 'Slug must be at least 2 characters')
      .max(100, 'Slug must be less than 100 characters')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .transform((val) => val.trim().toLowerCase()),
    description: z
      .string()
      .max(500, 'Description must be less than 500 characters')
      .transform((val) => val.trim())
      .optional(),
    fields: z
      .array(fieldDefinitionSchema)
      .min(1, 'At least one field is required')
      .refine(
        (fields) => {
          const names = fields.map((f) => f.name);
          return names.length === new Set(names).size;
        },
        {
          message: 'Field names must be unique',
        }
      ),
  })
  .strict();

/**
 * Update Content Type schema (all fields optional except what's being updated)
 */
export const updateContentTypeSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters')
      .transform((val) => val.trim())
      .optional(),
    slug: z
      .string()
      .min(2, 'Slug must be at least 2 characters')
      .max(100, 'Slug must be less than 100 characters')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .transform((val) => val.trim().toLowerCase())
      .optional(),
    description: z
      .string()
      .max(500, 'Description must be less than 500 characters')
      .transform((val) => val.trim())
      .optional(),
    fields: z
      .array(fieldDefinitionSchema)
      .min(1, 'At least one field is required')
      .refine(
        (fields) => {
          const names = fields.map((f) => f.name);
          return names.length === new Set(names).size;
        },
        {
          message: 'Field names must be unique',
        }
      )
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Type exports for TypeScript
 */
export type CreateContentTypeInput = z.infer<typeof createContentTypeSchema>;
export type UpdateContentTypeInput = z.infer<typeof updateContentTypeSchema>;
