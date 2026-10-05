import { Router, type IRouter } from 'express';
import { statsController } from './stats.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { projectMiddleware } from '../../middleware/project.middleware';

const router: IRouter = Router();

router.use(authMiddleware, projectMiddleware);

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Dashboard counts (entries by status, content types, media, sites, unread submissions)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
router.get('/', (req, res, next) => statsController.getStats(req, res, next));

export default router;
