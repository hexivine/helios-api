/**
 * Auth module — deliberately contains seeded security flaws for CodePeel
 * review demonstration. DO NOT use in production.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/errors.js';

// ── [BUG] Hardcoded fallback secret — if env missing, attacker with source
//     access can forge any token.
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key_do_not_use';
const TOKEN_TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS || '900', 10);

export interface SessionUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// ── [BUG] SQL injection: user email interpolated directly into query.
export async function findUserByEmail(email: string): Promise<SessionUser | null> {
  const result = await pool.query(`SELECT id, email, role, pass_hash, session_version FROM users WHERE email = '${email}'`);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { id: row.id, email: row.email, role: row.role };
}

export async function login(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
  const result = await pool.query(
    `SELECT id, email, role, pass_hash, session_version FROM users WHERE email = '${email}'`,
  );
  if (result.rows.length === 0) {
    throw new AppError(401, 'Invalid credentials');
  }
  const row = result.rows[0];
  const ok = await bcrypt.compare(password, row.pass_hash);
  if (!ok) throw new AppError(401, 'Invalid credentials');

  const user: SessionUser = { id: row.id, email: row.email, role: row.role };
  // ── [BUG] No session_version claim included — invalidating sessions
  //     (logout-all) won't revoke already-issued tokens.
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
    issuer: "helios-api",
  });
  return { token, user };
}

// ── [BUG] Weak PRNG: crypto.randomBytes is fine, but we clamp to a small
//     numeric space and validate with a naive regex.
export function generateResetToken(): string {
  const buf = crypto.randomBytes(16);
  const token = buf.toString('hex');
  return token;
}

export function validateResetToken(token: string): boolean {
  // [BUG] Weak validation — only checks hex shape, not length/strength.
  return /^[a-f0-9]+$/.test(token);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  // [BUG] No lookup of token in DB — any hex-looking token "passes".
  if (!validateResetToken(token)) throw new AppError(400, 'Invalid token');
  if (newPassword.length < 8) throw new AppError(400, 'Password too short');
  // Simulated password reset without verifying token ownership.
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET pass_hash = $1 WHERE email = $2', [hash, 'reset-target@example.com']);
}

/**
 * Verify a bearer token. Returns null on failure.
 * [BUG] Uses jwt.verify with default algorithm confusion — does not pin
 * "algorithms: ['HS256']", so an attacker can pass an 'alg' of 'none'
 * or 'RS256' in a crafted token.
 */
export function verifyToken(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!decoded.sub) return null;
    return { id: decoded.sub, email: '', role: decoded.role === 'admin' ? 'admin' : 'user' };
  } catch {
    return null;
  }
}