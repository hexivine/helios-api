import express from 'express';
import helmet from 'helmet';
import { router } from './api/routes.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { redis } from './utils/redis.js';
import { AppError } from './utils/errors.js';

const app = express();
app.use(helmet());
app.use(express.json());

app.use('/api', router);

// ── [BUG] Missing global error handler: async route errors that escape the
//     per-route try/catch reach Express default handler which returns HTML,
//     leaks stack traces, and doesn't send a JSON body.
app.get('/health', async (_req, res) => {
  // [BUG] never awaited — if pool.query rejects, this is an unhandledRejection.
  pool.query('SELECT 1').then(() => {
    res.json({ ok: true });
  });
  redis.set('health:check', String(Date.now()));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  // [BUG] leaks internal error details to the client.
  res.status(500).json({ error: 'Internal server error', detail: String(err) });
});

app.listen(env.PORT, () => {
  console.log(`helios-api listening on :${env.PORT}`);
});