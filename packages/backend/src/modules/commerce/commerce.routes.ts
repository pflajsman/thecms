import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { commerceController } from './commerce.controller';
import { settingsSchema } from './commerce.schema';

const router: IRouter = Router();

router.use(authMiddleware);

router.get('/settings', (req, res, next) => commerceController.getSettings(req, res, next));
router.put('/settings', validate(settingsSchema), (req, res, next) => commerceController.replaceSettings(req, res, next));

export default router;
