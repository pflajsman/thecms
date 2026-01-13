import { Request, Response, NextFunction } from 'express';
import { SitesService } from './sites.service';
import {
  createSiteSchema,
  updateSiteSchema,
  getSiteSchema,
  deleteSiteSchema,
  listSitesSchema,
} from './sites.schema';
import { z } from 'zod';

/**
 * Sites Controller
 */
export class SitesController {
  /**
   * Create a new site
   * POST /api/v1/sites
   */
  async createSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createSiteSchema.parse({ body: req.body });

      const site = await SitesService.createSite(validated.body);

      res.status(201).json({
        success: true,
        data: site,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * List all sites
   * GET /api/v1/sites
   */
  async listSites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = listSitesSchema.parse({ query: req.query });

      const result = await SitesService.listSites({
        page: validated.query.page,
        limit: validated.query.limit,
        isActive: validated.query.isActive,
      });

      res.status(200).json({
        success: true,
        data: result.sites,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get a single site by ID
   * GET /api/v1/sites/:id
   */
  async getSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = getSiteSchema.parse({ params: req.params });

      const site = await SitesService.getSiteById(validated.params.id);

      if (!site) {
        res.status(404).json({
          success: false,
          error: 'Site not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: site,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Update a site
   * PUT /api/v1/sites/:id
   */
  async updateSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateSiteSchema.parse({
        params: req.params,
        body: req.body,
      });

      const site = await SitesService.updateSite(validated.params.id, validated.body);

      if (!site) {
        res.status(404).json({
          success: false,
          error: 'Site not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: site,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Delete a site
   * DELETE /api/v1/sites/:id
   */
  async deleteSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = deleteSiteSchema.parse({ params: req.params });

      const success = await SitesService.deleteSite(validated.params.id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Site not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Site deleted successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Rotate API key for a site
   * POST /api/v1/sites/:id/rotate-key
   */
  async rotateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = getSiteSchema.parse({ params: req.params });

      const site = await SitesService.rotateApiKey(validated.params.id);

      if (!site) {
        res.status(404).json({
          success: false,
          error: 'Site not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: site,
        message: 'API key rotated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      next(error);
    }
  }
}

// Export controller instance
export const sitesController = new SitesController();
