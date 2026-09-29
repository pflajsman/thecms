import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { contactFormsController } from './contact-forms.controller';

const router: IRouter = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /submissions:
 *   get:
 *     summary: List form submissions across all forms (newest first)
 *     tags: [Contact Forms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: formId, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [UNREAD, READ, ARCHIVED] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: Submissions with form { id, name, slug, fields } or null }
 */
router.get('/', (req, res, next) => contactFormsController.listAllSubmissions(req, res, next));

export default router;
