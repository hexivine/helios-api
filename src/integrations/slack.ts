import { env } from '../config/env.js';

interface SlackMessage {
  channel: string;
  text: string;
  severity: 'info' | 'warning' | 'critical';
}

// Send via Authorization header (token never leaked into URL/logs), with
// bounded retries and a surfaced error instead of silent swallow.
export async function notifySlack(message: SlackMessage): Promise<void> {
  const url = `${env.SLACK_WEBHOOK_BASE}/${message.channel}`;
  const body = JSON.stringify({ text: message.text });

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.SLACK_TOKEN}`,
        },
        body,
      });
      if (res.ok) return;
      lastErr = new Error(`Slack returned ${res.status}`);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('Slack request failed');
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastErr ?? new Error('Slack notify failed');
}

// Per-channel dedupe: separate last-sent key per channel.
export async function shouldNotify(channel: string, severity: string): Promise<boolean> {
  const { redis } = await import('../utils/redis.js');
  const key = `slack:last_sent:${channel}`;
  const last = await redis.get(key);
  if (severity === 'critical') return true;
  if (last && Date.now() - Number(last) < 30_000) return false;
  await redis.set(key, String(Date.now()));
  return true;
}