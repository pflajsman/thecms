import { Router, type IRouter } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { commerceController } from './commerce.controller';
import { createProductSchema, listProductsSchema, settingsSchema, updateProductSchema, variantsSchema } from './commerce.schema';

const router: IRouter = Router();

router.use(authMiddleware);

router.get('/settings', (req, res, next) => commerceController.getSettings(req, res, next));
router.put('/settings', validate(settingsSchema), (req, res, next) => commerceController.replaceSettings(req, res, next));

router.get('/products', validate(listProductsSchema), (req, res, next) => commerceController.listProducts(req, res, next));
router.post('/products', validate(createProductSchema), (req, res, next) => commerceController.createProduct(req, res, next));
router.get('/products/:id', (req, res, next) => commerceController.getProduct(req, res, next));
router.put('/products/:id', validate(updateProductSchema), (req, res, next) => commerceController.updateProduct(req, res, next));
router.delete('/products/:id', (req, res, next) => commerceController.deleteProduct(req, res, next));
router.put('/products/:id/variants', validate(variantsSchema), (req, res, next) => commerceController.replaceVariants(req, res, next));

export default router;
