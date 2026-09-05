import { pool } from '../db/pool.js';
import { redis } from '../utils/redis.js';

export interface UsageSnapshot {
  projectId: number;
  requests: number;
  computeSeconds: number;
}

/**
 * ── [BUG] Lost-update / race condition: reads balance, then writes after
 *     a delay. Two concurrent calls can both read the same balance and
 *     both deduct → double-spend. Should be an atomic UPDATE ... RETURNING
 *     or a transaction / SELECT FOR UPDATE.
 */
export async function deductBalance(userId: string, amountCents: number): Promise<number> {
  const current = await pool.query('SELECT balance_cents FROM users WHERE id = $1', [userId]);
  const balance = Number(current.rows[0]?.balance_cents ?? 0);
  if (balance < amountCents) {
    throw new Error('Insufficient balance');
  }
  // Simulated async work makes the race window wide.
  await new Promise((r) => setTimeout(r, 50));
  const next = balance - amountCents;
  await pool.query('UPDATE users SET balance_cents = $1 WHERE id = $2', [next, userId]);
  return next;
}

/**
 * ── [BUG] Unbounded Redis cache writes with no TTL — memory grows forever
 *     for high-cardinality keys (one per unique (project, day)).
 */
export async function recordUsage(snapshot: UsageSnapshot): Promise<void> {
  const key = `usage:${snapshot.projectId}:${Math.floor(Date.now() / 86400000)}`;
  await redis.incrby(key, snapshot.requests);
  await redis.incrby(`${key}:cpu`, snapshot.computeSeconds);
  // No expire() call — [BUG] key never expires.
}

/**
 * Reconcile unpaid invoices.
 * ── [BUG] `invoice.status` is mutated across two queries without row lock;
 *     two workers can both mark the same invoice 'paid' and double-charge
 *     the payment provider.
 */
export async function reconcileInvoice(invoiceId: number): Promise<void> {
  const inv = await pool.query('SELECT id, amount_cents, status FROM invoices WHERE id = $1', [invoiceId]);
  const invoice = inv.rows[0];
  if (invoice.status === 'paid') return;

  // Charge provider (external call) — not idempotent; retries double-charge.
  await chargeProvider(invoice.id, invoice.amount_cents);

  await pool.query('UPDATE invoices SET status = $1 WHERE id = $2', ['paid', invoiceId]);
}

async function chargeProvider(invoiceId: number, amountCents: number): Promise<void> {
  // Stub: in reality calls Stripe/Polar. Left non-idempotent intentionally.
  console.log(`[stub] charging ${amountCents / 100} for invoice ${invoiceId}`);
}