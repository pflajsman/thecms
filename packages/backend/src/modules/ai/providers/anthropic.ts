import Anthropic from '@anthropic-ai/sdk';
import { AiProviderError, errorForStatus, scrub, type AiProvider } from './types';

interface Options {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}

export function anthropic(options: Options): AiProvider {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 0, ...(options.fetch ? { fetch: options.fetch } : {}) });
  return {
    async stream(prompt, signal, onText) {
      try {
        const stream = client.messages.stream(
          { model: options.model, max_tokens: prompt.maxTokens, system: prompt.system, messages: [{ role: 'user', content: prompt.user }] },
          { signal }
        );
        stream.on('text', (text) => onText(text));
        const final = await stream.finalMessage();
        return { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens };
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof Anthropic.APIError && typeof error.status === 'number') throw errorForStatus(error.status, scrub(error.message, options.apiKey));
        throw new AiProviderError('UNREACHABLE', 'The AI service cannot be reached');
      }
    },
  };
}
