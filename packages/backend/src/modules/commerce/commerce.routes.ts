import { Router, type IRouter, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { digitalUpload } from '../../config/upload';
import { AppError } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { inProject, projectMiddleware, requireProjectRole, writesNeed } from '../../middleware/project.middleware';
import { ProjectRole } from '../../models/project-member.model';
import { validate } from '../../middleware/validation.middleware';
import { commerceController } from './commerce.controller';
import { cancelSchema, noteSchema, resendSchema, shippedSchema, listOrdersSchema, createProductSchema, listProductsSchema, methodSchema, methodUpdateSchema, settingsSchema, updateProductSchema, variantsSchema, zoneSchema, zoneUpdateSchema } from './commerce.schema';

const router: IRouter = Router();

router.use(authMiddleware, projectMiddleware, writesNeed(ProjectRole.EDITOR));

router.get('/settings', (req, res, next) => commerceController.getSettings(req, res, next));
router.put('/settings', requireProjectRole(ProjectRole.ADMIN), validate(settingsSchema), (req, res, next) => commerceController.replaceSettings(req, res, next));

router.get('/products', validate(listProductsSchema), (req, res, next) => commerceController.listProducts(req, res, next));
router.post('/products', validate(createProductSchema), (req, res, next) => commerceController.createProduct(req, res, next));
router.get('/products/:id', (req, res, next) => commerceController.getProduct(req, res, next));
router.put('/products/:id', validate(updateProductSchema), (req, res, next) => commerceController.updateProduct(req, res, next));
router.delete('/products/:id', (req, res, next) => commerceController.deleteProduct(req, res, next));
router.put('/products/:id/variants', validate(variantsSchema), (req, res, next) => commerceController.replaceVariants(req, res, next));
router.post(
  '/products/:id/file',
  inProject((req: Request, res: Response, next: NextFunction) =>
    digitalUpload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return next(new AppError('Files up to 500 MB', 400));
      if (err) return next(err);
      next();
    })
  ),
  (req, res, next) => commerceController.uploadFile(req, res, next)
);

router.get('/shipping/zones', (req, res, next) => commerceController.listZones(req, res, next));
router.post('/shipping/zones', requireProjectRole(ProjectRole.ADMIN), validate(zoneSchema), (req, res, next) => commerceController.createZone(req, res, next));
router.put('/shipping/zones/:id', requireProjectRole(ProjectRole.ADMIN), validate(zoneUpdateSchema), (req, res, next) => commerceController.updateZone(req, res, next));
router.delete('/shipping/zones/:id', requireProjectRole(ProjectRole.ADMIN), (req, res, next) => commerceController.deleteZone(req, res, next));
router.get('/shipping/methods', (req, res, next) => commerceController.listMethods(req, res, next));
router.post('/shipping/methods', requireProjectRole(ProjectRole.ADMIN), validate(methodSchema), (req, res, next) => commerceController.createMethod(req, res, next));
router.put('/shipping/methods/:id', requireProjectRole(ProjectRole.ADMIN), validate(methodUpdateSchema), (req, res, next) => commerceController.updateMethod(req, res, next));
router.delete('/shipping/methods/:id', requireProjectRole(ProjectRole.ADMIN), (req, res, next) => commerceController.deleteMethod(req, res, next));

router.get('/orders', validate(listOrdersSchema), (req, res, next) => commerceController.listOrders(req, res, next));
router.get('/orders/needs-action', (req, res, next) => commerceController.ordersNeedingAction(req, res, next));
router.get('/orders/:id', (req, res, next) => commerceController.getOrder(req, res, next));
router.post('/orders/:id/paid', (req, res, next) => commerceController.markOrderPaid(req, res, next));
router.post('/orders/:id/shipped', validate(shippedSchema), (req, res, next) => commerceController.markOrderShipped(req, res, next));
router.post('/orders/:id/cancel', validate(cancelSchema), (req, res, next) => commerceController.cancelOrder(req, res, next));
router.post('/orders/:id/resend', validate(resendSchema), (req, res, next) => commerceController.resendOrderEmail(req, res, next));
router.put('/orders/:id/note', validate(noteSchema), (req, res, next) => commerceController.setOrderNote(req, res, next));

export default router;
