import { Request, Response, NextFunction } from 'express';
import { SitesService } from '../modules/sites/sites.service';
import { isValidApiKeyFormat } from '../utils/apiKey';

/**
 * Extend Request to include site information
 */
declare global {
  namespace Express {
    interface Request {
      site?: any;
    }
  }
}

/**
 * API Key Middleware
 * Validates API key from X-API-Key header
 */
export async function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required. Please provide X-API-Key header.',
      });
      return;
    }

    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key format.',
      });
      return;
    }

    // Look up site by API key
    const site = await SitesService.getSiteByApiKey(apiKey);

    if (!site) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive API key.',
      });
      return;
    }

    // Check CORS if allowedOrigins are configured
    const origin = req.headers.origin;
    if (site.allowedOrigins && site.allowedOrigins.length > 0 && origin) {
      if (!site.allowedOrigins.includes(origin)) {
        res.status(403).json({
          success: false,
          error: 'Origin not allowed for this API key.',
        });
        return;
      }
    }

    // Attach site to request for use in controllers
    req.site = site;

    // Increment request count (fire and forget)
    SitesService.incrementRequestCount(site._id).catch((err) => {
      console.error('Failed to increment request count:', err);
    });

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
