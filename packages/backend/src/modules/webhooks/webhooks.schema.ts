import { z } from 'zod';
import { WebhookEvent } from '../../models/webhook.model';

/**
 * Validation schemas for webhook endpoints
 */

export const createWebhookSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    description: z.string().max(500).optional(),
    events: z.array(z.nativeEnum(WebhookEvent)).min(1),
    siteId: z.string().optional(),
    maxRetries: z.number().int().min(0).max(10).optional(),
    retryDelay: z.number().int().min(1000).max(300000).optional(),
  }),
});

export const updateWebhookSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    url: z.string().url().optional(),
    description: z.string().max(500).optional(),
    events: z.array(z.nativeEnum(WebhookEvent)).min(1).optional(),
    isActive: z.boolean().optional(),
    siteId: z.string().optional(),
    maxRetries: z.number().int().min(0).max(10).optional(),
    retryDelay: z.number().int().min(1000).max(300000).optional(),
  }),
});

export const getWebhookSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const deleteWebhookSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const listWebhooksSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
    siteId: z.string().optional(),
    isActive: z.string().optional().transform((val) => val === 'true'),
  }),
});

export const testWebhookSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const rotateSecretSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>['body'];
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>['body'];
