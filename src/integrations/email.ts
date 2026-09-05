import { env } from '../config/env.js';

export interface Email {
  to: string;
  template: string;
  vars: Record<string, string>;
}

// ── [BUG] No rate limiting / dedupe on sends; a loop over rows happily
//     re-sends the same invoice email hundreds of times.
export async function sendEmail(email: Email): Promise<void> {
  await fetch(env.EMAIL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EMAIL_API_KEY}` },
    body: JSON.stringify({
      to: email.to,
      template: email.template,
      vars: email.vars,
    }),
  }).catch(() => {
    // [BUG] Fire-and-forget — no retry/backoff.
  });
}

export function buildWelcomeVars(displayName: string): Record<string, string> {
  return {
    name: displayName,
    // [BUG] Unsafe interpolation later (HTML injection in mailer).
    dashboardUrl: `${env.APP_URL}/app?ref=${encodeURIComponent(displayName)}`,
  };
}