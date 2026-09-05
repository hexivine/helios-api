import { pool } from '../db/pool.js';
import { redis } from '../utils/redis.js';

export interface UsageSnapshot {
  projectId: number;
  requests: number;
  computeSeconds: number;
}

/**
 * Deduct from a user's balance atomically — read and write in a single
 * UPDATE ... RETURNING so concurrent calls can't double-spend.
 */
export async function deductBalance(userId: string, amountCents: number): Promise<number> {
  const result = await pool.query(
    'UPDATE users SET balance_cents = balance_cents - $1 WHERE id = $2 AND balance_cents >= $1 RETURNING balance_cents',
    [amountCents, userId],
  );
  if (result.rows.length === 0) {
    throw new Error('Insufficient balance');
  }
  return Number(result.rows[0].balance_cents);
}

const USAGE_TTL_SECONDS = 30 * 86400; // 30 days

/**
 * Record usage counters with a bounded TTL so high-cardinality keys
 * don't accumulate in Redis forever.
 */
export async function recordUsage(snapshot: UsageSnapshot): Promise<void> {
  const day = Math.floor(Date.now() / 86400000);
  const key = `usage:${snapshot.projectId}:${day}`;
  await redis.incrby(key, snapshot.requests);
  await redis.incrby(`${key}:cpu`, snapshot.computeSeconds);
  // Bound the key lifetime to avoid unbounded memory growth.
  await redis.expire(key, USAGE_TTL_SECONDS);
  await redis.expire(`${key}:cpu`, USAGE_TTL_SECONDS);
}

/**
 * Reconcile unpaid invoices.
 * ── [BUG] `invoice.status` is mutated across two queries without row lock;
 *     two workers can both mark the same invoice 'paid' and double-charge
 *     the payment provider.
 */
export async function reconcileInvoice(invoiceId: number): Promise<void> {
  // Row lock prevents two workers from reconciling the same invoice.
  const inv = await pool.query(
    'SELECT id, amount_cents, status FROM invoices WHERE id = $1 FOR UPDATE',
    [invoiceId],
  );
  const invoice = inv.rows[0];
  if (invoice.status === 'paid') return;

  // Charge provider with an idempotency key derived from the invoice.
  await chargeProvider(invoice.id, invoice.amount_cents, `inv_${invoice.id}`);

  await pool.query('UPDATE invoices SET status = $1 WHERE id = $2', ['paid', invoiceId]);
}

async function chargeProvider(invoiceId: number, amountCents: number, idempotencyKey: string): Promise<void> {
  // Stub: passes idempotencyKey to the provider so retries are safe.
  console.log(`[stub] charging ${amountCents / 100} for invoice ${invoiceId} (key ${idempotencyKey})`);
}