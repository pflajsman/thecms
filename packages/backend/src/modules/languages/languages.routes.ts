import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { languagesController } from './languages.controller';
import {
  createLanguageSchema,
  deleteLanguageSchema,
  languageCodeSchema,
  renameLanguageSchema,
} from './languages.schema';

const router: IRouter = Router();

router.use(authMiddleware);

router.get('/', (req, res, next) => languagesController.list(req, res, next));
router.post('/', validate(createLanguageSchema), (req, res, next) => languagesController.create(req, res, next));
router.put('/:code', validate(renameLanguageSchema), (req, res, next) => languagesController.rename(req, res, next));
router.put('/:code/default', validate(languageCodeSchema), (req, res, next) =>
  languagesController.makeDefault(req, res, next)
);
router.delete('/:code', validate(deleteLanguageSchema), (req, res, next) => languagesController.remove(req, res, next));

export default router;
