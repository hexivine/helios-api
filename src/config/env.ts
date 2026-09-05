import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret',
  PORT: Number(process.env.PORT || 3001),
};

// ── [BUG] Env is snapshotted at import time. If the deployment system
//     rotates SECRETS and restarts, the old value lingers until hard
//     restart. Should read lazily.