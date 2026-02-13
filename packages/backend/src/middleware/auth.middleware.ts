import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { AppError } from './error.middleware';
import { User, UserRole } from '../models/user.model';
import { getAuthConfig, isDevMode } from '../config/auth';

export interface AuthRequest extends Request {
  user?: {
    entraId: string;
    email: string;
    displayName?: string;
    role: UserRole;
  };
}

// In-memory user cache to avoid DB lookup on every request
const userCache = new Map<string, { user: { entraId: string; email: string; displayName?: string; role: UserRole }; expiresAt: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// JWKS client - lazily initialized on first real token validation
let jwksClient: jwksRsa.JwksClient | null = null;

function getJwksClient(): jwksRsa.JwksClient {
  if (!jwksClient) {
    const config = getAuthConfig();
    jwksClient = jwksRsa({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });
  }
  return jwksClient;
}

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      if (!key) return reject(new Error('No signing key found'));
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
}

async function verifyTokenProduction(token: string): Promise<jwt.JwtPayload> {
  const config = getAuthConfig();

  // Decode header first to get kid
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new AppError('Invalid token format', 401);
  }

  const signingKey = await getSigningKey(decoded.header);

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      signingKey,
      {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
      },
      (err, payload) => {
        if (err) return reject(new AppError(`Token validation failed: ${err.message}`, 401));
        resolve(payload as jwt.JwtPayload);
      }
    );
  });
}

function parseTokenDev(token: string): jwt.JwtPayload {
  // Development mode: decode without signature verification
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch {
    throw new AppError('Invalid token', 401);
  }
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
    if (!token) {
      throw new AppError('Invalid token', 401);
    }

    // Validate token: production uses JWKS, dev uses simple decode
    let payload: jwt.JwtPayload;
    if (isDevMode()) {
      payload = parseTokenDev(token);
    } else {
      payload = await verifyTokenProduction(token);
    }

    // Extract email - Entra External ID uses 'email' or 'preferred_username'
    const email = payload.email || payload.preferred_username || payload.emails?.[0];
    const displayName = payload.name || payload.given_name || '';
    const sub = payload.sub || payload.oid;

    if (!sub) {
      throw new AppError('Token missing subject claim', 401);
    }

    // Check cache first to avoid DB query on every request
    const cached = userCache.get(sub);
    if (cached && cached.expiresAt > Date.now()) {
      req.user = cached.user;
      return next();
    }

    // Find or create user in database
    let user = await User.findOne({ entraId: sub }).lean();

    if (!user) {
      user = await User.create({
        entraId: sub,
        email: email,
        displayName: displayName,
        role: UserRole.EDITOR,
      });
    }

    const userData = {
      entraId: user.entraId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };

    // Cache user data
    userCache.set(sub, { user: userData, expiresAt: Date.now() + USER_CACHE_TTL });

    req.user = userData;

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
