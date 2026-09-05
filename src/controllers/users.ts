import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/errors.js';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  plan: string;
  twoFactorEnabled: boolean;
}

// Profile is only visible to the owning user (or an admin).
export async function getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const caller = (req as any).user;
    const userId = req.params.userId;
    if (caller.id !== userId && caller.role !== 'admin') {
      next(new AppError(403, 'Forbidden'));
      return;
    }
    const result = await pool.query(
      'SELECT id, email, display_name, plan, two_factor_enabled FROM users WHERE id = $1',
      [userId],
    );
    if (result.rows.length === 0) {
      next(new AppError(404, 'User not found'));
      return;
    }
    res.json({ ok: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
}

// Allow-list of editable columns — blocks mass-assignment.
const EDITABLE_FIELDS = new Set(['display_name', 'email', 'avatar_url']);

export async function updateUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const caller = (req as any).user;
    const userId = req.params.userId;
    if (caller.id !== userId && caller.role !== 'admin') {
      next(new AppError(403, 'Forbidden'));
      return;
    }
    const updates = req.body ?? {};
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (!EDITABLE_FIELDS.has(key)) continue;
      fields.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }
    if (fields.length === 0) {
      next(new AppError(400, 'No editable fields'));
      return;
    }
    values.push(userId);
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`,
      values,
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}