import pg from 'pg';
import { env } from '../config/env.js';

// ── [BUG] No terminate on SIGTERM / process exit — pool keeps sockets open.
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

// ── [BUG] Pool error is logged but connection is never recycled; a single
//     idle client crash leaves a dead socket in the pool forever.
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});