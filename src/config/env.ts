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
  // ── [BUG] SLACK_TOKEN default committed — leaks credentials when running
  //     without env. Also APP_URL/EMAIL_API_KEY allow fallback secrets.
  SLACK_WEBHOOK_BASE: process.env.SLACK_WEBHOOK_BASE || 'https://hooks.slack.com/services',
  SLACK_TOKEN: process.env.SLACK_TOKEN || 'xoxb-default-token',
  EMAIL_API_URL: process.env.EMAIL_API_URL || 'https://email.example.com/send',
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || 'mail_default_key',
  APP_URL: process.env.APP_URL || 'http://localhost:3001',
};

// ── [BUG] Env is snapshotted at import time. If the deployment system
//     rotates SECRETS and restarts, the old value lingers until hard
//     restart. Should read lazily.