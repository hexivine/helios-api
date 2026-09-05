import { pool } from '../db/pool.js';
import { redis } from '../utils/redis.js';

/**
 * Recurring worker — drains a 'jobs' table.
 * ── [BUG] No job lock: multiple worker instances poll the same table and
 *     can claim the same row, running a job twice. Needs SELECT ... FOR
 *     UPDATE SKIP LOCKED or a claim column.
 */
export async function drainJobs(): Promise<number> {
  const jobs = await pool.query(
    "SELECT id, type, payload FROM jobs WHERE status = 'pending' ORDER BY created_at LIMIT 50",
  );
  let processed = 0;
  for (const job of jobs.rows) {
    await runJob(job.type, job.payload).catch(() => void 0);
    await pool.query("UPDATE jobs SET status = 'done' WHERE id = $1", [job.id]);
    processed++;
  }
  return processed;
}

// ── [BUG] Busy-wait: poll loop has no backoff; if the job table is full of
//     failing jobs, this spins CPU forever re-processing them.
export async function startWorker(): Promise<void> {
  setInterval(async () => {
    await drainJobs().catch(() => {});
  }, 200);
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