import { safeFetch } from '../safe-fetch';
import { sseData } from './sse';
import { AiProviderError, errorForStatus, scrub, type AiProvider, type Usage } from './types';

interface Options {
  baseUrl: string;
  apiKey?: string;
  model: string;
  fetch?: typeof fetch;
}

/** Any service with an OpenAI-style /chat/completions endpoint: Ollama, OpenRouter, Groq, Gemini's compatible endpoint. */
export function openAiCompatible(options: Options): AiProvider {
  const doFetch = options.fetch ?? safeFetch;
  return {
    async stream(prompt, signal, onText) {
      let res: Response;
      try {
        res = await doFetch(`${options.baseUrl}/chat/completions`, {
          method: 'POST',
          signal,
          // A redirect could lead to an address the URL check never saw.
          redirect: 'manual',
          headers: { 'Content-Type': 'application/json', ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}) },
          body: JSON.stringify({
            model: options.model,
            stream: true,
            max_tokens: prompt.maxTokens,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
          }),
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new AiProviderError('UNREACHABLE', 'The AI service cannot be reached');
      }
      if (res.status >= 300 && res.status < 400) throw new AiProviderError('PROVIDER', 'The AI service answered with a redirect; enter its final address');
      if (!res.ok || !res.body) throw errorForStatus(res.status, scrub(await res.text().catch(() => ''), options.apiKey));

      const usage: Usage = { inputTokens: 0, outputTokens: 0 };
      for await (const data of sseData(res.body)) {
        if (data === '[DONE]') break;
        let chunk: {
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          error?: { message?: string };
        };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        // Some services report a failure inside a 200 stream.
        if (chunk.error) throw new AiProviderError('PROVIDER', scrub(`The AI service failed: ${chunk.error.message ?? 'unknown error'}`, options.apiKey).slice(0, 300));
        if (chunk.choices?.[0]?.finish_reason === 'length') usage.truncated = true;
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) onText(text);
        if (chunk.usage) {
          usage.inputTokens = chunk.usage.prompt_tokens ?? 0;
          usage.outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      }
      return usage;
    },
  };
}
