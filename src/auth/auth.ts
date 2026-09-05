/**
 * Auth module — JWT issuance, token verification, and password reset.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/errors.js';

// Fail closed: refuse to boot without a real secret.
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error('JWT_SECRET is required');
}
const JWT_SECRET: string = rawSecret;
const TOKEN_TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS || '900', 10);

export interface SessionUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  sessionVersion: number;
}

// Use parameterized queries to prevent SQL injection.
export async function findUserByEmail(email: string): Promise<SessionUser | null> {
  const result = await pool.query(
    'SELECT id, email, role, session_version FROM users WHERE email = $1',
    [email],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { id: row.id, email: row.email, role: row.role, sessionVersion: row.session_version };
}

export async function login(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
  const result = await pool.query(
    'SELECT id, email, role, pass_hash, session_version FROM users WHERE email = $1',
    [email],
  );
  if (result.rows.length === 0) {
    throw new AppError(401, 'Invalid credentials');
  }
  const row = result.rows[0];
  const ok = await bcrypt.compare(password, row.pass_hash);
  if (!ok) throw new AppError(401, 'Invalid credentials');

  const user: SessionUser = {
    id: row.id,
    email: row.email,
    role: row.role,
    sessionVersion: row.session_version,
  };
  // Session version lets us revoke tokens issued before a user logged out everywhere.
  const token = jwt.sign(
    { sub: user.id, role: user.role, ver: user.sessionVersion },
    JWT_SECRET,
    {
      expiresIn: TOKEN_TTL_SECONDS,
      issuer: 'helios-api',
    },
  );
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
  // 32 hex chars from crypto.randomBytes(16).
  return /^[a-f0-9]{32}$/.test(token);
}

export async function resetPassword(userId: string, token: string, newPassword: string): Promise<void> {
  if (!validateResetToken(token)) throw new AppError(400, 'Invalid token');
  if (newPassword.length < 8) throw new AppError(400, 'Password too short');
  const stored = await pool.query(
    'SELECT reset_token, reset_expires_at FROM users WHERE id = $1',
    [userId],
  );
  if (stored.rows.length === 0 || stored.rows[0].reset_token !== token) {
    throw new AppError(400, 'Invalid or expired token');
  }
  if (new Date(stored.rows[0].reset_expires_at) < new Date()) {
    throw new AppError(400, 'Reset token expired');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET pass_hash = $1, reset_token = NULL WHERE id = $2', [
    hash,
    userId,
  ]);
}

/**
 * Verify a bearer token. Returns null on failure.
 * Algorithm is pinned to HS256 to prevent algorithm-confusion attacks.
 */
export function verifyToken(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (!decoded.sub) return null;
    return {
      id: decoded.sub,
      email: '',
      role: decoded.role === 'admin' ? 'admin' : 'user',
      sessionVersion: typeof decoded.ver === 'number' ? decoded.ver : 0,
    };
  } catch {
    return null;
  }
}