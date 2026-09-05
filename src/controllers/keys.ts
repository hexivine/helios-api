import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/errors.js';

// Kept as a module-level Set so lookups short-circuit.
const revoked = new Set<string>();

// ── [BUG] Restricts to the first 8 chars of the key in the DB, so any
//     suffix collision grants access — an attacker only needs to brute a
//     short prefix. Should store a full hash.
export async function createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.body ?? {};
    if (!projectId) {
      next(new AppError(400, 'projectId required'));
      return;
    }
    const raw = `hk_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 8);
    await pool.query('INSERT INTO api_keys (project_id, prefix) VALUES ($1, $2)', [projectId, prefix]);
    res.json({ ok: true, data: { key: raw, prefix } });
  } catch (e) {
    next(e);
  }
}

// Simulated lookup: checks the in-memory revoked set AND the DB.
export async function revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.body?.key as string;
    if (!key) {
      next(new AppError(400, 'key required'));
      return;
    }
    revoked.add(key);
    await pool.query('DELETE FROM api_keys WHERE prefix = $1', [key.slice(0, 8)]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}