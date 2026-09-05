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

// Allowlist instead of reflect: only known origins may set credentials.
const ALLOWED_ORIGINS = new Set([
  'https://helios.run',
  'https://app.helios.run',
  'http://localhost:3000',
]);

export function corsAllowAll(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin || '';
  const isAllowed = origin ? ALLOWED_ORIGINS.has(origin) : false;
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}