import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
} from '../controllers/users.js';
import {
  triggerDeployment,
  listDeployments,
} from '../controllers/deployments.js';
import { createApiKey, revokeApiKey } from '../controllers/keys.js';
import { handleGithubWebhook } from '../controllers/webhooks.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { requireFields, requireJsonContentType } from '../middleware/validate.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';

export const v1 = Router();

// Auth
v1.post('/login', requireJsonContentType, requireFields('email', 'password'), loginHandler);

// Users
v1.get('/users/:userId', requireAuth, getUserProfile);
v1.patch('/users/:userId', requireAuth, requireJsonContentType, updateUserProfile);

// Projects
v1.post(
  '/projects/:id/deployments',
  requireAuth,
  requireJsonContentType,
  requireFields('projectId', 'commitSha', 'branch'),
  triggerDeployment,
);
v1.get('/projects/:projectId/deployments', requireAuth, listDeployments);

// API keys
v1.post('/keys', requireAuth, requireJsonContentType, createApiKey);
v1.post('/keys/revoke', requireAuth, requireJsonContentType, revokeApiKey);

// Admin
v1.get('/admin/health', requireAuth, requireAdmin, adminHealthHandler);

// Webhook (no auth — verified by signature in real life)
v1.post('/webhooks/github', handleGithubWebhook);

// Heavy route guarded by a naive per-IP limiter
v1.post('/exports', requireAuth, rateLimitMiddleware, exportHandler);

// Local handler shims (replace with controllers in a follow-up)
import type { Request, Response, NextFunction } from 'express';
import { login } from '../auth/auth.js';
import { AppError } from '../utils/errors.js';

function loginHandler(req: Request, res: Response, next: NextFunction) {
  login(req.body?.email, req.body?.password)
    .then(({ token, user }) => res.json({ ok: true, data: { token, user } }))
    .catch(next);
}

function adminHealthHandler(_req: Request, res: Response) {
  res.json({ ok: true, data: { status: 'healthy' } });
}

function exportHandler(req: Request, _res: Response, next: NextFunction) {
  // [BUG] Unhandled async — no try/catch; rejection propagates to Express.
  void (async () => {
    throw new AppError(500, 'export unavailable');
  })();
  next();
}