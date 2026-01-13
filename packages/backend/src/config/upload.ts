import multer from 'multer';
import { Request } from 'express';
import { AppError } from '../middleware/error.middleware';

/**
 * Allowed MIME types for uploads
 */
export const ALLOWED_MIME_TYPES = {
  images: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  videos: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'],
};

/**
 * All allowed MIME types
 */
export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES.images,
  ...ALLOWED_MIME_TYPES.documents,
  ...ALLOWED_MIME_TYPES.videos,
];

/**
 * Maximum file size (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * File filter for multer
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  // Check if MIME type is allowed
  if (ALL_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new AppError(
        `File type not allowed. Allowed types: ${ALL_ALLOWED_MIME_TYPES.join(', ')}`,
        400
      )
    );
  }
};

/**
 * Multer configuration for memory storage
 * Files will be stored in memory as Buffer objects
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

/**
 * Validate file magic bytes (file signature)
 * This prevents users from uploading malicious files with fake extensions
 */
export function validateFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const magicBytes = buffer.slice(0, 12);

  // JPEG
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return magicBytes[0] === 0xff && magicBytes[1] === 0xd8 && magicBytes[2] === 0xff;
  }

  // PNG
  if (mimeType === 'image/png') {
    return (
      magicBytes[0] === 0x89 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4e &&
      magicBytes[3] === 0x47
    );
  }

  // GIF
  if (mimeType === 'image/gif') {
    return (
      magicBytes[0] === 0x47 &&
      magicBytes[1] === 0x49 &&
      magicBytes[2] === 0x46 &&
      magicBytes[3] === 0x38
    );
  }

  // WebP
  if (mimeType === 'image/webp') {
    return (
      magicBytes[0] === 0x52 &&
      magicBytes[1] === 0x49 &&
      magicBytes[2] === 0x46 &&
      magicBytes[3] === 0x46 &&
      magicBytes[8] === 0x57 &&
      magicBytes[9] === 0x45 &&
      magicBytes[10] === 0x42 &&
      magicBytes[11] === 0x50
    );
  }

  // PDF
  if (mimeType === 'application/pdf') {
    return (
      magicBytes[0] === 0x25 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x44 &&
      magicBytes[3] === 0x46
    );
  }

  // MP4
  if (mimeType === 'video/mp4') {
    // MP4 files have 'ftyp' at bytes 4-7
    return (
      magicBytes[4] === 0x66 &&
      magicBytes[5] === 0x74 &&
      magicBytes[6] === 0x79 &&
      magicBytes[7] === 0x70
    );
  }

  // SVG (XML-based, harder to validate)
  if (mimeType === 'image/svg+xml') {
    const start = buffer.toString('utf8', 0, 100).trim();
    return start.startsWith('<svg') || start.startsWith('<?xml');
  }

  // For other types (Office documents, etc.), we trust the MIME type
  // In production, you might want to use a library like 'file-type' for more thorough checking
  return true;
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop()?.toLowerCase() || '';
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '-');

  return `${nameWithoutExt}-${timestamp}-${random}.${extension}`;
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): 'image' | 'document' | 'video' | 'other' {
  if (ALLOWED_MIME_TYPES.images.includes(mimeType)) {
    return 'image';
  }
  if (ALLOWED_MIME_TYPES.documents.includes(mimeType)) {
    return 'document';
  }
  if (ALLOWED_MIME_TYPES.videos.includes(mimeType)) {
    return 'video';
  }
  return 'other';
}
