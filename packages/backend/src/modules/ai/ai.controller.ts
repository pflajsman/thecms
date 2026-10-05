import type { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import type { ProjectRequest } from '../../middleware/project.middleware';
import { ProjectRole, hasRole } from '../../models/project-member.model';
import { AiService } from './ai.service';
import { AppError } from '../../middleware/error.middleware';
import { createVersion } from '../content-entries/entry-versions.service';
import { connectionBody, generateBody, settingsBody, translateBody } from './ai.schema';
import { buildPrompt, buildTranslatePrompt, TRANSLATE_MAX_FIELD_CHARS } from './prompts';
import { cleanRichText, toPlainText } from './rich-text';
import { planTranslation } from './translate.service';
import { AiProviderError, type Usage } from './providers';

const userId = (req: Request) => (req as AuthRequest).user!.entraId;
const canManage = (req: Request) => hasRole((req as ProjectRequest).project!.role, ProjectRole.ADMIN);

const FIELD_TIMEOUT_MS = 60_000;

/** Starts a server-sent event stream and returns a writer that stops once the client is gone. */
function openEventStream(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  return (event: string, data: unknown) => {
    if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

export const aiController = {
  async getConnection(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await AiService.status(userId(req), canManage(req)) });
    } catch (error) {
      next(error);
    }
  },

  async saveConnection(req: Request, res: Response, next: NextFunction) {
    try {
      await AiService.saveConnection(userId(req), connectionBody.parse(req.body));
      res.json({ success: true, data: await AiService.status(userId(req), canManage(req)) });
    } catch (error) {
      next(error);
    }
  },

  async deleteConnection(req: Request, res: Response, next: NextFunction) {
    try {
      await AiService.deleteConnection(userId(req));
      res.json({ success: true, data: await AiService.status(userId(req), canManage(req)) });
    } catch (error) {
      next(error);
    }
  },

  async saveSettings(req: Request, res: Response, next: NextFunction) {
    try {
      await AiService.setEnabled(settingsBody.parse(req.body).enabled);
      res.json({ success: true, data: await AiService.status(userId(req), canManage(req)) });
    } catch (error) {
      next(error);
    }
  },
  /** Streams the answer as server-sent events: delta { text }, then done { usage } or error { code, message }. */
  async generate(req: Request, res: Response, next: NextFunction) {
    const user = userId(req);
    let provider;
    try {
      provider = await AiService.providerFor(user);
    } catch (error) {
      return next(error);
    }
    const input = generateBody.parse(req.body);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60_000);
    // The client closed the panel or the page: stop the provider so it stops using tokens.
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    const send = openEventStream(res);

    let usage: Usage = { inputTokens: 0, outputTokens: 0 };
    try {
      usage = await provider.stream(buildPrompt(input), controller.signal, (text) => send('delta', { text }));
      send('done', usage);
    } catch (error) {
      if (timedOut) send('error', { code: 'TIMEOUT', message: 'The AI service took too long' });
      else if (!controller.signal.aborted) {
        const known = error instanceof AiProviderError ? error : new AiProviderError('PROVIDER', 'The AI request failed');
        send('error', { code: known.code, message: known.message });
      }
    } finally {
      clearTimeout(timer);
      await AiService.recordUsage(user, usage).catch(() => undefined);
      if (!res.writableEnded) res.end();
    }
  },
  /**
   * Translates a saved version into a missing language, one field at a time:
   * start { fields }, field { name, index, total } per field, then done { versionId, usage } or error { code, message, field? }.
   * The version is created only after every field succeeded.
   */
  async translate(req: Request, res: Response, next: NextFunction) {
    const user = userId(req);
    const input = translateBody.parse(req.body);
    let provider;
    let plan;
    try {
      provider = await AiService.providerFor(user);
      plan = await planTranslation(input.entryId, input.language);
    } catch (error) {
      return next(error);
    }

    let clientGone = false;
    let current: AbortController | null = null;
    // The client closed the dialog or the page: stop the provider and create nothing.
    res.on('close', () => {
      if (res.writableEnded) return;
      clientGone = true;
      current?.abort();
    });
    const send = openEventStream(res);
    send('start', { fields: plan.fields.map(({ name, label }) => ({ name, label })) });

    const tooLong = plan.fields.find((f) => f.value.length > TRANSLATE_MAX_FIELD_CHARS);
    if (tooLong) {
      send('error', { code: 'TOO_LONG', field: tooLong.name, message: `${tooLong.label} is too long to translate` });
      res.end();
      return;
    }

    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let called = false;
    let failedField: string | undefined;
    const values: Record<string, string> = {};
    try {
      for (const [i, f] of plan.fields.entries()) {
        if (clientGone) return;
        failedField = f.name;
        send('field', { name: f.name, index: i + 1, total: plan.fields.length });
        const controller = new AbortController();
        current = controller;
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, FIELD_TIMEOUT_MS);
        const parts: string[] = [];
        called = true;
        try {
          const result = await provider.stream(
            buildTranslatePrompt({ from: plan.from, to: plan.to, contentType: plan.contentType, field: f }),
            controller.signal,
            (text) => parts.push(text)
          );
          usage.inputTokens += result.inputTokens;
          usage.outputTokens += result.outputTokens;
          if (result.truncated) throw new AiProviderError('TRUNCATED', `The translation of ${f.label} was cut off`);
        } catch (error) {
          if (timedOut) throw new AiProviderError('TIMEOUT', 'The AI service took too long');
          throw error;
        } finally {
          clearTimeout(timer);
        }
        const text = f.type === 'RICH_TEXT' ? cleanRichText(parts.join('')) : toPlainText(parts.join(''));
        if (!toPlainText(text)) throw new AiProviderError('PROVIDER', `The AI service returned no text for ${f.label}`);
        values[f.name] = text;
      }
      failedField = undefined;
      if (clientGone) return;
      const version = await createVersion(input.entryId, input.language, undefined, { data: values });
      send('done', { versionId: String(version._id), ...usage });
    } catch (error) {
      if (clientGone) return;
      const field = failedField ? { field: failedField } : {};
      if (error instanceof AppError && error.statusCode === 409) send('error', { code: 'VERSION_EXISTS', message: error.message });
      else if (error instanceof AiProviderError) send('error', { code: error.code, message: error.message, ...field });
      else send('error', { code: 'PROVIDER', message: 'The translation failed', ...field });
    } finally {
      if (called) await AiService.recordUsage(user, usage).catch(() => undefined);
      if (!res.writableEnded) res.end();
    }
  },
};
