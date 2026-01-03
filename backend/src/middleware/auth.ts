import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

export async function authenticateAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const logger = (await import('../utils/logger')).logger;
  
  logger.info('[Auth Middleware] ===== Authentication Check Start =====');
  logger.info('[Auth Middleware] Request path:', req.path);
  logger.info('[Auth Middleware] Request method:', req.method);
  logger.info('[Auth Middleware] Request headers:', {
    authorization: req.headers.authorization ? 'Bearer ***' : 'none',
    'content-type': req.headers['content-type'],
    origin: req.headers.origin,
  });
  
  // Step 1: Extract token
  const authHeader = req.headers.authorization;
  logger.info('[Auth Middleware] Step 1: Extract token from Authorization header');
  logger.info('[Auth Middleware] Authorization header:', authHeader ? 'present' : 'missing');
  
  if (!authHeader) {
    logger.warn('[Auth Middleware] No Authorization header found');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  logger.info('[Auth Middleware] Token extracted:', {
    length: token.length,
    preview: token.substring(0, 20) + '...',
  });
  
  if (!token) {
    logger.warn('[Auth Middleware] Token is empty after removing Bearer prefix');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Step 2: Verify token
  logger.info('[Auth Middleware] Step 2: Verify JWT token');
  const jwtSecret = process.env.JWT_SECRET || 'secret';
  logger.info('[Auth Middleware] JWT_SECRET:', jwtSecret ? 'set' : 'using default');
  
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: number; username: string; role: string };
    logger.info('[Auth Middleware] Token verified successfully:', {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    });
    
    // Step 3: Check admin role
    logger.info('[Auth Middleware] Step 3: Check admin role');
    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };
    
    if (decoded.role !== 'admin') {
      logger.warn('[Auth Middleware] User is not admin:', decoded.role);
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    logger.info('[Auth Middleware] ===== Authentication Check Success =====');
    logger.info('[Auth Middleware] Proceeding to next middleware/route handler');
    next();
  } catch (error) {
    logger.error('[Auth Middleware] ===== Authentication Check Failed =====');
    logger.error('[Auth Middleware] Token verification error:', error);
    logger.error('[Auth Middleware] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    logger.error('[Auth Middleware] Error message:', error instanceof Error ? error.message : String(error));
    logger.error('[Auth Middleware] ========================================');
    res.status(401).json({ error: 'Invalid token' });
  }
}

