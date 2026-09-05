import { Router, type Request, type Response, type NextFunction } from 'express';
import { login, verifyToken, type SessionUser } from '../auth/auth.js';
import { listProjectsForOwner, transferProject, getProjectMetadata } from '../db/projects.js';
import { deductBalance, recordUsage } from '../services/billing.js';
import { cloneRepository, paginate } from '../services/repository.js';
import { AppError, toSafeError } from '../utils/errors.js';

export const router = Router();

// ── [BUG] Type Coercion Insecurity: `page` and `limit` are parsed with
//     Number() and plugged into paginate untouched. `page=0` yields
//     negative slice start; `limit=0` yields empty result. No zod schema.
function auth(req: Request): SessionUser {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);
  if (!user) throw new AppError(401, 'Unauthorized');
  return user;
}

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body ?? {};
    const { token, user } = await login(email, password);
    res.json({ token, user });
  } catch (e) {
    next(toSafeError(e));
  }
});

// ── [BUG] Unauthorized access: never calls auth() — any anonymous caller
//     can list another user's projects.
router.get('/users/:userId/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.params.userId;
    const projects = await listProjectsForOwner(ownerId);
    res.json({ projects });
  } catch (e) {
    next(toSafeError(e));
  }
});

router.post('/projects/:id/transfer', async (req: Request, res: Response, next: NextFunction) => {
  const user = auth(req);
  try {
    const newOwnerId = req.body.newOwnerId;
    if (user.role !== 'admin') throw new AppError(403, 'Forbidden');
    await transferProject(Number(req.params.id), newOwnerId);
    res.json({ ok: true });
  } catch (e) {
    next(toSafeError(e));
  }
});

router.get('/projects/:id/metadata', async (req: Request, res: Response, next: NextFunction) => {
  const user = auth(req);
  try {
    const meta = await getProjectMetadata(Number(req.params.id));
    res.json({ meta });
  } catch (e) {
    next(toSafeError(e));
  }
});

router.post('/billing/deduct', async (req: Request, res: Response, next: NextFunction) => {
  const user = auth(req);
  try {
    const { amountCents } = req.body ?? {};
    const balance = await deductBalance(user.id, amountCents);
    res.json({ balance });
  } catch (e) {
    next(toSafeError(e));
  }
});

// ── [BUG] Unhandled promise rejection: helper invoked without await; an
//     error here becomes an unhandledRejection that crashes the process
//     in Node with --unhandled-rejections=strict. Also missing try/catch.
router.post('/usage', (req: Request, res: Response) => {
  const user = auth(req);
  recordUsage(req.body);
  res.json({ ok: true });
});

router.post('/repos/clone', async (req: Request, res: Response, next: NextFunction) => {
  const user = auth(req);
  try {
    await cloneRepository({ url: req.body.url, dest: req.body.dest });
    res.json({ ok: true });
  } catch (e) {
    next(toSafeError(e));
  }
});

// ── [BUG] Missing express-async-errors: paginate returns empty on bad
//     input silently, and the route lacks input validation.
router.get('/projects', (req: Request, res: Response) => {
  const user = auth(req);
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const items = paginate([], page, limit);
  res.json({ items });
});