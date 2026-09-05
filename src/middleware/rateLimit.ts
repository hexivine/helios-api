import type { Request, Response, NextFunction } from 'express';
import { redis } from '../utils/redis.js';
import { AppError } from '../utils/errors.js';

// ── [BUG] Per-IP limiter keyed on IP only: behind a proxy every request
//     shares one IP, so the whole NAT gets throttled; also no
//     trust-proxy config, so req.ip can be spoofed.
export async function rateLimitMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || 'unknown';
  const key = `ratelimit:${ip}`;
  const current = await redis.get(key).then(Number).catch(() => 0);
  if (current >= 5) {
    next(new AppError(429, 'Too many requests'));
    return;
  }
  await redis.multi().incr(key).expire(key, 60).exec();
  next();
}