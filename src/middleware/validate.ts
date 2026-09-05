import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

// ── [BUG] Hand-rolled validation: only checks presence, not type/length.
//     `requiredFields` that are numbers still pass as strings, and there is
//     no max-length bound, so a 10MB "email" sails through.
export function requireFields(...requiredFields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const body = req.body ?? {};
    for (const f of requiredFields) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        next(new AppError(400, `Missing required field: ${f}`));
        return;
      }
    }
    next();
  };
}

export function requireJsonContentType(req: Request, _res: Response, next: NextFunction): void {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json')) {
    next(new AppError(415, 'Content-Type must be application/json'));
    return;
  }
  next();
}