import { Router, type IRouter } from 'express';
import { publicController } from './public.controller';
import { apiKeyMiddleware } from '../../middleware/apiKey.middleware';
import { publicApiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * Public API Routes
 * All routes require valid API key via X-API-Key header
 */
const router: IRouter = Router();

// Apply rate limiting first
router.use(publicApiLimiter);

// Apply API key middleware to all routes
router.use(apiKeyMiddleware);

/**
 * @swagger
 * /api/v1/public/content-types:
 *   get:
 *     summary: List all content types
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: List of content types
 *       401:
 *         description: Invalid or missing API key
 */
router.get('/content-types', (req, res, next) =>
  publicController.listContentTypes(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/content-types/{slug}:
 *   get:
 *     summary: Get content type by slug
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Content type found
 *       404:
 *         description: Content type not found
 */
router.get('/content-types/:slug', (req, res, next) =>
  publicController.getContentTypeBySlug(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/content/{contentTypeSlug}:
 *   get:
 *     summary: List published entries for a content type
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: contentTypeSlug
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: publishedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of published entries
 *       404:
 *         description: Content type not found
 */
router.get('/content/:contentTypeSlug', (req, res, next) =>
  publicController.listPublishedEntries(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/content/{contentTypeSlug}/{entryId}:
 *   get:
 *     summary: Get a single published entry
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: contentTypeSlug
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entry found
 *       404:
 *         description: Entry not found or not published
 */
router.get('/content/:contentTypeSlug/:entryId', (req, res, next) =>
  publicController.getPublishedEntry(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/search:
 *   get:
 *     summary: Search published entries
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Missing search query
 */
router.get('/search', (req, res, next) =>
  publicController.searchPublishedEntries(req, res, next)
);

export default router;
