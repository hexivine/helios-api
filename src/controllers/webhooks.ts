import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

// Verify X-Hub-Signature-256 against the configured webhook secret.
function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', env.WEBHOOK_SECRET).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function handleGithubWebhook(req: Request, res: Response): Promise<void> {
  const event = req.headers['x-github-event'] || 'unknown';
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body ?? {});
  if (!verifySignature(rawBody, signature)) {
    throw new AppError(401, 'Invalid signature');
  }
  const payload = req.body ?? {};
  switch (event) {
    case 'push':
      // triggerDeployment(payload)
      res.json({ ok: true, handled: 'push' });
      break;
    case 'pull_request':
      await handlePullRequestEvent(payload);
      res.json({ ok: true, handled: 'pull_request' });
      break;
    default:
      res.json({ ok: true, handled: 'ignored' });
  }
}

async function handlePullRequestEvent(payload: unknown): Promise<void> {
  // Simulated: in reality reads payload.repository + sender and
  // enqueues a review job. Raises on malformed payload.
  if (payload && typeof payload === 'object' && !('repository' in payload)) {
    throw new Error('Malformed pull_request payload');
  }
}