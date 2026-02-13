import { Router, type IRouter } from 'express';
import { contactFormsController } from './contact-forms.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import {
  createContactFormSchema,
  updateContactFormSchema,
  getContactFormSchema,
  deleteContactFormSchema,
  listContactFormsSchema,
  listSubmissionsSchema,
  getSubmissionSchema,
  updateSubmissionStatusSchema,
  deleteSubmissionSchema,
  getSubmissionStatsSchema,
} from './contact-forms.schema';

const router: IRouter = Router();

// All routes require authentication
router.use(authMiddleware);

// Form CRUD
router.post(
  '/',
  validate(createContactFormSchema),
  (req, res, next) => contactFormsController.createForm(req, res, next)
);

router.get(
  '/',
  validate(listContactFormsSchema),
  (req, res, next) => contactFormsController.listForms(req, res, next)
);

router.get(
  '/:id',
  validate(getContactFormSchema),
  (req, res, next) => contactFormsController.getForm(req, res, next)
);

router.put(
  '/:id',
  validate(updateContactFormSchema),
  (req, res, next) => contactFormsController.updateForm(req, res, next)
);

router.delete(
  '/:id',
  validate(deleteContactFormSchema),
  (req, res, next) => contactFormsController.deleteForm(req, res, next)
);

// Submissions
router.get(
  '/:formId/submissions',
  validate(listSubmissionsSchema),
  (req, res, next) => contactFormsController.listSubmissions(req, res, next)
);

router.get(
  '/:formId/submissions/:submissionId',
  validate(getSubmissionSchema),
  (req, res, next) => contactFormsController.getSubmission(req, res, next)
);

router.patch(
  '/:formId/submissions/:submissionId',
  validate(updateSubmissionStatusSchema),
  (req, res, next) => contactFormsController.updateSubmissionStatus(req, res, next)
);

router.delete(
  '/:formId/submissions/:submissionId',
  validate(deleteSubmissionSchema),
  (req, res, next) => contactFormsController.deleteSubmission(req, res, next)
);

// Stats
router.get(
  '/:formId/stats',
  validate(getSubmissionStatsSchema),
  (req, res, next) => contactFormsController.getSubmissionStats(req, res, next)
);

export default router;
