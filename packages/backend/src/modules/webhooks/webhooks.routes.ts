import { Router, type IRouter } from 'express';
import { webhooksController } from './webhooks.controller';
import { validate } from '../../middleware/validation.middleware';
import {
  createWebhookSchema,
  updateWebhookSchema,
  getWebhookSchema,
  deleteWebhookSchema,
  listWebhooksSchema,
  testWebhookSchema,
  rotateSecretSchema,
} from './webhooks.schema';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Webhook management endpoints
 */

/**
 * @swagger
 * /webhooks:
 *   post:
 *     summary: Create a new webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *               - events
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *                 format: uri
 *               description:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [entry.created, entry.updated, entry.deleted, entry.published, entry.unpublished, entry.archived, content_type.created, content_type.updated, content_type.deleted, media.uploaded, media.deleted]
 *               siteId:
 *                 type: string
 *               maxRetries:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10
 *                 default: 3
 *               retryDelay:
 *                 type: integer
 *                 minimum: 1000
 *                 maximum: 300000
 *                 default: 5000
 *     responses:
 *       201:
 *         description: Webhook created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  validate(createWebhookSchema),
  (req, res, next) => webhooksController.createWebhook(req, res, next)
);

/**
 * @swagger
 * /webhooks:
 *   get:
 *     summary: List all webhooks
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: siteId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of webhooks
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  validate(listWebhooksSchema),
  (req, res, next) => webhooksController.listWebhooks(req, res, next)
);

/**
 * @swagger
 * /webhooks/{id}:
 *   get:
 *     summary: Get webhook by ID
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook details
 *       404:
 *         description: Webhook not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:id',
  validate(getWebhookSchema),
  (req, res, next) => webhooksController.getWebhook(req, res, next)
);

/**
 * @swagger
 * /webhooks/{id}:
 *   put:
 *     summary: Update webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *                 format: uri
 *               description:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *               siteId:
 *                 type: string
 *               maxRetries:
 *                 type: integer
 *               retryDelay:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Webhook updated successfully
 *       404:
 *         description: Webhook not found
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/:id',
  validate(updateWebhookSchema),
  (req, res, next) => webhooksController.updateWebhook(req, res, next)
);

/**
 * @swagger
 * /webhooks/{id}:
 *   delete:
 *     summary: Delete webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook deleted successfully
 *       404:
 *         description: Webhook not found
 *       401:
 *         description: Unauthorized
 */
router.delete(
  '/:id',
  validate(deleteWebhookSchema),
  (req, res, next) => webhooksController.deleteWebhook(req, res, next)
);

/**
 * @swagger
 * /webhooks/{id}/test:
 *   post:
 *     summary: Test webhook delivery
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Test result
 *       404:
 *         description: Webhook not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:id/test',
  validate(testWebhookSchema),
  (req, res, next) => webhooksController.testWebhook(req, res, next)
);

/**
 * @swagger
 * /webhooks/{id}/rotate-secret:
 *   post:
 *     summary: Rotate webhook secret
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Secret rotated successfully
 *       404:
 *         description: Webhook not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:id/rotate-secret',
  validate(rotateSecretSchema),
  (req, res, next) => webhooksController.rotateSecret(req, res, next)
);

/**
 * @swagger
 * /webhooks/{id}/logs:
 *   get:
 *     summary: Get webhook delivery logs
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Delivery logs
 *       404:
 *         description: Webhook not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:id/logs',
  validate(getWebhookSchema),
  (req, res, next) => webhooksController.getDeliveryLogs(req, res, next)
);

export default router;
