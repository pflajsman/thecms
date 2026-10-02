import { Router, type IRouter } from 'express';
import { userRoutes } from './user.routes';
import contentTypesRoutes from '../modules/content-types/content-types.routes';
import contentEntriesRoutes from '../modules/content-entries/content-entries.routes';
import mediaRoutes from '../modules/media/media.routes';
import sitesRoutes from '../modules/sites/sites.routes';
import publicRoutes from '../modules/public/public.routes';
import webhooksRoutes from '../modules/webhooks/webhooks.routes';
import contactFormsRoutes from '../modules/contact-forms/contact-forms.routes';
import statsRoutes from '../modules/stats/stats.routes';
import submissionsRoutes from '../modules/contact-forms/submissions.routes';
import languagesRoutes from '../modules/languages/languages.routes';
import commerceRoutes from '../modules/commerce/commerce.routes';
import aiRoutes from '../modules/ai/ai.routes';
import tokensRoutes from '../modules/tokens/tokens.routes';
import mcpRoutes from '../modules/mcp/mcp.routes';

const router: IRouter = Router();

// Mount route modules
router.use('/users', userRoutes);
router.use('/content-types', contentTypesRoutes);
router.use('/entries', contentEntriesRoutes);
router.use('/media', mediaRoutes);
router.use('/sites', sitesRoutes);
router.use('/public', publicRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/contact-forms', contactFormsRoutes);
router.use('/stats', statsRoutes);
router.use('/submissions', submissionsRoutes);
router.use('/languages', languagesRoutes);
router.use('/commerce', commerceRoutes);
router.use('/ai', aiRoutes);
router.use('/tokens', tokensRoutes);
router.use('/mcp', mcpRoutes);

export { router as apiRoutes };
