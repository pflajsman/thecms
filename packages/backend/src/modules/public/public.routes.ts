import { Router, type IRouter } from 'express';
import { publicController } from './public.controller';
import { apiKeyMiddleware } from '../../middleware/apiKey.middleware';
import { publicApiLimiter, formSubmitLimiter, orderLimiter } from '../../middleware/rateLimit.middleware';
import { validate } from '../../middleware/validation.middleware';
import { orderSchema, quoteSchema } from '../commerce/checkout.schema';

/**
 * Public API Routes
 * All routes require valid API key via X-API-Key header
 */
const router: IRouter = Router();

// Apply rate limiting first
router.use(publicApiLimiter);

// Apply API key middleware to all routes
router.use(apiKeyMiddleware);

/**
 * @swagger
 * /api/v1/public/content-types:
 *   get:
 *     summary: List all content types
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: List of content types
 *       401:
 *         description: Invalid or missing API key
 */
router.get('/content-types', (req, res, next) =>
  publicController.listContentTypes(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/content-types/{slug}:
 *   get:
 *     summary: Get content type by slug
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Content type found
 *       404:
 *         description: Content type not found
 */
router.get('/content-types/:slug', (req, res, next) =>
  publicController.getContentTypeBySlug(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/shop/settings:
 *   get:
 *     summary: Shop currencies
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Currencies and the default currency
 */
router.get('/shop/settings', (req, res, next) => publicController.getShopSettings(req, res, next));

/**
 * @swagger
 * /api/v1/public/shop/products:
 *   get:
 *     summary: Products for sale, with prices in one currency and content in one language
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - { in: query, name: currency, schema: { type: string } }
 *       - { in: query, name: language, schema: { type: string } }
 *       - { in: query, name: ids, schema: { type: string }, description: Comma-separated product or entry ids }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Products for sale
 *       400:
 *         description: Unknown currency or language
 */
router.get('/shop/products', (req, res, next) => publicController.listShopProducts(req, res, next));

/**
 * @swagger
 * /api/v1/public/shop/quote:
 *   post:
 *     summary: Price a cart (lines, shipping options, payment fees, totals)
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Quote
 *       400:
 *         description: Invalid cart, currency or language
 */
router.post('/shop/quote', validate(quoteSchema), (req, res, next) => publicController.quoteCart(req, res, next));

/**
 * @swagger
 * /api/v1/public/shop/shipping-countries:
 *   get:
 *     summary: Countries the shop ships to
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: ISO country codes
 */
router.get('/shop/shipping-countries', (req, res, next) => publicController.shippingCountries(req, res, next));

/**
 * @swagger
 * /api/v1/public/shop/orders:
 *   post:
 *     summary: Place a guest order (re-prices the cart and reserves stock)
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - { in: header, name: Idempotency-Key, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Order placed
 *       409:
 *         description: PRICE_CHANGED (with a fresh quote) or OUT_OF_STOCK
 */
router.post('/shop/orders', orderLimiter, validate(orderSchema), (req, res, next) => publicController.placeOrder(req, res, next));

/**
 * @swagger
 * /api/v1/public/shop/orders/{number}:
 *   get:
 *     summary: An order for its customer, with the access token from checkout
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Order status and payment instructions
 *       404:
 *         description: Unknown order or wrong token
 */
router.get('/shop/orders/:number', (req, res, next) => publicController.getCustomerOrder(req, res, next));

/**
 * @swagger
 * /api/v1/public/shop/products/{id}:
 *   get:
 *     summary: One product for sale, by product id or entry id
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Product
 *       404:
 *         description: Not for sale
 */
router.get('/shop/products/:id', (req, res, next) => publicController.getShopProduct(req, res, next));

/**
 * @swagger
 * /api/v1/public/content/{contentTypeSlug}:
 *   get:
 *     summary: List published entries for a content type
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: contentTypeSlug
 *         required: true
 *         schema:
 *           type: string
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: publishedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of published entries
 *       404:
 *         description: Content type not found
 */
router.get('/content/:contentTypeSlug', (req, res, next) =>
  publicController.listPublishedEntries(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/content/{contentTypeSlug}/{entryId}:
 *   get:
 *     summary: Get a single published entry
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: contentTypeSlug
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entry found
 *       404:
 *         description: Entry not found or not published
 */
router.get('/content/:contentTypeSlug/:entryId', (req, res, next) =>
  publicController.getPublishedEntry(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/search:
 *   get:
 *     summary: Search published entries
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Missing search query
 */
router.get('/search', (req, res, next) =>
  publicController.searchPublishedEntries(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/media/{id}:
 *   get:
 *     summary: Resolve a media item by id to its public file info (url, size, type)
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public media info
 *       404:
 *         description: Media not found
 */
router.get('/media/:id', (req, res, next) => publicController.getMedia(req, res, next));

/**
 * @swagger
 * /api/v1/public/forms/{formSlug}:
 *   get:
 *     summary: Get contact form schema by slug
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact form schema
 *       404:
 *         description: Form not found
 */
router.get('/forms/:formSlug', (req, res, next) =>
  publicController.getForm(req, res, next)
);

/**
 * @swagger
 * /api/v1/public/forms/{formSlug}/submit:
 *   post:
 *     summary: Submit a contact form
 *     tags: [Public API]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: formSlug
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Submission received
 *       400:
 *         description: Validation error
 *       404:
 *         description: Form not found
 */
router.post('/forms/:formSlug/submit', formSubmitLimiter, (req, res, next) =>
  publicController.submitForm(req, res, next)
);

export default router;
