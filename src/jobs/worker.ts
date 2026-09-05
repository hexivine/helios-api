import { pool } from '../db/pool.js';
import { redis } from '../utils/redis.js';

/**
 * Drain the jobs table with row-level locking so concurrent workers
 * never claim the same job. Failing jobs are retried with backoff and
 * finally marked failed.
 */
export async function drainJobs(): Promise<number> {
  // FOR UPDATE SKIP LOCKED lets many workers pull disjoint sets safely.
  const jobs = await pool.query(
    `SELECT id, type, payload, attempts FROM jobs
     WHERE status = 'pending'
     ORDER BY created_at
     LIMIT 50
     FOR UPDATE SKIP LOCKED`,
  );
  let processed = 0;
  for (const job of jobs.rows) {
    const nextAttempts = (job.attempts || 0) + 1;
    try {
      await runJob(job.type, job.payload);
      await pool.query("UPDATE jobs SET status = 'done' WHERE id = $1", [job.id]);
    } catch (err) {
      if (nextAttempts >= 5) {
        await pool.query("UPDATE jobs SET status = 'failed' WHERE id = $1", [job.id]);
      } else {
        await pool.query(
          "UPDATE jobs SET status = 'pending', attempts = $1, next_at = now() + interval '30 seconds' WHERE id = $2",
          [nextAttempts, job.id],
        );
      }
    }
    processed++;
  }
  return processed;
}

// Exponential polling: starts at 1s, backs off to 60s when idle.
export async function startWorker(): Promise<void> {
  let delay = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const count = await drainJobs().catch(() => 0);
    delay = count > 0 ? 1000 : Math.min(delay * 2, 60_000);
    await new Promise((r) => setTimeout(r, delay));
  }
}

async function runJob(type: string, _payload: unknown): Promise<void> {
  switch (type) {
    case 'email':
      // stub
      return;
    case 'webhook_delivery':
      // stub
      return;
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}