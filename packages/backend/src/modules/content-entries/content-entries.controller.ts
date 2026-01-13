import { Request, Response, NextFunction } from 'express';
import { ContentEntriesService } from './content-entries.service';
import {
  createEntryForTypeSchema,
  listEntriesForTypeSchema,
  getContentEntrySchema,
  updateContentEntryParamsSchema,
  updateContentEntrySchema,
  deleteContentEntrySchema,
  publishContentEntrySchema,
  unpublishContentEntrySchema,
  archiveContentEntrySchema,
  searchContentEntriesSchema,
} from './content-entries.schema';
import { z } from 'zod';

/**
 * Content Entries Controller
 * Handles HTTP requests for content entry management
 */
export class ContentEntriesController {
  /**
   * Create a new content entry for a specific content type
   * POST /api/v1/content-types/:typeId/entries
   */
  async createEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = createEntryForTypeSchema.parse({
        params: req.params,
        body: req.body,
      });

      // Get user ID from authenticated request (if available)
      const userId = (req as any).user?.userId;

      // Create content entry
      const entry = await ContentEntriesService.createEntry({
        contentTypeId: validated.params.typeId,
        data: validated.body.data,
        status: validated.body.status,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: entry,
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

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        if (error.message.includes('Validation failed')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      next(error);
    }
  }

  /**
   * List all content entries for a specific content type
   * GET /api/v1/content-types/:typeId/entries
   */
  async listEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = listEntriesForTypeSchema.parse({
        params: req.params,
        query: req.query,
      });

      // List entries
      const result = await ContentEntriesService.listEntries(validated.params.typeId, {
        page: validated.query.page,
        limit: validated.query.limit,
        status: validated.query.status,
        sortBy: validated.query.sortBy,
        sortOrder: validated.query.sortOrder,
        search: validated.query.search,
      });

      res.status(200).json({
        success: true,
        data: result.entries,
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

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get a single content entry by ID
   * GET /api/v1/entries/:id
   */
  async getEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = getContentEntrySchema.parse({
        params: req.params,
      });

      // Get entry
      const entry = await ContentEntriesService.getEntryById(validated.params.id);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Content entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: entry,
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
   * Update a content entry
   * PUT /api/v1/entries/:id
   */
  async updateEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validatedParams = updateContentEntryParamsSchema.parse({
        params: req.params,
      });

      const validatedBody = updateContentEntrySchema.parse({
        body: req.body,
      });

      // Get user ID from authenticated request (if available)
      const userId = (req as any).user?.userId;

      // Update entry
      const entry = await ContentEntriesService.updateEntry(validatedParams.params.id, {
        data: validatedBody.body.data,
        status: validatedBody.body.status,
        updatedBy: userId,
      });

      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Content entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: entry,
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

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        if (error.message.includes('Validation failed') || error.message.includes('Invalid')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      next(error);
    }
  }

  /**
   * Delete a content entry
   * DELETE /api/v1/entries/:id
   */
  async deleteEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = deleteContentEntrySchema.parse({
        params: req.params,
      });

      // Delete entry
      const success = await ContentEntriesService.deleteEntry(validated.params.id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Content entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Content entry deleted successfully',
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
   * Publish a content entry (change status to PUBLISHED)
   * PUT /api/v1/entries/:id/publish
   */
  async publishEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = publishContentEntrySchema.parse({
        params: req.params,
      });

      // Get user ID from authenticated request (if available)
      const userId = (req as any).user?.userId;

      // Publish entry
      const entry = await ContentEntriesService.publishEntry(validated.params.id, userId);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Content entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: entry,
        message: 'Content entry published successfully',
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

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        if (error.message.includes('validation errors') || error.message.includes('Invalid')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      next(error);
    }
  }

  /**
   * Unpublish a content entry (change status back to DRAFT)
   * PUT /api/v1/entries/:id/unpublish
   */
  async unpublishEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = unpublishContentEntrySchema.parse({
        params: req.params,
      });

      // Get user ID from authenticated request (if available)
      const userId = (req as any).user?.userId;

      // Unpublish entry
      const entry = await ContentEntriesService.unpublishEntry(validated.params.id, userId);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Content entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: entry,
        message: 'Content entry unpublished successfully',
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

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        if (error.message.includes('Only published') || error.message.includes('Invalid')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      next(error);
    }
  }

  /**
   * Archive a content entry
   * PUT /api/v1/entries/:id/archive
   */
  async archiveEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = archiveContentEntrySchema.parse({
        params: req.params,
      });

      // Get user ID from authenticated request (if available)
      const userId = (req as any).user?.userId;

      // Archive entry
      const entry = await ContentEntriesService.archiveEntry(validated.params.id, userId);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Content entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: entry,
        message: 'Content entry archived successfully',
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

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        if (error.message.includes('Invalid')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      next(error);
    }
  }

  /**
   * Search content entries across all content types
   * GET /api/v1/entries/search
   */
  async searchEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = searchContentEntriesSchema.parse({
        query: req.query,
      });

      // Search entries
      const result = await ContentEntriesService.searchEntries(validated.query.q, {
        page: validated.query.page,
        limit: validated.query.limit,
        status: validated.query.status,
      });

      res.status(200).json({
        success: true,
        data: result.entries,
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
}

// Export controller instance
export const contentEntriesController = new ContentEntriesController();
