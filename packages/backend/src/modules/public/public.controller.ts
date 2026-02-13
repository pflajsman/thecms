import { Request, Response, NextFunction } from 'express';
import { contentTypesService } from '../content-types/content-types.service';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { ContentStatus } from '../../models/content-entry.model';
import { ContactFormsService } from '../contact-forms/contact-forms.service';

/**
 * Public API Controller
 * Handles read-only access to published content for consumer applications
 */
export class PublicController {
  /**
   * List all content types
   * GET /api/v1/public/content-types
   */
  async listContentTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await contentTypesService.listContentTypes({
        limit: 100,
        offset: 0,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single content type by slug
   * GET /api/v1/public/content-types/:slug
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
   * List published entries for a content type
   * GET /api/v1/public/content/:contentTypeSlug
   */
  async listPublishedEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contentTypeSlug } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = (req.query.sortBy as string) || 'publishedAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      // Get content type first
      const contentType = await contentTypesService.getContentTypeBySlug(contentTypeSlug);

      if (!contentType) {
        res.status(404).json({
          success: false,
          error: 'Content type not found',
        });
        return;
      }

      // List published entries only
      const result = await ContentEntriesService.listEntries(contentType._id.toString(), {
        page,
        limit,
        status: ContentStatus.PUBLISHED,
        sortBy,
        sortOrder,
      });

      res.status(200).json({
        success: true,
        data: result.entries,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single published entry
   * GET /api/v1/public/content/:contentTypeSlug/:entryId
   */
  async getPublishedEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contentTypeSlug, entryId } = req.params;

      // Get content type first
      const contentType = await contentTypesService.getContentTypeBySlug(contentTypeSlug);

      if (!contentType) {
        res.status(404).json({
          success: false,
          error: 'Content type not found',
        });
        return;
      }

      // Get entry
      const entry = await ContentEntriesService.getEntryById(entryId);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Entry not found',
        });
        return;
      }

      // Check if entry is published
      if (entry.status !== ContentStatus.PUBLISHED) {
        res.status(404).json({
          success: false,
          error: 'Entry not found',
        });
        return;
      }

      // Check if entry belongs to the content type
      if (entry.contentTypeId.toString() !== contentType._id.toString()) {
        res.status(404).json({
          success: false,
          error: 'Entry not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search published entries
   * GET /api/v1/public/search
   */
  async searchPublishedEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Search query required (q parameter)',
        });
        return;
      }

      const result = await ContentEntriesService.searchEntries(query, {
        page,
        limit,
        status: ContentStatus.PUBLISHED,
      });

      res.status(200).json({
        success: true,
        data: result.entries,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get contact form schema by slug
   * GET /api/v1/public/forms/:formSlug
   */
  async getForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { formSlug } = req.params;

      const form = await ContactFormsService.getFormBySlug(formSlug);

      if (!form) {
        res.status(404).json({
          success: false,
          error: 'Form not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          name: form.name,
          description: form.description,
          fields: form.fields,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit a contact form
   * POST /api/v1/public/forms/:formSlug/submit
   */
  async submitForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { formSlug } = req.params;

      const form = await ContactFormsService.getFormBySlug(formSlug);

      if (!form) {
        res.status(404).json({
          success: false,
          error: 'Form not found',
        });
        return;
      }

      await ContactFormsService.createSubmission({
        formId: form._id.toString(),
        data: req.body,
        submitterIp: req.ip,
        submitterUserAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Field ')) {
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
export const publicController = new PublicController();
