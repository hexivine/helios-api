# CodePeel Test App

A **deliberately complex** Node.js/TypeScript backend, purpose-built to
demonstrate the CodePeel VS Code extension's inline code review. The code
is realistic but intentionally **seeded with security, concurrency, and
architecture flaws**.

> ⚠️ **NOT for production.** Every flaw is marked with a `[BUG]` comment so
> reviewers (and CodePeel) can find them easily.

## Stack

- Express 4 (REST API)
- PostgreSQL via `pg`
- Redis via `ioredis`
- JWT auth via `jsonwebtoken` + `bcryptjs`
- TypeScript, strict mode

## Seeded flaw map

| Area | Flaw |
|------|------|
| `src/auth/auth.ts` | Hardcoded JWT fallback secret · SQL injection in `findUserByEmail`/`login` · missing `session_version` claim · lax reset-token validation · JWT algorithm-confusion in `verifyToken` |
| `src/db/projects.ts` | N+1 query in `listProjectsForOwner` · non-transactional `transferProject` · malformed-JSON 500s in `getProjectMetadata` |
| `src/db/pool.ts` | Pool never drained on shutdown · dead-socket leak on idle error |
| `src/services/billing.ts` | Lost-update race in `deductBalance` · unbounded cache keys (no TTL) · non-idempotent invoice reconcile |
| `src/services/repository.ts` | Command injection in `cloneRepository` · off-by-one in `paginate` · unawaited `forEach` async · unbounded memo cache |
| `src/utils/redis.ts` | No retry strategy · health-failure counter grows forever |
| `src/utils/errors.ts` | `toSafeError` swallows original stack |
| `src/config/env.ts` | Env snapshot at import; secrets rotation sticky |
| `src/api/routes.ts` | Missing auth on `/users/:id/projects` · unhandled rejection in `/usage` · no zod validation · `Number()` coercion bugs |
| `src/index.ts` | Missing global error handler · unawaited health query · error detail leak |

## Install & run

```bash
npm install
npm run dev
```

Point a `.env` at a Postgres URL (`DATABASE_URL`) and Redis (`REDIS_URL`).