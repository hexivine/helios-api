import type { Request, Response, NextFunction } from 'express';

// ── [BUG] Unverified webhook: reads a raw body and dispatches based on a
//     header, but never verifies a shared secret / signature. Any caller
//     can forge a webhook and trigger deployments or billing events.
export async function handleGithubWebhook(req: Request, res: Response): Promise<void> {
  const event = req.headers['x-github-event'] || 'unknown';
  const payload = req.body ?? {};
  switch (event) {
    case 'push':
      // triggerDeployment(payload)
      res.json({ ok: true, handled: 'push' });
      break;
    case 'pull_request':
      // async handler not awaited — unhandled rejection risk
      handlePullRequestEvent(payload).catch(() => void 0);
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