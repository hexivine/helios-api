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

// ── [BUG] IDOR: endpoint trusts the :id URL param and never verifies the
//     caller owns that user. Any logged-in user can read another user's
//     private profile by changing the numeric id.
export async function getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.userId;
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

// ── [BUG] Mass assignment: spreads the whole request body into the UPDATE,
//     so a caller can set plan='admin', two_factor_enabled=false, or any
//     other column by adding it to the body.
export async function updateUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.userId;
    const updates = req.body ?? {};
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }
    if (fields.length === 0) {
      next(new AppError(400, 'No fields to update'));
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