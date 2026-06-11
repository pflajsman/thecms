import { Request, Response, NextFunction } from 'express';
import { contentTypesService } from './content-types.service';
import { createContentTypeSchema, updateContentTypeSchema } from './content-types.schema';
import { z } from 'zod';

/**
 * Content Types Controller
 * Handles HTTP requests for content type management
 */
export class ContentTypesController {
  /**
   * Create a new content type
   * POST /api/v1/content-types
   */
  async createContentType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const validatedData = createContentTypeSchema.parse(req.body);

      // Create content type
      const contentType = await contentTypesService.createContentType(validatedData);

      res.status(201).json({
        success: true,
        data: contentType,
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

      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get all content types
   * GET /api/v1/content-types
   */
  async listContentTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      const result = await contentTypesService.listContentTypes({
        limit,
        offset,
        sortBy,
        sortOrder,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get content type by ID
   * GET /api/v1/content-types/:id
   */
  async getContentTypeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const contentType = await contentTypesService.getContentTypeById(id);

      if (!contentType) {
        res.status(404).json({
          success: false,
          error: 'Content type not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: contentType,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get content type by slug
   * GET /api/v1/content-types/slug/:slug
   */
  async getContentTypeBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;

      const contentType = await contentTypesService.getContentTypeBySlug(slug);

      if (!contentType) {
        res.status(404).json({
          success: false,
          error: 'Content type not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: contentType,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update content type
   * PUT /api/v1/content-types/:id
   */
  async updateContentType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate request body
      const validatedData = updateContentTypeSchema.parse(req.body);

      // Update content type
      const contentType = await contentTypesService.updateContentType(id, validatedData);

      if (!contentType) {
        res.status(404).json({
          success: false,
          error: 'Content type not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: contentType,
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

      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get the number of content entries using a content type
   * GET /api/v1/content-types/:id/entry-count
   */
  async getEntryCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const contentType = await contentTypesService.getContentTypeById(id);
      if (!contentType) {
        res.status(404).json({
          success: false,
          error: 'Content type not found',
        });
        return;
      }

      const count = await contentTypesService.countEntriesForType(id);

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete content type
   * DELETE /api/v1/content-types/:id
   * Refuses to delete a type that still has entries unless `?force=true`.
   */
  async deleteContentType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const force = req.query.force === 'true';

      const deleted = await contentTypesService.deleteContentType(id, { force });

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Content type not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Content type deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'HAS_ENTRIES') {
        res.status(409).json({
          success: false,
          error: error.message,
          code: 'HAS_ENTRIES',
          entryCount: (error as Error & { entryCount?: number }).entryCount,
        });
        return;
      }

      next(error);
    }
  }
}

// Export singleton instance
export const contentTypesController = new ContentTypesController();
