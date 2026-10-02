import type { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { AiService } from './ai.service';
import { connectionBody, settingsBody } from './ai.schema';

const userId = (req: Request) => (req as AuthRequest).user!.entraId;

export const aiController = {
  async getConnection(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await AiService.status(userId(req)) });
    } catch (error) {
      next(error);
    }
  },

  async saveConnection(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await AiService.saveConnection(userId(req), connectionBody.parse(req.body)) });
    } catch (error) {
      next(error);
    }
  },

  async deleteConnection(req: Request, res: Response, next: NextFunction) {
    try {
      await AiService.deleteConnection(userId(req));
      res.json({ success: true, data: await AiService.status(userId(req)) });
    } catch (error) {
      next(error);
    }
  },

  async saveSettings(req: Request, res: Response, next: NextFunction) {
    try {
      await AiService.setEnabled(settingsBody.parse(req.body).enabled);
      res.json({ success: true, data: await AiService.status(userId(req)) });
    } catch (error) {
      next(error);
    }
  },
};
