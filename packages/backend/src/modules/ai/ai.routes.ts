import { Router, type IRouter } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { UserRole } from '../../models/user.model';
import { aiController } from './ai.controller';
import { connectionSchema, settingsSchema } from './ai.schema';

const router: IRouter = Router();

router.use(authMiddleware);
router.use(requireRole(UserRole.ADMIN, UserRole.EDITOR));

router.get('/connection', (req, res, next) => aiController.getConnection(req, res, next));
router.put('/connection', validate(connectionSchema), (req, res, next) => aiController.saveConnection(req, res, next));
router.delete('/connection', (req, res, next) => aiController.deleteConnection(req, res, next));
router.put('/settings', requireRole(UserRole.ADMIN), validate(settingsSchema), (req, res, next) => aiController.saveSettings(req, res, next));

export default router;
