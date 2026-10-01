import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service';

export const commerceController = {
  async getSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await SettingsService.get() });
    } catch (error) {
      next(error);
    }
  },

  async replaceSettings(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await SettingsService.replace(req.body) });
    } catch (error) {
      next(error);
    }
  },
};
