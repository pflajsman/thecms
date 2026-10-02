import type { AuthRequest } from './auth.middleware';
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for public API
 * 1000 requests per hour per API key
 */
export const publicApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each API key to 1000 requests per hour
  message: {
    success: false,
    error: 'Too many requests. Rate limit exceeded (1000 requests per hour).',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use API key as the rate limit key
    const apiKey = req.headers['x-api-key'] as string;
    return apiKey || req.ip || 'unknown';
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Rate limit exceeded (1000 requests per hour).',
    });
  },
});

/**
 * Rate limiter for form submissions
 * 20 submissions per 15 minutes per IP
 */
export const formSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    error: 'Too many submissions. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many submissions. Please try again later.',
    });
  },
});

/**
 * Rate limiter for admin API
 * 500 requests per 15 minutes per user
 */
export const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each user to 500 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID or IP as the rate limit key
    const userId = (req as any).user?.userId;
    return userId || req.ip || 'unknown';
  },
});

/**
 * Rate limiter for placing shop orders
 * 10 orders per minute per site key and IP
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${(req.headers['x-api-key'] as string) || 'none'}:${req.ip || 'unknown'}`,
  // Tests place many orders from one address in a few seconds.
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many orders. Please try again in a minute.' });
  },
});

/**
 * AI generation per user (20 per minute by default; AI_REQUESTS_PER_MINUTE overrides, also in tests)
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => Number(process.env.AI_REQUESTS_PER_MINUTE) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.entraId ?? req.ip ?? 'unknown',
  // Tests call the AI endpoints many times; only the limit test sets AI_REQUESTS_PER_MINUTE.
  skip: () => process.env.NODE_ENV === 'test' && !process.env.AI_REQUESTS_PER_MINUTE,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many AI requests. Please wait a minute.', reason: 'AI_RATE_LIMIT' });
  },
});

/**
 * MCP requests per token (120 per minute; MCP_REQUESTS_PER_MINUTE overrides, also in tests)
 */
export const mcpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => Number(process.env.MCP_REQUESTS_PER_MINUTE) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as { mcp?: { tokenId: string } }).mcp?.tokenId ?? req.ip ?? 'unknown',
  // Tests call MCP many times; only the limit test sets MCP_REQUESTS_PER_MINUTE.
  skip: () => process.env.NODE_ENV === 'test' && !process.env.MCP_REQUESTS_PER_MINUTE,
  handler: (_req, res) => {
    res.status(429).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many MCP requests. Wait a minute.' }, id: null });
  },
});
