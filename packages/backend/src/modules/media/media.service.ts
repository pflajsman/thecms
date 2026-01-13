import sharp from 'sharp';
import mongoose from 'mongoose';
import { MediaModel, IMedia, MediaVariant } from '../../models/media.model';
import { storageService } from '../../config/storage';
import {
  generateUniqueFilename,
  validateFileMagicBytes,
  getFileCategory,
} from '../../config/upload';

/**
 * Image variant configurations
 */
const IMAGE_VARIANTS = [
  { name: 'thumbnail', width: 150, height: 150 },
  { name: 'small', width: 400, height: 400 },
  { name: 'medium', width: 800, height: 800 },
  { name: 'large', width: 1200, height: 1200 },
];

/**
 * Upload file data
 */
export interface UploadFileData {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy?: string;
  altText?: string;
  description?: string;
  tags?: string[];
}

/**
 * List media options
 */
export interface ListMediaOptions {
  page?: number;
  limit?: number;
  mimeType?: string;
  category?: 'image' | 'document' | 'video';
  uploadedBy?: string;
  tags?: string[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated media response
 */
export interface PaginatedMedia {
  media: IMedia[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Media Service
 */
export class MediaService {
  /**
   * Upload a file to blob storage and save metadata
   */
  static async uploadFile(fileData: UploadFileData): Promise<IMedia> {
    const { buffer, originalName, mimeType, size, uploadedBy, altText, description, tags } =
      fileData;

    // Validate file magic bytes
    if (!validateFileMagicBytes(buffer, mimeType)) {
      throw new Error('File type validation failed. File content does not match MIME type.');
    }

    // Generate unique filename
    const filename = generateUniqueFilename(originalName);
    const category = getFileCategory(mimeType);

    // Upload original file to blob storage
    const { url: blobUrl, cdnUrl } = await storageService.uploadFile(filename, buffer, mimeType);

    let width: number | undefined;
    let height: number | undefined;
    let thumbnailUrl: string | undefined;
    const variants: MediaVariant[] = [];

    // Process images
    if (category === 'image' && mimeType !== 'image/svg+xml') {
      try {
        // Get image metadata
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;

        // Generate variants for different sizes
        for (const variant of IMAGE_VARIANTS) {
          const variantFilename = filename.replace(/(\.[^.]+)$/, `-${variant.name}$1`);

          // Resize image
          const resizedBuffer = await sharp(buffer)
            .resize(variant.width, variant.height, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .toBuffer();

          // Upload variant
          const { url: variantUrl } = await storageService.uploadFile(
            variantFilename,
            resizedBuffer,
            mimeType
          );

          // Get variant metadata
          const variantMetadata = await sharp(resizedBuffer).metadata();

          variants.push({
            name: variant.name,
            width: variantMetadata.width || variant.width,
            height: variantMetadata.height || variant.height,
            url: variantUrl,
            size: resizedBuffer.length,
          });

          // Use thumbnail variant as thumbnailUrl
          if (variant.name === 'thumbnail') {
            thumbnailUrl = variantUrl;
          }
        }
      } catch (error) {
        console.error('Image processing failed:', error);
        // Continue without variants if processing fails
      }
    }

    // Create media document
    const media = new MediaModel({
      filename,
      originalName,
      mimeType,
      size,
      blobUrl,
      cdnUrl,
      width,
      height,
      thumbnailUrl,
      variants,
      uploadedBy: uploadedBy ? new mongoose.Types.ObjectId(uploadedBy) : undefined,
      altText,
      description,
      tags,
    });

    await media.save();
    return media;
  }

  /**
   * List media files with filtering and pagination
   */
  static async listMedia(options: ListMediaOptions = {}): Promise<PaginatedMedia> {
    const {
      page = 1,
      limit = 20,
      mimeType,
      category,
      uploadedBy,
      tags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build query
    const query: any = {};

    // Filter by MIME type
    if (mimeType) {
      query.mimeType = mimeType;
    }

    // Filter by category
    if (category) {
      if (category === 'image') {
        query.mimeType = { $regex: '^image/' };
      } else if (category === 'document') {
        query.mimeType = {
          $in: [
            /application\/pdf/,
            /document/,
            /sheet/,
            /presentation/,
          ],
        };
      } else if (category === 'video') {
        query.mimeType = { $regex: '^video/' };
      }
    }

    // Filter by uploader
    if (uploadedBy) {
      query.uploadedBy = uploadedBy;
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      query.tags = { $all: tags };
    }

    // Full-text search
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
    const [media, total] = await Promise.all([
      MediaModel.find(query).sort(sort).skip(skip).limit(limit).populate('uploadedBy').exec(),
      MediaModel.countDocuments(query),
    ]);

    return {
      media,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single media file by ID
   */
  static async getMediaById(mediaId: string): Promise<IMedia | null> {
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      throw new Error('Invalid media ID');
    }

    const media = await MediaModel.findById(mediaId).populate('uploadedBy').exec();
    return media;
  }

  /**
   * Update media metadata
   */
  static async updateMedia(
    mediaId: string,
    updates: {
      altText?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<IMedia | null> {
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      throw new Error('Invalid media ID');
    }

    const media = await MediaModel.findByIdAndUpdate(mediaId, updates, {
      new: true,
      runValidators: true,
    });

    return media;
  }

  /**
   * Delete a media file (removes from blob storage and database)
   */
  static async deleteMedia(mediaId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      throw new Error('Invalid media ID');
    }

    const media = await MediaModel.findById(mediaId);
    if (!media) {
      return false;
    }

    // Delete original file from blob storage
    await storageService.deleteFile(media.filename);

    // Delete variants from blob storage
    if (media.variants && media.variants.length > 0) {
      for (const variant of media.variants) {
        const variantFilename = media.filename.replace(/(\.[^.]+)$/, `-${variant.name}$1`);
        await storageService.deleteFile(variantFilename);
      }
    }

    // Delete from database
    await MediaModel.findByIdAndDelete(mediaId);
    return true;
  }

  /**
   * Get media files by IDs
   */
  static async getMediaByIds(mediaIds: string[]): Promise<IMedia[]> {
    const validIds = mediaIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return [];
    }

    const media = await MediaModel.find({
      _id: { $in: validIds },
    }).exec();

    return media;
  }

  /**
   * Count media files
   */
  static async countMedia(filters?: {
    mimeType?: string;
    category?: 'image' | 'document' | 'video';
  }): Promise<number> {
    const query: any = {};

    if (filters?.mimeType) {
      query.mimeType = filters.mimeType;
    }

    if (filters?.category) {
      if (filters.category === 'image') {
        query.mimeType = { $regex: '^image/' };
      } else if (filters.category === 'document') {
        query.mimeType = {
          $in: [
            /application\/pdf/,
            /document/,
            /sheet/,
            /presentation/,
          ],
        };
      } else if (filters.category === 'video') {
        query.mimeType = { $regex: '^video/' };
      }
    }

    return MediaModel.countDocuments(query);
  }
}
