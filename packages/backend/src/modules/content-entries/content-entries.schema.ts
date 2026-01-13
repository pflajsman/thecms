import { z } from 'zod';
import { ContentStatus } from '../../models/content-entry.model';

/**
 * Schema for creating a content entry
 */
export const createContentEntrySchema = z.object({
  body: z.object({
    data: z
      .record(z.any())
      .describe('Content data object with fields defined by the content type'),
    status: z
      .nativeEnum(ContentStatus)
      .optional()
      .default(ContentStatus.DRAFT)
      .describe('Entry status: DRAFT, PUBLISHED, or ARCHIVED'),
  }),
});

/**
 * Schema for updating a content entry
 */
export const updateContentEntrySchema = z.object({
  body: z.object({
    data: z
      .record(z.any())
      .optional()
      .describe('Content data object with fields defined by the content type'),
    status: z
      .nativeEnum(ContentStatus)
      .optional()
      .describe('Entry status: DRAFT, PUBLISHED, or ARCHIVED'),
  }),
});

/**
 * Schema for listing content entries (query parameters)
 */
export const listContentEntriesSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, { message: 'Page must be greater than 0' })
      .describe('Page number for pagination'),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, {
        message: 'Limit must be between 1 and 100',
      })
      .describe('Number of items per page'),
    status: z
      .nativeEnum(ContentStatus)
      .optional()
      .describe('Filter by status: DRAFT, PUBLISHED, or ARCHIVED'),
    sortBy: z
      .string()
      .optional()
      .default('createdAt')
      .describe('Field to sort by (e.g., createdAt, updatedAt, publishedAt)'),
    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort order: asc or desc'),
    search: z.string().optional().describe('Full-text search term'),
  }),
});

/**
 * Schema for getting a single entry by ID
 */
export const getContentEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Content entry ID'),
  }),
});

/**
 * Schema for updating an entry by ID
 */
export const updateContentEntryParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Content entry ID'),
  }),
});

/**
 * Schema for deleting an entry by ID
 */
export const deleteContentEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Content entry ID'),
  }),
});

/**
 * Schema for publishing an entry
 */
export const publishContentEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Content entry ID'),
  }),
});

/**
 * Schema for unpublishing an entry
 */
export const unpublishContentEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Content entry ID'),
  }),
});

/**
 * Schema for archiving an entry
 */
export const archiveContentEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Content entry ID'),
  }),
});

/**
 * Schema for creating an entry under a specific content type
 */
export const createEntryForTypeSchema = z.object({
  params: z.object({
    typeId: z.string().min(1).describe('Content type ID'),
  }),
  body: z.object({
    data: z
      .record(z.any())
      .describe('Content data object with fields defined by the content type'),
    status: z
      .nativeEnum(ContentStatus)
      .optional()
      .default(ContentStatus.DRAFT)
      .describe('Entry status: DRAFT, PUBLISHED, or ARCHIVED'),
  }),
});

/**
 * Schema for listing entries of a specific content type
 */
export const listEntriesForTypeSchema = z.object({
  params: z.object({
    typeId: z.string().min(1).describe('Content type ID'),
  }),
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, { message: 'Page must be greater than 0' })
      .describe('Page number for pagination'),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, {
        message: 'Limit must be between 1 and 100',
      })
      .describe('Number of items per page'),
    status: z
      .nativeEnum(ContentStatus)
      .optional()
      .describe('Filter by status: DRAFT, PUBLISHED, or ARCHIVED'),
    sortBy: z
      .string()
      .optional()
      .default('createdAt')
      .describe('Field to sort by (e.g., createdAt, updatedAt, publishedAt)'),
    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort order: asc or desc'),
    search: z.string().optional().describe('Full-text search term'),
  }),
});

/**
 * Schema for global search across all content entries
 */
export const searchContentEntriesSchema = z.object({
  query: z.object({
    q: z.string().min(1).describe('Search query term'),
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, { message: 'Page must be greater than 0' })
      .describe('Page number for pagination'),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, {
        message: 'Limit must be between 1 and 100',
      })
      .describe('Number of items per page'),
    status: z
      .nativeEnum(ContentStatus)
      .optional()
      .describe('Filter by status: DRAFT, PUBLISHED, or ARCHIVED'),
  }),
});

// Type exports for TypeScript
export type CreateContentEntryInput = z.infer<typeof createContentEntrySchema>;
export type UpdateContentEntryInput = z.infer<typeof updateContentEntrySchema>;
export type ListContentEntriesInput = z.infer<typeof listContentEntriesSchema>;
export type GetContentEntryInput = z.infer<typeof getContentEntrySchema>;
export type CreateEntryForTypeInput = z.infer<typeof createEntryForTypeSchema>;
export type ListEntriesForTypeInput = z.infer<typeof listEntriesForTypeSchema>;
export type SearchContentEntriesInput = z.infer<typeof searchContentEntriesSchema>;
