import { AppError } from '../../middleware/error.middleware';
import { AiConnectionModel } from '../../models/ai-connection.model';
import { AiSettingsModel } from '../../models/ai-settings.model';
import { AiUsageModel } from '../../models/ai-usage.model';
import { aiAvailable, decryptKey, encryptKey, keyHint } from './crypto';
import { checkBaseUrl } from './url-rule';
import { AiProviderError, createProvider, type AiProvider, type Usage } from './providers';
import type { ConnectionInput } from './ai.schema';

export interface AiStatus {
  available: boolean;
  enabled: boolean;
  connection: { provider: string; model: string; baseUrl?: string; keyHint?: string; createdAt: Date } | null;
  usage: { month: string; requests: number; inputTokens: number; outputTokens: number };
}

const month = (date = new Date()) => date.toISOString().slice(0, 7);

function requireAvailable(): void {
  if (!aiAvailable()) throw new AppError('AI is not set up on this server', 503, { reason: 'AI_NOT_AVAILABLE' });
}

async function isEnabled(): Promise<boolean> {
  return (await AiSettingsModel.findOne().lean())?.enabled ?? true;
}

async function requireEnabled(): Promise<void> {
  if (!(await isEnabled())) throw new AppError('AI features are turned off', 403, { reason: 'AI_DISABLED' });
}

/** One tiny request, so a wrong key or address is found before anything is saved. */
async function testCall(provider: AiProvider): Promise<void> {
  try {
    await provider.stream({ system: 'Reply with the word OK.', user: 'OK?', maxTokens: 5 }, AbortSignal.timeout(20_000), () => {});
  } catch (error) {
    if (error instanceof AiProviderError) throw new AppError(error.message, 400, { reason: error.code });
    throw new AppError('The AI service did not answer', 400, { reason: 'UNREACHABLE' });
  }
}

export const AiService = {
  async status(userId: string): Promise<AiStatus> {
    const [connection, usage, enabled] = await Promise.all([
      AiConnectionModel.findOne({ userId }).lean(),
      AiUsageModel.findOne({ userId, month: month() }).lean(),
      isEnabled(),
    ]);
    return {
      available: aiAvailable(),
      enabled,
      connection: connection
        ? { provider: connection.provider, model: connection.model, baseUrl: connection.baseUrl, keyHint: connection.keyHint, createdAt: connection.createdAt }
        : null,
      usage: { month: month(), requests: usage?.requests ?? 0, inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 },
    };
  },

  async saveConnection(userId: string, input: ConnectionInput): Promise<AiStatus> {
    requireAvailable();
    await requireEnabled();
    const current = await AiConnectionModel.findOne({ userId });
    const baseUrl = input.provider === 'openai-compatible' ? await checkBaseUrl(input.baseUrl) : undefined;
    let apiKey = input.apiKey;
    // A save without a key keeps the stored one when it was made for the same service.
    if (!apiKey && current?.key && current.provider === input.provider && current.baseUrl === baseUrl) apiKey = decryptKey(current.key);
    if (input.provider === 'anthropic' && !apiKey) throw new AppError('Enter the API key', 400, { reason: 'KEY_REQUIRED' });

    await testCall(createProvider({ provider: input.provider, model: input.model, baseUrl, apiKey }));

    const set: Record<string, unknown> = { provider: input.provider, model: input.model };
    const unset: Record<string, ''> = {};
    if (baseUrl) set.baseUrl = baseUrl;
    else unset.baseUrl = '';
    if (apiKey) {
      set.key = encryptKey(apiKey);
      set.keyHint = keyHint(apiKey);
    } else {
      unset.key = '';
      unset.keyHint = '';
    }
    await AiConnectionModel.findOneAndUpdate({ userId }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { upsert: true });
    return AiService.status(userId);
  },

  async deleteConnection(userId: string): Promise<void> {
    await AiConnectionModel.deleteOne({ userId });
  },

  async setEnabled(enabled: boolean): Promise<void> {
    await AiSettingsModel.findOneAndUpdate({}, { $set: { enabled } }, { upsert: true });
  },

  /** The user's own provider; refuses when AI is off, not set up, or the user is not connected. */
  async providerFor(userId: string): Promise<AiProvider> {
    requireAvailable();
    await requireEnabled();
    const connection = await AiConnectionModel.findOne({ userId });
    if (!connection) throw new AppError('Connect an AI service first', 409, { reason: 'NOT_CONNECTED' });
    // Checked again on every use: the rule or the setting may have changed since the URL was saved.
    const baseUrl = connection.provider === 'openai-compatible' ? await checkBaseUrl(connection.baseUrl ?? '') : undefined;
    return createProvider({
      provider: connection.provider,
      model: connection.model,
      baseUrl,
      apiKey: connection.key ? decryptKey(connection.key) : undefined,
    });
  },

  async recordUsage(userId: string, usage: Usage): Promise<void> {
    await AiUsageModel.findOneAndUpdate(
      { userId, month: month() },
      { $inc: { requests: 1, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } },
      { upsert: true }
    );
  },
};
