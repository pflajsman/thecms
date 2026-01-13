import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { User, UserRole } from '../models/user.model';

// JWT verification (simplified - will be enhanced with proper MSAL validation)
export interface AuthRequest extends Request {
  user?: {
    azureB2CId: string;
    email: string;
    displayName?: string;
    role: UserRole;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authorization token provided', 401);
    }

    const token = authHeader.substring(7);

    // TODO: Implement proper JWT validation with MSAL
    // For now, we'll use a simplified version
    // In production, this should:
    // 1. Validate JWT signature using Azure AD B2C public keys
    // 2. Validate issuer, audience, expiration
    // 3. Extract claims from token

    // Temporary implementation - replace with actual JWT validation
    if (!token) {
      throw new AppError('Invalid token', 401);
    }

    // Parse token (in production, use proper JWT library)
    // This is a placeholder - will be implemented fully when Azure AD B2C is configured
    const decoded = parseToken(token);

    // Find or create user in database
    let user = await User.findOne({ azureB2CId: decoded.sub });

    if (!user) {
      // Create user on first login
      user = await User.create({
        azureB2CId: decoded.sub,
        email: decoded.email || decoded.emails?.[0],
        displayName: decoded.name,
        role: UserRole.EDITOR // Default role
      });
    }

    // Attach user to request
    req.user = {
      azureB2CId: user.azureB2CId,
      email: user.email,
      displayName: user.displayName,
      role: user.role
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Authentication failed', 401));
    }
  }
};

// Role-based authorization middleware
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

// Temporary token parser (replace with proper JWT validation)
function parseToken(token: string): any {
  // In production, use jsonwebtoken library to verify and decode
  // This is just a placeholder
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    throw new AppError('Invalid token', 401);
  }
}
