import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { projectMiddleware, requireProjectRole } from '../../middleware/project.middleware';
import { ProjectRole } from '../../models/project-member.model';
import { validate } from '../../middleware/validation.middleware';
import { aiController } from './ai.controller';
import { connectionSchema, generateSchema, settingsSchema, translateSchema } from './ai.schema';
import { aiLimiter } from '../../middleware/rateLimit.middleware';

const router: IRouter = Router();

router.use(authMiddleware, projectMiddleware);
router.use(requireProjectRole(ProjectRole.EDITOR));

router.get('/connection', (req, res, next) => aiController.getConnection(req, res, next));
router.put('/connection', validate(connectionSchema), (req, res, next) => aiController.saveConnection(req, res, next));
router.delete('/connection', (req, res, next) => aiController.deleteConnection(req, res, next));
router.put('/settings', requireProjectRole(ProjectRole.ADMIN), validate(settingsSchema), (req, res, next) => aiController.saveSettings(req, res, next));
router.post('/generate', aiLimiter, validate(generateSchema), (req, res, next) => aiController.generate(req, res, next));
router.post('/translate', aiLimiter, validate(translateSchema), (req, res, next) => aiController.translate(req, res, next));

export default router;
