import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service';
import { ShippingService } from './shipping.service';
import { OrderActions, OrdersAdminService } from './order-actions';
import { listOrdersSchema, shippedSchema } from './commerce.schema';
import { ProductsService } from './products.service';
import { VariantsService } from './variants.service';
import { listProductsSchema, methodBody, zoneBody } from './commerce.schema';
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

  async listZones(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await ShippingService.listZones() });
    } catch (error) {
      next(error);
    }
  },

  async createZone(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ success: true, data: await ShippingService.createZone(zoneBody.parse(req.body)) });
    } catch (error) {
      next(error);
    }
  },

  async updateZone(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await ShippingService.updateZone(req.params.id, zoneBody.parse(req.body)) });
    } catch (error) {
      next(error);
    }
  },

  async deleteZone(req: Request, res: Response, next: NextFunction) {
    try {
      await ShippingService.deleteZone(req.params.id);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  async listMethods(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await ShippingService.listMethods() });
    } catch (error) {
      next(error);
    }
  },

  async createMethod(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ success: true, data: await ShippingService.createMethod(methodBody.parse(req.body)) });
    } catch (error) {
      next(error);
    }
  },

  async updateMethod(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await ShippingService.updateMethod(req.params.id, methodBody.parse(req.body)) });
    } catch (error) {
      next(error);
    }
  },

  async deleteMethod(req: Request, res: Response, next: NextFunction) {
    try {
      await ShippingService.deleteMethod(req.params.id);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = listOrdersSchema.parse({ query: req.query });
      const result = await OrdersAdminService.list(query);
      res.json({ success: true, data: result.orders, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  },

  async ordersNeedingAction(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: { count: await OrdersAdminService.needsAction() } });
    } catch (error) {
      next(error);
    }
  },

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await OrdersAdminService.get(req.params.id) });
    } catch (error) {
      next(error);
    }
  },

  async markOrderPaid(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await OrderActions.markPaid(req.params.id, userId(req)) });
    } catch (error) {
      next(error);
    }
  },

  async markOrderShipped(req: Request, res: Response, next: NextFunction) {
    try {
      const { body } = shippedSchema.parse({ body: req.body ?? {} });
      res.json({ success: true, data: await OrderActions.markShipped(req.params.id, body, userId(req)) });
    } catch (error) {
      next(error);
    }
  },

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await OrderActions.cancel(req.params.id, { refunded: req.body?.refunded }, userId(req)) });
    } catch (error) {
      next(error);
    }
  },

  async resendOrderEmail(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await OrderActions.resend(req.params.id, req.body.what, userId(req)) });
    } catch (error) {
      next(error);
    }
  },

  async setOrderNote(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await OrderActions.setInternalNote(req.params.id, req.body.note) });
    } catch (error) {
      next(error);
    }
  },
};
