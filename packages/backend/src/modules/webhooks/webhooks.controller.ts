import { Request, Response, NextFunction } from 'express';
import { WebhooksService } from './webhooks.service';
import { WebhookService } from '../../services/webhook.service';

/**
 * Webhooks Controller
 * Handles HTTP requests for webhook management
 */
export class WebhooksController {
  /**
   * Create a new webhook
   * POST /api/v1/webhooks
   */
  async createWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      const webhook = await WebhooksService.createWebhook({
        ...req.body,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all webhooks
   * GET /api/v1/webhooks
   */
  async listWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, siteId, isActive } = req.query as any;

      const result = await WebhooksService.listWebhooks({
        page,
        limit,
        siteId,
        isActive,
      });

      res.status(200).json({
        success: true,
        data: result.webhooks,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook by ID
   * GET /api/v1/webhooks/:id
   */
  async getWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const webhook = await WebhooksService.getWebhookById(id);

      if (!webhook) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update webhook
   * PUT /api/v1/webhooks/:id
   */
  async updateWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const webhook = await WebhooksService.updateWebhook(id, req.body);

      if (!webhook) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete webhook
   * DELETE /api/v1/webhooks/:id
   */
  async deleteWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await WebhooksService.deleteWebhook(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Webhook deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test webhook
   * POST /api/v1/webhooks/:id/test
   */
  async testWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const result = await WebhookService.testWebhook(id);

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rotate webhook secret
   * POST /api/v1/webhooks/:id/rotate-secret
   */
  async rotateSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const result = await WebhooksService.rotateSecret(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook delivery logs
   * GET /api/v1/webhooks/:id/logs
   */
  async getDeliveryLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const logs = await WebhooksService.getDeliveryLogs(id, limit);

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export controller instance
export const webhooksController = new WebhooksController();
