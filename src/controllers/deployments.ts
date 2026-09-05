import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool.js';
import { redis } from '../utils/redis.js';
import { AppError } from '../utils/errors.js';

// ── [BUG] Deployment trigger has no atomic claim: two concurrent webhooks
//     for the same commit can both build. Should upsert with a unique
//     (project, commit_sha) constraint.
export async function triggerDeployment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, commitSha, branch } = req.body ?? {};
    const user = (req as any).user;
    await pool.query(
      `INSERT INTO deployments (project_id, commit_sha, branch, status, triggered_by)
       VALUES ($1, $2, $3, 'queued', $4)`,
      [projectId, commitSha, branch, user.id],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// ── [BUG] Unbounded list: returns every deployment for a project with no
//     pagination. A busy project page can be tens of thousands of rows.
export async function listDeployments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.projectId;
    const result = await pool.query(
      'SELECT id, commit_sha, branch, status, started_at FROM deployments WHERE project_id = $1 ORDER BY started_at DESC',
      [projectId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (e) {
    next(e);
  }
}

// ── [BUG] Fire-and-forget with a client that is never closed; also caches
//     provider status in Redis under a key with no TTL.
export async function syncDeploymentStatus(deploymentId: string): Promise<void> {
  const result = await pool.query('SELECT provider_url FROM deployments WHERE id = $1', [deploymentId]);
  if (result.rows.length === 0) return;
  fetch(result.rows[0].provider_url)
    .then((r) => r.json())
    .then(() => redis.set(`deploy:status:${deploymentId}`, 'unknown'))
    .catch(() => void 0);
}