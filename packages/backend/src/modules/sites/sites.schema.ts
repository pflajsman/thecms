import { z } from 'zod';

/**
 * Schema for creating a site
 */
export const createSiteSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    domain: z.string().min(1).max(255).toLowerCase(),
    description: z.string().max(500).optional(),
    allowedOrigins: z.array(z.string().url()).optional(),
  }),
});

/**
 * Schema for updating a site
 */
export const updateSiteSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    domain: z.string().min(1).max(255).toLowerCase().optional(),
    description: z.string().max(500).optional(),
    allowedOrigins: z.array(z.string().url()).optional(),
    isActive: z.boolean().optional(),
  }),
});

/**
 * Schema for getting a site
 */
export const getSiteSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

/**
 * Schema for deleting a site
 */
export const deleteSiteSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

/**
 * Schema for listing sites
 */
export const listSitesSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10)),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((val) => parseInt(val, 10)),
    isActive: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

// Type exports
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type GetSiteInput = z.infer<typeof getSiteSchema>;
export type DeleteSiteInput = z.infer<typeof deleteSiteSchema>;
export type ListSitesInput = z.infer<typeof listSitesSchema>;
