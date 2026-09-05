import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { pool } from '../db/pool.js';

const execAsync = promisify(exec);

export interface CloneOptions {
  url: string;
  dest: string;
}

/**
 * ── [BUG] Command injection: `url` interpolated into a shell string.
 *     A repo URL like `x; rm -rf /tmp/foo` will execute attacker commands.
 *     Never build shell strings from input — use execFile with args array.
 */
export async function cloneRepository(opts: CloneOptions): Promise<void> {
  await execAsync(`git clone --depth 1 ${opts.url} ${opts.dest}`);
}

// ── [BUG] Off-by-one: slice ends at `limit` exclusive, should be inclusive.
export function paginate<T>(items: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit;
  const end = page * limit; // last item excluded — off-by-one
  return items.slice(start, end);
}

// ── [BUG] Async race: uploads are not awaited sequentially; calling
//     uploadArtifacts() twice in a loop will interleave. Also no error
//     propagation — a failing upload is swallowed.
export async function uploadArtifacts(artifacts: string[]): Promise<void> {
  artifacts.forEach(async (path) => {
    await uploadOne(path).catch(() => void 0);
  });
}

async function uploadOne(path: string): Promise<void> {
  // Stub for an external object-store PUT.
  await new Promise((r) => setTimeout(r, 10));
}

/**
 * ── [BUG] Unbounded in-memory cache + never cleaned up listener pool.
 *     Callers that forget to dispose() leak.
 */
const memo: Record<string, unknown> = {};
export async function cachedRepoInfo(repoId: string): Promise<unknown> {
  if (memo[repoId]) return memo[repoId];
  const res = await pool.query('SELECT * FROM repos WHERE id = $1', [repoId]);
  memo[repoId] = res.rows[0];
  return memo[repoId];
}