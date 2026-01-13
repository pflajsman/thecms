import { z } from 'zod';

/**
 * Schema for listing media (query parameters)
 */
export const listMediaSchema = z.object({
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
      .default('20')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, {
        message: 'Limit must be between 1 and 100',
      })
      .describe('Number of items per page'),
    mimeType: z.string().optional().describe('Filter by MIME type'),
    category: z
      .enum(['image', 'document', 'video'])
      .optional()
      .describe('Filter by category: image, document, or video'),
    uploadedBy: z.string().optional().describe('Filter by uploader user ID'),
    tags: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',').map((t) => t.trim()) : undefined))
      .describe('Filter by tags (comma-separated)'),
    search: z.string().optional().describe('Full-text search term'),
    sortBy: z
      .string()
      .optional()
      .default('createdAt')
      .describe('Field to sort by (e.g., createdAt, size, filename)'),
    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe('Sort order: asc or desc'),
  }),
});

/**
 * Schema for getting a single media file
 */
export const getMediaSchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Media ID'),
  }),
});

/**
 * Schema for updating media metadata
 */
export const updateMediaSchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Media ID'),
  }),
  body: z.object({
    altText: z.string().max(200).optional().describe('Alternative text for accessibility'),
    description: z.string().max(500).optional().describe('Media description'),
    tags: z
      .array(z.string().max(50))
      .max(20)
      .optional()
      .describe('Tags for organizing media'),
  }),
});

/**
 * Schema for deleting media
 */
export const deleteMediaSchema = z.object({
  params: z.object({
    id: z.string().min(1).describe('Media ID'),
  }),
});

/**
 * Schema for upload metadata (from multipart form data)
 * Note: File validation is handled by multer middleware
 */
export const uploadMediaMetadataSchema = z.object({
  altText: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((t) => t.trim()) : undefined)),
});

// Type exports for TypeScript
export type ListMediaInput = z.infer<typeof listMediaSchema>;
export type GetMediaInput = z.infer<typeof getMediaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
export type DeleteMediaInput = z.infer<typeof deleteMediaSchema>;
export type UploadMediaMetadata = z.infer<typeof uploadMediaMetadataSchema>;
