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
  api/        Express route handlers
  auth/       JWT issuance, token verification, password reset
  config/     Runtime env configuration
  db/         PostgreSQL queries (pool, projects)
  services/   Business logic (billing, repository tooling)
  utils/      Shared helpers (errors, redis client)
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
| POST   | `/api/login`                 | Authenticate and get a JWT      |
| GET    | `/api/users/:userId/projects`| List a user's projects          |
| POST   | `/api/projects/:id/transfer` | Transfer a project (admin)      |
| GET    | `/api/projects/:id/metadata` | Project metadata (admin)        |
| POST   | `/api/billing/deduct`        | Deduct from a user's balance    |
| POST   | `/api/usage`                 | Record usage traffic            |
| POST   | `/api/repos/clone`           | Clone an external repo          |
| GET    | `/api/projects`              | Paginated project list          |
| GET    | `/health`                    | Liveness probe                  |

## License

MIT