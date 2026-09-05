import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pool } from '../db/pool.js';

const execFileAsync = promisify(execFile);

export interface CloneOptions {
  url: string;
  dest: string;
}

/**
 * Clone a repository. Uses execFile with an args array (no shell) so the
 * URL can never be interpreted as shell syntax.
 */
export async function cloneRepository(opts: CloneOptions): Promise<void> {
  await execFileAsync('git', ['clone', '--depth', '1', opts.url, opts.dest]);
}

// Paginate with an inclusive-ish window: `limit` items per page starting at 1.
export function paginate<T>(items: T[], page: number, limit: number): T[] {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const start = (safePage - 1) * safeLimit;
  return items.slice(start, start + safeLimit);
}

// Await all uploads and let failures propagate to the caller.
export async function uploadArtifacts(artifacts: string[]): Promise<void> {
  await Promise.all(artifacts.map((path) => uploadOne(path)));
}

async function uploadOne(path: string): Promise<void> {
  // Stub for an external object-store PUT.
  await new Promise((r) => setTimeout(r, 10));
}

// Simple memo with a small cap so memory stays bounded.
const memo: Record<string, unknown> = {};
const MEMO_MAX = 500;
export async function cachedRepoInfo(repoId: string): Promise<unknown> {
  if (memo[repoId]) return memo[repoId];
  const res = await pool.query('SELECT * FROM repos WHERE id = $1', [repoId]);
  memo[repoId] = res.rows[0];
  if (Object.keys(memo).length > MEMO_MAX) {
    // Drop the oldest entry (first key) to bound memory.
    delete memo[Object.keys(memo)[0]];
  }
  return memo[repoId];
}