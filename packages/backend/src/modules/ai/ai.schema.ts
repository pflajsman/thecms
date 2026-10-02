import { z } from 'zod';
import { AI_ACTIONS } from './prompts';

export const ANTHROPIC_MODELS = ['claude-sonnet-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001'] as const;

const apiKey = z.string().trim().min(1).max(500).optional();

export const connectionBody = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('anthropic'), model: z.enum(ANTHROPIC_MODELS), apiKey }),
  z.object({ provider: z.literal('openai-compatible'), model: z.string().trim().min(1).max(200), baseUrl: z.string().trim().min(1).max(500), apiKey }),
]);
export const connectionSchema = z.object({ body: connectionBody });
export type ConnectionInput = z.infer<typeof connectionBody>;

export const settingsBody = z.object({ enabled: z.boolean() });
export const settingsSchema = z.object({ body: settingsBody });

export const generateBody = z
  .object({
    action: z.enum(AI_ACTIONS),
    instruction: z.string().trim().max(1000).optional(),
    field: z.object({ label: z.string().max(200), type: z.enum(['TEXT', 'RICH_TEXT']), value: z.string().max(100_000) }),
    context: z.object({
      contentType: z.string().max(200),
      language: z.string().max(20),
      // Context values are cut to 1,000 characters in the prompt; this keeps the whole body under the 2 MB parser limit.
      fields: z.array(z.object({ label: z.string().max(200), value: z.string().max(20_000) })).max(50),
    }),
  })
  .refine((b) => (b.action !== 'draft' && b.action !== 'custom') || !!b.instruction, { message: 'This action needs an instruction', path: ['instruction'] });
export const generateSchema = z.object({ body: generateBody });
