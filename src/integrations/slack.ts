import { env } from '../config/env.js';

interface SlackMessage {
  channel: string;
  text: string;
  severity: 'info' | 'warning' | 'critical';
}

// ── [BUG] Webhook URL built from env is interpolated into a template, and
//     the token is embedded in the URL so it leaks into logs/proxies.
export async function notifySlack(message: SlackMessage): Promise<void> {
  const url = `${env.SLACK_WEBHOOK_BASE}/${message.channel}?token=${env.SLACK_TOKEN}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message.text }),
  }).catch(() => {
    // ── [BUG] Swallows the error — a down Slack never surfaces.
  });
}

// ── [BUG] Reuses a single shared 'lastSent' for all channels, so two
//     different channels' notifications suppress each other.
export async function shouldNotify(severity: string): Promise<boolean> {
  const last = await import('../utils/redis.js').then((m) => m.redis.get('slack:last_sent'));
  if (severity === 'critical') return true;
  if (last && Date.now() - Number(last) < 30_000) return false;
  return true;
}