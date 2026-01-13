import { Router, type IRouter } from 'express';
import { contentTypesController } from './content-types.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { contentEntriesController } from '../content-entries/content-entries.controller';

/**
 * Content Types Routes
 */
const router: IRouter = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/content-types:
 *   post:
 *     summary: Create a new content type
 *     tags: [Content Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - fields
 *             properties:
 *               name:
 *                 type: string
 *                 example: Blog Post
 *               slug:
 *                 type: string
 *                 example: blog-post
 *               description:
 *                 type: string
 *                 example: Blog post content type
 *               fields:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/FieldDefinition'
 *     responses:
 *       201:
 *         description: Content type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentType'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Content type with slug already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (req, res, next) => contentTypesController.createContentType(req, res, next));

/**
 * @swagger
 * /api/v1/content-types:
 *   get:
 *     summary: Get all content types
 *     tags: [Content Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of items per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
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
 *         description: List of content types
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
 *                     $ref: '#/components/schemas/ContentType'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
router.get('/', (req, res, next) => contentTypesController.listContentTypes(req, res, next));

/**
 * @swagger
 * /api/v1/content-types/slug/{slug}:
 *   get:
 *     summary: Get content type by slug
 *     tags: [Content Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Content type slug
 *     responses:
 *       200:
 *         description: Content type found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentType'
 *       404:
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/slug/:slug', (req, res, next) => contentTypesController.getContentTypeBySlug(req, res, next));

/**
 * @swagger
 * /api/v1/content-types/{id}:
 *   get:
 *     summary: Get content type by ID
 *     tags: [Content Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content type ID
 *     responses:
 *       200:
 *         description: Content type found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentType'
 *       404:
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update content type
 *     tags: [Content Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               fields:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/FieldDefinition'
 *     responses:
 *       200:
 *         description: Content type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContentType'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Delete content type
 *     tags: [Content Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content type ID
 *     responses:
 *       200:
 *         description: Content type deleted successfully
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
 *                   example: Content type deleted successfully
 *       404:
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', (req, res, next) => contentTypesController.getContentTypeById(req, res, next));
router.put('/:id', (req, res, next) => contentTypesController.updateContentType(req, res, next));
router.delete('/:id', (req, res, next) => contentTypesController.deleteContentType(req, res, next));

/**
 * @swagger
 * /api/v1/content-types/{typeId}/entries:
 *   post:
 *     summary: Create a new content entry for a specific content type
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: typeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *                 description: Content data (fields depend on content type)
 *                 example:
 *                   title: "My First Blog Post"
 *                   body: "<p>This is the content...</p>"
 *                   author: "John Doe"
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *                 default: DRAFT
 *     responses:
 *       201:
 *         description: Content entry created successfully
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
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: List all content entries for a specific content type
 *     tags: [Content Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: typeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content type ID
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search term
 *     responses:
 *       200:
 *         description: List of content entries
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
 *       404:
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:typeId/entries', (req, res, next) => {
  // Map :typeId to :typeId param for controller
  req.params.typeId = req.params.typeId;
  contentEntriesController.createEntry(req, res, next);
});

router.get('/:typeId/entries', (req, res, next) => {
  req.params.typeId = req.params.typeId;
  contentEntriesController.listEntries(req, res, next);
});

export default router;
