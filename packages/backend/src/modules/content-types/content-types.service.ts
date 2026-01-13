import { ContentTypeModel, IContentType } from '../../models/content-type.model';
import { CreateContentTypeInput, UpdateContentTypeInput } from './content-types.schema';

/**
 * Content Types Service
 * Handles all business logic for content type management
 */
export class ContentTypesService {
  /**
   * Create a new content type
   */
  async createContentType(data: CreateContentTypeInput): Promise<IContentType> {
    // Check if slug already exists
    const existingContentType = await ContentTypeModel.findOne({ slug: data.slug });
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
      });
      if (existingContentType) {
        throw new Error(`Content type with slug '${data.slug}' already exists`);
      }
    }

    // Update content type
    const contentType = await ContentTypeModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );

    return contentType;
  }

  /**
   * Delete content type
   * Note: In production, you might want to check if there are content entries using this type
   */
  async deleteContentType(id: string): Promise<boolean> {
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
