import type { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { UserRole } from '../../models/user.model';
import { AiService } from './ai.service';
import { connectionBody, generateBody, settingsBody } from './ai.schema';
import { buildPrompt } from './prompts';
import { AiProviderError, type Usage } from './providers';

const userId = (req: Request) => (req as AuthRequest).user!.entraId;
const canManage = (req: Request) => (req as AuthRequest).user?.role === UserRole.ADMIN;

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

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event: string, data: unknown) => {
      if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

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
};
