import { Request, Response, NextFunction } from 'express';
import { LanguagesService } from './languages.service';

export const languagesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await LanguagesService.list() });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ success: true, data: await LanguagesService.create(req.body) });
    } catch (error) {
      next(error);
    }
  },

  async rename(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await LanguagesService.rename(req.params.code, req.body.name) });
    } catch (error) {
      next(error);
    }
  },

  async makeDefault(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await LanguagesService.makeDefault(req.params.code) });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const confirm = typeof req.query.confirm === 'string' ? req.query.confirm : undefined;
      res.json({ success: true, data: await LanguagesService.remove(req.params.code, confirm) });
    } catch (error) {
      next(error);
    }
  },
};
