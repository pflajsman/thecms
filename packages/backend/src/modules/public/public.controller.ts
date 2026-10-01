import { Request, Response, NextFunction } from 'express';
import { contentTypesService } from '../content-types/content-types.service';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { ContentStatus } from '../../models/content-entry.model';
import { ContactFormsService } from '../contact-forms/contact-forms.service';
import { MediaService } from '../media/media.service';
import { getPublished, listPublished, onePerItem, resolveLanguage } from './public-content.service';
import { getShopProduct, listShopProducts, resolveCurrency } from '../commerce/public-shop.service';
import { SettingsService } from '../commerce/settings.service';

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

      const { language, defaultLanguage } = await resolveLanguage(req.query.language);

      // Published entries only, one version per item
      const result = await listPublished(contentType._id.toString(), {
        language,
        defaultLanguage,
        page,
        limit,
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

      const { language, defaultLanguage } = await resolveLanguage(req.query.language);

      // entryId may be an item id or the id of any of its versions
      const entry = await getPublished(contentType._id.toString(), entryId, language, defaultLanguage);

      if (!entry) {
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

      const { language, defaultLanguage } = await resolveLanguage(req.query.language);

      // Totals count matching versions; the page keeps one version per item.
      const result = await ContentEntriesService.searchEntries(query, {
        page,
        limit,
        status: ContentStatus.PUBLISHED,
        languages: [...new Set([language, defaultLanguage])],
      });

      res.status(200).json({
        success: true,
        data: onePerItem(result.entries, language),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resolve a media item by id to its public file info.
   * GET /api/v1/public/media/:id
   *
   * Returns only public-safe fields (no uploader/internal data) so consumer
   * apps can turn a media id stored in entry data into a downloadable URL.
   */
  async getMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const media = await MediaService.getMediaById(id).catch(() => null);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: media._id.toString(),
          filename: media.filename,
          originalName: media.originalName,
          mimeType: media.mimeType,
          size: media.size,
          url: media.cdnUrl || media.blobUrl,
          blobUrl: media.blobUrl,
          cdnUrl: media.cdnUrl,
          width: media.width,
          height: media.height,
          thumbnailUrl: media.thumbnailUrl,
          variants: media.variants,
        },
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

  /**
   * Shop currencies
   * GET /api/v1/public/shop/settings
   */
  async getShopSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SettingsService.get();
      res.status(200).json({ success: true, data: { currencies: settings.toJSON().currencies, defaultCurrency: settings.defaultCurrency } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Products for sale
   * GET /api/v1/public/shop/products
   */
  async listShopProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { language, defaultLanguage } = await resolveLanguage(req.query.language);
      const currency = await resolveCurrency(req.query.currency);
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100) : undefined;
      const result = await listShopProducts({ currency, language, defaultLanguage, page, limit, ids });
      res.status(200).json({ success: true, data: result.products, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  /**
   * One product for sale, by product id or entry id
   * GET /api/v1/public/shop/products/:id
   */
  async getShopProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { language, defaultLanguage } = await resolveLanguage(req.query.language);
      const currency = await resolveCurrency(req.query.currency);
      const product = await getShopProduct(req.params.id, currency, language, defaultLanguage);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      res.status(200).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
}

// Export controller instance
export const publicController = new PublicController();
