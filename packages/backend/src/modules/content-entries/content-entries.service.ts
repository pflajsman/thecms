import mongoose from 'mongoose';
import { ContentEntryModel, ContentStatus, IContentEntry } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryValidator } from './validation.helper';
import { WebhookService } from '../../services/webhook.service';
import { WebhookEvent } from '../../models/webhook.model';
import { computeEntryTitle } from '../../utils/entryTitle';
import { escapeRegex } from '../../utils/regex';

/**
 * Query options for listing content entries
 */
export interface ListEntriesOptions {
  page?: number;
  limit?: number;
  status?: ContentStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/**
 * Paginated response for content entries
 */
export interface PaginatedEntries {
  entries: IContentEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListAllEntriesOptions {
  page?: number;
  limit?: number;
  status?: ContentStatus;
  contentTypeIds?: string[];
  search?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface EntryContentTypeRef {
  id: string;
  name: string;
  slug: string;
}

export type EntryListItem = ReturnType<IContentEntry['toJSON']> & {
  title: string;
  contentType: EntryContentTypeRef | null;
};

export interface PaginatedEntryListItems {
  entries: EntryListItem[];
  pagination: PaginatedEntries['pagination'];
}

/**
 * Content Entry creation data
 */
export interface CreateEntryData {
  contentTypeId: string;
  data: Record<string, any>;
  status?: ContentStatus;
  createdBy?: string;
}

/**
 * Content Entry update data
 */
export interface UpdateEntryData {
  data?: Record<string, any>;
  status?: ContentStatus;
  updatedBy?: string;
}

/**
 * Service layer for Content Entries
 */
export class ContentEntriesService {
  /**
   * Create a new content entry
   */
  static async createEntry(entryData: CreateEntryData): Promise<IContentEntry> {
    // Validate content type exists (lean + select for minimal RU cost)
    const contentType = await ContentTypeModel.findById(entryData.contentTypeId).lean();
    if (!contentType) {
      throw new Error('Content type not found');
    }

    // Validate entry data against content type fields
    const validationResult = ContentEntryValidator.validateEntryData(
      entryData.data,
      contentType.fields
    );

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map((e) => e.message).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    if (validationResult.warnings.length > 0) {
      console.warn(
        `Content entry (type ${entryData.contentTypeId}) has orphaned fields: ${validationResult.warnings
          .map((w) => w.field)
          .join(', ')}`
      );
    }

    // Create the entry
    const entry = new ContentEntryModel({
      contentTypeId: entryData.contentTypeId,
      data: entryData.data,
      title: computeEntryTitle(entryData.data, contentType.fields, contentType.titleField),
      status: entryData.status || ContentStatus.DRAFT,
      createdBy: entryData.createdBy,
      updatedBy: entryData.createdBy,
    });

    await entry.save();

    // Trigger webhook for entry creation
    WebhookService.triggerEvent(WebhookEvent.ENTRY_CREATED, {
      entry: entry.toJSON(),
      contentType: { id: contentType._id, name: contentType.name, slug: contentType.slug },
    }).catch((err) => console.error('Webhook trigger error:', err));

    return entry;
  }

  /**
   * List content entries with filtering and pagination
   */
  static async listEntries(
    contentTypeId: string,
    options: ListEntriesOptions = {}
  ): Promise<PaginatedEntries> {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
    } = options;

    // Validate content type exists (select only _id for minimal RU cost)
    const contentTypeExists = await ContentTypeModel.exists({ _id: contentTypeId });
    if (!contentTypeExists) {
      throw new Error('Content type not found');
    }

    // Build query
    const query: any = { contentTypeId };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Full-text search if search term provided
    if (search) {
      query.$text = { $search: search };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // If searching, sort by text score
    if (search) {
      sort.score = { $meta: 'textScore' };
    }

    // Execute query
    const [entries, total] = await Promise.all([
      ContentEntryModel.find(query).sort(sort).skip(skip).limit(limit).exec(),
      ContentEntryModel.countDocuments(query),
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List entries across all content types (admin Content list, pickers, search)
   */
  static async listAllEntries(options: ListAllEntriesOptions = {}): Promise<PaginatedEntryListItems> {
    const {
      page = 1,
      limit = 20,
      status,
      contentTypeIds,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = options;

    // `any` matches the existing query-building style in this service.
    const query: any = {};
    if (contentTypeIds && contentTypeIds.length > 0) query.contentTypeId = { $in: contentTypeIds };
    if (status) query.status = status;
    if (search) query.title = { $regex: escapeRegex(search), $options: 'i' };

    const direction = sortOrder === 'asc' ? 1 : -1;
    // One sort key only: Cosmos DB (production) needs an index that matches the sort exactly, and
    // each sortable field has a single-field index on the model.
    const sort: Record<string, 1 | -1> = { [sortBy]: direction };

    const [entries, total] = await Promise.all([
      ContentEntryModel.find(query).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      ContentEntryModel.countDocuments(query),
    ]);

    const typeIds = [...new Set(entries.map((e) => String(e.contentTypeId)))];
    const types = await ContentTypeModel.find({ _id: { $in: typeIds } }).select('name slug').lean();
    const typeMap = new Map<string, EntryContentTypeRef>(
      types.map((t) => [String(t._id), { id: String(t._id), name: t.name, slug: t.slug }])
    );

    return {
      entries: entries.map((e) => ({
        ...e.toJSON(),
        title: e.title,
        contentType: typeMap.get(String(e.contentTypeId)) ?? null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single content entry by ID
   */
  static async getEntryById(entryId: string): Promise<IContentEntry | null> {
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      throw new Error('Invalid entry ID');
    }

    const entry = await ContentEntryModel.findById(entryId).populate('contentTypeId').exec();
    return entry;
  }

  /**
   * Update a content entry
   */
  static async updateEntry(
    entryId: string,
    updateData: UpdateEntryData
  ): Promise<IContentEntry | null> {
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      throw new Error('Invalid entry ID');
    }

    // Get existing entry
    const entry = await ContentEntryModel.findById(entryId);
    if (!entry) {
      throw new Error('Content entry not found');
    }

    // Get content type (lean — only used for validation, not saved)
    const contentType = await ContentTypeModel.findById(entry.contentTypeId).lean();
    if (!contentType) {
      throw new Error('Content type not found');
    }

    // If data is being updated, validate it
    if (updateData.data) {
      const validationResult = ContentEntryValidator.validateEntryData(
        updateData.data,
        contentType.fields
      );

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors.map((e) => e.message).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      if (validationResult.warnings.length > 0) {
        console.warn(
          `Content entry ${entryId} has orphaned fields: ${validationResult.warnings
            .map((w) => w.field)
            .join(', ')}`
        );
      }

      entry.data = updateData.data;
      entry.title = computeEntryTitle(updateData.data, contentType.fields, contentType.titleField);
    }

    // Update status if provided
    if (updateData.status) {
      entry.status = updateData.status;
    }

    // Update updatedBy if provided
    if (updateData.updatedBy) {
      entry.updatedBy = new mongoose.Types.ObjectId(updateData.updatedBy);
    }

    await entry.save();

    // Trigger webhook for entry update
    WebhookService.triggerEvent(WebhookEvent.ENTRY_UPDATED, {
      entry: entry.toJSON(),
      contentType: { id: contentType._id, name: contentType.name, slug: contentType.slug },
    }).catch((err) => console.error('Webhook trigger error:', err));

    return entry;
  }

  /**
   * Delete a content entry
   */
  static async deleteEntry(entryId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      throw new Error('Invalid entry ID');
    }

    // Get entry data before deleting for webhook
    const entry = await ContentEntryModel.findById(entryId);
    if (!entry) {
      return false;
    }

    const contentType = await ContentTypeModel.findById(entry.contentTypeId)
      .select('_id name slug').lean();
    const entryData = entry.toJSON();

    const result = await ContentEntryModel.findByIdAndDelete(entryId);

    // Trigger webhook for entry deletion
    if (result) {
      WebhookService.triggerEvent(WebhookEvent.ENTRY_DELETED, {
        entry: entryData,
        contentType: contentType ? { id: contentType._id, name: contentType.name, slug: contentType.slug } : undefined,
      }).catch((err) => console.error('Webhook trigger error:', err));
    }

    return result !== null;
  }

  /**
   * Publish a content entry (change status to PUBLISHED)
   */
  static async publishEntry(entryId: string, userId?: string): Promise<IContentEntry | null> {
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      throw new Error('Invalid entry ID');
    }

    const entry = await ContentEntryModel.findById(entryId);
    if (!entry) {
      throw new Error('Content entry not found');
    }

    // Get content type to validate data before publishing (lean — only read)
    const contentType = await ContentTypeModel.findById(entry.contentTypeId).lean();
    if (!contentType) {
      throw new Error('Content type not found');
    }

    // Validate entry data before publishing
    const validationResult = ContentEntryValidator.validateEntryData(
      entry.data,
      contentType.fields
    );

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map((e) => e.message).join(', ');
      throw new Error(`Cannot publish entry with validation errors: ${errorMessages}`);
    }

    // Update status to published
    entry.status = ContentStatus.PUBLISHED;

    if (userId) {
      entry.updatedBy = new mongoose.Types.ObjectId(userId);
    }

    // The pre-save hook will set publishedAt automatically
    await entry.save();

    // Trigger webhook for entry published
    WebhookService.triggerEvent(WebhookEvent.ENTRY_PUBLISHED, {
      entry: entry.toJSON(),
      contentType: { id: contentType._id, name: contentType.name, slug: contentType.slug },
    }).catch((err) => console.error('Webhook trigger error:', err));

    return entry;
  }

  /**
   * Unpublish a content entry (change status back to DRAFT)
   */
  static async unpublishEntry(entryId: string, userId?: string): Promise<IContentEntry | null> {
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      throw new Error('Invalid entry ID');
    }

    const entry = await ContentEntryModel.findById(entryId);
    if (!entry) {
      throw new Error('Content entry not found');
    }

    if (entry.status !== ContentStatus.PUBLISHED) {
      throw new Error('Only published entries can be unpublished');
    }

    entry.status = ContentStatus.DRAFT;

    if (userId) {
      entry.updatedBy = new mongoose.Types.ObjectId(userId);
    }

    // The pre-save hook will clear publishedAt automatically
    await entry.save();

    // Get content type for webhook (select only needed fields)
    const contentType = await ContentTypeModel.findById(entry.contentTypeId)
      .select('_id name slug').lean();

    // Trigger webhook for entry unpublished
    WebhookService.triggerEvent(WebhookEvent.ENTRY_UNPUBLISHED, {
      entry: entry.toJSON(),
      contentType: contentType ? { id: contentType._id, name: contentType.name, slug: contentType.slug } : undefined,
    }).catch((err) => console.error('Webhook trigger error:', err));

    return entry;
  }

  /**
   * Archive a content entry
   */
  static async archiveEntry(entryId: string, userId?: string): Promise<IContentEntry | null> {
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      throw new Error('Invalid entry ID');
    }

    const entry = await ContentEntryModel.findById(entryId);
    if (!entry) {
      throw new Error('Content entry not found');
    }

    entry.status = ContentStatus.ARCHIVED;

    if (userId) {
      entry.updatedBy = new mongoose.Types.ObjectId(userId);
    }

    await entry.save();

    // Get content type for webhook (select only needed fields)
    const contentType = await ContentTypeModel.findById(entry.contentTypeId)
      .select('_id name slug').lean();

    // Trigger webhook for entry archived
    WebhookService.triggerEvent(WebhookEvent.ENTRY_ARCHIVED, {
      entry: entry.toJSON(),
      contentType: contentType ? { id: contentType._id, name: contentType.name, slug: contentType.slug } : undefined,
    }).catch((err) => console.error('Webhook trigger error:', err));

    return entry;
  }

  /**
   * Search content entries across all content types
   */
  static async searchEntries(
    searchTerm: string,
    options: Omit<ListEntriesOptions, 'search'> = {}
  ): Promise<PaginatedEntries> {
    const { page = 1, limit = 10, status, sortOrder = 'desc' } = options;

    // Build query
    const query: any = {
      $text: { $search: searchTerm },
    };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Sort by text search score
    const sort: any = {
      score: { $meta: 'textScore' },
      createdAt: sortOrder === 'asc' ? 1 : -1,
    };

    // Execute query
    const [entries, total] = await Promise.all([
      ContentEntryModel.find(query).sort(sort).skip(skip).limit(limit).exec(),
      ContentEntryModel.countDocuments(query),
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get entries by multiple IDs
   */
  static async getEntriesByIds(entryIds: string[]): Promise<IContentEntry[]> {
    const validIds = entryIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return [];
    }

    const entries = await ContentEntryModel.find({
      _id: { $in: validIds },
    }).lean().exec();

    return entries as IContentEntry[];
  }

  /**
   * Count entries by content type and status
   */
  static async countEntries(contentTypeId: string, status?: ContentStatus): Promise<number> {
    const query: any = { contentTypeId };

    if (status) {
      query.status = status;
    }

    return ContentEntryModel.countDocuments(query);
  }
}
