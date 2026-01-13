import { Router, type IRouter } from 'express';
import { userRoutes } from './user.routes';
import contentTypesRoutes from '../modules/content-types/content-types.routes';
import contentEntriesRoutes from '../modules/content-entries/content-entries.routes';
import mediaRoutes from '../modules/media/media.routes';
import sitesRoutes from '../modules/sites/sites.routes';
import publicRoutes from '../modules/public/public.routes';
import webhooksRoutes from '../modules/webhooks/webhooks.routes';

const router: IRouter = Router();

// Mount route modules
router.use('/users', userRoutes);
router.use('/content-types', contentTypesRoutes);
router.use('/entries', contentEntriesRoutes);
router.use('/media', mediaRoutes);
router.use('/sites', sitesRoutes);
router.use('/public', publicRoutes);
router.use('/webhooks', webhooksRoutes);

export { router as apiRoutes };
