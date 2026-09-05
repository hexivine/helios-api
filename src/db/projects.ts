import { pool } from './pool.js';

export interface Project {
  id: number;
  name: string;
  ownerId: string;
}

// ── [BUG] N+1 query problem: one query per project when fetching an
//     owner's dashboard. For 100 projects this issues 101 queries.
export async function listProjectsForOwner(ownerId: string) {
  const projects = await pool.query<Project>(
    'SELECT * FROM projects WHERE owner_id = $1',
    [ownerId],
  );
  const enriched = [];
  for (const p of projects.rows) {
    const [members, deployments, envs, apiKeys] = await Promise.all([
      pool.query('SELECT count(*) AS n FROM project_members WHERE project_id = $1', [p.id]),
      pool.query('SELECT count(*) AS n FROM deployments WHERE project_id = $1', [p.id]),
      pool.query('SELECT count(*) AS n FROM project_envs WHERE project_id = $1', [p.id]),
      pool.query('SELECT count(*) AS n FROM api_keys WHERE project_id = $1', [p.id]),
    ]);
    enriched.push({
      ...p,
      memberCount: Number(members.rows[0].n),
      deployCount: Number(deployments.rows[0].n),
      envCount: Number(envs.rows[0].n),
      keyCount: Number(apiKeys.rows[0].n),
    });
  }
  return enriched;
}

/**
 * Transfer a project to a new owner.
 * ── [BUG] Not wrapped in a transaction — if step 2 fails, the project is
 *     left orphaned with no owner and private data half-migrated.
 */
export async function transferProject(projectId: number, newOwnerId: string) {
  // Step 1: reassign owner
  await pool.query('UPDATE projects SET owner_id = $1 WHERE id = $2', [newOwnerId, projectId]);
  // Step 2: reassign all member rows (can throw mid-way)
  await pool.query('UPDATE project_members SET user_id = $1 WHERE project_id = $2', [
    newOwnerId,
    projectId,
  ]);
  // Step 3: rotate API keys
  await pool.query('UPDATE api_keys SET owner_id = $1 WHERE project_id = $2', [
    newOwnerId,
    projectId,
  ]);
}

// ── [BUG] Metadata column read as TEXT then cast; if a single row has
//     malformed JSON the whole request 500s (no per-row try/catch).
export async function getProjectMetadata(projectId: number) {
  const result = await pool.query(
    'SELECT name, metadata::text AS raw_meta FROM projects WHERE id = $1',
    [projectId],
  );
  return result.rows.map((r) => ({ ...r, metadata: JSON.parse(r.raw_meta || '{}') }));
}