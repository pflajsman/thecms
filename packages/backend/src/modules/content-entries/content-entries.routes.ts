import { Router, type IRouter } from 'express';
import { contentEntriesController } from './content-entries.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

/**
 * Content Entries Routes
 */
const router: IRouter = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/entries/search:
 *   get:
 *     summary: Search content entries across all content types
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query term
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
 *           default: 10
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ARCHIVED]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Search results
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
 *                     $ref: '#/components/schemas/ContentEntry'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/search', (req, res, next) => contentEntriesController.searchEntries(req, res, next));

/**
 * @swagger
 * /api/v1/entries/{id}:
 *   get:
 *     summary: Get a content entry by ID
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content entry ID
 *     responses:
 *       200:
 *         description: Content entry found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentEntry'
 *       404:
 *         description: Content entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update a content entry
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Content data (fields depend on content type)
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *                 description: Entry status
 *     responses:
 *       200:
 *         description: Content entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentEntry'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Content entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Delete a content entry
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content entry ID
 *     responses:
 *       200:
 *         description: Content entry deleted successfully
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
 *         description: Content entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', (req, res, next) => contentEntriesController.getEntry(req, res, next));
router.put('/:id', (req, res, next) => contentEntriesController.updateEntry(req, res, next));
router.delete('/:id', (req, res, next) => contentEntriesController.deleteEntry(req, res, next));

/**
 * @swagger
 * /api/v1/entries/{id}/publish:
 *   put:
 *     summary: Publish a content entry
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content entry ID
 *     responses:
 *       200:
 *         description: Content entry published successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentEntry'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or entry cannot be published
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Content entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/publish', (req, res, next) =>
  contentEntriesController.publishEntry(req, res, next)
);

/**
 * @swagger
 * /api/v1/entries/{id}/unpublish:
 *   put:
 *     summary: Unpublish a content entry (revert to DRAFT)
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content entry ID
 *     responses:
 *       200:
 *         description: Content entry unpublished successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentEntry'
 *                 message:
 *                   type: string
 *       400:
 *         description: Entry is not published
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Content entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/unpublish', (req, res, next) =>
  contentEntriesController.unpublishEntry(req, res, next)
);

/**
 * @swagger
 * /api/v1/entries/{id}/archive:
 *   put:
 *     summary: Archive a content entry
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content entry ID
 *     responses:
 *       200:
 *         description: Content entry archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentEntry'
 *                 message:
 *                   type: string
 *       404:
 *         description: Content entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/archive', (req, res, next) =>
  contentEntriesController.archiveEntry(req, res, next)
);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     ContentEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         contentTypeId:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         data:
 *           type: object
 *           description: Dynamic content data based on content type fields
 *         status:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ARCHIVED]
 *           example: DRAFT
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdBy:
 *           type: string
 *           nullable: true
 *         updatedBy:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
 *         total:
 *           type: integer
 *           example: 100
 *         totalPages:
 *           type: integer
 *           example: 10
 */
