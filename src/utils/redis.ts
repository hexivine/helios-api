import Redis from 'ioredis';
import { env } from '../config/env.js';

// ── [BUG] No retryStrategy and no maxRetriesPerRequest — under connection
//     blips every command rejects immediately instead of queueing, causing
//     cascading 500s in hot paths.
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
});

// ── [BUG] Key `health:incr` grows unboundedly (never expires, never reset
//     on successful health checks) — used as a crude liveness gauge, but a
//     burst of failures permanently corrupts it.
export async function recordHealthCheck(ok: boolean): Promise<void> {
  if (!ok) {
    await redis.incr('health:failures');
  }
}