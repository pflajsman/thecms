import { Request, Response, NextFunction } from 'express';
import { MediaService } from './media.service';
import {
  listMediaSchema,
  getMediaSchema,
  updateMediaSchema,
  deleteMediaSchema,
  uploadMediaMetadataSchema,
} from './media.schema';
import { z } from 'zod';

/**
 * Media Controller
 * Handles HTTP requests for media management
 */
export class MediaController {
  /**
   * Upload a media file
   * POST /api/v1/media/upload
   */
  async uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if file was uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
        return;
      }

      // Get user ID from authenticated request
      const userId = (req as any).user?.userId;

      // Parse and validate metadata from form data
      const metadata = uploadMediaMetadataSchema.parse({
        altText: req.body.altText,
        description: req.body.description,
        tags: req.body.tags,
      });

      // Upload file
      const media = await MediaService.uploadFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: userId,
        altText: metadata.altText,
        description: metadata.description,
        tags: metadata.tags,
      });

      res.status(201).json({
        success: true,
        data: media,
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
        if (error.message.includes('validation failed')) {
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
   * List media files
   * GET /api/v1/media
   */
  async listMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = listMediaSchema.parse({
        query: req.query,
      });

      // List media
      const result = await MediaService.listMedia({
        page: validated.query.page,
        limit: validated.query.limit,
        mimeType: validated.query.mimeType,
        category: validated.query.category,
        uploadedBy: validated.query.uploadedBy,
        tags: validated.query.tags,
        search: validated.query.search,
        sortBy: validated.query.sortBy,
        sortOrder: validated.query.sortOrder,
      });

      res.status(200).json({
        success: true,
        data: result.media,
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
   * Get a single media file by ID
   * GET /api/v1/media/:id
   */
  async getMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = getMediaSchema.parse({
        params: req.params,
      });

      // Get media
      const media = await MediaService.getMediaById(validated.params.id);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media file not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: media,
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
   * Update media metadata
   * PATCH /api/v1/media/:id
   */
  async updateMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = updateMediaSchema.parse({
        params: req.params,
        body: req.body,
      });

      // Update media
      const media = await MediaService.updateMedia(validated.params.id, validated.body);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media file not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: media,
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
   * Delete a media file
   * DELETE /api/v1/media/:id
   */
  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const validated = deleteMediaSchema.parse({
        params: req.params,
      });

      // Delete media
      const success = await MediaService.deleteMedia(validated.params.id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Media file not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Media file deleted successfully',
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
export const mediaController = new MediaController();
