import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service';
import { ProductsService } from './products.service';
import { VariantsService } from './variants.service';
import { listProductsSchema } from './commerce.schema';
import { uploadDigitalFile } from './digital-files';
import { AppError } from '../../middleware/error.middleware';

const userId = (req: Request): string | undefined => (req as { user?: { userId?: string } }).user?.userId;

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

  async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = listProductsSchema.parse({ query: req.query });
      const result = await ProductsService.list(query);
      res.json({ success: true, data: result.products, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  },

  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ success: true, data: await ProductsService.create({ ...req.body, userId: userId(req) }) });
    } catch (error) {
      next(error);
    }
  },

  async getProduct(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await ProductsService.get(req.params.id) });
    } catch (error) {
      next(error);
    }
  },

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await ProductsService.update(req.params.id, req.body, userId(req)) });
    } catch (error) {
      next(error);
    }
  },

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      await ProductsService.remove(req.params.id);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  async replaceVariants(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await VariantsService.replaceAll(req.params.id, req.body.variants) });
    } catch (error) {
      next(error);
    }
  },

  async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError('Choose a file to upload', 400);
      res.json({ success: true, data: await uploadDigitalFile(req.params.id, req.file) });
    } catch (error) {
      next(error);
    }
  },
};
