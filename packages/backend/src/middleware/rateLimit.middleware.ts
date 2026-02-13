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
