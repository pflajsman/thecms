export interface PromptInput {
  system: string;
  user: string;
  maxTokens: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** The answer stopped at the token cap. */
  truncated?: boolean;
}

/** One AI service. `stream` calls `onText` for each piece of the answer and resolves with the token usage (0 when unknown). */
export interface AiProvider {
  stream(prompt: PromptInput, signal: AbortSignal, onText: (text: string) => void): Promise<Usage>;
}

export type AiErrorCode = 'AUTH' | 'RATE_LIMIT' | 'UNREACHABLE' | 'TOO_LONG' | 'PROVIDER';

export class AiProviderError extends Error {
  code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
  }
}

/** Removes the key from text a provider sent back. */
export function scrub(text: string, secret?: string): string {
  return secret ? text.split(secret).join('***') : text;
}

export function errorForStatus(status: number, detail: string): AiProviderError {
  const short = detail.trim().slice(0, 300);
  if (status === 401 || status === 403) return new AiProviderError('AUTH', 'The AI service refused the key');
  if (status === 429) return new AiProviderError('RATE_LIMIT', 'The AI service is limiting requests; try again shortly');
  if ((status === 400 || status === 413) && /context|too long|maximum|token/i.test(short)) return new AiProviderError('TOO_LONG', 'The text is too long for this model');
  return new AiProviderError('PROVIDER', short ? `The AI service answered ${status}: ${short}` : `The AI service answered ${status}`);
}
