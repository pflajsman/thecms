import { ContentTypeModel, IContentType } from '../../models/content-type.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { CreateContentTypeInput, UpdateContentTypeInput } from './content-types.schema';
import { FieldType } from '../../types/field-types';
import { AppError } from '../../middleware/error.middleware';
import { PRODUCT_CORE_FIELDS } from '../commerce/product-model';
import { recomputeTitlesForType } from '../content-entries/entry-titles.service';
import { unifySharedField } from '../content-entries/entry-versions.service';
import { isLocalized } from '../../utils/localized';

/**
 * Content Types Service
 * Handles all business logic for content type management
 */
export class ContentTypesService {
  /**
   * Create a new content type
   */
  async createContentType(data: CreateContentTypeInput): Promise<IContentType> {
    // Check if slug already exists (select only _id for minimal RU)
    const existingContentType = await ContentTypeModel.findOne({ slug: data.slug })
      .select('_id').lean();
    if (existingContentType) {
      throw new Error(`Content type with slug '${data.slug}' already exists`);
    }

    // Create new content type
    const contentType = new ContentTypeModel(data);
    await contentType.save();

    return contentType;
  }

  /**
   * Get all content types
   */
  async listContentTypes(options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: IContentType[]; total: number }> {
    const { limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options || {};

    // Build sort object
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    // Execute query with pagination
    const [data, total] = await Promise.all([
      ContentTypeModel.find().sort(sort).skip(offset).limit(limit).exec(),
      ContentTypeModel.countDocuments(),
    ]);

    return { data, total };
  }

  /**
   * Get content type by ID
   */
  async getContentTypeById(id: string): Promise<IContentType | null> {
    const contentType = await ContentTypeModel.findById(id);
    return contentType;
  }

  /**
   * Get content type by slug
   */
  async getContentTypeBySlug(slug: string): Promise<IContentType | null> {
    const contentType = await ContentTypeModel.findOne({ slug });
    return contentType;
  }

  /**
   * Update content type
   */
  async updateContentType(id: string, data: UpdateContentTypeInput): Promise<IContentType | null> {
    // Check if updating slug and if it conflicts
    if (data.slug) {
      const existingContentType = await ContentTypeModel.findOne({
        slug: data.slug,
        _id: { $ne: id },
      }).select('_id').lean();
      if (existingContentType) {
        throw new Error(`Content type with slug '${data.slug}' already exists`);
      }
    }

    // A titleField sent without fields is checked against the stored fields
    // (the schema can only check it when both arrive together).
    if (data.titleField && !data.fields) {
      const existing = await ContentTypeModel.findById(id).select('fields').lean();
      const ok = existing?.fields.some((f) => f.name === data.titleField && f.type === FieldType.TEXT);
      if (existing && !ok) {
        throw new Error('Invalid titleField: must name a TEXT field of this content type');
      }
    }

    const previous = data.fields ? await ContentTypeModel.findById(id).select('fields system').lean() : null;
    const previousFields = previous?.fields ?? [];
    if (previous?.system === 'product' && data.fields) {
      const kept = PRODUCT_CORE_FIELDS.every((name) => {
        const before = previousFields.find((f) => f.name === name);
        const after = data.fields!.find((f) => f.name === name);
        return !!before && !!after && before.type === after.type;
      });
      if (!kept) throw new AppError("The Product model's name, description and images fields cannot be removed or changed", 409);
    }

    // Update content type
    const contentType = await ContentTypeModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );

    // Fields turned from translated to shared take one value across the item's versions.
    if (contentType && data.fields) {
      for (const field of data.fields) {
        const before = previousFields.find((f) => f.name === field.name);
        if (before && isLocalized(before) && !isLocalized(field)) {
          await unifySharedField(id, field.name);
        }
      }
    }

    if (contentType && (data.titleField !== undefined || data.fields !== undefined)) {
      await recomputeTitlesForType(contentType);
    }

    return contentType;
  }

  /**
   * Count content entries using a given content type
   */
  async countEntriesForType(id: string): Promise<number> {
    return ContentEntryModel.countDocuments({ contentTypeId: id });
  }

  /**
   * Delete content type
   *
   * By default this refuses to delete a content type that still has entries,
   * to avoid silently orphaning content. Pass `force: true` to cascade-delete
   * all entries of this type as well.
   *
   * @throws Error with `code: 'HAS_ENTRIES'` when entries exist and force is not set.
   */
  async deleteContentType(id: string, options?: { force?: boolean }): Promise<boolean> {
    const force = options?.force ?? false;

    const system = (await ContentTypeModel.findById(id).select('system').lean())?.system;
    if (system === 'product') throw new AppError('The Product model cannot be deleted', 409);

    const entryCount = await this.countEntriesForType(id);
    if (entryCount > 0 && !force) {
      const error = new Error(
        `Cannot delete content type: ${entryCount} content ${
          entryCount === 1 ? 'entry uses' : 'entries use'
        } it. Delete those entries first, or force-delete to remove them too.`
      ) as Error & { code?: string; entryCount?: number };
      error.code = 'HAS_ENTRIES';
      error.entryCount = entryCount;
      throw error;
    }

    // Force delete: remove dependent entries first to avoid orphans
    if (entryCount > 0 && force) {
      await ContentEntryModel.deleteMany({ contentTypeId: id });
    }

    const result = await ContentTypeModel.findByIdAndDelete(id);
    return result !== null;
  }

  /**
   * Check if content type exists
   */
  async contentTypeExists(slug: string): Promise<boolean> {
    const count = await ContentTypeModel.countDocuments({ slug });
    return count > 0;
  }

  /**
   * Get content type field by name
   */
  async getFieldDefinition(contentTypeId: string, fieldName: string) {
    const contentType = await this.getContentTypeById(contentTypeId);
    if (!contentType) {
      return null;
    }

    const field = contentType.fields.find((f) => f.name === fieldName);
    return field || null;
  }
}

// Export singleton instance
export const contentTypesService = new ContentTypesService();
