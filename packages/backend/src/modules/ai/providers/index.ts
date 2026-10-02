import type { AiProviderName } from '../../../models/ai-connection.model';
import { anthropic } from './anthropic';
import { openAiCompatible } from './openai-compatible';
import type { AiProvider } from './types';

export * from './types';

export interface ProviderConfig {
  provider: AiProviderName;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export function createProvider(config: ProviderConfig): AiProvider {
  if (config.provider === 'anthropic') return anthropic({ apiKey: config.apiKey ?? '', model: config.model });
  return openAiCompatible({ baseUrl: config.baseUrl ?? '', apiKey: config.apiKey, model: config.model });
}
