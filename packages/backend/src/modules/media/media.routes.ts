import { Router, type IRouter } from 'express';
import { mediaController } from './media.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { upload } from '../../config/upload';

/**
 * Media Routes
 */
const router: IRouter = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/media/upload:
 *   post:
 *     summary: Upload a media file
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload (max 10MB)
 *               altText:
 *                 type: string
 *                 maxLength: 200
 *                 description: Alternative text for accessibility
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: File description
 *               tags:
 *                 type: string
 *                 description: Comma-separated tags
 *                 example: "product,banner,homepage"
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Media'
 *       400:
 *         description: Validation error or file type not allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/upload', upload.single('file'), (req, res, next) =>
  mediaController.uploadMedia(req, res, next)
);

/**
 * @swagger
 * /api/v1/media:
 *   get:
 *     summary: List all media files
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: mimeType
 *         schema:
 *           type: string
 *         description: Filter by MIME type
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [image, document, video]
 *         description: Filter by category
 *       - in: query
 *         name: uploadedBy
 *         schema:
 *           type: string
 *         description: Filter by uploader user ID
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search term
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of media files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', (req, res, next) => mediaController.listMedia(req, res, next));

/**
 * @swagger
 * /api/v1/media/{id}:
 *   get:
 *     summary: Get a media file by ID
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     responses:
 *       200:
 *         description: Media file found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Media'
 *       404:
 *         description: Media file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     summary: Update media metadata
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               altText:
 *                 type: string
 *                 maxLength: 200
 *                 description: Alternative text
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: File description
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 20
 *                 description: Tags for organizing
 *     responses:
 *       200:
 *         description: Media metadata updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Media'
 *       404:
 *         description: Media file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Delete a media file
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     responses:
 *       200:
 *         description: Media file deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       404:
 *         description: Media file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', (req, res, next) => mediaController.getMedia(req, res, next));
router.patch('/:id', (req, res, next) => mediaController.updateMedia(req, res, next));
router.delete('/:id', (req, res, next) => mediaController.deleteMedia(req, res, next));

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Media:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         filename:
 *           type: string
 *           example: my-image-1234567890-abc123.jpg
 *         originalName:
 *           type: string
 *           example: my-image.jpg
 *         mimeType:
 *           type: string
 *           example: image/jpeg
 *         size:
 *           type: integer
 *           example: 1024000
 *           description: File size in bytes
 *         blobUrl:
 *           type: string
 *           example: http://127.0.0.1:10000/devstoreaccount1/media/my-image.jpg
 *         cdnUrl:
 *           type: string
 *           nullable: true
 *           example: https://cdn.example.com/my-image.jpg
 *         width:
 *           type: integer
 *           nullable: true
 *           example: 1920
 *         height:
 *           type: integer
 *           nullable: true
 *           example: 1080
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *         variants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: thumbnail
 *               width:
 *                 type: integer
 *               height:
 *                 type: integer
 *               url:
 *                 type: string
 *               size:
 *                 type: integer
 *         uploadedBy:
 *           type: string
 *           nullable: true
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         altText:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
