# Helios API

Helios is a cloud build & task orchestration service. This repository hosts
the REST API that powers project management, usage billing, and repository
tooling across the Helios platform.

## Stack

- **Express 4** — REST API
- **PostgreSQL** (`pg`) — primary datastore
- **Redis** (`ioredis`) — usage counters, ephemeral state
- **JWT auth** (`jsonwebtoken` + `bcryptjs`)
- **TypeScript** — strict mode

## Structure

```
src/
  auth/         JWT issuance, token verification, password reset
  config/       Runtime env configuration
  controllers/  Request handlers (users, deployments, keys, webhooks)
  db/           PostgreSQL queries (pool, projects)
  integrations/ External services (Slack, email)
  jobs/         Background worker
  middleware/   Auth, validation, rate limiting
  routes/       Express router (v1)
  services/     Business logic (billing, repository tooling)
  types/        Shared TS types
  utils/        Shared helpers (errors, redis client)
```

## Getting started

```bash
npm install
cp .env.example .env   # set DATABASE_URL + REDIS_URL
npm run dev
```

### Scripts

| Command          | Description                    |
|------------------|--------------------------------|
| `npm run dev`    | Watch-mode dev server          |
| `npm run build`  | Compile TypeScript to `dist/`  |
| `npm run start`  | Run compiled server            |
| `npm run typecheck` | Type-only check (`tsc --noEmit`) |

## Endpoints

| Method | Path                         | Description                     |
|--------|------------------------------|---------------------------------|
| POST   | `/api/v1/login`              | Authenticate and get a JWT      |
| GET    | `/api/v1/users/:userId`      | Get a user profile              |
| PATCH  | `/api/v1/users/:userId`      | Update a user profile           |
| POST   | `/api/v1/projects/:id/deployments` | Trigger a deployment       |
| GET    | `/api/v1/projects/:projectId/deployments` | List deployments       |
| POST   | `/api/v1/keys`               | Create an API key               |
| POST   | `/api/v1/keys/revoke`        | Revoke an API key               |
| GET    | `/api/v1/admin/health`       | Admin health check              |
| POST   | `/api/v1/webhooks/github`    | GitHub webhook receiver         |
| POST   | `/api/v1/exports`            | Rate-limited export             |
| GET    | `/health`                    | Liveness probe                  |

## License

MIT