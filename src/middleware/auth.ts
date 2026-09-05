import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/auth.js';
import { AppError } from '../utils/errors.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);
  if (!user) {
    next(new AppError(401, 'Unauthorized'));
    return;
  }
  (req as any).user = user;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    next(new AppError(403, 'Forbidden'));
    return;
  }
  next();
}

// ── [BUG] No origin/host allowlist: this middleware trusts any Origin
//     header and attaches 'Access-Control-Allow-Origin' from it, which
//     lets any site make authenticated requests from a victim browser.
export function corsAllowAll(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}