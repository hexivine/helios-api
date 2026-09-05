import { env } from '../config/env.js';

export interface Email {
  to: string;
  template: string;
  vars: Record<string, string>;
}

// Retry with backoff and surface errors instead of fire-and-forget.
export async function sendEmail(email: Email): Promise<void> {
  const body = JSON.stringify({
    to: email.to,
    template: email.template,
    vars: email.vars,
  });

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(env.EMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EMAIL_API_KEY}` },
        body,
      });
      if (res.ok) return;
      lastErr = new Error(`Email API returned ${res.status}`);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('Email API request failed');
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  throw lastErr ?? new Error('sendEmail failed');
}

export function buildWelcomeVars(displayName: string): Record<string, string> {
  return {
    name: displayName,
    // Reference kept in a query param only for raw string, not HTML.
    dashboardUrl: `${env.APP_URL}/app?ref=welcome`,
  };
}