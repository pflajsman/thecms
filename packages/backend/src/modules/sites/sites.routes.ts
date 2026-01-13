import { Router, type IRouter } from 'express';
import { sitesController } from './sites.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

/**
 * Sites Routes
 */
const router: IRouter = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/sites:
 *   post:
 *     summary: Create a new site
 *     tags: [Sites]
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
 *               - domain
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               domain:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               allowedOrigins:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Site created successfully
 */
router.post('/', (req, res, next) => sitesController.createSite(req, res, next));

/**
 * @swagger
 * /api/v1/sites:
 *   get:
 *     summary: List all sites
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of sites
 */
router.get('/', (req, res, next) => sitesController.listSites(req, res, next));

/**
 * @swagger
 * /api/v1/sites/{id}:
 *   get:
 *     summary: Get a site by ID
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Site found
 *       404:
 *         description: Site not found
 */
router.get('/:id', (req, res, next) => sitesController.getSite(req, res, next));

/**
 * @swagger
 * /api/v1/sites/{id}:
 *   put:
 *     summary: Update a site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               domain:
 *                 type: string
 *               description:
 *                 type: string
 *               allowedOrigins:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Site updated successfully
 *       404:
 *         description: Site not found
 */
router.put('/:id', (req, res, next) => sitesController.updateSite(req, res, next));

/**
 * @swagger
 * /api/v1/sites/{id}:
 *   delete:
 *     summary: Delete a site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Site deleted successfully
 *       404:
 *         description: Site not found
 */
router.delete('/:id', (req, res, next) => sitesController.deleteSite(req, res, next));

/**
 * @swagger
 * /api/v1/sites/{id}/rotate-key:
 *   post:
 *     summary: Rotate API key for a site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key rotated successfully
 *       404:
 *         description: Site not found
 */
router.post('/:id/rotate-key', (req, res, next) => sitesController.rotateApiKey(req, res, next));

export default router;
